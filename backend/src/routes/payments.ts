import { Env } from '../types';
import { authenticate, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';
import { MpesaPaymentService } from '../services/mpesa';
import { PayHeroPaymentService } from '../services/payhero';

// Provider status strings are uppercase ('PAID'/'FAILED'/...); the payments
// table's status column is constrained to lowercase values. Every write path
// must go through this map or the update silently violates the CHECK
// constraint and never actually lands.
function toDbStatus(status: string): string {
  return status.toLowerCase();
}

async function restoreStockForSale(supabase: ReturnType<typeof getSupabaseService>, saleId: string, userId: string): Promise<void> {
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
      notes: 'Stock restored - payment failed/cancelled',
      user_id: userId
    });
  }
}

export async function handlePaymentRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // POST /api/payments/mpesa/initiate
  if (path === 'mpesa/initiate' && request.method === 'POST') {
    const body = await request.json() as {
      sale_id: string;
      phone: string;
      amount: number;
    };

    const { sale_id, phone, amount } = body;

    if (!sale_id || !phone || !amount) {
      return error_response('VALIDATION_ERROR', 'Sale ID, phone, and amount are required');
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .eq('status', 'pending')
      .single();

    if (saleError || !sale) {
      return error_response('NOT_FOUND', 'Pending sale not found', 404);
    }

    if (Math.abs(sale.total - amount) > 0.01) {
      return error_response('VALIDATION_ERROR', 'Amount does not match sale total');
    }

    const mpesa = new MpesaPaymentService(env);
    const result = await mpesa.initiatePayment(phone, amount, sale.receipt_number);

    if (result.status === 'FAILED') {
      return error_response('PAYMENT_FAILED', result.message || 'Failed to initiate M-Pesa payment');
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'pending',
        phone,
        reference: result.reference,
        provider_reference: result.provider_reference,
        provider_response: JSON.stringify(result.raw_response),
        // Give the customer 3 minutes to respond to the STK prompt before we
        // consider it stale and eligible for auto-cancel/restock.
        expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString()
      })
      .eq('sale_id', sale_id)
      .eq('method', 'mpesa');

    if (updateError) {
      return error_response('DATABASE_ERROR', updateError.message);
    }

    return success_response({
      status: 'PENDING',
      message: 'STK Push sent. Waiting for customer to enter PIN.',
      checkout_request_id: result.checkout_request_id
    });
  }

  // POST /api/payments/payhero/initiate
  if (path === 'payhero/initiate' && request.method === 'POST') {
    const body = await request.json() as {
      sale_id: string;
      phone: string;
      amount: number;
    };

    const { sale_id, phone, amount } = body;

    if (!sale_id || !phone || !amount) {
      return error_response('VALIDATION_ERROR', 'Sale ID, phone, and amount are required');
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .eq('status', 'pending')
      .single();

    if (saleError || !sale) {
      return error_response('NOT_FOUND', 'Pending sale not found', 404);
    }

    if (Math.abs(sale.total - amount) > 0.01) {
      return error_response('VALIDATION_ERROR', 'Amount does not match sale total');
    }

    const payhero = new PayHeroPaymentService(env);
    const result = await payhero.initiatePayment(phone, amount, sale.receipt_number);

    if (result.status === 'FAILED') {
      return error_response('PAYMENT_FAILED', result.message || 'Failed to initiate PayHero payment');
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'pending',
        phone,
        reference: result.reference,
        provider_reference: result.provider_reference,
        provider_response: JSON.stringify(result.raw_response),
        expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString()
      })
      .eq('sale_id', sale_id)
      .eq('method', 'payhero');

    if (updateError) {
      return error_response('DATABASE_ERROR', updateError.message);
    }

    return success_response({
      status: 'PENDING',
      message: 'Payment request sent. Waiting for confirmation.',
      transaction_id: result.transaction_id
    });
  }

  // POST /api/payments/manual/initiate
  // For shops without M-Pesa/PayHero API access: cashier tells the customer
  // to pay to a till/paybill number directly, then confirms once they've
  // physically seen the M-Pesa confirmation SMS. No third-party API call.
  if (path === 'manual/initiate' && request.method === 'POST') {
    const body = await request.json() as {
      sale_id: string;
      till_reference?: string;
      confirmation_code?: string;
      phone?: string;
    };

    const { sale_id, till_reference, confirmation_code, phone } = body;

    if (!sale_id) {
      return error_response('VALIDATION_ERROR', 'Sale ID is required');
    }
    if (!confirmation_code || !confirmation_code.trim()) {
      return error_response('VALIDATION_ERROR', 'Enter the M-Pesa confirmation code shown on the customer\'s message before confirming');
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .eq('status', 'pending')
      .single();

    if (saleError || !sale) {
      return error_response('NOT_FOUND', 'Pending sale not found', 404);
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        phone: phone || null,
        reference: till_reference || null,
        provider_reference: confirmation_code.trim().toUpperCase(),
        confirmed_by: user.id
      })
      .eq('sale_id', sale_id)
      .eq('method', 'manual')
      .select()
      .single();

    if (paymentError) {
      return error_response('DATABASE_ERROR', paymentError.message);
    }

    await supabase
      .from('sales')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sale_id);

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'MANUAL_PAYMENT_CONFIRMED',
      entity: 'payment',
      entity_id: payment?.id || null,
      metadata: { sale_id, confirmation_code, till_reference }
    });

    return success_response({ status: 'PAID', payment });
  }

  // POST /api/payments/:id/cancel
  // Cancels a still-pending mobile-money or manual payment (customer backed
  // out, STK timed out, wrong number, etc.) and restores the deducted stock.
  if (path.endsWith('/cancel') && request.method === 'POST') {
    const paymentId = path.replace('/cancel', '');

    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (findError || !payment) {
      return error_response('NOT_FOUND', 'Payment not found', 404);
    }

    if (payment.status !== 'pending') {
      return error_response('CONFLICT', `Payment already ${payment.status}, nothing to cancel`, 409);
    }

    await supabase
      .from('payments')
      .update({ status: 'cancelled' })
      .eq('id', paymentId);

    await supabase
      .from('sales')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', payment.sale_id);

    await restoreStockForSale(supabase, payment.sale_id, user.id);

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'PAYMENT_CANCELLED',
      entity: 'payment',
      entity_id: payment.id,
      metadata: { sale_id: payment.sale_id, method: payment.method }
    });

    return success_response({ status: 'CANCELLED' });
  }

  // GET /api/payments/:id/status
  if (path.endsWith('/status') && request.method === 'GET') {
    const paymentId = path.replace('/status', '');
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return error_response('NOT_FOUND', 'Payment not found', 404);
    }

    if (payment.status === 'pending' && payment.provider === 'mpesa') {
      const mpesa = new MpesaPaymentService(env);
      const status = await mpesa.checkPaymentStatus(payment.provider_reference || '');
      if (status && status.status && status.status !== 'PENDING') {
        await applyProviderStatus(supabase, payment, status.status, user.id);
        payment.status = toDbStatus(status.status);
      }
    }

    if (payment.status === 'pending' && payment.provider === 'payhero') {
      const payhero = new PayHeroPaymentService(env);
      const status = await payhero.checkPaymentStatus(payment.provider_reference || '');
      if (status && status.status && status.status !== 'PENDING') {
        await applyProviderStatus(supabase, payment, status.status, user.id);
        payment.status = toDbStatus(status.status);
      }
    }

    // Sweep: if a pending mobile-money payment has passed its expiry with no
    // resolution from either the webhook or a poll, auto-cancel and restock
    // rather than leaving inventory locked up indefinitely.
    if (payment.status === 'pending' && payment.expires_at && new Date(payment.expires_at) < new Date()) {
      await supabase.from('payments').update({ status: 'expired' }).eq('id', payment.id);
      await supabase.from('sales').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', payment.sale_id);
      await restoreStockForSale(supabase, payment.sale_id, user.id);
      payment.status = 'expired';
    }

    return success_response(payment);
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}

async function applyProviderStatus(
  supabase: ReturnType<typeof getSupabaseService>,
  payment: { id: string; sale_id: string },
  providerStatus: string,
  userId: string
): Promise<void> {
  const dbStatus = toDbStatus(providerStatus);

  await supabase.from('payments').update({ status: dbStatus }).eq('id', payment.id);

  if (dbStatus === 'paid') {
    await supabase
      .from('sales')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', payment.sale_id);
  } else if (dbStatus === 'failed' || dbStatus === 'cancelled') {
    await supabase
      .from('sales')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', payment.sale_id);
    await restoreStockForSale(supabase, payment.sale_id, userId);
  }
}
