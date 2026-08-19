import { Env } from '../types';
import { success_response, error_response, json_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';
import { MpesaPaymentService } from '../services/mpesa';
import { PayHeroPaymentService } from '../services/payhero';

export async function handleWebhookRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabaseService(env);

  // POST /api/webhooks/mpesa
  if (path === 'mpesa' && request.method === 'POST') {
    try {
      const body = await request.json();
      const mpesa = new MpesaPaymentService(env);
      const result = await mpesa.handleCallback(body);

      if (!result.reference) {
        return error_response('INVALID_WEBHOOK', 'Missing transaction reference');
      }

      // Find payment by provider reference
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('provider_reference', result.reference)
        .eq('method', 'mpesa')
        .single();

      if (paymentError || !payment) {
        console.error('Payment not found for reference:', result.reference);
        return success_response({ message: 'Payment not found' });
      }

      // Idempotency check - don't process if already paid
      if (payment.status === 'paid') {
        return success_response({ message: 'Already processed' });
      }

      // Update payment status
      const updateData: Record<string, unknown> = {
        status: result.status === 'PAID' ? 'paid' : 'failed',
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

      // If payment successful, complete the sale
      if (result.status === 'PAID') {
        // Update sale status
        await supabase
          .from('sales')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.sale_id);

        // Audit log
        await supabase.from('audit_logs').insert({
          user_id: payment.sale_id,
          action: 'PAYMENT_CONFIRMED',
          entity: 'payment',
          entity_id: payment.id,
          metadata: {
            method: 'mpesa',
            amount: payment.amount,
            transaction_id: result.transactionId
          }
        });
      }

      return success_response({ message: 'Webhook processed' });
    } catch (error) {
      console.error('M-Pesa webhook error:', error);
      return error_response('WEBHOOK_ERROR', 'Failed to process webhook');
    }
  }

  // POST /api/webhooks/payhero
  if (path === 'payhero' && request.method === 'POST') {
    try {
      const body = await request.json();
      const payhero = new PayHeroPaymentService(env);
      const result = await payhero.handleCallback(body);

      if (!result.reference) {
        return error_response('INVALID_WEBHOOK', 'Missing transaction reference');
      }

      // Find payment by external reference
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('reference', result.reference)
        .eq('method', 'payhero')
        .single();

      if (paymentError || !payment) {
        console.error('Payment not found for reference:', result.reference);
        return success_response({ message: 'Payment not found' });
      }

      // Idempotency check
      if (payment.status === 'paid') {
        return success_response({ message: 'Already processed' });
      }

      // Update payment status
      const updateData: Record<string, unknown> = {
        status: result.status === 'PAID' ? 'paid' : 'failed',
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

      // If payment successful, complete the sale
      if (result.status === 'PAID') {
        await supabase
          .from('sales')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.sale_id);

        await supabase.from('audit_logs').insert({
          user_id: payment.sale_id,
          action: 'PAYMENT_CONFIRMED',
          entity: 'payment',
          entity_id: payment.id,
          metadata: {
            method: 'payhero',
            amount: payment.amount,
            transaction_id: result.providerReference
          }
        });
      }

      return success_response({ message: 'Webhook processed' });
    } catch (error) {
      console.error('PayHero webhook error:', error);
      return error_response('WEBHOOK_ERROR', 'Failed to process webhook');
    }
  }

  return error_response('NOT_FOUND', 'Webhook endpoint not found', 404);
}
