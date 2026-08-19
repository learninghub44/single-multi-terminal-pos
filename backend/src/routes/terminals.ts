import { Env, Terminal } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleTerminalRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  const supabase = getSupabaseService(env);

  // GET /api/terminals - List all terminals
  if (path === '' && request.method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';

    let query = supabase
      .from('terminals')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.order('terminal_code', { ascending: true });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ terminals: data, total: count });
  }

  // POST /api/terminals - Create terminal (owner/manager only)
  if (path === '' && request.method === 'POST') {
    authorize(user, ['owner', 'manager']);

    const body = await request.json() as Partial<Terminal>;
    const { terminal_code, name, location } = body;

    if (!terminal_code || !name) {
      return error_response('VALIDATION_ERROR', 'Terminal code and name are required');
    }

    // Validate terminal code format
    const codeRegex = /^[A-Z0-9-]+$/;
    if (!codeRegex.test(terminal_code)) {
      return error_response('VALIDATION_ERROR', 'Terminal code must contain only uppercase letters, numbers, and hyphens');
    }

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('terminals')
      .select('id')
      .eq('terminal_code', terminal_code)
      .single();

    if (existing) {
      return error_response('CONFLICT', 'Terminal code already exists');
    }

    const { data, error } = await supabase
      .from('terminals')
      .insert({
        terminal_code,
        name,
        location: location || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'TERMINAL_CREATED',
      entity: 'terminal',
      entity_id: data.id,
      terminal_id: data.id,
      metadata: { terminal_code, name }
    });

    return success_response(data, 201);
  }

  // GET /api/terminals/:id - Get single terminal
  if (path.startsWith('/') && request.method === 'GET' && !path.includes('/activity')) {
    const id = path.slice(1);
    const { data, error } = await supabase
      .from('terminals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return error_response('NOT_FOUND', 'Terminal not found', 404);
    }

    return success_response(data);
  }

  // PUT /api/terminals/:id - Update terminal (owner/manager only)
  if (path.startsWith('/') && request.method === 'PUT') {
    authorize(user, ['owner', 'manager']);

    const id = path.slice(1);
    const body = await request.json() as Partial<Terminal>;
    const { terminal_code, name, location, status } = body;

    const { data: existing } = await supabase
      .from('terminals')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return error_response('NOT_FOUND', 'Terminal not found', 404);
    }

    // Check for duplicate code (excluding current)
    if (terminal_code && terminal_code !== existing.terminal_code) {
      const { data: dup } = await supabase
        .from('terminals')
        .select('id')
        .eq('terminal_code', terminal_code)
        .neq('id', id)
        .single();

      if (dup) {
        return error_response('CONFLICT', 'Terminal code already exists');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (terminal_code !== undefined) updateData.terminal_code = terminal_code;
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('terminals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Audit log
    const action = status === 'active' ? 'TERMINAL_ACTIVATED' :
                   status === 'inactive' ? 'TERMINAL_DEACTIVATED' : 'TERMINAL_UPDATED';
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      entity: 'terminal',
      entity_id: id,
      terminal_id: id,
      metadata: { changes: updateData }
    });

    return success_response(data);
  }

  // GET /api/terminals/:id/activity - Get terminal activity
  if (path.startsWith('/') && path.endsWith('/activity') && request.method === 'GET') {
    const id = path.slice(1, -9);

    // Get recent sales for this terminal
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, receipt_number, total, status, created_at, users(full_name)')
      .eq('terminal_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (salesError) {
      return error_response('DATABASE_ERROR', salesError.message);
    }

    // Get cash sessions for this terminal
    const { data: sessions, error: sessionsError } = await supabase
      .from('cash_sessions')
      .select('*, users(full_name)')
      .eq('terminal_id', id)
      .order('opened_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      return error_response('DATABASE_ERROR', sessionsError.message);
    }

    return success_response({
      recent_sales: sales,
      recent_sessions: sessions
    });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
