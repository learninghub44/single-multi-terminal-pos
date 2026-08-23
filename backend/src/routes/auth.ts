import { Env, ApiResponse } from '../types';
import { getSupabaseAnon, getSupabaseService } from '../services/supabase';
import { success_response, error_response, json_response } from '../middleware/auth';

export async function handleAuthRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabaseAnon(env);

  // GET /api/auth/setup-status - public. Tells the frontend whether to show
  // "Create Admin Account" instead of the login form. True only until the
  // very first user is created, then permanently false.
  if (path === 'setup-status' && request.method === 'GET') {
    const service = getSupabaseService(env);
    const { count, error } = await service
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ needs_setup: (count || 0) === 0 });
  }

  // POST /api/auth/setup - public, but only works while the users table is
  // empty. This is the ONLY way to create the very first account, since
  // every other user-creation path (POST /api/users, invite acceptance)
  // requires an existing owner/manager to have created it - a brand new
  // deployment has no one yet. Whoever gets here first becomes the owner;
  // once any user exists this permanently 403s, closing the bootstrap
  // window for good.
  if (path === 'setup' && request.method === 'POST') {
    const service = getSupabaseService(env);

    const { count, error: countError } = await service
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return error_response('DATABASE_ERROR', countError.message);
    }

    if ((count || 0) > 0) {
      return error_response('SETUP_COMPLETE', 'Setup has already been completed. Ask an existing owner for an invite link.', 403);
    }

    const body = await request.json() as { email: string; password: string; full_name: string };
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return error_response('VALIDATION_ERROR', 'Email, password, and full name are required');
    }
    if (password.length < 6) {
      return error_response('VALIDATION_ERROR', 'Password must be at least 6 characters');
    }

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      return error_response('AUTH_ERROR', authError?.message || 'Failed to create admin account');
    }

    const { data: profile, error: profileError } = await service
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role: 'owner'
      })
      .select()
      .single();

    if (profileError) {
      await service.auth.admin.deleteUser(authData.user.id);
      return error_response('DATABASE_ERROR', profileError.message);
    }

    // Log them straight in so setup flows directly into the app.
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      // Account was created fine - just couldn't auto-login. Not fatal,
      // they can log in manually.
      return success_response({
        user: { id: profile.id, email: profile.email, role: profile.role, full_name: profile.full_name },
        session: null
      }, 201);
    }

    return success_response({
      user: { id: profile.id, email: profile.email, role: profile.role, full_name: profile.full_name },
      session: signInData.session
    }, 201);
  }

  // GET /api/auth/invite/:token - public. Lets the accept-invite page show
  // what role/business the person is being invited into before they commit
  // to filling out the form, and tells them clearly if the link is
  // expired/used/revoked rather than a confusing generic error.
  if (path.startsWith('invite/') && request.method === 'GET') {
    const token = path.slice('invite/'.length);
    const service = getSupabaseService(env);

    const { data: invite, error } = await service
      .from('invites')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invite) {
      return error_response('NOT_FOUND', 'Invite link not found', 404);
    }
    if (invite.revoked_at) {
      return error_response('INVITE_REVOKED', 'This invite has been revoked', 410);
    }
    if (invite.used_at) {
      return error_response('INVITE_USED', 'This invite has already been used', 410);
    }
    if (new Date(invite.expires_at) < new Date()) {
      return error_response('INVITE_EXPIRED', 'This invite has expired - ask for a new one', 410);
    }

    const { data: settings } = await service
      .from('business_settings')
      .select('business_name')
      .limit(1)
      .single();

    return success_response({
      role: invite.role,
      email: invite.email,
      business_name: settings?.business_name || 'the team'
    });
  }

  // POST /api/auth/accept-invite - public. Creates the staff member's own
  // account using the role fixed by whoever generated the invite - they
  // choose their own email (unless the invite was locked to a specific one)
  // and password, an owner/manager never has to type or see it.
  if (path === 'accept-invite' && request.method === 'POST') {
    const body = await request.json() as {
      token: string;
      email: string;
      password: string;
      full_name: string;
    };

    const { token, email, password, full_name } = body;

    if (!token || !email || !password || !full_name) {
      return error_response('VALIDATION_ERROR', 'All fields are required');
    }
    if (password.length < 6) {
      return error_response('VALIDATION_ERROR', 'Password must be at least 6 characters');
    }

    const service = getSupabaseService(env);

    const { data: invite, error: inviteError } = await service
      .from('invites')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return error_response('NOT_FOUND', 'Invite link not found', 404);
    }
    if (invite.revoked_at) {
      return error_response('INVITE_REVOKED', 'This invite has been revoked', 410);
    }
    if (invite.used_at) {
      return error_response('INVITE_USED', 'This invite has already been used', 410);
    }
    if (new Date(invite.expires_at) < new Date()) {
      return error_response('INVITE_EXPIRED', 'This invite has expired - ask for a new one', 410);
    }
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return error_response('VALIDATION_ERROR', 'This invite was sent to a different email address');
    }

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      return error_response('AUTH_ERROR', authError?.message || 'Failed to create account');
    }

    const { data: profile, error: profileError } = await service
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role: invite.role
      })
      .select()
      .single();

    if (profileError) {
      await service.auth.admin.deleteUser(authData.user.id);
      return error_response('DATABASE_ERROR', profileError.message);
    }

    // Mark the invite used so it can't be replayed - a link is single-use,
    // consistent with how the owner would expect a one-time invite to work.
    await service
      .from('invites')
      .update({ used_at: new Date().toISOString(), used_by: profile.id })
      .eq('id', invite.id);

    await service.from('audit_logs').insert({
      user_id: profile.id,
      action: 'INVITE_ACCEPTED',
      entity: 'user',
      entity_id: profile.id,
      metadata: { role: invite.role, invited_by: invite.created_by }
    });

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      return success_response({
        user: { id: profile.id, email: profile.email, role: profile.role, full_name: profile.full_name },
        session: null
      }, 201);
    }

    return success_response({
      user: { id: profile.id, email: profile.email, role: profile.role, full_name: profile.full_name },
      session: signInData.session
    }, 201);
  }

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
