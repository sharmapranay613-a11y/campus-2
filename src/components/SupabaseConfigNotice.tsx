import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

export function SupabaseConfigNotice() {
  const { isConfigured } = useAuth();

  if (isConfigured) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-200 bg-amber-50/90 px-6 py-3 text-sm text-amber-950"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Supabase connection required:</strong> Add{' '}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            VITE_SUPABASE_URL
          </code>{' '}
          and{' '}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            VITE_SUPABASE_ANON_KEY
          </code>{' '}
          to <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">.env</code>{' '}
          and run the SQL migrations in{' '}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">supabase/</code>{' '}
          to enable authentication, listings, storage uploads, and transactions.
        </p>
      </div>
    </div>
  );
}
