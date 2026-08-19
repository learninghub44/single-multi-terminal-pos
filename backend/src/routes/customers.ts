import { Env, Customer } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleCustomerRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/customers
  if (path === '' && request.method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order('name', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({
      customers: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  }

  // POST /api/customers
  if (path === '' && request.method === 'POST') {
    const body = await request.json() as Partial<Customer>;
    const { name, phone, email } = body;

    if (!name) {
      return error_response('VALIDATION_ERROR', 'Customer name is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        phone: phone || null,
        email: email || null
      })
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response(data, 201);
  }

  // GET /api/customers/:id
  if (path.startsWith('/') && request.method === 'GET') {
    const id = path.slice(1);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return error_response('NOT_FOUND', 'Customer not found', 404);
    }

    return success_response(data);
  }

  // PUT /api/customers/:id
  if (path.startsWith('/') && request.method === 'PUT') {
    const id = path.slice(1);
    const body = await request.json() as Partial<Customer>;
    const { name, phone, email } = body;

    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return error_response('NOT_FOUND', 'Customer not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response(data);
  }

  // GET /api/customers/:id/history
  if (path.startsWith('/') && path.endsWith('/history') && request.method === 'GET') {
    const id = path.slice(1, -8);
    const { data, error } = await supabase
      .from('sales')
      .select('*, payments(method, status)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ sales: data });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
