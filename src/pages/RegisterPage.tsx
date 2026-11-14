import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select } from '@/src/components/ui/select';
import { ACADEMIC_YEARS, getCampusConfig } from '@/src/config/campus';
import { useAuth } from '@/src/context/AuthContext';
import { createRegisterSchema, formatAllowedDomainsLabel } from '@/src/lib/validation';
import { registerStudent } from '@/src/services/authService';
import { getErrorMessage } from '@/src/services/errors';

export function RegisterPage() {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const { allowedDomains } = getCampusConfig();
  const domainsLabel = formatAllowedDomainsLabel(allowedDomains);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState<string>(ACADEMIC_YEARS[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/my-listings" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setVerificationNotice(null);

    const schema = createRegisterSchema(allowedDomains);
    const candidate = {
      full_name: fullName,
      email,
      department,
      year,
      password,
      confirm_password: confirmPassword,
    };

    const parsed = schema.safeParse(candidate);
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
      const result = await registerStudent(candidate);
      if (result.needsEmailVerification) {
        setVerificationNotice(
          `Registration created for ${result.email}. Check your college inbox to verify your email address before signing in.`
        );
      } else {
        toast.success('Welcome to CampusConnect! Your student profile is ready.');
        navigate('/my-listings', { replace: true });
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'Registration failed. Please verify your details.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-xl border border-stone-200 bg-white p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          Create Student Account
        </h1>
        <p className="mt-1.5 text-sm text-stone-600">
          Registration is restricted to verified college emails ({domainsLabel}).
        </p>

        {verificationNotice ? (
          <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
            <p className="font-semibold">Verify your college email</p>
            <p className="leading-relaxed">{verificationNotice}</p>
            <Button asChild className="w-full">
              <Link to="/login">Proceed to Sign In</Link>
            </Button>
          </div>
        ) : (
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
              <Label htmlFor="reg-full-name">Full Name</Label>
              <Input
                id="reg-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Maya Patel"
                className="mt-1.5"
                required
              />
              {fieldErrors.full_name && (
                <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.full_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="reg-email">College Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                className="mt-1.5"
                required
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.email}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="reg-department">Department</Label>
                <Input
                  id="reg-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Mechanical Engineering"
                  className="mt-1.5"
                  required
                />
                {fieldErrors.department && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {fieldErrors.department}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="reg-year">Academic Year</Label>
                <Select
                  id="reg-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1.5"
                >
                  {ACADEMIC_YEARS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </Select>
                {fieldErrors.year && (
                  <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.year}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                  required
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                <Input
                  id="reg-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5"
                  required
                />
                {fieldErrors.confirm_password && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {fieldErrors.confirm_password}
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating Account...' : 'Create Student Account'}
            </Button>
          </form>
        )}

        <p className="mt-6 border-t border-stone-100 pt-5 text-center text-sm text-stone-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-emerald-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
