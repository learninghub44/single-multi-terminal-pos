import { Env } from '../types';
import { authenticate, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';
import { MpesaPaymentService } from '../services/mpesa';
import { PayHeroPaymentService } from '../services/payhero';

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

    // Verify sale exists and is pending
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .eq('status', 'pending')
      .single();

    if (saleError || !sale) {
      return error_response('NOT_FOUND', 'Pending sale not found', 404);
    }

    // Verify amount matches
    if (Math.abs(sale.total - amount) > 0.01) {
      return error_response('VALIDATION_ERROR', 'Amount does not match sale total');
    }

    // Initiate M-Pesa STK Push
    const mpesa = new MpesaPaymentService(env);
    const result = await mpesa.initiatePayment(phone, amount, sale.receipt_number);

    if (result.status === 'FAILED') {
      return error_response('PAYMENT_FAILED', result.message || 'Failed to initiate M-Pesa payment');
    }

    // Update payment record
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'pending',
        phone,
        reference: result.reference,
        provider_reference: result.provider_reference,
        provider_response: JSON.stringify(result.raw_response)
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

    // Verify sale exists and is pending
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .eq('status', 'pending')
      .single();

    if (saleError || !sale) {
      return error_response('NOT_FOUND', 'Pending sale not found', 404);
    }

    // Verify amount matches
    if (Math.abs(sale.total - amount) > 0.01) {
      return error_response('VALIDATION_ERROR', 'Amount does not match sale total');
    }

    // Initiate PayHero payment
    const payhero = new PayHeroPaymentService(env);
    const result = await payhero.initiatePayment(phone, amount, sale.receipt_number);

    if (result.status === 'FAILED') {
      return error_response('PAYMENT_FAILED', result.message || 'Failed to initiate PayHero payment');
    }

    // Update payment record
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'pending',
        phone,
        reference: result.reference,
        provider_reference: result.provider_reference,
        provider_response: JSON.stringify(result.raw_response)
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

    // Check status with provider if pending
    if (payment.status === 'pending' && payment.provider === 'mpesa') {
      const mpesa = new MpesaPaymentService(env);
      const status = await mpesa.checkPaymentStatus(payment.provider_reference || '');
      if (status) {
        await supabase
          .from('payments')
          .update({ status: status.status })
          .eq('id', paymentId);
        payment.status = status.status;
      }
    }

    if (payment.status === 'pending' && payment.provider === 'payhero') {
      const payhero = new PayHeroPaymentService(env);
      const status = await payhero.checkPaymentStatus(payment.provider_reference || '');
      if (status) {
        await supabase
          .from('payments')
          .update({ status: status.status })
          .eq('id', paymentId);
        payment.status = status.status;
      }
    }

    return success_response(payment);
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
