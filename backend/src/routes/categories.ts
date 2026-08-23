import { Env, Category } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleCategoryRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/categories
  if (path === '' && request.method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'active';

    let query = supabase
      .from('categories')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.order('name', { ascending: true });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ categories: data, total: count });
  }

  // POST /api/categories
  if (path === '' && request.method === 'POST') {
    authorize(user, ['owner', 'manager']);

    const body = await request.json() as Partial<Category>;
    const { name, description } = body;

    if (!name) {
      return error_response('VALIDATION_ERROR', 'Category name is required');
    }

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name)
      .single();

    if (existing) {
      return error_response('CONFLICT', 'Category already exists');
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        description: description || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response(data, 201);
  }

  // PUT /api/categories/:id
  if (path.length > 0 && request.method === 'PUT') {
    authorize(user, ['owner', 'manager']);

    const id = path;
    const body = await request.json() as Partial<Category>;
    const { name, description, status } = body;

    const { data: existing } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return error_response('NOT_FOUND', 'Category not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response(data);
  }

  // DELETE /api/categories/:id (archive)
  if (path.length > 0 && request.method === 'DELETE') {
    authorize(user, ['owner', 'manager']);

    const id = path;
    const { data, error } = await supabase
      .from('categories')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return error_response('NOT_FOUND', 'Category not found', 404);
    }

    return success_response({ message: 'Category archived' });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
