import { requireSupabase } from '@/src/lib/supabase';
import { getCampusConfig } from '@/src/config/campus';
import { createRegisterSchema, loginSchema, profileUpdateSchema } from '@/src/lib/validation';
import type { Profile } from '@/src/types/database';

export interface RegisterPayload {
  full_name: string;
  email: string;
  department: string;
  year: string;
  password: string;
  confirm_password: string;
}

export interface RegisterResult {
  needsEmailVerification: boolean;
  email: string;
}

export async function registerStudent(payload: RegisterPayload): Promise<RegisterResult> {
  const { allowedDomains } = getCampusConfig();
  const parsed = createRegisterSchema(allowedDomains).parse(payload);
  const supabase = requireSupabase();

  const normalizedEmail = parsed.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: parsed.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: {
        full_name: parsed.full_name.trim(),
        department: parsed.department.trim(),
        year: parsed.year.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.user && data.session) {
    await ensureProfileRecord(data.user.id, {
      full_name: parsed.full_name.trim(),
      email: normalizedEmail,
      department: parsed.department.trim(),
      year: parsed.year.trim(),
    });
  }

  return {
    needsEmailVerification: Boolean(data.user && !data.session),
    email: normalizedEmail,
  };
}

export async function loginStudent(payload: { email: string; password: string }) {
  const parsed = loginSchema.parse(payload);
  const supabase = requireSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.email.trim().toLowerCase(),
    password: parsed.password,
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    const metadata = data.user.user_metadata as
      | { full_name?: string; department?: string; year?: string }
      | undefined;

    if (metadata?.full_name && metadata?.department && metadata?.year && data.user.email) {
      await ensureProfileRecord(data.user.id, {
        full_name: metadata.full_name,
        email: data.user.email.toLowerCase(),
        department: metadata.department,
        year: metadata.year,
      });
    }
  }

  return data;
}

export async function logoutStudent(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

export async function ensureProfileRecord(
  userId: string,
  values: { full_name: string; email: string; department: string; year: string }
): Promise<Profile> {
  const supabase = requireSupabase();
  const existing = await fetchOwnProfile(userId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      full_name: values.full_name,
      email: values.email.toLowerCase(),
      department: values.department,
      year: values.year,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function updateOwnProfile(
  userId: string,
  payload: { full_name: string; department: string; year: string }
): Promise<Profile> {
  const parsed = profileUpdateSchema.parse(payload);
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.full_name,
      department: parsed.department,
      year: parsed.year,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}
