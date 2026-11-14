import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Phone, XCircle } from 'lucide-react';
import { ConfirmationDialog } from '@/src/components/ConfirmationDialog';
import { ItemImage } from '@/src/components/ItemImage';
import { Button } from '@/src/components/ui/button';
import {
  formatPrice,
  formatTimestamp,
  getPurchaseAvailableActions,
  getPurchaseConfirmationProgress,
  getPurchaseStatusLabel,
} from '@/src/lib/workflows';
import type { PurchaseRequestWithDetails } from '@/src/types/database';

type PendingAction =
  | { type: 'approve'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'reject'; title: string; description: string; label: string; variant: 'destructive' }
  | { type: 'buyer_confirm'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'seller_confirm'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'cancel'; title: string; description: string; label: string; variant: 'destructive' };

interface PurchaseRequestCardProps {
  request: PurchaseRequestWithDetails;
  currentUserId: string;
  onAction: (
    requestId: string,
    action: PendingAction['type']
  ) => Promise<void>;
}

export function PurchaseRequestCard({
  request,
  currentUserId,
  onAction,
}: PurchaseRequestCardProps) {
  const [confirmState, setConfirmState] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = request.owner_id === currentUserId;
  const otherPerson = isOwner ? request.buyer : request.owner;
  const roleLabel = isOwner ? 'Incoming Purchase Offer' : 'Outgoing Purchase Offer';
  const actions = getPurchaseAvailableActions(request, currentUserId);
  const progress = getPurchaseConfirmationProgress(request);
  const statusLabel = getPurchaseStatusLabel(request.status);

  const showPhone =
    request.status === 'awaiting_confirmation' ||
    (isOwner && request.status === 'pending');

  const statusTextColor =
    request.status === 'sold'
      ? 'text-emerald-800'
      : request.status === 'awaiting_confirmation'
      ? 'text-amber-800'
      : request.status === 'rejected' || request.status === 'cancelled'
      ? 'text-red-700'
      : 'text-zinc-800';

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setBusy(true);
    try {
      await onAction(request.id, confirmState.type);
      setConfirmState(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Link
          to={`/items/${request.item_id}`}
          className="h-24 w-full shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 sm:w-32"
        >
          <ItemImage
            imageUrl={request.item?.image_url}
            category={request.item?.category ?? 'Other'}
            title={request.item?.title ?? 'Listed item'}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
              {roleLabel}
            </span>
            <span className={`text-xs font-semibold ${statusTextColor}`}>
              {statusLabel}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <Link
              to={`/items/${request.item_id}`}
              className="truncate font-display text-lg font-semibold text-zinc-900 hover:text-emerald-900"
            >
              {request.item?.title ?? 'Item Listing'}
            </Link>
            <span className="font-mono text-base font-semibold tabular-nums text-zinc-900">
              Offer: {formatPrice(request.offered_price)}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
            <span>
              {isOwner ? 'Buyer' : 'Seller'}:{' '}
              <strong className="font-medium text-zinc-900">
                {otherPerson?.full_name ?? 'Student'}
              </strong>
              {otherPerson?.department ? ` (${otherPerson.department})` : ''}
            </span>
            {request.item?.price !== null && request.item?.price !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Listed at {formatPrice(request.item.price)}
                </span>
              </>
            )}
            {request.item?.pickup_location && (
              <>
                <span aria-hidden="true">·</span>
                <span>Pickup: {request.item.pickup_location}</span>
              </>
            )}
          </div>

          {showPhone && (
            <div className="mt-2 flex items-center gap-2 text-xs text-stone-600">
              <Phone className="h-3.5 w-3.5 text-stone-500" aria-hidden="true" />
              <span>
                Buyer contact:{' '}
                <span className="font-mono font-medium text-zinc-900">
                  {request.buyer_phone}
                </span>
              </span>
            </div>
          )}

          {(request.status === 'awaiting_confirmation' || request.status === 'sold') && (
            <div className="mt-4 space-y-1.5 border-t border-stone-100 pt-3 text-xs">
              <p className="font-semibold text-zinc-800">Mutual Purchase Confirmation</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                <div className="flex items-center gap-2 text-stone-700">
                  {progress.partyAConfirmed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <span>{progress.partyALabel}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-700">
                  {progress.partyBConfirmed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <span>{progress.partyBLabel}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-100 pt-3 font-mono text-[11px] tabular-nums text-stone-500">
            <span>Offered: {formatTimestamp(request.created_at)}</span>
            {request.buyer_confirmed_at && (
              <span>Buyer Confirmed: {formatTimestamp(request.buyer_confirmed_at)}</span>
            )}
            {request.seller_confirmed_at && (
              <span>Seller Confirmed: {formatTimestamp(request.seller_confirmed_at)}</span>
            )}
            {request.confirmed_at && (
              <span>Sold Completed: {formatTimestamp(request.confirmed_at)}</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {actions.canApprove && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'approve',
                    title: 'Accept purchase offer?',
                    description:
                      'Accepting moves this offer to Awaiting Confirmation and holds the item. The item will ONLY be marked sold after both you and the buyer confirm completion.',
                    label: 'Accept Offer',
                    variant: 'default',
                  })
                }
              >
                Accept Offer
              </Button>
            )}

            {actions.canReject && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setConfirmState({
                    type: 'reject',
                    title: 'Decline purchase offer?',
                    description:
                      'The buyer will see this offer as declined and the listing remains open for other students.',
                    label: 'Decline Offer',
                    variant: 'destructive',
                  })
                }
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Decline
              </Button>
            )}

            {actions.canConfirmBuyer && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'buyer_confirm',
                    title: 'Confirm purchase completion?',
                    description:
                      'Confirm only after inspecting the item and completing payment in person. Once both parties confirm, the item is permanently marked Sold.',
                    label: 'Confirm Purchase',
                    variant: 'default',
                  })
                }
              >
                Confirm Purchase
              </Button>
            )}

            {actions.canConfirmSeller && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'seller_confirm',
                    title: 'Confirm sale completion?',
                    description:
                      'Confirm only after handing over the item and receiving payment. Once both parties confirm, the item is permanently marked Sold and competing offers are closed.',
                    label: 'Confirm Sale',
                    variant: 'default',
                  })
                }
              >
                Confirm Sale
              </Button>
            )}

            {actions.canCancel && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setConfirmState({
                    type: 'cancel',
                    title: 'Cancel purchase request?',
                    description:
                      'This cancels the uncompleted purchase request and restores listing availability if it was held.',
                    label: 'Cancel Offer',
                    variant: 'destructive',
                  })
                }
              >
                Cancel Offer
              </Button>
            )}
          </div>
        </div>
      </div>

      {confirmState && (
        <ConfirmationDialog
          open={Boolean(confirmState)}
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmState(null);
          }}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.label}
          confirmVariant={confirmState.variant}
          busy={busy}
          onConfirm={runConfirmedAction}
        />
      )}
    </article>
  );
}
