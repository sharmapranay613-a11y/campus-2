import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="h-8 w-48 animate-pulse rounded-md bg-stone-200" />
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-xl border border-stone-200 bg-white" />
          <div className="h-36 animate-pulse rounded-xl border border-stone-200 bg-white" />
          <div className="h-36 animate-pulse rounded-xl border border-stone-200 bg-white" />
        </div>
      </div>
    );
  }

  if (!isConfigured || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
