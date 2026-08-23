import { Env, Product, ApiResponse } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleProductRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/products
  if (path === '' && request.method === 'GET') {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const category_id = url.searchParams.get('category_id') || '';
    const status = url.searchParams.get('status') || 'active';

    let query = supabase
      .from('products')
      .select('*, categories(name)', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({
      products: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  }

  // POST /api/products
  if (path === '' && request.method === 'POST') {
    authorize(user, ['owner', 'manager']);

    const body = await request.json() as Partial<Product>;
    const { name, sku, barcode, category_id, buying_price, selling_price, stock_quantity, low_stock_threshold, unit, description } = body;

    if (!name) {
      return error_response('VALIDATION_ERROR', 'Product name is required');
    }
    if (selling_price === undefined || selling_price < 0) {
      return error_response('VALIDATION_ERROR', 'Selling price cannot be negative');
    }
    if (buying_price !== undefined && buying_price < 0) {
      return error_response('VALIDATION_ERROR', 'Buying price cannot be negative');
    }

    // Check for duplicate barcode
    if (barcode) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('barcode', barcode)
        .single();

      if (existing) {
        return error_response('CONFLICT', 'Barcode already exists');
      }
    }

    // Check for duplicate SKU
    if (sku) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .single();

      if (existing) {
        return error_response('CONFLICT', 'SKU already exists');
      }
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        sku: sku || null,
        barcode: barcode || null,
        category_id: category_id || null,
        buying_price: buying_price || 0,
        selling_price,
        stock_quantity: stock_quantity || 0,
        low_stock_threshold: low_stock_threshold || 5,
        unit: unit || 'piece',
        status: 'active',
        description: description || null,
        image: null
      })
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'PRODUCT_CREATED',
      entity: 'product',
      entity_id: data.id,
      metadata: { name: data.name }
    });

    return success_response(data, 201);
  }

  // GET /api/products/:id (path IS the id here - no leading slash, since
  // apiPath.slice(9) in index.ts already consumed the full "products/" prefix)
  if (path.length > 0 && request.method === 'GET') {
    const id = path;
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return error_response('NOT_FOUND', 'Product not found', 404);
    }

    return success_response(data);
  }

  // PUT /api/products/:id
  if (path.length > 0 && request.method === 'PUT') {
    authorize(user, ['owner', 'manager']);

    const id = path;
    const body = await request.json() as Partial<Product>;
    const { name, sku, barcode, category_id, buying_price, selling_price, stock_quantity, low_stock_threshold, unit, status, description } = body;

    // Check product exists
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return error_response('NOT_FOUND', 'Product not found', 404);
    }

    // Check for duplicate barcode (excluding current product)
    if (barcode && barcode !== existing.barcode) {
      const { data: dup } = await supabase
        .from('products')
        .select('id')
        .eq('barcode', barcode)
        .neq('id', id)
        .single();

      if (dup) {
        return error_response('CONFLICT', 'Barcode already exists');
      }
    }

    // Check for duplicate SKU (excluding current product)
    if (sku && sku !== existing.sku) {
      const { data: dup } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .neq('id', id)
        .single();

      if (dup) {
        return error_response('CONFLICT', 'SKU already exists');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku;
    if (barcode !== undefined) updateData.barcode = barcode;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (buying_price !== undefined) updateData.buying_price = buying_price;
    if (selling_price !== undefined) updateData.selling_price = selling_price;
    if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity;
    if (low_stock_threshold !== undefined) updateData.low_stock_threshold = low_stock_threshold;
    if (unit !== undefined) updateData.unit = unit;
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'PRODUCT_UPDATED',
      entity: 'product',
      entity_id: id,
      metadata: { changes: updateData }
    });

    return success_response(data);
  }

  // DELETE /api/products/:id (archive)
  if (path.length > 0 && request.method === 'DELETE') {
    authorize(user, ['owner', 'manager']);

    const id = path;
    const { data, error } = await supabase
      .from('products')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return error_response('NOT_FOUND', 'Product not found', 404);
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'PRODUCT_ARCHIVED',
      entity: 'product',
      entity_id: id
    });

    return success_response({ message: 'Product archived' });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
