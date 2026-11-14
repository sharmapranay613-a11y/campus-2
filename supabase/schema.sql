-- ============================================================================
-- CampusConnect: 01 - Fresh Database Schema
-- Execute FIRST in a fresh Supabase PostgreSQL project.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Profiles (1-to-1 with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  email text NOT NULL UNIQUE CHECK (char_length(trim(email)) BETWEEN 5 AND 254),
  department text NOT NULL CHECK (char_length(trim(department)) BETWEEN 2 AND 120),
  year text NOT NULL CHECK (char_length(trim(year)) BETWEEN 2 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. Items (Marketplace Listings)
-- ----------------------------------------------------------------------------
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 140),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 2000),
  category text NOT NULL CHECK (
    category IN (
      'Textbooks',
      'Calculators & Electronics',
      'Lab Equipment',
      'Drafting & Tools',
      'Notes & Supplies',
      'Sports Equipment',
      'Other'
    )
  ),
  condition text NOT NULL CHECK (condition IN ('Like New', 'Good', 'Fair')),
  image_url text,
  pickup_location text NOT NULL CHECK (char_length(trim(pickup_location)) BETWEEN 2 AND 160),
  listing_type text NOT NULL CHECK (listing_type IN ('borrow_only', 'sell_only', 'borrow_or_buy')),
  price numeric(10, 2),
  borrow_duration text,
  available boolean NOT NULL DEFAULT true,
  is_sold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT items_listing_type_rules CHECK (
    (
      listing_type = 'borrow_only'
      AND price IS NULL
      AND borrow_duration IS NOT NULL
      AND char_length(trim(borrow_duration)) > 0
    )
    OR (
      listing_type = 'sell_only'
      AND price IS NOT NULL
      AND price > 0
      AND borrow_duration IS NULL
    )
    OR (
      listing_type = 'borrow_or_buy'
      AND price IS NOT NULL
      AND price > 0
      AND borrow_duration IS NOT NULL
      AND char_length(trim(borrow_duration)) > 0
    )
  ),
  CONSTRAINT items_sold_unavailable CHECK (NOT is_sold OR available = false)
);

CREATE INDEX idx_items_owner_id ON public.items (owner_id);
CREATE INDEX idx_items_browse_created ON public.items (available, is_sold, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Borrow Requests (Two-Party Handover & Return Verification)
-- ----------------------------------------------------------------------------
CREATE TABLE public.borrow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  borrower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  borrower_phone text NOT NULL CHECK (char_length(trim(borrower_phone)) BETWEEN 7 AND 25),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'borrowed', 'returned', 'cancelled')
  ),
  borrower_handover_confirmed boolean NOT NULL DEFAULT false,
  owner_handover_confirmed boolean NOT NULL DEFAULT false,
  borrower_return_confirmed boolean NOT NULL DEFAULT false,
  owner_return_confirmed boolean NOT NULL DEFAULT false,
  borrower_handover_confirmed_at timestamptz,
  owner_handover_confirmed_at timestamptz,
  borrower_return_confirmed_at timestamptz,
  owner_return_confirmed_at timestamptz,
  borrowed_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT borrow_requests_distinct_users CHECK (borrower_id <> owner_id),
  CONSTRAINT borrow_requests_handover_timestamps CHECK (
    (NOT borrower_handover_confirmed OR borrower_handover_confirmed_at IS NOT NULL)
    AND (NOT owner_handover_confirmed OR owner_handover_confirmed_at IS NOT NULL)
  ),
  CONSTRAINT borrow_requests_return_timestamps CHECK (
    (NOT borrower_return_confirmed OR borrower_return_confirmed_at IS NOT NULL)
    AND (NOT owner_return_confirmed OR owner_return_confirmed_at IS NOT NULL)
  ),
  CONSTRAINT borrow_requests_borrowed_requires_both CHECK (
    status <> 'borrowed'
    OR (borrower_handover_confirmed AND owner_handover_confirmed AND borrowed_at IS NOT NULL)
  ),
  CONSTRAINT borrow_requests_returned_requires_both CHECK (
    status <> 'returned'
    OR (
      borrower_handover_confirmed
      AND owner_handover_confirmed
      AND borrower_return_confirmed
      AND owner_return_confirmed
      AND borrowed_at IS NOT NULL
      AND returned_at IS NOT NULL
    )
  )
);

-- Prevent duplicate pending borrow requests by the same borrower for the same item
CREATE UNIQUE INDEX uq_borrow_requests_pending_item_borrower
  ON public.borrow_requests (item_id, borrower_id)
  WHERE status = 'pending';

-- Prevent concurrent approved/active borrows on the same item
CREATE UNIQUE INDEX uq_borrow_requests_active_item
  ON public.borrow_requests (item_id)
  WHERE status IN ('approved', 'borrowed');

CREATE INDEX idx_borrow_requests_borrower ON public.borrow_requests (borrower_id, created_at DESC);
CREATE INDEX idx_borrow_requests_owner ON public.borrow_requests (owner_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Purchase Requests (Two-Party Purchase Confirmation)
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_phone text NOT NULL CHECK (char_length(trim(buyer_phone)) BETWEEN 7 AND 25),
  offered_price numeric(10, 2) NOT NULL CHECK (offered_price > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'awaiting_confirmation', 'sold', 'rejected', 'cancelled')
  ),
  buyer_confirmed boolean NOT NULL DEFAULT false,
  seller_confirmed boolean NOT NULL DEFAULT false,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT purchase_requests_distinct_users CHECK (buyer_id <> owner_id),
  CONSTRAINT purchase_requests_confirmation_timestamps CHECK (
    (NOT buyer_confirmed OR buyer_confirmed_at IS NOT NULL)
    AND (NOT seller_confirmed OR seller_confirmed_at IS NOT NULL)
  ),
  CONSTRAINT purchase_requests_sold_requires_both CHECK (
    status <> 'sold'
    OR (buyer_confirmed AND seller_confirmed AND confirmed_at IS NOT NULL)
  )
);

-- Prevent duplicate pending purchase requests by the same buyer for the same item
CREATE UNIQUE INDEX uq_purchase_requests_pending_item_buyer
  ON public.purchase_requests (item_id, buyer_id)
  WHERE status = 'pending';

-- Prevent concurrent awaiting_confirmation or completed sold transactions on the same item
CREATE UNIQUE INDEX uq_purchase_requests_committed_item
  ON public.purchase_requests (item_id)
  WHERE status IN ('awaiting_confirmation', 'sold');

CREATE INDEX idx_purchase_requests_buyer ON public.purchase_requests (buyer_id, created_at DESC);
CREATE INDEX idx_purchase_requests_owner ON public.purchase_requests (owner_id, created_at DESC);
