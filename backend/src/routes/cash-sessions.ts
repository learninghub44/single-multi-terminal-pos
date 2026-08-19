import { Env, CashSession } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleCashSessionRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/cash-sessions - List cash sessions
  if (path === '' && request.method === 'GET') {
    const url = new URL(request.url);
    const terminal_id = url.searchParams.get('terminal_id') || '';
    const status = url.searchParams.get('status') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let query = supabase
      .from('cash_sessions')
      .select('*, terminals(terminal_code, name), users(full_name)', { count: 'exact' });

    if (terminal_id) {
      query = query.eq('terminal_id', terminal_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('opened_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({
      sessions: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  }

  // GET /api/cash-sessions/active/:terminal_id - Get active session for terminal
  if (path.startsWith('/active/') && request.method === 'GET') {
    const terminalId = path.slice(8);

    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*, terminals(terminal_code, name), users(full_name)')
      .eq('terminal_id', terminalId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return success_response({ session: null });
    }

    return success_response({ session: data });
  }

  // POST /api/cash-sessions/open - Open a new cash session
  if (path === '/open' && request.method === 'POST') {
    const body = await request.json() as {
      terminal_id: string;
      opening_cash: number;
    };

    const { terminal_id, opening_cash } = body;

    if (!terminal_id) {
      return error_response('VALIDATION_ERROR', 'Terminal ID is required');
    }

    if (opening_cash === undefined || opening_cash < 0) {
      return error_response('VALIDATION_ERROR', 'Opening cash must be a non-negative amount');
    }

    // Verify terminal exists and is active
    const { data: terminal, error: terminalError } = await supabase
      .from('terminals')
      .select('*')
      .eq('id', terminal_id)
      .eq('status', 'active')
      .single();

    if (terminalError || !terminal) {
      return error_response('NOT_FOUND', 'Terminal not found or inactive', 404);
    }

    // Check for existing open session on this terminal
    const { data: existingSession } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('terminal_id', terminal_id)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (existingSession) {
      return error_response('CONFLICT', 'Terminal already has an open cash session');
    }

    // Create cash session
    const { data: session, error: sessionError } = await supabase
      .from('cash_sessions')
      .insert({
        terminal_id,
        user_id: user.id,
        opening_cash,
        expected_cash: opening_cash,
        status: 'open'
      })
      .select()
      .single();

    if (sessionError) {
      return error_response('DATABASE_ERROR', sessionError.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CASH_SESSION_OPENED',
      entity: 'cash_session',
      entity_id: session.id,
      terminal_id,
      metadata: { opening_cash, terminal_code: terminal.terminal_code }
    });

    return success_response(session, 201);
  }

  // POST /api/cash-sessions/close - Close a cash session
  if (path === '/close' && request.method === 'POST') {
    const body = await request.json() as {
      session_id: string;
      actual_cash: number;
    };

    const { session_id, actual_cash } = body;

    if (!session_id) {
      return error_response('VALIDATION_ERROR', 'Session ID is required');
    }

    if (actual_cash === undefined || actual_cash < 0) {
      return error_response('VALIDATION_ERROR', 'Actual cash must be a non-negative amount');
    }

    // Get the session
    const { data: session, error: sessionError } = await supabase
      .from('cash_sessions')
      .select('*, terminals(terminal_code)')
      .eq('id', session_id)
      .eq('status', 'open')
      .single();

    if (sessionError || !session) {
      return error_response('NOT_FOUND', 'Open cash session not found', 404);
    }

    // Calculate expected cash: opening_cash + cash sales during session
    const { data: cashSales } = await supabase
      .from('sales')
      .select('total')
      .eq('terminal_id', session.terminal_id)
      .eq('status', 'completed')
      .gte('created_at', session.opened_at)
      .lte('created_at', new Date().toISOString());

    // Also check payments table for cash method
    const { data: cashPayments } = await supabase
      .from('payments')
      .select('amount, sale_id')
      .eq('terminal_id', session.terminal_id)
      .eq('method', 'cash')
      .eq('status', 'paid')
      .gte('created_at', session.opened_at)
      .lte('created_at', new Date().toISOString());

    // Calculate total cash sales from payments (more reliable)
    let totalCashSales = 0;
    if (cashPayments && cashPayments.length > 0) {
      totalCashSales = cashPayments.reduce((sum, p) => sum + p.amount, 0);
    } else if (cashSales && cashSales.length > 0) {
      // Fallback to sales table if no payment records
      totalCashSales = cashSales.reduce((sum, s) => sum + s.total, 0);
    }

    const expectedCash = Number(session.opening_cash) + totalCashSales;
    const difference = actual_cash - expectedCash;

    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('cash_sessions')
      .update({
        actual_cash: actual_cash,
        expected_cash: expectedCash,
        difference,
        status: 'closed',
        closed_at: new Date().toISOString()
      })
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) {
      return error_response('DATABASE_ERROR', updateError.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CASH_SESSION_CLOSED',
      entity: 'cash_session',
      entity_id: session_id,
      terminal_id: session.terminal_id,
      metadata: {
        opening_cash: session.opening_cash,
        total_cash_sales: totalCashSales,
        expected_cash: expectedCash,
        actual_cash,
        difference,
        terminal_code: session.terminals?.terminal_code
      }
    });

    return success_response(updatedSession);
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
