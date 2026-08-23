import { Env } from '../types';
import { success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';
import { MpesaPaymentService } from '../services/mpesa';
import { PayHeroPaymentService } from '../services/payhero';

async function restoreStockForSale(supabase: ReturnType<typeof getSupabaseService>, saleId: string): Promise<void> {
  const { data: items } = await supabase
    .from('sale_items')
    .select('product_id, quantity')
    .eq('sale_id', saleId);

  for (const item of items || []) {
    await supabase.rpc('restore_stock_atomically', {
      p_product_id: item.product_id,
      p_quantity: item.quantity
    });

    await supabase.from('inventory_movements').insert({
      product_id: item.product_id,
      type: 'adjustment',
      quantity: item.quantity,
      reference: saleId,
      notes: 'Stock restored - payment failed/cancelled (webhook)',
      user_id: null
    });
  }
}

/**
 * Neither Safaricom's Daraja callbacks nor PayHero's webhooks are signed, so
 * there's no HMAC to verify. The mitigation is a shared secret embedded in
 * the callback URL itself - configure MPESA_CALLBACK_URL / PAYHERO_CALLBACK_URL
 * as e.g. https://yourapp.workers.dev/api/webhooks/mpesa/<MPESA_WEBHOOK_SECRET>
 * and only requests hitting that exact path are accepted. Without this,
 * anyone who finds/guesses the webhook URL could POST a fake "payment
 * successful" body and get free stock.
 */
function checkSecret(path: string, provider: 'mpesa' | 'payhero', env: Env): { ok: boolean; rest: string } {
  const expected = provider === 'mpesa' ? env.MPESA_WEBHOOK_SECRET : env.PAYHERO_WEBHOOK_SECRET;
  const prefix = `${provider}/`;

  if (!path.startsWith(prefix)) {
    return { ok: false, rest: path };
  }

  const secret = path.slice(prefix.length);

  if (!expected) {
    // Misconfiguration - fail closed rather than silently accepting anything.
    console.error(`${provider.toUpperCase()}_WEBHOOK_SECRET is not configured`);
    return { ok: false, rest: path };
  }

  return { ok: secret === expected, rest: path };
}

export async function handleWebhookRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabaseService(env);

  // POST /api/webhooks/mpesa/<secret>
  if (path.startsWith('mpesa/') && request.method === 'POST') {
    const { ok } = checkSecret(path, 'mpesa', env);
    if (!ok) {
      // 404 rather than 401/403 so an attacker probing the URL can't tell
      // the difference between "wrong secret" and "route doesn't exist".
      return error_response('NOT_FOUND', 'Not found', 404);
    }

    try {
      const body = await request.json();
      const mpesa = new MpesaPaymentService(env);
      const result = await mpesa.handleCallback(body);

      if (!result.reference) {
        return error_response('INVALID_WEBHOOK', 'Missing transaction reference');
      }

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*, sales(user_id)')
        .eq('provider_reference', result.reference)
        .eq('method', 'mpesa')
        .single();

      if (paymentError || !payment) {
        console.error('Payment not found for reference:', result.reference);
        return success_response({ message: 'Payment not found' });
      }

      if (payment.status === 'paid') {
        return success_response({ message: 'Already processed' });
      }

      // Guard against a callback trying to confirm a different amount than
      // what the sale actually expects (defensive, since there's no signature).
      if (result.status === 'PAID' && result.amount !== undefined && Math.abs(payment.amount - result.amount) > 0.01) {
        console.error(`Amount mismatch on mpesa webhook: expected ${payment.amount}, got ${result.amount}`);
        await supabase.from('audit_logs').insert({
          user_id: null,
          action: 'PAYMENT_AMOUNT_MISMATCH',
          entity: 'payment',
          entity_id: payment.id,
          metadata: { expected: payment.amount, received: result.amount, reference: result.reference }
        });
        return error_response('AMOUNT_MISMATCH', 'Callback amount does not match expected sale total');
      }

      const updateData: Record<string, unknown> = {
        status: result.status === 'PAID' ? 'paid' : (result.status === 'CANCELLED' ? 'cancelled' : 'failed'),
        provider_response: JSON.stringify(body)
      };

      if (result.transactionId) {
        updateData.provider_reference = result.transactionId;
      }

      const { error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', payment.id);

      if (updateError) {
        console.error('Payment update error:', updateError);
        return error_response('DATABASE_ERROR', updateError.message);
      }

      if (result.status === 'PAID') {
        await supabase
          .from('sales')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', payment.sale_id);

        await supabase.from('audit_logs').insert({
          user_id: payment.sales?.user_id || null,
          action: 'PAYMENT_CONFIRMED',
          entity: 'payment',
          entity_id: payment.id,
          metadata: {
            method: 'mpesa',
            amount: payment.amount,
            transaction_id: result.transactionId
          }
        });
      } else {
        // Failed/cancelled STK push - the sale never actually happened, so
        // put the reserved stock back instead of leaving it deducted.
        await supabase
          .from('sales')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', payment.sale_id);
        await restoreStockForSale(supabase, payment.sale_id);
      }

      return success_response({ message: 'Webhook processed' });
    } catch (error) {
      console.error('M-Pesa webhook error:', error);
      return error_response('WEBHOOK_ERROR', 'Failed to process webhook');
    }
  }

  // POST /api/webhooks/payhero/<secret>
  if (path.startsWith('payhero/') && request.method === 'POST') {
    const { ok } = checkSecret(path, 'payhero', env);
    if (!ok) {
      return error_response('NOT_FOUND', 'Not found', 404);
    }

    try {
      const body = await request.json();
      const payhero = new PayHeroPaymentService(env);
      const result = await payhero.handleCallback(body);

      if (!result.reference) {
        return error_response('INVALID_WEBHOOK', 'Missing transaction reference');
      }

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*, sales(user_id)')
        .eq('reference', result.reference)
        .eq('method', 'payhero')
        .single();

      if (paymentError || !payment) {
        console.error('Payment not found for reference:', result.reference);
        return success_response({ message: 'Payment not found' });
      }

      if (payment.status === 'paid') {
        return success_response({ message: 'Already processed' });
      }

      if (result.status === 'PAID' && result.amount !== undefined && Math.abs(payment.amount - result.amount) > 0.01) {
        console.error(`Amount mismatch on payhero webhook: expected ${payment.amount}, got ${result.amount}`);
        await supabase.from('audit_logs').insert({
          user_id: null,
          action: 'PAYMENT_AMOUNT_MISMATCH',
          entity: 'payment',
          entity_id: payment.id,
          metadata: { expected: payment.amount, received: result.amount, reference: result.reference }
        });
        return error_response('AMOUNT_MISMATCH', 'Callback amount does not match expected sale total');
      }

      const updateData: Record<string, unknown> = {
        status: result.status === 'PAID' ? 'paid' : (result.status === 'CANCELLED' ? 'cancelled' : 'failed'),
        provider_response: JSON.stringify(body)
      };

      if (result.providerReference) {
        updateData.provider_reference = result.providerReference;
      }

      const { error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', payment.id);

      if (updateError) {
        console.error('Payment update error:', updateError);
        return error_response('DATABASE_ERROR', updateError.message);
      }

      if (result.status === 'PAID') {
        await supabase
          .from('sales')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', payment.sale_id);

        await supabase.from('audit_logs').insert({
          user_id: payment.sales?.user_id || null,
          action: 'PAYMENT_CONFIRMED',
          entity: 'payment',
          entity_id: payment.id,
          metadata: {
            method: 'payhero',
            amount: payment.amount,
            transaction_id: result.providerReference
          }
        });
      } else {
        await supabase
          .from('sales')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', payment.sale_id);
        await restoreStockForSale(supabase, payment.sale_id);
      }

      return success_response({ message: 'Webhook processed' });
    } catch (error) {
      console.error('PayHero webhook error:', error);
      return error_response('WEBHOOK_ERROR', 'Failed to process webhook');
    }
  }

  return error_response('NOT_FOUND', 'Webhook endpoint not found', 404);
}
