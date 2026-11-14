export type ItemCategory =
  | 'Textbooks'
  | 'Calculators & Electronics'
  | 'Lab Equipment'
  | 'Drafting & Tools'
  | 'Notes & Supplies'
  | 'Sports Equipment'
  | 'Other';

export type ItemCondition = 'Like New' | 'Good' | 'Fair';

export type ListingType = 'borrow_only' | 'sell_only' | 'borrow_or_buy';

export type BorrowStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'borrowed'
  | 'returned'
  | 'cancelled';

export type PurchaseStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'sold'
  | 'rejected'
  | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  year: string;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
  image_url: string | null;
  pickup_location: string;
  listing_type: ListingType;
  price: number | null;
  borrow_duration: string | null;
  available: boolean;
  is_sold: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemOwnerSummary {
  id: string;
  full_name: string;
  department: string;
  year: string;
}

export interface ItemWithOwner extends Item {
  owner: ItemOwnerSummary | null;
}

export interface BorrowRequest {
  id: string;
  item_id: string;
  borrower_id: string;
  owner_id: string;
  borrower_phone: string;
  status: BorrowStatus;
  borrower_handover_confirmed: boolean;
  owner_handover_confirmed: boolean;
  borrower_return_confirmed: boolean;
  owner_return_confirmed: boolean;
  borrower_handover_confirmed_at: string | null;
  owner_handover_confirmed_at: string | null;
  borrower_return_confirmed_at: string | null;
  owner_return_confirmed_at: string | null;
  borrowed_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BorrowRequestWithDetails extends BorrowRequest {
  item: Pick<
    Item,
    'id' | 'title' | 'image_url' | 'category' | 'pickup_location' | 'borrow_duration' | 'listing_type'
  > | null;
  borrower: Pick<Profile, 'id' | 'full_name' | 'department' | 'year'> | null;
  owner: Pick<Profile, 'id' | 'full_name' | 'department' | 'year'> | null;
}

export interface PurchaseRequest {
  id: string;
  item_id: string;
  buyer_id: string;
  owner_id: string;
  buyer_phone: string;
  offered_price: number;
  status: PurchaseStatus;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestWithDetails extends PurchaseRequest {
  item: Pick<
    Item,
    'id' | 'title' | 'image_url' | 'category' | 'pickup_location' | 'price' | 'listing_type' | 'is_sold'
  > | null;
  buyer: Pick<Profile, 'id' | 'full_name' | 'department' | 'year'> | null;
  owner: Pick<Profile, 'id' | 'full_name' | 'department' | 'year'> | null;
}

export interface DashboardStats {
  totalListings: number;
  myActiveListings: number;
  incomingBorrowRequests: number;
  outgoingBorrowRequests: number;
  incomingPurchaseRequests: number;
  outgoingPurchaseRequests: number;
  pendingActionsCount: number;
}
