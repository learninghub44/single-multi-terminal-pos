import { Env } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleReportRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  authorize(user, ['owner', 'manager']);
  const supabase = getSupabaseService(env);

  const url = new URL(request.url);
  const start_date = url.searchParams.get('start_date') || '';
  const end_date = url.searchParams.get('end_date') || '';
  const terminal_id = url.searchParams.get('terminal_id') || '';

  // GET /api/reports/sales
  if (path === 'sales' && request.method === 'GET') {
    let query = supabase
      .from('sales')
      .select('*, payments(method, status), terminals(terminal_code)');

    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    if (terminal_id) {
      query = query.eq('terminal_id', terminal_id);
    }

    const { data: sales, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    const totalSales = sales?.reduce((sum, s) => sum + (s.status === 'completed' ? s.total : 0), 0) || 0;
    const completedSales = sales?.filter(s => s.status === 'completed') || [];
    const totalTransactions = completedSales.length;

    return success_response({
      sales: completedSales,
      summary: {
        total_sales: totalSales,
        total_transactions: totalTransactions,
        average_sale: totalTransactions > 0 ? totalSales / totalTransactions : 0
      }
    });
  }

  // GET /api/reports/payment-methods
  if (path === 'payment-methods' && request.method === 'GET') {
    let query = supabase
      .from('payments')
      .select('*')
      .eq('status', 'paid');

    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    if (terminal_id) {
      query = query.eq('terminal_id', terminal_id);
    }

    const { data: payments, error } = await query;

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    const cashTotal = payments?.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0) || 0;
    const mpesaTotal = payments?.filter(p => p.method === 'mpesa').reduce((sum, p) => sum + p.amount, 0) || 0;
    const payheroTotal = payments?.filter(p => p.method === 'payhero').reduce((sum, p) => sum + p.amount, 0) || 0;

    return success_response({
      cash: cashTotal,
      mpesa: mpesaTotal,
      payhero: payheroTotal,
      total: cashTotal + mpesaTotal + payheroTotal
    });
  }

  // GET /api/reports/products
  if (path === 'products' && request.method === 'GET') {
    const { data: saleItems, error } = await supabase
      .from('sale_items')
      .select('*, sales(created_at, status)');

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Filter completed sales
    const completedItems = saleItems?.filter(item => item.sales?.status === 'completed') || [];

    // Aggregate by product
    const productStats: Record<string, {
      product_id: string;
      product_name: string;
      quantity_sold: number;
      revenue: number;
      cost: number;
      profit: number;
    }> = {};

    for (const item of completedItems) {
      if (!productStats[item.product_id]) {
        productStats[item.product_id] = {
          product_id: item.product_id,
          product_name: item.product_name_snapshot,
          quantity_sold: 0,
          revenue: 0,
          cost: 0,
          profit: 0
        };
      }

      const stat = productStats[item.product_id];
      stat.quantity_sold += item.quantity;
      stat.revenue += item.subtotal;
      stat.cost += item.buying_price_snapshot * item.quantity;
      stat.profit = stat.revenue - stat.cost;
    }

    const products = Object.values(productStats).sort((a, b) => b.quantity_sold - a.quantity_sold);

    return success_response({ products });
  }

  // GET /api/reports/inventory
  if (path === 'inventory' && request.method === 'GET') {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('status', 'active')
      .order('stock_quantity', { ascending: true });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    const lowStock = products?.filter(p => p.stock_quantity <= p.low_stock_threshold) || [];
    const totalStockValue = products?.reduce((sum, p) => sum + (p.stock_quantity * p.buying_price), 0) || 0;

    return success_response({
      products,
      low_stock: lowStock,
      total_stock_value: totalStockValue
    });
  }

  // GET /api/reports/expenses
  if (path === 'expenses' && request.method === 'GET') {
    let query = supabase
      .from('expenses')
      .select('*');

    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: expenses, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const expense of expenses || []) {
      byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
    }

    return success_response({
      expenses,
      total: totalExpenses,
      by_category: byCategory
    });
  }

  // GET /api/reports/profit
  if (path === 'profit' && request.method === 'GET') {
    // Get sales
    let salesQuery = supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('status', 'completed');

    if (start_date) {
      salesQuery = salesQuery.gte('created_at', start_date);
    }
    if (end_date) {
      salesQuery = salesQuery.lte('created_at', end_date);
    }
    if (terminal_id) {
      salesQuery = salesQuery.eq('terminal_id', terminal_id);
    }

    const { data: sales, error: salesError } = await salesQuery;

    if (salesError) {
      return error_response('DATABASE_ERROR', salesError.message);
    }

    let revenue = 0;
    let costOfGoods = 0;

    for (const sale of sales || []) {
      revenue += sale.total;
      for (const item of sale.sale_items || []) {
        costOfGoods += item.buying_price_snapshot * item.quantity;
      }
    }

    // Get expenses
    let expensesQuery = supabase
      .from('expenses')
      .select('amount');

    if (start_date) {
      expensesQuery = expensesQuery.gte('created_at', start_date);
    }
    if (end_date) {
      expensesQuery = expensesQuery.lte('created_at', end_date);
    }

    const { data: expenses } = await expensesQuery;
    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - totalExpenses;

    return success_response({
      revenue,
      cost_of_goods: costOfGoods,
      gross_profit: grossProfit,
      expenses: totalExpenses,
      net_profit: netProfit
    });
  }

  return error_response('NOT_FOUND', 'Report endpoint not found', 404);
}
