import { Env, User } from '../types';
import { authenticate, authorize, success_response, error_response } from '../middleware/auth';
import { getSupabaseService } from '../services/supabase';

export async function handleUserRoutes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await authenticate(request, env);
  authorize(user, ['owner', 'manager']);
  const supabase = getSupabaseService(env);

  // GET /api/users
  if (path === '' && request.method === 'GET') {
    // Managers can only view, not manage
    if (user.role === 'manager') {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, created_at');

      if (error) {
        return error_response('DATABASE_ERROR', error.message);
      }

      return success_response({ users: data });
    }

    // Owner can see all
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at, updated_at');

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    return success_response({ users: data });
  }

  // POST /api/users - Create user (owner only)
  if (path === '' && request.method === 'POST') {
    authorize(user, ['owner']);

    const body = await request.json() as {
      email: string;
      password: string;
      full_name: string;
      role: 'owner' | 'manager' | 'cashier';
    };

    const { email, password, full_name, role } = body;

    if (!email || !password || !full_name || !role) {
      return error_response('VALIDATION_ERROR', 'All fields are required');
    }

    const validRoles = ['owner', 'manager', 'cashier'];
    if (!validRoles.includes(role)) {
      return error_response('VALIDATION_ERROR', 'Invalid role');
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return error_response('AUTH_ERROR', authError.message);
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return error_response('DATABASE_ERROR', profileError.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'USER_CREATED',
      entity: 'user',
      entity_id: profile.id,
      metadata: { email, role }
    });

    return success_response({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role
    }, 201);
  }

  // PUT /api/users/:id
  if (path.length > 0 && request.method === 'PUT') {
    authorize(user, ['owner']);

    const id = path;
    const body = await request.json() as Partial<User> & { password?: string };
    const { full_name, role, password } = body;

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return error_response('NOT_FOUND', 'User not found', 404);
    }

    // Update profile
    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (role !== undefined) updateData.role = role;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Update password if provided
    if (password) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
        password
      });

      if (pwError) {
        console.error('Password update error:', pwError);
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'USER_UPDATED',
      entity: 'user',
      entity_id: id,
      metadata: { changes: updateData }
    });

    return success_response(data);
  }

  // DELETE /api/users/:id
  if (path.length > 0 && request.method === 'DELETE') {
    authorize(user, ['owner']);

    const id = path;

    // Prevent self-deletion
    if (id === user.id) {
      return error_response('VALIDATION_ERROR', 'Cannot delete yourself');
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      return error_response('DATABASE_ERROR', error.message);
    }

    // Also delete from auth
    await supabase.auth.admin.deleteUser(id);

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'USER_DELETED',
      entity: 'user',
      entity_id: id
    });

    return success_response({ message: 'User deleted' });
  }

  return error_response('NOT_FOUND', 'Endpoint not found', 404);
}
