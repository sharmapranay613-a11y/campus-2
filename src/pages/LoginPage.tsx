import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { useAuth } from '@/src/context/AuthContext';
import { loginSchema } from '@/src/lib/validation';
import { loginStudent } from '@/src/services/authService';
import { getErrorMessage } from '@/src/services/errors';

export function LoginPage() {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget =
    (location.state as { from?: string } | null)?.from || '/my-listings';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    if (!isConfigured) {
      setFormError(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env first.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await loginStudent({ email, password });
      toast.success('Signed in to CampusConnect.');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Unable to sign in. Check your credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-14">
      <div className="rounded-xl border border-stone-200 bg-white p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          Student Sign In
        </h1>
        <p className="mt-1.5 text-sm text-stone-600">
          Sign in with your verified college email to manage listings and requests.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <div>
            <Label htmlFor="login-email">College Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@college.edu"
              className="mt-1.5"
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-6 border-t border-stone-100 pt-5 text-center text-sm text-stone-600">
          New to CampusConnect?{' '}
          <Link to="/register" className="font-semibold text-emerald-900 hover:underline">
            Register with your college email
          </Link>
        </p>
      </div>
    </div>
  );
}
