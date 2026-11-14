export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    if (err.code === '23505') {
      if (err.message?.includes('uq_borrow_requests_pending_item_borrower')) {
        return 'You already have a pending borrow request for this item.';
      }
      if (err.message?.includes('uq_purchase_requests_pending_item_buyer')) {
        return 'You already have a pending purchase request for this item.';
      }
      if (err.message?.includes('uq_borrow_requests_active_item')) {
        return 'This item already has an active borrow transaction.';
      }
      if (err.message?.includes('uq_purchase_requests_committed_item')) {
        return 'This item already has a purchase awaiting confirmation or completed.';
      }
    }

    if (err.code === '23503') {
      return 'This listing has transaction history and cannot be permanently deleted. You can mark it unavailable instead.';
    }

    if (err.message && err.message.trim().length > 0) {
      return err.message;
    }
  }

  return fallback;
}
