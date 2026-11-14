import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUserRequestBorrow,
  canUserRequestPurchase,
  computeDashboardStats,
  getBorrowAvailableActions,
  getBorrowHandoverProgress,
  getBorrowReturnProgress,
  getItemStatusInfo,
  getPurchaseAvailableActions,
  getPurchaseConfirmationProgress,
} from './workflows';
import type { BorrowRequest, Item, PurchaseRequest } from '@/src/types/database';

const ownerId = 'user-owner';
const studentId = 'user-student';
const strangerId = 'user-stranger';

const sampleBorrowableItem: Item = {
  id: 'item-1',
  owner_id: ownerId,
  title: 'CLRS Textbook',
  description: 'Clean hardcover algorithms book.',
  category: 'Textbooks',
  condition: 'Like New',
  image_url: null,
  pickup_location: 'Library',
  listing_type: 'borrow_or_buy',
  price: 45,
  borrow_duration: '2 Weeks',
  available: true,
  is_sold: false,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

test('item status info prevents borrowing or buying sold or unavailable items', () => {
  assert.deepEqual(getItemStatusInfo(sampleBorrowableItem), {
    label: 'Available',
    tone: 'available',
    canBorrow: true,
    canBuy: true,
  });

  assert.deepEqual(getItemStatusInfo({ ...sampleBorrowableItem, available: false }), {
    label: 'Currently Unavailable',
    tone: 'reserved',
    canBorrow: false,
    canBuy: false,
  });

  assert.deepEqual(
    getItemStatusInfo({ ...sampleBorrowableItem, available: false, is_sold: true }),
    {
      label: 'Sold',
      tone: 'sold',
      canBorrow: false,
      canBuy: false,
    }
  );
});

test('canUserRequestBorrow and canUserRequestPurchase enforce self-request and duplicate pending guards', () => {
  assert.equal(canUserRequestBorrow(sampleBorrowableItem, ownerId, []).allowed, false);
  assert.equal(canUserRequestPurchase(sampleBorrowableItem, ownerId, []).allowed, false);

  assert.equal(canUserRequestBorrow(sampleBorrowableItem, studentId, []).allowed, true);
  assert.equal(canUserRequestPurchase(sampleBorrowableItem, studentId, []).allowed, true);

  assert.equal(
    canUserRequestBorrow(sampleBorrowableItem, studentId, [
      { item_id: 'item-1', borrower_id: studentId, status: 'pending' },
    ]).allowed,
    false
  );
  assert.equal(
    canUserRequestPurchase(sampleBorrowableItem, studentId, [
      { item_id: 'item-1', buyer_id: studentId, status: 'pending' },
    ]).allowed,
    false
  );
});

test('two-party borrow workflow permissions and confirmation progress behave strictly', () => {
  const approvedReq: BorrowRequest = {
    id: 'br-1',
    item_id: 'item-1',
    borrower_id: studentId,
    owner_id: ownerId,
    borrower_phone: '555-0100',
    status: 'approved',
    borrower_handover_confirmed: true,
    owner_handover_confirmed: false,
    borrower_return_confirmed: false,
    owner_return_confirmed: false,
    borrower_handover_confirmed_at: '2026-11-02T12:00:00Z',
    owner_handover_confirmed_at: null,
    borrower_return_confirmed_at: null,
    owner_return_confirmed_at: null,
    borrowed_at: null,
    returned_at: null,
    created_at: '2026-11-01T12:00:00Z',
    updated_at: '2026-11-02T12:00:00Z',
  };

  const borrowerActions = getBorrowAvailableActions(approvedReq, studentId);
  assert.equal(borrowerActions.canConfirmBorrowerHandover, false); // Already confirmed
  assert.equal(borrowerActions.canConfirmOwnerHandover, false);

  const ownerActions = getBorrowAvailableActions(approvedReq, ownerId);
  assert.equal(ownerActions.canConfirmOwnerHandover, true);
  assert.equal(ownerActions.canConfirmBorrowerHandover, false);

  const strangerActions = getBorrowAvailableActions(approvedReq, strangerId);
  assert.equal(strangerActions.canConfirmOwnerHandover, false);
  assert.equal(strangerActions.canCancel, false);

  const handoverProgress = getBorrowHandoverProgress(approvedReq);
  assert.equal(handoverProgress.partyAConfirmed, true);
  assert.equal(handoverProgress.partyBConfirmed, false);
  assert.equal(handoverProgress.completed, false);

  const borrowedReq: BorrowRequest = {
    ...approvedReq,
    status: 'borrowed',
    owner_handover_confirmed: true,
    owner_handover_confirmed_at: '2026-11-02T12:05:00Z',
    borrowed_at: '2026-11-02T12:05:00Z',
    borrower_return_confirmed: true,
    borrower_return_confirmed_at: '2026-11-09T12:00:00Z',
  };

  const returnProgress = getBorrowReturnProgress(borrowedReq);
  assert.equal(returnProgress.partyAConfirmed, true);
  assert.equal(returnProgress.partyBConfirmed, false);
  assert.equal(returnProgress.completed, false);
  assert.equal(getBorrowAvailableActions(borrowedReq, ownerId).canConfirmOwnerReturn, true);
  assert.equal(getBorrowAvailableActions(borrowedReq, studentId).canConfirmBorrowerReturn, false);
});

test('two-party purchase workflow permissions require both buyer and seller confirmations', () => {
  const awaitingReq: PurchaseRequest = {
    id: 'pr-1',
    item_id: 'item-1',
    buyer_id: studentId,
    owner_id: ownerId,
    buyer_phone: '555-0199',
    offered_price: 40,
    status: 'awaiting_confirmation',
    buyer_confirmed: false,
    seller_confirmed: true,
    buyer_confirmed_at: null,
    seller_confirmed_at: '2026-11-03T10:00:00Z',
    confirmed_at: null,
    created_at: '2026-11-02T10:00:00Z',
    updated_at: '2026-11-03T10:00:00Z',
  };

  const progress = getPurchaseConfirmationProgress(awaitingReq);
  assert.equal(progress.partyAConfirmed, false);
  assert.equal(progress.partyBConfirmed, true);
  assert.equal(progress.completed, false);

  assert.equal(getPurchaseAvailableActions(awaitingReq, studentId).canConfirmBuyer, true);
  assert.equal(getPurchaseAvailableActions(awaitingReq, ownerId).canConfirmSeller, false);
  assert.equal(getPurchaseAvailableActions(awaitingReq, strangerId).canConfirmBuyer, false);
});

test('computeDashboardStats counts active listings, incoming/outgoing requests, and pending actions', () => {
  const stats = computeDashboardStats({
    totalMarketplaceListings: 12,
    myListings: [
      { available: true, is_sold: false },
      { available: false, is_sold: true },
      { available: true, is_sold: false },
    ],
    borrowRequests: [
      {
        id: 'br-1',
        item_id: 'i1',
        borrower_id: studentId,
        owner_id: ownerId,
        borrower_phone: '555-1234',
        status: 'pending',
        borrower_handover_confirmed: false,
        owner_handover_confirmed: false,
        borrower_return_confirmed: false,
        owner_return_confirmed: false,
        borrower_handover_confirmed_at: null,
        owner_handover_confirmed_at: null,
        borrower_return_confirmed_at: null,
        owner_return_confirmed_at: null,
        borrowed_at: null,
        returned_at: null,
        created_at: '',
        updated_at: '',
      },
    ],
    purchaseRequests: [
      {
        id: 'pr-1',
        item_id: 'i2',
        buyer_id: ownerId,
        owner_id: studentId,
        buyer_phone: '555-5678',
        offered_price: 25,
        status: 'awaiting_confirmation',
        buyer_confirmed: false,
        seller_confirmed: true,
        buyer_confirmed_at: null,
        seller_confirmed_at: '',
        confirmed_at: null,
        created_at: '',
        updated_at: '',
      },
    ],
    userId: ownerId,
  });

  assert.equal(stats.totalListings, 12);
  assert.equal(stats.myActiveListings, 2);
  assert.equal(stats.incomingBorrowRequests, 1);
  assert.equal(stats.outgoingBorrowRequests, 0);
  assert.equal(stats.incomingPurchaseRequests, 0);
  assert.equal(stats.outgoingPurchaseRequests, 1);
  assert.equal(stats.pendingActionsCount, 2);
});
