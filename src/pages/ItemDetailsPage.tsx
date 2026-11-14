import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit3, MapPin, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { ItemImage } from '@/src/components/ItemImage';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { useAuth } from '@/src/context/AuthContext';
import { borrowRequestSchema, purchaseRequestSchema } from '@/src/lib/validation';
import {
  canUserRequestBorrow,
  canUserRequestPurchase,
  formatPrice,
  formatTimestamp,
  getItemStatusInfo,
  getListingTypeLabel,
} from '@/src/lib/workflows';
import { getErrorMessage } from '@/src/services/errors';
import { getItemById } from '@/src/services/itemsService';
import {
  createBorrowRequest,
  createPurchaseRequest,
  listUserBorrowRequests,
  listUserPurchaseRequests,
} from '@/src/services/requestsService';
import type {
  BorrowRequestWithDetails,
  ItemWithOwner,
  PurchaseRequestWithDetails,
} from '@/src/types/database';

export function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isConfigured } = useAuth();

  const [item, setItem] = useState<ItemWithOwner | null>(null);
  const [userBorrows, setUserBorrows] = useState<BorrowRequestWithDetails[]>([]);
  const [userPurchases, setUserPurchases] = useState<PurchaseRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [borrowPhone, setBorrowPhone] = useState('');
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [borrowSubmitting, setBorrowSubmitting] = useState(false);

  const [buyerPhone, setBuyerPhone] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || !isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const itemData = await getItemById(id);
      setItem(itemData);
      if (itemData?.price !== null && itemData?.price !== undefined) {
        setOfferedPrice(String(itemData.price));
      }

      if (user) {
        const [borrows, purchases] = await Promise.all([
          listUserBorrowRequests(user.id),
          listUserPurchaseRequests(user.id),
        ]);
        setUserBorrows(borrows);
        setUserPurchases(purchases);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load listing details.'));
    } finally {
      setLoading(false);
    }
  }, [id, isConfigured, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBorrowSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setBorrowError(null);

    const parsed = borrowRequestSchema.safeParse({ borrower_phone: borrowPhone });
    if (!parsed.success) {
      setBorrowError(parsed.error.issues[0]?.message ?? 'Invalid phone number.');
      return;
    }

    setBorrowSubmitting(true);
    try {
      await createBorrowRequest(item.id, borrowPhone);
      toast.success('Borrow request sent to the item owner.');
      setBorrowPhone('');
      await loadData();
    } catch (err) {
      const msg = getErrorMessage(err, 'Unable to submit borrow request.');
      setBorrowError(msg);
      toast.error(msg);
    } finally {
      setBorrowSubmitting(false);
    }
  };

  const handlePurchaseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setPurchaseError(null);

    const parsed = purchaseRequestSchema.safeParse({
      buyer_phone: buyerPhone,
      offered_price: offeredPrice,
    });
    if (!parsed.success) {
      setPurchaseError(parsed.error.issues[0]?.message ?? 'Invalid purchase offer.');
      return;
    }

    setPurchaseSubmitting(true);
    try {
      await createPurchaseRequest(item.id, buyerPhone, offeredPrice);
      toast.success('Purchase request sent to the seller.');
      setBuyerPhone('');
      await loadData();
    } catch (err) {
      const msg = getErrorMessage(err, 'Unable to submit purchase request.');
      setPurchaseError(msg);
      toast.error(msg);
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-6 w-32 animate-pulse rounded bg-stone-200" />
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-xl border border-stone-200 bg-white lg:col-span-7" />
          <div className="h-96 animate-pulse rounded-xl border border-stone-200 bg-white lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          Supabase Connection Required
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Configure Supabase credentials in <code className="font-mono text-xs">.env</code> to
          view and interact with live item listings.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          {error ? 'Could not load listing' : 'Listing not found'}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {error ?? 'This listing may have been removed by its owner.'}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/explore">Return to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const isOwner = Boolean(user && item.owner_id === user.id);
  const status = getItemStatusInfo(item);
  const borrowEligibility = canUserRequestBorrow(item, user?.id, userBorrows);
  const purchaseEligibility = canUserRequestPurchase(item, user?.id, userPurchases);

  const defaultTab =
    item.listing_type === 'sell_only' ? 'buy' : 'borrow';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/explore"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to Explore</span>
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-12">
        {/* Left: Product Photo + Details */}
        <div className="space-y-6 lg:col-span-7">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-stone-200 bg-white">
            <ItemImage
              imageUrl={item.image_url}
              category={item.category}
              title={item.title}
            />
          </div>

          <section className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-zinc-900">
              Item Description
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">
              {item.description}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-stone-500">Category</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{item.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Condition</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{item.condition}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Listing Type</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {getListingTypeLabel(item.listing_type)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Pickup Location</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{item.pickup_location}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Listed On</dt>
                <dd className="mt-0.5 font-mono text-xs tabular-nums text-zinc-900">
                  {formatTimestamp(item.created_at)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right: Contiguous Purchase / Borrow Module */}
        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium uppercase tracking-wide text-stone-500">
                {item.category}
              </span>
              <span
                className={
                  status.tone === 'available'
                    ? 'font-semibold text-emerald-800'
                    : status.tone === 'sold'
                    ? 'font-semibold text-red-700'
                    : 'font-semibold text-amber-800'
                }
              >
                {status.label}
              </span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-900">
              {item.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-y border-stone-100 py-4">
              {item.price !== null && (
                <div>
                  <span className="block text-xs text-stone-500">Selling Price</span>
                  <span className="font-mono text-2xl font-bold tabular-nums text-zinc-900">
                    {formatPrice(item.price)}
                  </span>
                </div>
              )}
              {item.borrow_duration && (
                <div>
                  <span className="block text-xs text-stone-500">Max Borrow Period</span>
                  <span className="font-display text-lg font-semibold text-zinc-900">
                    {item.borrow_duration}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm text-stone-600">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-stone-400" aria-hidden="true" />
                <span>
                  Listed by{' '}
                  <strong className="font-medium text-zinc-900">
                    {item.owner?.full_name ?? 'Campus Student'}
                  </strong>
                  {item.owner?.department ? ` · ${item.owner.department}` : ''}
                  {item.owner?.year ? ` · ${item.owner.year}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-stone-400" aria-hidden="true" />
                <span>Pickup at {item.pickup_location}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-800" aria-hidden="true" />
                <span>Protected by two-party confirmation</span>
              </div>
            </div>

            {/* Transaction Actions */}
            <div className="mt-6 border-t border-stone-200 pt-5">
              {isOwner ? (
                <div className="space-y-3">
                  <p className="text-sm text-stone-600">
                    You own this listing. Manage edits, availability, or incoming student requests
                    from your dashboard.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!item.is_sold && (
                      <Button asChild>
                        <Link to={`/items/${item.id}/edit`}>
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                          <span>Edit Listing</span>
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline">
                      <Link to="/requests">View Requests</Link>
                    </Button>
                  </div>
                </div>
              ) : !user ? (
                <div className="space-y-3">
                  <p className="text-sm text-stone-600">
                    Sign in with your college account to request borrowing or buying this item.
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => navigate('/login', { state: { from: `/items/${item.id}` } })}
                  >
                    Sign In to Request Item
                  </Button>
                </div>
              ) : item.is_sold || !item.available ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                  {item.is_sold
                    ? 'This item has been sold and confirmed by both parties.'
                    : 'This item is currently unavailable for new borrow or purchase requests.'}
                </div>
              ) : (
                <Tabs defaultValue={defaultTab}>
                  {item.listing_type === 'borrow_or_buy' && (
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="borrow">Request to Borrow</TabsTrigger>
                      <TabsTrigger value="buy">Make Purchase Offer</TabsTrigger>
                    </TabsList>
                  )}

                  {(item.listing_type === 'borrow_only' ||
                    item.listing_type === 'borrow_or_buy') && (
                    <TabsContent value="borrow">
                      {!borrowEligibility.allowed ? (
                        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                          <p>{borrowEligibility.reason}</p>
                          <Button asChild size="sm" variant="outline">
                            <Link to="/requests">Manage My Requests</Link>
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleBorrowSubmit} className="space-y-4" noValidate>
                          <div>
                            <Label htmlFor="borrow-phone">Your Phone Number</Label>
                            <Input
                              id="borrow-phone"
                              type="tel"
                              value={borrowPhone}
                              onChange={(e) => setBorrowPhone(e.target.value)}
                              placeholder="e.g., +1 555-234-5678"
                              className="mt-1.5"
                              required
                            />
                            <p className="mt-1 text-xs text-stone-500">
                              Shared with the owner to coordinate campus pickup ({item.pickup_location}).
                            </p>
                            {borrowError && (
                              <p className="mt-1.5 text-xs font-medium text-red-700">
                                {borrowError}
                              </p>
                            )}
                          </div>
                          <Button type="submit" className="w-full" disabled={borrowSubmitting}>
                            {borrowSubmitting ? 'Sending Request...' : 'Send Borrow Request'}
                          </Button>
                        </form>
                      )}
                    </TabsContent>
                  )}

                  {(item.listing_type === 'sell_only' ||
                    item.listing_type === 'borrow_or_buy') && (
                    <TabsContent value="buy">
                      {!purchaseEligibility.allowed ? (
                        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                          <p>{purchaseEligibility.reason}</p>
                          <Button asChild size="sm" variant="outline">
                            <Link to="/requests">Manage My Requests</Link>
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handlePurchaseSubmit} className="space-y-4" noValidate>
                          <div>
                            <Label htmlFor="purchase-offered-price">Offered Price (USD)</Label>
                            <Input
                              id="purchase-offered-price"
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={offeredPrice}
                              onChange={(e) => setOfferedPrice(e.target.value)}
                              className="mt-1.5 font-mono tabular-nums"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="purchase-phone">Your Phone Number</Label>
                            <Input
                              id="purchase-phone"
                              type="tel"
                              value={buyerPhone}
                              onChange={(e) => setBuyerPhone(e.target.value)}
                              placeholder="e.g., +1 555-234-5678"
                              className="mt-1.5"
                              required
                            />
                            <p className="mt-1 text-xs text-stone-500">
                              Item is marked sold only after both you and the seller confirm completion.
                            </p>
                          </div>
                          {purchaseError && (
                            <p className="text-xs font-medium text-red-700">{purchaseError}</p>
                          )}
                          <Button type="submit" className="w-full" disabled={purchaseSubmitting}>
                            {purchaseSubmitting ? 'Submitting Offer...' : 'Submit Purchase Request'}
                          </Button>
                        </form>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
