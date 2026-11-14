import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/src/components/ConfirmationDialog';
import { ItemImage } from '@/src/components/ItemImage';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/context/AuthContext';
import { useDashboardData } from '@/src/hooks/useDashboardData';
import {
  formatPrice,
  formatTimestamp,
  getItemStatusInfo,
  getListingTypeLabel,
} from '@/src/lib/workflows';
import { getErrorMessage } from '@/src/services/errors';
import { deleteItem, toggleItemAvailability } from '@/src/services/itemsService';
import type { Item } from '@/src/types/database';

export function MyListingsPage() {
  const { user } = useAuth();
  const { myItems, stats, loading, error, reload } = useDashboardData();

  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (!user) return null;

  const handleToggleAvailability = async (item: Item) => {
    setTogglingId(item.id);
    try {
      await toggleItemAvailability(item.id, user.id, !item.available);
      toast.success(
        !item.available
          ? 'Listing marked as available.'
          : 'Listing marked as unavailable.'
      );
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to change item availability.'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await deleteItem(itemToDelete.id, user.id, itemToDelete.image_url);
      toast.success('Listing deleted.');
      setItemToDelete(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete listing.'));
      setItemToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900">
            My Listings & Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Manage your posted items and monitor active campus requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/requests">View Requests</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/transactions">Transactions</Link>
          </Button>
          <Button asChild>
            <Link to="/items/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Listing</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <section aria-label="Dashboard overview metrics" className="mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Total Listings</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
              {stats.totalListings}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">My Active</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-900">
              {stats.myActiveListings}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">In Borrow</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
              {stats.incomingBorrowRequests}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Out Borrow</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
              {stats.outgoingBorrowRequests}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">In Purchase</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
              {stats.incomingPurchaseRequests}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Out Purchase</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
              {stats.outgoingPurchaseRequests}
            </p>
          </div>
          <Link
            to="/requests"
            className="rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-amber-600"
          >
            <p className="text-xs text-stone-500">Pending Actions</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                stats.pendingActionsCount > 0 ? 'text-amber-700' : 'text-zinc-900'
              }`}
            >
              {stats.pendingActionsCount}
            </p>
          </Link>
        </div>
      </section>

      {/* Listings Section */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-zinc-900">
          Your Posted Items
        </h2>

        {loading ? (
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-28 animate-pulse rounded-xl border border-stone-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          >
            {error}
          </div>
        ) : myItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-10 text-center">
            <h3 className="font-display text-lg font-semibold text-zinc-900">
              You haven&apos;t listed any items yet
            </h3>
            <p className="mt-1.5 text-sm text-stone-600">
              Share textbooks, calculators, or equipment you aren&apos;t using this term.
            </p>
            <Button asChild className="mt-5">
              <Link to="/items/new">Create Your First Listing</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {myItems.map((item) => {
              const status = getItemStatusInfo(item);
              return (
                <article
                  key={item.id}
                  className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center"
                >
                  <Link
                    to={`/items/${item.id}`}
                    className="h-24 w-full shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 sm:w-32"
                  >
                    <ItemImage
                      imageUrl={item.image_url}
                      category={item.category}
                      title={item.title}
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.condition}</span>
                      <span aria-hidden="true">·</span>
                      <span>{getListingTypeLabel(item.listing_type)}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          status.tone === 'available'
                            ? 'font-semibold text-emerald-800'
                            : status.tone === 'sold'
                            ? 'font-semibold text-red-700'
                            : 'font-semibold text-amber-700'
                        }
                      >
                        {status.label}
                      </span>
                    </div>

                    <Link
                      to={`/items/${item.id}`}
                      className="mt-1 block truncate font-display text-lg font-semibold text-zinc-900 hover:text-emerald-900"
                    >
                      {item.title}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                      {item.price !== null && (
                        <span className="font-mono font-semibold tabular-nums text-zinc-900">
                          {formatPrice(item.price)}
                        </span>
                      )}
                      {item.borrow_duration && (
                        <span>Max borrow: {item.borrow_duration}</span>
                      )}
                      <span>Pickup: {item.pickup_location}</span>
                      <span className="font-mono tabular-nums text-stone-500">
                        Updated {formatTimestamp(item.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!item.is_sold && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={togglingId === item.id}
                          onClick={() => void handleToggleAvailability(item)}
                        >
                          {togglingId === item.id
                            ? 'Updating...'
                            : item.available
                            ? 'Mark Unavailable'
                            : 'Mark Available'}
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to={`/items/${item.id}/edit`}
                            aria-label={`Edit ${item.title}`}
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${item.title}`}
                          onClick={() => setItemToDelete(item)}
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Delete</span>
                        </Button>
                      </>
                    )}
                    {item.is_sold && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/items/${item.id}`}>View Sold Record</Link>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmationDialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setItemToDelete(null);
        }}
        title={`Delete "${itemToDelete?.title ?? ''}"?`}
        description="This permanently removes the listing. Listings with existing transaction history cannot be deleted and should be marked unavailable instead."
        confirmLabel="Delete Listing"
        confirmVariant="destructive"
        busy={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
