import { Env, InventoryMovement } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleInventoryRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/inventory - Get inventory movements
  if (path === '' && request.method === 'GET') {
    authorize(user, ['owner', 'manager']);

    const url = new URL(request.url);
    const product_id = url.searchParams.get('product_id') || '';
    const type = url.searchParams.get('type') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = supabase
      .from('inventory_movements')
      .select('*, products(name, sku)', { count: 'exact' });

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({
      movements: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  }

  // POST /api/inventory/adjust
  if (path === 'adjust' && request.method === 'POST') {
    authorize(user, ['owner', 'manager']);

    const body = await request.json() as {
      product_id: string;
      type: InventoryMovement['type'];
      quantity: number;
      notes?: string;
    };

    const { product_id, type, quantity, notes } = body;

    if (!product_id || !type || quantity === undefined) {
      return error_response('VALIDATION_ERROR', 'Product ID, type, and quantity are required');
    }

    const validTypes = ['opening_stock', 'purchase', 'return', 'damage', 'adjustment'];
    if (!validTypes.includes(type)) {
      return error_response('VALIDATION_ERROR', 'Invalid movement type');
    }

    // Get current product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return error_response('NOT_FOUND', 'Product not found', 404);
    }

    // Calculate new stock
    let newStock = product.stock_quantity;
    if (type === 'purchase' || type === 'return' || type === 'opening_stock') {
      newStock += quantity;
    } else if (type === 'damage' || type === 'adjustment') {
      newStock -= quantity;
    }

    if (newStock < 0) {
      return error_response('INSUFFICIENT_STOCK', 'Stock cannot go below zero');
    }

    // Update product stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
      .eq('id', product_id);

    if (updateError) {
      return error_response('DATABASE_ERROR', updateError.message);
    }

    // Create inventory movement
    const { data: movement, error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id,
        type,
        quantity,
        reference: null,
        notes: notes || null,
        user_id: user.id
      })
      .select()
      .single();

    if (movementError) {
      return error_response('DATABASE_ERROR', movementError.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'STOCK_ADJUSTED',
      entity: 'product',
      entity_id: product_id,
      metadata: { type, quantity, new_stock: newStock }
    });

    return success_response({
      movement,
      new_stock: newStock
    });
  }

  // GET /api/inventory/low-stock
  if (path === 'low-stock' && request.method === 'GET') {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('status', 'active')
      .filter('stock_quantity', 'lte', 'low_stock_threshold')
      .order('stock_quantity', { ascending: true });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ products: data });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
