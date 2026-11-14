import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Phone, XCircle } from 'lucide-react';
import { ConfirmationDialog } from '@/src/components/ConfirmationDialog';
import { ItemImage } from '@/src/components/ItemImage';
import { Button } from '@/src/components/ui/button';
import {
  formatTimestamp,
  getBorrowAvailableActions,
  getBorrowHandoverProgress,
  getBorrowReturnProgress,
  getBorrowStatusLabel,
} from '@/src/lib/workflows';
import type { BorrowRequestWithDetails } from '@/src/types/database';

type PendingAction =
  | { type: 'approve'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'reject'; title: string; description: string; label: string; variant: 'destructive' }
  | { type: 'borrower_handover'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'owner_handover'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'borrower_return'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'owner_return'; title: string; description: string; label: string; variant: 'default' }
  | { type: 'cancel'; title: string; description: string; label: string; variant: 'destructive' };

interface BorrowRequestCardProps {
  request: BorrowRequestWithDetails;
  currentUserId: string;
  onAction: (
    requestId: string,
    action: PendingAction['type']
  ) => Promise<void>;
}

export function BorrowRequestCard({
  request,
  currentUserId,
  onAction,
}: BorrowRequestCardProps) {
  const [confirmState, setConfirmState] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = request.owner_id === currentUserId;
  const otherPerson = isOwner ? request.borrower : request.owner;
  const roleLabel = isOwner ? 'Incoming Borrow Request' : 'Outgoing Borrow Request';
  const actions = getBorrowAvailableActions(request, currentUserId);
  const handover = getBorrowHandoverProgress(request);
  const returnStep = getBorrowReturnProgress(request);
  const statusLabel = getBorrowStatusLabel(request.status);

  const showPhone =
    request.status === 'approved' ||
    request.status === 'borrowed' ||
    (isOwner && request.status === 'pending');

  const statusTextColor =
    request.status === 'returned'
      ? 'text-emerald-800'
      : request.status === 'borrowed' || request.status === 'approved'
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

          <Link
            to={`/items/${request.item_id}`}
            className="mt-1 block truncate font-display text-lg font-semibold text-zinc-900 hover:text-emerald-900"
          >
            {request.item?.title ?? 'Item Listing'}
          </Link>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
            <span>
              {isOwner ? 'Borrower' : 'Owner'}:{' '}
              <strong className="font-medium text-zinc-900">
                {otherPerson?.full_name ?? 'Student'}
              </strong>
              {otherPerson?.department ? ` (${otherPerson.department})` : ''}
            </span>
            {request.item?.borrow_duration && (
              <>
                <span aria-hidden="true">·</span>
                <span>Duration: {request.item.borrow_duration}</span>
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
                Borrower contact:{' '}
                <span className="font-mono font-medium text-zinc-900">
                  {request.borrower_phone}
                </span>
              </span>
            </div>
          )}

          {/* Two-party confirmation tracking */}
          {(request.status === 'approved' ||
            request.status === 'borrowed' ||
            request.status === 'returned') && (
            <div className="mt-4 grid gap-3 border-t border-stone-100 pt-3 text-xs sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="font-semibold text-zinc-800">Handover Verification</p>
                <div className="flex items-center gap-2 text-stone-700">
                  {handover.partyAConfirmed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <span>{handover.partyALabel}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-700">
                  {handover.partyBConfirmed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <span>{handover.partyBLabel}</span>
                </div>
              </div>

              {(request.status === 'borrowed' || request.status === 'returned') && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-zinc-800">Return Verification</p>
                  <div className="flex items-center gap-2 text-stone-700">
                    {returnStep.partyAConfirmed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    )}
                    <span>{returnStep.partyALabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-700">
                    {returnStep.partyBConfirmed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    )}
                    <span>{returnStep.partyBLabel}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-100 pt-3 font-mono text-[11px] tabular-nums text-stone-500">
            <span>Requested: {formatTimestamp(request.created_at)}</span>
            {request.borrowed_at && <span>Handover Complete: {formatTimestamp(request.borrowed_at)}</span>}
            {request.returned_at && <span>Returned: {formatTimestamp(request.returned_at)}</span>}
          </div>

          {/* Real RPC Action Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {actions.canApprove && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'approve',
                    title: 'Approve borrow request?',
                    description:
                      'Approving reserves this item for handover. Both you and the borrower must still confirm handover before it becomes actively borrowed.',
                    label: 'Approve Request',
                    variant: 'default',
                  })
                }
              >
                Approve
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
                    title: 'Decline borrow request?',
                    description:
                      'The requester will be notified and this request record will remain in history as declined.',
                    label: 'Decline Request',
                    variant: 'destructive',
                  })
                }
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Decline
              </Button>
            )}

            {actions.canConfirmBorrowerHandover && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'borrower_handover',
                    title: 'Confirm item received?',
                    description:
                      'Confirm only after physically inspecting and receiving the item from the owner.',
                    label: 'Confirm Received',
                    variant: 'default',
                  })
                }
              >
                Confirm Received
              </Button>
            )}

            {actions.canConfirmOwnerHandover && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'owner_handover',
                    title: 'Confirm item handed over?',
                    description:
                      'Confirm only after handing the item to the borrower. Once both parties confirm, status becomes Borrowed.',
                    label: 'Confirm Handed Over',
                    variant: 'default',
                  })
                }
              >
                Confirm Handed Over
              </Button>
            )}

            {actions.canConfirmBorrowerReturn && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'borrower_return',
                    title: 'Confirm item returned?',
                    description:
                      'Confirm only after handing the item back to the owner. The owner must also confirm receipt.',
                    label: 'Confirm Returned',
                    variant: 'default',
                  })
                }
              >
                Confirm Returned
              </Button>
            )}

            {actions.canConfirmOwnerReturn && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setConfirmState({
                    type: 'owner_return',
                    title: 'Confirm item received back?',
                    description:
                      'Confirm once you have the item back in hand. When both parties confirm return, the listing becomes available again.',
                    label: 'Confirm Received Back',
                    variant: 'default',
                  })
                }
              >
                Confirm Received Back
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
                    title: 'Cancel borrow request?',
                    description:
                      'This cancels the request before handover completion and restores listing availability if reserved.',
                    label: 'Cancel Request',
                    variant: 'destructive',
                  })
                }
              >
                Cancel Request
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
