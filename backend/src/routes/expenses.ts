import { Env, Expense } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleExpenseRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/expenses
  if (path === '' && request.method === 'GET') {
    authorize(user, ['owner', 'manager']);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const category = url.searchParams.get('category') || '';
    const start_date = url.searchParams.get('start_date') || '';
    const end_date = url.searchParams.get('end_date') || '';

    let query = supabase
      .from('expenses')
      .select('*, users(full_name)', { count: 'exact' });

    if (category) {
      query = query.eq('category', category);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({
      expenses: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  }

  // POST /api/expenses
  if (path === '' && request.method === 'POST') {
    authorize(user, ['owner', 'manager']);

    const body = await request.json() as Partial<Expense>;
    const { category, description, amount } = body;

    if (!category || !description || amount === undefined) {
      return error_response('VALIDATION_ERROR', 'Category, description, and amount are required');
    }

    if (amount < 0) {
      return error_response('VALIDATION_ERROR', 'Amount cannot be negative');
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category,
        description,
        amount,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'EXPENSE_CREATED',
      entity: 'expense',
      entity_id: data.id,
      metadata: { category, amount }
    });

    return success_response(data, 201);
  }

  // PUT /api/expenses/:id
  if (path.startsWith('/') && request.method === 'PUT') {
    authorize(user, ['owner', 'manager']);

    const id = path.slice(1);
    const body = await request.json() as Partial<Expense>;
    const { category, description, amount } = body;

    const { data: existing } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return error_response('NOT_FOUND', 'Expense not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;

    const { data, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response(data);
  }

  // DELETE /api/expenses/:id
  if (path.startsWith('/') && request.method === 'DELETE') {
    authorize(user, ['owner']);

    const id = path.slice(1);
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ message: 'Expense deleted' });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
