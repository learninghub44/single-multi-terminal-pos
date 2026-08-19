import { Env, Sale, CartItem } from '../types';
import { authenticate, authorize, success_response, error_response, ValidationError, InsufficientStockError } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleSaleRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/sales
  if (path === '' && request.method === 'GET') {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const payment_method = url.searchParams.get('payment_method') || '';
    const user_id = url.searchParams.get('user_id') || '';
    const terminal_id = url.searchParams.get('terminal_id') || '';
    const start_date = url.searchParams.get('start_date') || '';
    const end_date = url.searchParams.get('end_date') || '';

    let query = supabase
      .from('sales')
      .select('*, customers(name), users(full_name), terminals(terminal_code, name), payments(method, status)', { count: 'exact' });

    if (search) {
      query = query.ilike('receipt_number', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (terminal_id) {
      query = query.eq('terminal_id', terminal_id);
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
      sales: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  }

  // POST /api/sales - Create a sale (checkout)
  if (path === '' && request.method === 'POST') {
    const body = await request.json() as {
      items: CartItem[];
      customer_id?: string;
      discount?: number;
      tax?: number;
      payment_method: 'cash' | 'mpesa' | 'payhero';
      terminal_id?: string;
      cash_session_id?: string;
      payment_details?: {
        amount_received?: number;
        phone?: string;
      };
    };

    const { items, customer_id, discount = 0, tax = 0, payment_method, terminal_id, cash_session_id, payment_details } = body;

    if (!items || items.length === 0) {
      return error_response('VALIDATION_ERROR', 'Cart cannot be empty');
    }

    if (!payment_method) {
      return error_response('VALIDATION_ERROR', 'Payment method is required');
    }

    // Validate terminal if provided
    if (terminal_id) {
      const { data: terminal, error: terminalError } = await supabase
        .from('terminals')
        .select('id, status')
        .eq('id', terminal_id)
        .eq('status', 'active')
        .single();

      if (terminalError || !terminal) {
        return error_response('VALIDATION_ERROR', 'Terminal not found or inactive');
      }
    }

    // Validate and calculate on server side
    let subtotal = 0;
    const saleItems: Array<{
      product_id: string;
      product_name_snapshot: string;
      quantity: number;
      unit_price: number;
      buying_price_snapshot: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      // Get authoritative product data
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .single();

      if (productError || !product) {
        throw new ValidationError(`Product not found: ${item.product_id}`);
      }

      if (product.status !== 'active') {
        throw new ValidationError(`Product is archived: ${product.name}`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new InsufficientStockError(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`);
      }

      const itemSubtotal = product.selling_price * item.quantity;
      subtotal += itemSubtotal;

      saleItems.push({
        product_id: product.id,
        product_name_snapshot: product.name,
        quantity: item.quantity,
        unit_price: product.selling_price,
        buying_price_snapshot: product.buying_price,
        subtotal: itemSubtotal
      });
    }

    const total = subtotal - discount + tax;

    // Validate cash payment
    if (payment_method === 'cash') {
      if (!payment_details?.amount_received) {
        return error_response('VALIDATION_ERROR', 'Amount received is required for cash payment');
      }
      if (payment_details.amount_received < total) {
        return error_response('VALIDATION_ERROR', 'Insufficient amount received');
      }
    }

    // Generate receipt number using database function for atomicity
    const { data: receiptData, error: receiptError } = await supabase
      .rpc('generate_receipt_number');

    let receiptNumber: string;
    if (receiptError || !receiptData) {
      // Fallback: use count-based approach
      const { count: saleCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true });
      receiptNumber = `RCT-${String((saleCount || 0) + 1).padStart(6, '0')}`;
    } else {
      receiptNumber = receiptData;
    }

    // Create sale
    const saleInsert: Record<string, unknown> = {
      receipt_number: receiptNumber,
      customer_id: customer_id || null,
      user_id: user.id,
      subtotal,
      discount,
      tax,
      total,
      status: payment_method === 'cash' ? 'completed' : 'pending'
    };

    if (terminal_id) saleInsert.terminal_id = terminal_id;
    if (cash_session_id) saleInsert.cash_session_id = cash_session_id;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleInsert)
      .select()
      .single();

    if (saleError) {
      return error_response('DATABASE_ERROR', saleError.message);
    }

    // Create sale items
    const saleItemsWithId = saleItems.map(item => ({
      ...item,
      sale_id: sale.id
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsWithId);

    if (itemsError) {
      await supabase.from('sales').delete().eq('id', sale.id);
      return error_response('DATABASE_ERROR', itemsError.message);
    }

    // Create payment
    const paymentInsert: Record<string, unknown> = {
      sale_id: sale.id,
      method: payment_method,
      provider: payment_method,
      amount: total,
      status: payment_method === 'cash' ? 'paid' : 'pending',
      phone: payment_details?.phone || null,
      reference: null,
      provider_reference: null,
      provider_response: null
    };

    if (terminal_id) paymentInsert.terminal_id = terminal_id;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentInsert)
      .select()
      .single();

    if (paymentError) {
      await supabase.from('sale_items').delete().eq('sale_id', sale.id);
      await supabase.from('sales').delete().eq('id', sale.id);
      return error_response('DATABASE_ERROR', paymentError.message);
    }

    // Update inventory using atomic function for each item
    for (const item of saleItems) {
      try {
        const { error: deductError } = await supabase
          .rpc('deduct_stock_atomically', {
            p_product_id: item.product_id,
            p_quantity: item.quantity
          });

        if (deductError) {
          // Rollback entire sale
          await supabase.from('payments').delete().eq('id', payment.id);
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new InsufficientStockError(deductError.message);
        }

        // Create inventory movement
        await supabase
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            type: 'sale',
            quantity: -item.quantity,
            reference: sale.id,
            notes: `Sale ${receiptNumber}`,
            user_id: user.id
          });
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          throw err;
        }
        console.error('Inventory deduction error:', err);
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'SALE_CREATED',
      entity: 'sale',
      entity_id: sale.id,
      terminal_id: terminal_id || null,
      metadata: { receipt_number: receiptNumber, total, payment_method, terminal_id }
    });

    // For cash, return immediately
    if (payment_method === 'cash') {
      const change = (payment_details?.amount_received || 0) - total;
      return success_response({
        sale,
        payment,
        items: saleItems,
        change
      }, 201);
    }

    // For M-Pesa/PayHero, return pending status
    return success_response({
      sale,
      payment,
      items: saleItems,
      pending: true
    }, 201);
  }

  // GET /api/sales/:id
  if (path.startsWith('/') && request.method === 'GET') {
    const id = path.slice(1);
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(*), users(full_name, email), terminals(terminal_code, name), payments(*), sale_items(*, products(name, sku, barcode))')
      .eq('id', id)
      .single();

    if (error || !data) {
      return error_response('NOT_FOUND', 'Sale not found', 404);
    }

    return success_response(data);
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
