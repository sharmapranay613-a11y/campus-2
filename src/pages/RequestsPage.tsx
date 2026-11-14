import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BorrowRequestCard } from '@/src/components/BorrowRequestCard';
import { PurchaseRequestCard } from '@/src/components/PurchaseRequestCard';
import { Button } from '@/src/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { useAuth } from '@/src/context/AuthContext';
import { useDashboardData } from '@/src/hooks/useDashboardData';
import {
  getBorrowAvailableActions,
  getPurchaseAvailableActions,
} from '@/src/lib/workflows';
import { getErrorMessage } from '@/src/services/errors';
import {
  cancelBorrowRequest,
  cancelPurchaseRequest,
  confirmBorrowerHandover,
  confirmBorrowerReturn,
  confirmBuyerPurchase,
  confirmOwnerHandover,
  confirmOwnerReturn,
  confirmSellerPurchase,
  respondBorrowRequest,
  respondPurchaseRequest,
} from '@/src/services/requestsService';

export function RequestsPage() {
  const { user } = useAuth();
  const { borrowRequests, purchaseRequests, stats, loading, error, reload } =
    useDashboardData();
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing'>(
    'all'
  );

  if (!user) return null;

  const handleBorrowAction = async (
    requestId: string,
    action:
      | 'approve'
      | 'reject'
      | 'borrower_handover'
      | 'owner_handover'
      | 'borrower_return'
      | 'owner_return'
      | 'cancel'
  ) => {
    try {
      switch (action) {
        case 'approve':
          await respondBorrowRequest(requestId, 'approve');
          toast.success('Borrow request approved. Awaiting two-party handover.');
          break;
        case 'reject':
          await respondBorrowRequest(requestId, 'reject');
          toast.success('Borrow request declined.');
          break;
        case 'borrower_handover':
          await confirmBorrowerHandover(requestId);
          toast.success('Recorded your receipt confirmation.');
          break;
        case 'owner_handover':
          await confirmOwnerHandover(requestId);
          toast.success('Recorded your handover confirmation.');
          break;
        case 'borrower_return':
          await confirmBorrowerReturn(requestId);
          toast.success('Recorded your return confirmation.');
          break;
        case 'owner_return':
          await confirmOwnerReturn(requestId);
          toast.success('Recorded owner return receipt.');
          break;
        case 'cancel':
          await cancelBorrowRequest(requestId);
          toast.success('Borrow request cancelled.');
          break;
      }
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update borrow request.'));
      throw err;
    }
  };

  const handlePurchaseAction = async (
    requestId: string,
    action: 'approve' | 'reject' | 'buyer_confirm' | 'seller_confirm' | 'cancel'
  ) => {
    try {
      switch (action) {
        case 'approve':
          await respondPurchaseRequest(requestId, 'approve');
          toast.success('Offer accepted. Waiting for both buyer and seller to confirm.');
          break;
        case 'reject':
          await respondPurchaseRequest(requestId, 'reject');
          toast.success('Purchase offer declined.');
          break;
        case 'buyer_confirm':
          await confirmBuyerPurchase(requestId);
          toast.success('Buyer confirmation recorded.');
          break;
        case 'seller_confirm':
          await confirmSellerPurchase(requestId);
          toast.success('Seller confirmation recorded.');
          break;
        case 'cancel':
          await cancelPurchaseRequest(requestId);
          toast.success('Purchase request cancelled.');
          break;
      }
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update purchase request.'));
      throw err;
    }
  };

  const actionRequiredBorrows = borrowRequests.filter((req) => {
    const a = getBorrowAvailableActions(req, user.id);
    return (
      a.canApprove ||
      a.canConfirmBorrowerHandover ||
      a.canConfirmOwnerHandover ||
      a.canConfirmBorrowerReturn ||
      a.canConfirmOwnerReturn
    );
  });

  const actionRequiredPurchases = purchaseRequests.filter((req) => {
    const a = getPurchaseAvailableActions(req, user.id);
    return a.canApprove || a.canConfirmBuyer || a.canConfirmSeller;
  });

  const filteredBorrows = borrowRequests.filter((req) => {
    if (directionFilter === 'incoming') return req.owner_id === user.id;
    if (directionFilter === 'outgoing') return req.borrower_id === user.id;
    return true;
  });

  const filteredPurchases = purchaseRequests.filter((req) => {
    if (directionFilter === 'incoming') return req.owner_id === user.id;
    if (directionFilter === 'outgoing') return req.buyer_id === user.id;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900">
            Requests & Confirmations
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Approve student requests and complete two-party handover, return, and sale confirmations.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link to="/transactions">View Transactions Ledger</Link>
        </Button>
      </div>

      {loading ? (
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-36 animate-pulse rounded-xl border border-stone-200 bg-white"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          {error}
        </div>
      ) : (
        <Tabs defaultValue={stats.pendingActionsCount > 0 ? 'pending' : 'borrow'} className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="pending" className="tabular-nums">
                Action Required ({stats.pendingActionsCount})
              </TabsTrigger>
              <TabsTrigger value="borrow" className="tabular-nums">
                Borrow Requests ({borrowRequests.length})
              </TabsTrigger>
              <TabsTrigger value="purchase" className="tabular-nums">
                Purchase Requests ({purchaseRequests.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1">
              {(['all', 'incoming', 'outgoing'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirectionFilter(dir)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    directionFilter === dir
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-stone-600 hover:text-zinc-900'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          <TabsContent value="pending">
            {actionRequiredBorrows.length === 0 && actionRequiredPurchases.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
                <h2 className="font-display text-lg font-semibold text-zinc-900">
                  No pending actions right now
                </h2>
                <p className="mt-1.5 text-sm text-stone-600">
                  Requests waiting for your approval or two-party confirmation appear here.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/explore">Browse Marketplace</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {actionRequiredBorrows.map((req) => (
                  <BorrowRequestCard
                    key={req.id}
                    request={req}
                    currentUserId={user.id}
                    onAction={handleBorrowAction}
                  />
                ))}
                {actionRequiredPurchases.map((req) => (
                  <PurchaseRequestCard
                    key={req.id}
                    request={req}
                    currentUserId={user.id}
                    onAction={handlePurchaseAction}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="borrow">
            {filteredBorrows.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
                <h2 className="font-display text-lg font-semibold text-zinc-900">
                  No borrow requests found
                </h2>
                <p className="mt-1.5 text-sm text-stone-600">
                  Incoming and outgoing borrow requests will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBorrows.map((req) => (
                  <BorrowRequestCard
                    key={req.id}
                    request={req}
                    currentUserId={user.id}
                    onAction={handleBorrowAction}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchase">
            {filteredPurchases.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
                <h2 className="font-display text-lg font-semibold text-zinc-900">
                  No purchase requests found
                </h2>
                <p className="mt-1.5 text-sm text-stone-600">
                  Incoming and outgoing purchase offers will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPurchases.map((req) => (
                  <PurchaseRequestCard
                    key={req.id}
                    request={req}
                    currentUserId={user.id}
                    onAction={handlePurchaseAction}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
