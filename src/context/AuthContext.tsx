import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/src/lib/supabase';
import {
  ensureProfileRecord,
  fetchOwnProfile,
  logoutStudent,
} from '@/src/services/authService';
import { getErrorMessage } from '@/src/services/errors';
import type { Profile } from '@/src/types/database';

interface AuthContextValue {
  isConfigured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<boolean>(supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfileForUser = useCallback(async (authUser: User | null) => {
    if (!authUser || !supabaseConfigured) {
      setProfile(null);
      return;
    }
    try {
      let ownProfile = await fetchOwnProfile(authUser.id);
      if (!ownProfile) {
        const meta = authUser.user_metadata as
          | { full_name?: string; department?: string; year?: string }
          | undefined;
        if (meta?.full_name && meta?.department && meta?.year && authUser.email) {
          ownProfile = await ensureProfileRecord(authUser.id, {
            full_name: meta.full_name,
            email: authUser.email,
            department: meta.department,
            year: meta.year,
          });
        }
      }
      setProfile(ownProfile);
      setAuthError(null);
    } catch (err) {
      setAuthError(getErrorMessage(err, 'Unable to load student profile.'));
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setAuthError(getErrorMessage(error, 'Session verification failed.'));
          setSession(null);
          setProfile(null);
        } else {
          setSession(data.session);
          await loadProfileForUser(data.session?.user ?? null);
        }
        if (mounted) {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setAuthError(getErrorMessage(err, 'Unable to check authentication session.'));
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      void loadProfileForUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForUser]);

  const refreshProfile = useCallback(async () => {
    await loadProfileForUser(session?.user ?? null);
  }, [loadProfileForUser, session?.user]);

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return;
    await logoutStudent();
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isConfigured: supabaseConfigured,
        loading,
        session,
        user: session?.user ?? null,
        profile,
        authError,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
