import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { ItemCard } from '@/src/components/ItemCard';
import { Button } from '@/src/components/ui/button';
import { ITEM_CATEGORIES } from '@/src/config/campus';
import { useAuth } from '@/src/context/AuthContext';
import { HERO_COMMONS_IMAGE } from '@/src/lib/images';
import { getErrorMessage } from '@/src/services/errors';
import { listMarketplaceItems } from '@/src/services/itemsService';
import type { ItemWithOwner } from '@/src/types/database';

export function HomePage() {
  const { user, isConfigured } = useAuth();
  const [recentItems, setRecentItems] = useState<ItemWithOwner[]>([]);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;
    listMarketplaceItems({ availableOnly: true, limit: 6 })
      .then((items) => {
        if (mounted) {
          setRecentItems(items);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(getErrorMessage(err, 'Unable to load recent listings.'));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isConfigured]);

  return (
    <div>
      {/* Storefront Hero (2-column split with balanced stretch) */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl items-stretch gap-10 px-6 py-12 lg:grid-cols-12 lg:py-16">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
              Verified College Marketplace
            </p>
            <h1 className="mt-3 max-w-xl font-display text-4xl font-bold tracking-tight text-zinc-900 text-balance sm:text-5xl">
              Borrow, buy, and share academic gear within your campus.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-600">
              Find textbooks, graphing calculators, lab kits, and drafting tools from fellow
              students—backed by college-email registration and mutual two-party handover
              confirmations.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/explore">
                  <span>Explore Marketplace</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to={user ? '/items/new' : '/register'}>
                  {user ? (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>List an Item</span>
                    </>
                  ) : (
                    <span>Register with College Email</span>
                  )}
                </Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
              <img
                src={HERO_COMMONS_IMAGE}
                alt="University study table with engineering textbooks, scientific calculator, and bound notebook"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Editorial 3-step trust strip */}
      <section className="border-b border-stone-200 bg-[#F9F8F6]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3">
          <div>
            <p className="font-display text-sm font-semibold text-emerald-900">
              01. College-Verified Community
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Accounts are restricted to approved institution email domains so every transaction
              happens between verified students on campus.
            </p>
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-emerald-900">
              02. Two-Party Handover & Return
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Borrowed items transition only after both the borrower and owner confirm physical
              handover—and return availability restores after both confirm return.
            </p>
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-emerald-900">
              03. Mutual Purchase Confirmation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Accepted purchase offers wait until both buyer and seller confirm completion in
              person before marking the item permanently sold.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Available Listings */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
              Recently Listed on Campus
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Available items ready for pickup across campus buildings and libraries.
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900 hover:text-emerald-800 whitespace-nowrap shrink-0"
          >
            <span>View all listings</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-80 animate-pulse rounded-xl border border-stone-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
          >
            {error}
          </div>
        ) : !isConfigured ? (
          <div className="mt-8 rounded-xl border border-stone-200 bg-white p-8 text-center">
            <h3 className="font-display text-lg font-semibold text-zinc-900">
              Connect Supabase to Display Live Listings
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600">
              Once your Supabase project URL and anonymous key are configured in{' '}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">.env</code>{' '}
              and the SQL migrations are executed, student listings appear here directly from
              PostgreSQL.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/explore">Open Explore Filters</Link>
              </Button>
            </div>
          </div>
        ) : recentItems.length === 0 ? (
          <div className="mt-8 rounded-xl border border-stone-200 bg-white p-10 text-center">
            <h3 className="font-display text-lg font-semibold text-zinc-900">
              No available listings yet
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Be the first student on campus to list a textbook, calculator, or lab kit.
            </p>
            <div className="mt-5">
              <Button asChild>
                <Link to={user ? '/items/new' : '/register'}>
                  {user ? 'Post First Listing' : 'Create Student Account'}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Category Directory */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Browse by Academic Category
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {ITEM_CATEGORIES.map((category) => (
              <Link
                key={category}
                to={`/explore?category=${encodeURIComponent(category)}`}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-[#F9F8F6] px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:border-emerald-800 hover:bg-white"
              >
                <span className="truncate">{category}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
