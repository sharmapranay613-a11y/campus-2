-- ============================================================================
-- CampusConnect: 03 - Row Level Security (RLS) Policies
-- Execute THIRD, immediately after functions.sql.
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. Profiles Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public listings to display owner's name/department when browsing
DROP POLICY IF EXISTS "profiles_select_public_listing_owners" ON public.profiles;
CREATE POLICY "profiles_select_public_listing_owners"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.items i WHERE i.owner_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. Items Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "items_select_public" ON public.items;
CREATE POLICY "items_select_public"
  ON public.items
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "items_insert_own" ON public.items;
CREATE POLICY "items_insert_own"
  ON public.items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND is_sold = false
  );

DROP POLICY IF EXISTS "items_update_own" ON public.items;
CREATE POLICY "items_update_own"
  ON public.items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "items_delete_own" ON public.items;
CREATE POLICY "items_delete_own"
  ON public.items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id AND is_sold = false);

-- ----------------------------------------------------------------------------
-- 3. Borrow Requests Policies
--    Read-only for participants; mutations occur strictly via SECURITY DEFINER RPCs.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "borrow_requests_select_participants" ON public.borrow_requests;
CREATE POLICY "borrow_requests_select_participants"
  ON public.borrow_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = borrower_id OR auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- 4. Purchase Requests Policies
--    Read-only for participants; mutations occur strictly via SECURITY DEFINER RPCs.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "purchase_requests_select_participants" ON public.purchase_requests;
CREATE POLICY "purchase_requests_select_participants"
  ON public.purchase_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = owner_id);
