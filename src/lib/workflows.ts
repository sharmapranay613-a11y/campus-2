import type {
  BorrowRequest,
  BorrowStatus,
  DashboardStats,
  Item,
  ListingType,
  PurchaseRequest,
  PurchaseStatus,
} from '@/src/types/database';

export function getListingTypeLabel(type: ListingType): string {
  switch (type) {
    case 'borrow_only':
      return 'Borrow Only';
    case 'sell_only':
      return 'For Sale';
    case 'borrow_or_buy':
      return 'Borrow or Buy';
  }
}

export function getItemStatusInfo(item: Pick<Item, 'available' | 'is_sold' | 'listing_type'>): {
  label: string;
  tone: 'available' | 'reserved' | 'sold';
  canBorrow: boolean;
  canBuy: boolean;
} {
  if (item.is_sold) {
    return {
      label: 'Sold',
      tone: 'sold',
      canBorrow: false,
      canBuy: false,
    };
  }
  if (!item.available) {
    return {
      label: 'Currently Unavailable',
      tone: 'reserved',
      canBorrow: false,
      canBuy: false,
    };
  }
  return {
    label: 'Available',
    tone: 'available',
    canBorrow: item.listing_type === 'borrow_only' || item.listing_type === 'borrow_or_buy',
    canBuy: item.listing_type === 'sell_only' || item.listing_type === 'borrow_or_buy',
  };
}

export function getBorrowStatusLabel(status: BorrowStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending Owner Approval';
    case 'approved':
      return 'Approved — Handover Confirmation';
    case 'rejected':
      return 'Declined by Owner';
    case 'borrowed':
      return 'Borrowed — Awaiting Return';
    case 'returned':
      return 'Returned & Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function getPurchaseStatusLabel(status: PurchaseStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending Seller Approval';
    case 'awaiting_confirmation':
      return 'Approved — Mutual Confirmation';
    case 'sold':
      return 'Sold & Confirmed';
    case 'rejected':
      return 'Declined by Seller';
    case 'cancelled':
      return 'Cancelled';
  }
}

export interface TwoPartyConfirmationProgress {
  partyALabel: string;
  partyAConfirmed: boolean;
  partyBLabel: string;
  partyBConfirmed: boolean;
  completed: boolean;
}

export function getBorrowHandoverProgress(
  req: Pick<
    BorrowRequest,
    'borrower_handover_confirmed' | 'owner_handover_confirmed' | 'status'
  >
): TwoPartyConfirmationProgress {
  return {
    partyALabel: req.borrower_handover_confirmed
      ? 'Borrower confirmed receipt'
      : 'Awaiting borrower receipt',
    partyAConfirmed: req.borrower_handover_confirmed,
    partyBLabel: req.owner_handover_confirmed
      ? 'Owner confirmed handover'
      : 'Awaiting owner handover',
    partyBConfirmed: req.owner_handover_confirmed,
    completed: req.status === 'borrowed' || req.status === 'returned',
  };
}

export function getBorrowReturnProgress(
  req: Pick<
    BorrowRequest,
    'borrower_return_confirmed' | 'owner_return_confirmed' | 'status'
  >
): TwoPartyConfirmationProgress {
  return {
    partyALabel: req.borrower_return_confirmed
      ? 'Borrower confirmed return'
      : 'Awaiting borrower return',
    partyAConfirmed: req.borrower_return_confirmed,
    partyBLabel: req.owner_return_confirmed
      ? 'Owner confirmed item back'
      : 'Awaiting owner receipt',
    partyBConfirmed: req.owner_return_confirmed,
    completed: req.status === 'returned',
  };
}

export function getPurchaseConfirmationProgress(
  req: Pick<PurchaseRequest, 'buyer_confirmed' | 'seller_confirmed' | 'status'>
): TwoPartyConfirmationProgress {
  return {
    partyALabel: req.buyer_confirmed ? 'Buyer confirmed' : 'Awaiting buyer',
    partyAConfirmed: req.buyer_confirmed,
    partyBLabel: req.seller_confirmed ? 'Seller confirmed' : 'Awaiting seller',
    partyBConfirmed: req.seller_confirmed,
    completed: req.status === 'sold',
  };
}

export function canUserRequestBorrow(
  item: Pick<Item, 'id' | 'owner_id' | 'available' | 'is_sold' | 'listing_type'>,
  userId: string | null | undefined,
  existingBorrowRequests: Pick<BorrowRequest, 'item_id' | 'borrower_id' | 'status'>[]
): { allowed: boolean; reason?: string } {
  if (!userId) {
    return { allowed: false, reason: 'Sign in with your college account to send a borrow request.' };
  }
  if (item.owner_id === userId) {
    return { allowed: false, reason: 'You cannot borrow your own listing.' };
  }
  if (item.is_sold || !item.available) {
    return { allowed: false, reason: 'This item is currently unavailable.' };
  }
  if (item.listing_type !== 'borrow_only' && item.listing_type !== 'borrow_or_buy') {
    return { allowed: false, reason: 'This item is listed for sale only.' };
  }
  const hasPending = existingBorrowRequests.some(
    (req) =>
      req.item_id === item.id &&
      req.borrower_id === userId &&
      req.status === 'pending'
  );
  if (hasPending) {
    return { allowed: false, reason: 'You already have a pending borrow request for this item.' };
  }
  return { allowed: true };
}

export function canUserRequestPurchase(
  item: Pick<Item, 'id' | 'owner_id' | 'available' | 'is_sold' | 'listing_type'>,
  userId: string | null | undefined,
  existingPurchaseRequests: Pick<PurchaseRequest, 'item_id' | 'buyer_id' | 'status'>[]
): { allowed: boolean; reason?: string } {
  if (!userId) {
    return { allowed: false, reason: 'Sign in with your college account to submit a purchase offer.' };
  }
  if (item.owner_id === userId) {
    return { allowed: false, reason: 'You cannot purchase your own listing.' };
  }
  if (item.is_sold || !item.available) {
    return { allowed: false, reason: 'This item is sold or currently unavailable.' };
  }
  if (item.listing_type !== 'sell_only' && item.listing_type !== 'borrow_or_buy') {
    return { allowed: false, reason: 'This item is listed for borrowing only.' };
  }
  const hasPending = existingPurchaseRequests.some(
    (req) =>
      req.item_id === item.id &&
      req.buyer_id === userId &&
      req.status === 'pending'
  );
  if (hasPending) {
    return { allowed: false, reason: 'You already have a pending purchase request for this item.' };
  }
  return { allowed: true };
}

export function getBorrowAvailableActions(
  req: Pick<
    BorrowRequest,
    | 'borrower_id'
    | 'owner_id'
    | 'status'
    | 'borrower_handover_confirmed'
    | 'owner_handover_confirmed'
    | 'borrower_return_confirmed'
    | 'owner_return_confirmed'
  >,
  userId: string
) {
  const isOwner = req.owner_id === userId;
  const isBorrower = req.borrower_id === userId;

  return {
    canApprove: isOwner && !isBorrower && req.status === 'pending',
    canReject: isOwner && !isBorrower && req.status === 'pending',
    canConfirmBorrowerHandover:
      isBorrower && req.status === 'approved' && !req.borrower_handover_confirmed,
    canConfirmOwnerHandover:
      isOwner && req.status === 'approved' && !req.owner_handover_confirmed,
    canConfirmBorrowerReturn:
      isBorrower && req.status === 'borrowed' && !req.borrower_return_confirmed,
    canConfirmOwnerReturn:
      isOwner && req.status === 'borrowed' && !req.owner_return_confirmed,
    canCancel:
      (isBorrower && req.status === 'pending') ||
      ((isBorrower || isOwner) && req.status === 'approved'),
  };
}

export function getPurchaseAvailableActions(
  req: Pick<
    PurchaseRequest,
    'buyer_id' | 'owner_id' | 'status' | 'buyer_confirmed' | 'seller_confirmed'
  >,
  userId: string
) {
  const isOwner = req.owner_id === userId;
  const isBuyer = req.buyer_id === userId;

  return {
    canApprove: isOwner && !isBuyer && req.status === 'pending',
    canReject: isOwner && !isBuyer && req.status === 'pending',
    canConfirmBuyer:
      isBuyer && req.status === 'awaiting_confirmation' && !req.buyer_confirmed,
    canConfirmSeller:
      isOwner && req.status === 'awaiting_confirmation' && !req.seller_confirmed,
    canCancel:
      (isBuyer && req.status === 'pending') ||
      ((isBuyer || isOwner) && req.status === 'awaiting_confirmation'),
  };
}

export function computeDashboardStats(params: {
  totalMarketplaceListings: number;
  myListings: Pick<Item, 'available' | 'is_sold'>[];
  borrowRequests: BorrowRequest[];
  purchaseRequests: PurchaseRequest[];
  userId: string;
}): DashboardStats {
  const { totalMarketplaceListings, myListings, borrowRequests, purchaseRequests, userId } = params;

  const incomingBorrow = borrowRequests.filter((r) => r.owner_id === userId);
  const outgoingBorrow = borrowRequests.filter((r) => r.borrower_id === userId);
  const incomingPurchase = purchaseRequests.filter((r) => r.owner_id === userId);
  const outgoingPurchase = purchaseRequests.filter((r) => r.buyer_id === userId);

  let pendingActionsCount = 0;

  for (const req of borrowRequests) {
    const actions = getBorrowAvailableActions(req, userId);
    if (
      actions.canApprove ||
      actions.canConfirmBorrowerHandover ||
      actions.canConfirmOwnerHandover ||
      actions.canConfirmBorrowerReturn ||
      actions.canConfirmOwnerReturn
    ) {
      pendingActionsCount += 1;
    }
  }

  for (const req of purchaseRequests) {
    const actions = getPurchaseAvailableActions(req, userId);
    if (actions.canApprove || actions.canConfirmBuyer || actions.canConfirmSeller) {
      pendingActionsCount += 1;
    }
  }

  return {
    totalListings: totalMarketplaceListings,
    myActiveListings: myListings.filter((item) => item.available && !item.is_sold).length,
    incomingBorrowRequests: incomingBorrow.length,
    outgoingBorrowRequests: outgoingBorrow.length,
    incomingPurchaseRequests: incomingPurchase.length,
    outgoingPurchaseRequests: outgoingPurchase.length,
    pendingActionsCount,
  };
}

export function formatPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
