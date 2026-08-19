import { Env, ApiResponse } from '../types';
import { getSupabaseAnon } from '../services/supabase';
import { success_response, error_response, json_response } from '../middleware/auth';

export async function handleAuthRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabaseAnon(env);

  // POST /api/auth/login
  if (path === 'login' && request.method === 'POST') {
    const body = await request.json() as { email: string; password: string };
    const { email, password } = body;

    if (!email || !password) {
      return error_response('VALIDATION_ERROR', 'Email and password are required');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return error_response('AUTH_ERROR', error.message, 401);
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return success_response({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile?.role || 'cashier',
        full_name: profile?.full_name || ''
      },
      session: data.session
    });
  }

  // POST /api/auth/logout
  if (path === 'logout' && request.method === 'POST') {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return error_response('AUTH_ERROR', error.message);
    }
    return success_response({ message: 'Logged out successfully' });
  }

  // POST /api/auth/refresh
  if (path === 'refresh' && request.method === 'POST') {
    const body = await request.json() as { refresh_token: string };
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refresh_token
    });

    if (error) {
      return error_response('AUTH_ERROR', error.message, 401);
    }

    return success_response({ session: data.session });
  }

  // GET /api/auth/user
  if (path === 'user' && request.method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return error_response('UNAUTHORIZED', 'Missing authorization header', 401);
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return error_response('UNAUTHORIZED', 'Invalid token', 401);
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return success_response({
      id: user.id,
      email: user.email,
      role: profile?.role || 'cashier',
      full_name: profile?.full_name || ''
    });
  }

  return error_response('NOT_FOUND', 'Auth endpoint not found', 404);
}
