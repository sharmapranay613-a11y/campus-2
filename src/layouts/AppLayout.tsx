import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, Plus, X } from 'lucide-react';
import { SupabaseConfigNotice } from '@/src/components/SupabaseConfigNotice';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/context/AuthContext';
import { getCampusConfig } from '@/src/config/campus';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore', end: false },
  { to: '/my-listings', label: 'My Listings', end: false },
  { to: '/requests', label: 'Requests', end: false },
  { to: '/profile', label: 'Profile', end: false },
] as const;

export function CampusConnectLogo() {
  const { campusName } = getCampusConfig();
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-emerald-900"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
        <path
          d="M7.5 12.25C7.5 9.62665 9.62665 7.5 12.25 7.5H16.5V10.25H12.25C11.1454 10.25 10.25 11.1454 10.25 12.25C10.25 13.3546 11.1454 14.25 12.25 14.25H16.5V17H12.25C9.62665 17 7.5 14.8734 7.5 12.25Z"
          fill="#F9F8F6"
        />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
        {campusName}
      </span>
    </span>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-[#F9F8F6] text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#F9F8F6]/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 rounded-md"
          >
            <CampusConnectLogo />
          </Link>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 md:flex"
          >
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-emerald-900 text-zinc-900'
                      : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-zinc-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link to="/items/new">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Listing</span>
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link
                  to={
                    location.pathname === '/login' ? '/register' : '/login'
                  }
                >
                  {location.pathname === '/login' ? 'Create Account' : 'Sign In'}
                </Link>
              </Button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-zinc-900 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="border-t border-stone-200 bg-white px-6 py-4 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-950'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/transactions"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Transactions
              </Link>
            </div>
            <div className="mt-4 border-t border-stone-100 pt-4">
              {user ? (
                <Button asChild className="w-full">
                  <Link to="/items/new" onClick={() => setMobileMenuOpen(false)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add Listing</span>
                  </Link>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        )}
      </header>

      <SupabaseConfigNotice />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-semibold text-zinc-900">CampusConnect</p>
            <p className="mt-1 text-xs text-stone-500">
              Verified college student marketplace for borrowing, buying, and selling campus gear.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-stone-600">
            <Link to="/explore" className="hover:text-zinc-900">
              Explore
            </Link>
            <Link to="/my-listings" className="hover:text-zinc-900">
              My Listings
            </Link>
            <Link to="/requests" className="hover:text-zinc-900">
              Requests
            </Link>
            <Link to="/transactions" className="hover:text-zinc-900">
              Transactions
            </Link>
            <Link to="/profile" className="hover:text-zinc-900">
              Profile
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
