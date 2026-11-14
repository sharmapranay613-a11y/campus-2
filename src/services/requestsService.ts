import { requireSupabase } from '@/src/lib/supabase';
import { borrowRequestSchema, purchaseRequestSchema } from '@/src/lib/validation';
import type {
  BorrowRequest,
  BorrowRequestWithDetails,
  PurchaseRequest,
  PurchaseRequestWithDetails,
} from '@/src/types/database';

const BORROW_REQUEST_SELECT = `
  *,
  item:items!borrow_requests_item_id_fkey (
    id,
    title,
    image_url,
    category,
    pickup_location,
    borrow_duration,
    listing_type
  ),
  borrower:profiles!borrow_requests_borrower_id_fkey (
    id,
    full_name,
    department,
    year
  ),
  owner:profiles!borrow_requests_owner_id_fkey (
    id,
    full_name,
    department,
    year
  )
`;

const PURCHASE_REQUEST_SELECT = `
  *,
  item:items!purchase_requests_item_id_fkey (
    id,
    title,
    image_url,
    category,
    pickup_location,
    price,
    listing_type,
    is_sold
  ),
  buyer:profiles!purchase_requests_buyer_id_fkey (
    id,
    full_name,
    department,
    year
  ),
  owner:profiles!purchase_requests_owner_id_fkey (
    id,
    full_name,
    department,
    year
  )
`;

export async function listUserBorrowRequests(userId: string): Promise<BorrowRequestWithDetails[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('borrow_requests')
    .select(BORROW_REQUEST_SELECT)
    .or(`borrower_id.eq.${userId},owner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as BorrowRequestWithDetails[];
}

export async function listUserPurchaseRequests(
  userId: string
): Promise<PurchaseRequestWithDetails[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('purchase_requests')
    .select(PURCHASE_REQUEST_SELECT)
    .or(`buyer_id.eq.${userId},owner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PurchaseRequestWithDetails[];
}

export async function createBorrowRequest(
  itemId: string,
  borrowerPhone: string
): Promise<BorrowRequest> {
  const parsed = borrowRequestSchema.parse({ borrower_phone: borrowerPhone });
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('create_borrow_request', {
    p_item_id: itemId,
    p_borrower_phone: parsed.borrower_phone,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function respondBorrowRequest(
  requestId: string,
  action: 'approve' | 'reject'
): Promise<BorrowRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('respond_borrow_request', {
    p_request_id: requestId,
    p_action: action,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function confirmBorrowerHandover(requestId: string): Promise<BorrowRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('confirm_borrower_handover', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function confirmOwnerHandover(requestId: string): Promise<BorrowRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('confirm_owner_handover', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function confirmBorrowerReturn(requestId: string): Promise<BorrowRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('confirm_borrower_return', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function confirmOwnerReturn(requestId: string): Promise<BorrowRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('confirm_owner_return', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function cancelBorrowRequest(requestId: string): Promise<BorrowRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('cancel_borrow_request', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as BorrowRequest;
}

export async function createPurchaseRequest(
  itemId: string,
  buyerPhone: string,
  offeredPrice: string
): Promise<PurchaseRequest> {
  const parsed = purchaseRequestSchema.parse({
    buyer_phone: buyerPhone,
    offered_price: offeredPrice,
  });
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('create_purchase_request', {
    p_item_id: itemId,
    p_buyer_phone: parsed.buyer_phone,
    p_offered_price: Number(Number(parsed.offered_price).toFixed(2)),
  });

  if (error) {
    throw error;
  }
  return data as PurchaseRequest;
}

export async function respondPurchaseRequest(
  requestId: string,
  action: 'approve' | 'reject'
): Promise<PurchaseRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('respond_purchase_request', {
    p_request_id: requestId,
    p_action: action,
  });

  if (error) {
    throw error;
  }
  return data as PurchaseRequest;
}

export async function confirmBuyerPurchase(requestId: string): Promise<PurchaseRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('confirm_buyer_purchase', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as PurchaseRequest;
}

export async function confirmSellerPurchase(requestId: string): Promise<PurchaseRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('confirm_seller_purchase', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as PurchaseRequest;
}

export async function cancelPurchaseRequest(requestId: string): Promise<PurchaseRequest> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('cancel_purchase_request', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }
  return data as PurchaseRequest;
}
