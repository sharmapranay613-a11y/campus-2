import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ItemCard } from '@/src/components/ItemCard';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select } from '@/src/components/ui/select';
import { ITEM_CATEGORIES, ITEM_CONDITIONS } from '@/src/config/campus';
import { useAuth } from '@/src/context/AuthContext';
import { getErrorMessage } from '@/src/services/errors';
import {
  listMarketplaceItems,
  type ExploreListingTypeFilter,
} from '@/src/services/itemsService';
import type { ItemCategory, ItemCondition, ItemWithOwner } from '@/src/types/database';

const TYPE_FILTERS: { value: ExploreListingTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'borrow', label: 'Borrow' },
  { value: 'buy', label: 'Buy' },
  { value: 'both', label: 'Borrow & Buy' },
];

export function ExplorePage() {
  const { user, isConfigured } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCategory = (searchParams.get('category') as ItemCategory | 'all') || 'all';
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState<ItemCategory | 'all'>(
    ITEM_CATEGORIES.includes(initialCategory as ItemCategory) ? initialCategory : 'all'
  );
  const [listingType, setListingType] = useState<ExploreListingTypeFilter>(
    (searchParams.get('type') as ExploreListingTypeFilter) || 'all'
  );
  const [condition, setCondition] = useState<ItemCondition | 'all'>('all');
  const [availableOnly, setAvailableOnly] = useState(true);

  const [items, setItems] = useState<ItemWithOwner[]>([]);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await listMarketplaceItems({
        search,
        category,
        listingType,
        condition,
        availableOnly,
      });
      setItems(results);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch marketplace listings.'));
    } finally {
      setLoading(false);
    }
  }, [isConfigured, search, category, listingType, condition, availableOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchItems();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setListingType('all');
    setCondition('all');
    setAvailableOnly(true);
    setSearchParams({});
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900">
            Explore Campus Marketplace
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Search textbooks, electronics, lab equipment, and study gear sorted by newest.
          </p>
        </div>
        {user && (
          <Button asChild>
            <Link to="/items/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Listing</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Search and filters"
        className="mt-6 rounded-xl border border-stone-200 bg-white p-5"
      >
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <Label htmlFor="explore-search">Search title or description</Label>
            <div className="relative mt-1.5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <Input
                id="explore-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search calculus book, TI-84, Arduino..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="md:col-span-4">
            <Label htmlFor="explore-category">Category</Label>
            <Select
              id="explore-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory | 'all')}
              className="mt-1.5"
            >
              <option value="all">All Categories</option>
              {ITEM_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label htmlFor="explore-condition">Condition</Label>
            <Select
              id="explore-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as ItemCondition | 'all')}
              className="mt-1.5"
            >
              <option value="all">All Conditions</option>
              {ITEM_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-4">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1">
            {TYPE_FILTERS.map((opt) => {
              const active = listingType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setListingType(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-stone-600 hover:text-zinc-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <label
              htmlFor="explore-available-only"
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-800"
            >
              <input
                id="explore-available-only"
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 accent-emerald-900"
              />
              <span>Available items only</span>
            </label>

            <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </section>

      {/* Results Header */}
      <div className="mt-6 flex items-center justify-between text-xs text-stone-500">
        <span className="tabular-nums">
          {loading ? 'Loading listings...' : `${items.length} listing${items.length === 1 ? '' : 's'} shown`}
        </span>
        <span>Sorted by newest</span>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-80 animate-pulse rounded-xl border border-stone-200 bg-white"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        >
          {error}
        </div>
      ) : !isConfigured ? (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Supabase Environment Not Configured
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            Configure <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> to query live
            listings from your Supabase PostgreSQL database.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            No matching items found
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Try clearing one of your filters or searching with broader keywords.
          </p>
          <div className="mt-5">
            <Button type="button" variant="outline" onClick={handleResetFilters}>
              Clear All Filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
