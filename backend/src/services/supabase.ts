import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../types';

export function createSupabaseClient(env: Env, useServiceRole = false): SupabaseClient {
  const key = useServiceRole ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  return createClient(env.SUPABASE_URL, key);
}

export function getSupabaseAnon(env: Env): SupabaseClient {
  return createSupabaseClient(env, false);
}

export function getSupabaseService(env: Env): SupabaseClient {
  return createSupabaseClient(env, true);
}
