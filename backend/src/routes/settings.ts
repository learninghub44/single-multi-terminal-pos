import { Env, BusinessSettings } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleSettingsRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  // GET is readable by any authenticated role (cashiers need to see the
  // till/paybill number at checkout to tell customers) - only PUT (editing
  // business settings) stays owner-only. Previously the whole route was
  // locked to owner, which meant cashiers couldn't even read the till
  // number the manual-payment checkout screen is supposed to show them.
  if (request.method !== 'GET') {
    authorize(user, ['owner']);
  }
  const supabase = getSupabaseService(env);

  // GET /api/settings
  if (path === '' && request.method === 'GET') {
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      // Return default settings
      return success_response({
        business_name: 'My POS Store',
        logo: null,
        phone: null,
        email: null,
        address: null,
        location: null,
        website: null,
        receipt_footer: 'Thank you for shopping with us!',
        return_policy: null,
        currency: 'KES',
        tax_rate: 0,
        low_stock_default: 5,
        receipt_size: '80mm',
        till_number: null,
        paybill_number: null,
        paybill_account_name: null,
        manual_payment_instructions: null
      });
    }

    return success_response(data);
  }

  // PUT /api/settings
  if (path === '' && request.method === 'PUT') {
    const body = await request.json() as Partial<BusinessSettings>;

    const { data: existing } = await supabase
      .from('business_settings')
      .select('id')
      .limit(1)
      .single();

    const updateData: Record<string, unknown> = {};
    if (body.business_name !== undefined) updateData.business_name = body.business_name;
    if (body.logo !== undefined) updateData.logo = body.logo;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.receipt_footer !== undefined) updateData.receipt_footer = body.receipt_footer;
    if (body.return_policy !== undefined) updateData.return_policy = body.return_policy;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.tax_rate !== undefined) updateData.tax_rate = body.tax_rate;
    if (body.low_stock_default !== undefined) updateData.low_stock_default = body.low_stock_default;
    if (body.receipt_size !== undefined) updateData.receipt_size = body.receipt_size;
    if (body.till_number !== undefined) updateData.till_number = body.till_number;
    if (body.paybill_number !== undefined) updateData.paybill_number = body.paybill_number;
    if (body.paybill_account_name !== undefined) updateData.paybill_account_name = body.paybill_account_name;
    if (body.manual_payment_instructions !== undefined) updateData.manual_payment_instructions = body.manual_payment_instructions;

    updateData.updated_at = new Date().toISOString();

    let data;
    if (existing) {
      const { data: updated, error } = await supabase
        .from('business_settings')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return error_response('DATABASE_ERROR', error.message);
      }
      data = updated;
    } else {
      const { data: created, error } = await supabase
        .from('business_settings')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        return error_response('DATABASE_ERROR', error.message);
      }
      data = created;
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'SETTINGS_CHANGED',
      entity: 'business_settings',
      entity_id: data.id,
      metadata: { changes: updateData }
    });

    return success_response(data);
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
