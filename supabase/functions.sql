-- ============================================================================
-- CampusConnect: 02 - Triggers & Secure Workflow RPC Functions
-- Execute SECOND, immediately after schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Updated-At Timestamp Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_items_updated_at ON public.items;
CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_borrow_requests_updated_at ON public.borrow_requests;
CREATE TRIGGER trg_borrow_requests_updated_at
  BEFORE UPDATE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_requests_updated_at ON public.purchase_requests;
CREATE TRIGGER trg_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Automatic Profile Creation on Auth Sign-Up
--    Ensures a matching profile exists even when email verification is enabled.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_full_name text;
  v_department text;
  v_year text;
BEGIN
  v_full_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  v_department := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'department', '')), '');
  v_year := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'year', '')), '');

  -- Only auto-create if registration metadata is present; otherwise app completes profile via RLS.
  IF v_full_name IS NOT NULL AND v_department IS NOT NULL AND v_year IS NOT NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, email, department, year)
    VALUES (NEW.id, v_full_name, lower(trim(NEW.email)), v_department, v_year)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Defense-in-Depth Direct Mutation Guards
--    Blocks direct REST updates to workflow-controlled columns outside RPCs.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_item_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_bypass text := pg_catalog.current_setting('app.bypass_workflow_guard', true);
  v_has_active_tx boolean;
BEGIN
  IF v_bypass = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Cannot reassign item ownership.';
  END IF;

  IF NEW.is_sold IS DISTINCT FROM OLD.is_sold THEN
    RAISE EXCEPTION 'Sold status can only be changed through mutual purchase confirmation.';
  END IF;

  IF OLD.is_sold THEN
    RAISE EXCEPTION 'Sold items cannot be modified.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.borrow_requests br
    WHERE br.item_id = OLD.id AND br.status IN ('approved', 'borrowed')
  ) OR EXISTS (
    SELECT 1 FROM public.purchase_requests pr
    WHERE pr.item_id = OLD.id AND pr.status IN ('awaiting_confirmation', 'sold')
  ) INTO v_has_active_tx;

  IF v_has_active_tx THEN
    IF NEW.available IS DISTINCT FROM OLD.available
       OR NEW.listing_type IS DISTINCT FROM OLD.listing_type
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.borrow_duration IS DISTINCT FROM OLD.borrow_duration THEN
      RAISE EXCEPTION 'Cannot change availability, pricing, or listing terms while an active transaction is in progress.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_item_protected_fields ON public.items;
CREATE TRIGGER trg_guard_item_protected_fields
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.guard_item_protected_fields();

CREATE OR REPLACE FUNCTION public.guard_borrow_request_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_catalog.current_setting('app.bypass_workflow_guard', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Borrow requests must be created and updated through CampusConnect workflow RPCs.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_borrow_request_mutations ON public.borrow_requests;
CREATE TRIGGER trg_guard_borrow_request_mutations
  BEFORE INSERT OR UPDATE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_borrow_request_mutations();

CREATE OR REPLACE FUNCTION public.guard_purchase_request_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_catalog.current_setting('app.bypass_workflow_guard', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Purchase requests must be created and updated through CampusConnect workflow RPCs.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_purchase_request_mutations ON public.purchase_requests;
CREATE TRIGGER trg_guard_purchase_request_mutations
  BEFORE INSERT OR UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_request_mutations();

-- ----------------------------------------------------------------------------
-- 4. Borrowing Workflow RPCs
--    Consistent lock order across ALL RPCs: items -> borrow_requests -> purchase_requests
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_borrow_request(
  p_item_id uuid,
  p_borrower_phone text
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.items;
  v_phone text := trim(COALESCE(p_borrower_phone, ''));
  v_created public.borrow_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Student profile must be completed before requesting an item.';
  END IF;

  IF char_length(v_phone) < 7 OR char_length(v_phone) > 25 THEN
    RAISE EXCEPTION 'Please provide a valid phone number (7 to 25 characters).';
  END IF;

  SELECT * INTO v_item
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_item.owner_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot borrow your own item.';
  END IF;

  IF v_item.is_sold OR NOT v_item.available THEN
    RAISE EXCEPTION 'This item is currently unavailable.';
  END IF;

  IF v_item.listing_type NOT IN ('borrow_only', 'borrow_or_buy') THEN
    RAISE EXCEPTION 'This listing is not available for borrowing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE item_id = p_item_id AND status IN ('approved', 'borrowed')
  ) OR EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE item_id = p_item_id AND status IN ('awaiting_confirmation', 'sold')
  ) THEN
    RAISE EXCEPTION 'This item already has an active transaction in progress.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE item_id = p_item_id AND borrower_id = v_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending borrow request for this item.';
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  INSERT INTO public.borrow_requests (
    item_id,
    borrower_id,
    owner_id,
    borrower_phone,
    status
  )
  VALUES (
    v_item.id,
    v_user_id,
    v_item.owner_id,
    v_phone,
    'pending'
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_borrow_request(
  p_request_id uuid,
  p_action text
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.borrow_requests;
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action. Expected approve or reject.';
  END IF;

  SELECT item_id INTO v_item_id
  FROM public.borrow_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found.';
  END IF;

  -- Consistent lock ordering: items first, then borrow_requests
  SELECT * INTO v_item
  FROM public.items
  WHERE id = v_item_id
  FOR UPDATE;

  SELECT * INTO v_req
  FROM public.borrow_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_item.owner_id <> v_user_id OR v_req.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the item owner can approve or reject this borrow request.';
  END IF;

  IF v_req.borrower_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot approve your own request.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending borrow requests can be approved or rejected.';
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  IF v_action = 'reject' THEN
    UPDATE public.borrow_requests
    SET status = 'rejected'
    WHERE id = v_req.id
    RETURNING * INTO v_req;

    RETURN v_req;
  END IF;

  -- Approve path
  IF v_item.is_sold OR NOT v_item.available THEN
    RAISE EXCEPTION 'This item is no longer available for borrowing.';
  END IF;

  IF v_item.listing_type NOT IN ('borrow_only', 'borrow_or_buy') THEN
    RAISE EXCEPTION 'This item is not configured for borrowing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE item_id = v_item.id AND id <> v_req.id AND status IN ('approved', 'borrowed')
  ) OR EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE item_id = v_item.id AND status IN ('awaiting_confirmation', 'sold')
  ) THEN
    RAISE EXCEPTION 'Another transaction is already active for this item.';
  END IF;

  UPDATE public.items
  SET available = false
  WHERE id = v_item.id;

  UPDATE public.borrow_requests
  SET status = 'approved'
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_borrower_handover(
  p_request_id uuid
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.borrow_requests;
  v_now timestamptz := now();
  v_both boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.borrow_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.borrow_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.borrower_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the borrower can confirm receipt of the item.';
  END IF;

  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Handover confirmation is only allowed for approved requests.';
  END IF;

  IF v_req.borrower_handover_confirmed THEN
    RAISE EXCEPTION 'You have already confirmed receiving this item.';
  END IF;

  v_both := v_req.owner_handover_confirmed;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.borrow_requests
  SET
    borrower_handover_confirmed = true,
    borrower_handover_confirmed_at = v_now,
    status = CASE WHEN v_both THEN 'borrowed' ELSE status END,
    borrowed_at = CASE WHEN v_both THEN v_now ELSE borrowed_at END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_both THEN
    UPDATE public.items SET available = false WHERE id = v_item.id;
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_owner_handover(
  p_request_id uuid
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.borrow_requests;
  v_now timestamptz := now();
  v_both boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.borrow_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.borrow_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.owner_id <> v_user_id OR v_item.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the item owner can confirm handing over the item.';
  END IF;

  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Handover confirmation is only allowed for approved requests.';
  END IF;

  IF v_req.owner_handover_confirmed THEN
    RAISE EXCEPTION 'You have already confirmed handing over this item.';
  END IF;

  v_both := v_req.borrower_handover_confirmed;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.borrow_requests
  SET
    owner_handover_confirmed = true,
    owner_handover_confirmed_at = v_now,
    status = CASE WHEN v_both THEN 'borrowed' ELSE status END,
    borrowed_at = CASE WHEN v_both THEN v_now ELSE borrowed_at END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_both THEN
    UPDATE public.items SET available = false WHERE id = v_item.id;
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_borrower_return(
  p_request_id uuid
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.borrow_requests;
  v_now timestamptz := now();
  v_both boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.borrow_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.borrow_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.borrower_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the borrower can confirm returning this item.';
  END IF;

  IF v_req.status <> 'borrowed' THEN
    RAISE EXCEPTION 'Return confirmation is only allowed while the item is actively borrowed.';
  END IF;

  IF v_req.borrower_return_confirmed THEN
    RAISE EXCEPTION 'You have already confirmed returning this item.';
  END IF;

  v_both := v_req.owner_return_confirmed;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.borrow_requests
  SET
    borrower_return_confirmed = true,
    borrower_return_confirmed_at = v_now,
    status = CASE WHEN v_both THEN 'returned' ELSE status END,
    returned_at = CASE WHEN v_both THEN v_now ELSE returned_at END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_both AND NOT v_item.is_sold AND v_item.listing_type IN ('borrow_only', 'borrow_or_buy') THEN
    UPDATE public.items SET available = true WHERE id = v_item.id;
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_owner_return(
  p_request_id uuid
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.borrow_requests;
  v_now timestamptz := now();
  v_both boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.borrow_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.borrow_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.owner_id <> v_user_id OR v_item.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the item owner can confirm receiving the returned item.';
  END IF;

  IF v_req.status <> 'borrowed' THEN
    RAISE EXCEPTION 'Return confirmation is only allowed while the item is actively borrowed.';
  END IF;

  IF v_req.owner_return_confirmed THEN
    RAISE EXCEPTION 'You have already confirmed receiving this returned item.';
  END IF;

  v_both := v_req.borrower_return_confirmed;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.borrow_requests
  SET
    owner_return_confirmed = true,
    owner_return_confirmed_at = v_now,
    status = CASE WHEN v_both THEN 'returned' ELSE status END,
    returned_at = CASE WHEN v_both THEN v_now ELSE returned_at END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_both AND NOT v_item.is_sold AND v_item.listing_type IN ('borrow_only', 'borrow_or_buy') THEN
    UPDATE public.items SET available = true WHERE id = v_item.id;
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_borrow_request(
  p_request_id uuid
)
RETURNS public.borrow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.borrow_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.borrow_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.borrow_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.status = 'pending' THEN
    IF v_req.borrower_id <> v_user_id THEN
      RAISE EXCEPTION 'Only the borrower can cancel a pending borrow request.';
    END IF;
  ELSIF v_req.status = 'approved' THEN
    IF v_req.borrower_id <> v_user_id AND v_req.owner_id <> v_user_id THEN
      RAISE EXCEPTION 'Only participants can cancel an approved borrow request prior to handover.';
    END IF;
  ELSE
    RAISE EXCEPTION 'This borrow request can no longer be cancelled.';
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.borrow_requests
  SET status = 'cancelled'
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF NOT v_item.is_sold
     AND NOT EXISTS (
       SELECT 1 FROM public.purchase_requests
       WHERE item_id = v_item.id AND status IN ('awaiting_confirmation', 'sold')
     ) THEN
    UPDATE public.items SET available = true WHERE id = v_item.id;
  END IF;

  RETURN v_req;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Purchase Workflow RPCs (Two-Party Atomic Purchase Confirmation)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_purchase_request(
  p_item_id uuid,
  p_buyer_phone text,
  p_offered_price numeric
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.items;
  v_phone text := trim(COALESCE(p_buyer_phone, ''));
  v_price numeric(10, 2) := round(COALESCE(p_offered_price, 0)::numeric, 2);
  v_created public.purchase_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Student profile must be completed before requesting a purchase.';
  END IF;

  IF char_length(v_phone) < 7 OR char_length(v_phone) > 25 THEN
    RAISE EXCEPTION 'Please provide a valid phone number (7 to 25 characters).';
  END IF;

  IF v_price <= 0 THEN
    RAISE EXCEPTION 'Offered price must be greater than zero.';
  END IF;

  SELECT * INTO v_item
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_item.owner_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot purchase your own item.';
  END IF;

  IF v_item.is_sold OR NOT v_item.available THEN
    RAISE EXCEPTION 'This item is sold or currently unavailable.';
  END IF;

  IF v_item.listing_type NOT IN ('sell_only', 'borrow_or_buy') THEN
    RAISE EXCEPTION 'This listing is not for sale.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE item_id = p_item_id AND status IN ('approved', 'borrowed')
  ) OR EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE item_id = p_item_id AND status IN ('awaiting_confirmation', 'sold')
  ) THEN
    RAISE EXCEPTION 'This item already has an active transaction in progress.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE item_id = p_item_id AND buyer_id = v_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending purchase request for this item.';
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  INSERT INTO public.purchase_requests (
    item_id,
    buyer_id,
    owner_id,
    buyer_phone,
    offered_price,
    status
  )
  VALUES (
    v_item.id,
    v_user_id,
    v_item.owner_id,
    v_phone,
    v_price,
    'pending'
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_purchase_request(
  p_request_id uuid,
  p_action text
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.purchase_requests;
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action. Expected approve or reject.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.purchase_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase request not found.';
  END IF;

  -- Consistent lock ordering: items first, then purchase_requests
  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.purchase_requests WHERE id = p_request_id FOR UPDATE;

  IF v_item.owner_id <> v_user_id OR v_req.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the item owner can approve or reject this purchase request.';
  END IF;

  IF v_req.buyer_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot approve your own purchase request.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending purchase requests can be approved or rejected.';
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  IF v_action = 'reject' THEN
    UPDATE public.purchase_requests
    SET status = 'rejected'
    WHERE id = v_req.id
    RETURNING * INTO v_req;

    RETURN v_req;
  END IF;

  -- Approve path: transition to awaiting_confirmation (NOT sold yet!)
  IF v_item.is_sold OR NOT v_item.available THEN
    RAISE EXCEPTION 'This item is sold or no longer available.';
  END IF;

  IF v_item.listing_type NOT IN ('sell_only', 'borrow_or_buy') THEN
    RAISE EXCEPTION 'This item is not configured for sale.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE item_id = v_item.id AND status IN ('approved', 'borrowed')
  ) OR EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE item_id = v_item.id AND id <> v_req.id AND status IN ('awaiting_confirmation', 'sold')
  ) THEN
    RAISE EXCEPTION 'Another transaction is already active or completed for this item.';
  END IF;

  UPDATE public.items
  SET available = false
  WHERE id = v_item.id;

  UPDATE public.purchase_requests
  SET status = 'awaiting_confirmation'
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_buyer_purchase(
  p_request_id uuid
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.purchase_requests;
  v_now timestamptz := now();
  v_both boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.purchase_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.purchase_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.buyer_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the buyer can confirm this purchase.';
  END IF;

  IF v_req.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'This purchase request is not awaiting confirmation.';
  END IF;

  IF v_item.is_sold THEN
    RAISE EXCEPTION 'This item has already been marked as sold.';
  END IF;

  IF v_req.buyer_confirmed THEN
    RAISE EXCEPTION 'You have already confirmed this purchase.';
  END IF;

  v_both := v_req.seller_confirmed;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.purchase_requests
  SET
    buyer_confirmed = true,
    buyer_confirmed_at = v_now,
    status = CASE WHEN v_both THEN 'sold' ELSE status END,
    confirmed_at = CASE WHEN v_both THEN v_now ELSE confirmed_at END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_both THEN
    UPDATE public.items
    SET is_sold = true, available = false
    WHERE id = v_item.id;

    UPDATE public.purchase_requests
    SET status = 'rejected'
    WHERE item_id = v_item.id AND id <> v_req.id AND status = 'pending';

    UPDATE public.borrow_requests
    SET status = 'rejected'
    WHERE item_id = v_item.id AND status = 'pending';
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_seller_purchase(
  p_request_id uuid
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.purchase_requests;
  v_now timestamptz := now();
  v_both boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.purchase_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.purchase_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.owner_id <> v_user_id OR v_item.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the seller/item owner can confirm this sale.';
  END IF;

  IF v_req.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'This purchase request is not awaiting confirmation.';
  END IF;

  IF v_item.is_sold THEN
    RAISE EXCEPTION 'This item has already been marked as sold.';
  END IF;

  IF v_req.seller_confirmed THEN
    RAISE EXCEPTION 'You have already confirmed this sale.';
  END IF;

  v_both := v_req.buyer_confirmed;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.purchase_requests
  SET
    seller_confirmed = true,
    seller_confirmed_at = v_now,
    status = CASE WHEN v_both THEN 'sold' ELSE status END,
    confirmed_at = CASE WHEN v_both THEN v_now ELSE confirmed_at END
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF v_both THEN
    UPDATE public.items
    SET is_sold = true, available = false
    WHERE id = v_item.id;

    UPDATE public.purchase_requests
    SET status = 'rejected'
    WHERE item_id = v_item.id AND id <> v_req.id AND status = 'pending';

    UPDATE public.borrow_requests
    SET status = 'rejected'
    WHERE item_id = v_item.id AND status = 'pending';
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_request(
  p_request_id uuid
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items;
  v_req public.purchase_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT item_id INTO v_item_id FROM public.purchase_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase request not found.';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_req FROM public.purchase_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.status = 'pending' THEN
    IF v_req.buyer_id <> v_user_id THEN
      RAISE EXCEPTION 'Only the buyer can cancel a pending purchase request.';
    END IF;
  ELSIF v_req.status = 'awaiting_confirmation' THEN
    IF v_req.buyer_id <> v_user_id AND v_req.owner_id <> v_user_id THEN
      RAISE EXCEPTION 'Only participants can cancel an uncompleted purchase confirmation.';
    END IF;
  ELSE
    RAISE EXCEPTION 'This purchase request can no longer be cancelled.';
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_workflow_guard', 'true', true);

  UPDATE public.purchase_requests
  SET status = 'cancelled'
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  IF NOT v_item.is_sold
     AND NOT EXISTS (
       SELECT 1 FROM public.borrow_requests
       WHERE item_id = v_item.id AND status IN ('approved', 'borrowed')
     ) THEN
    UPDATE public.items SET available = true WHERE id = v_item.id;
  END IF;

  RETURN v_req;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Strict Function Execute Permissions
--    Revoke from PUBLIC and anon; grant only to authenticated users.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_borrow_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_borrow_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_borrower_handover(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_owner_handover(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_borrower_return(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_owner_return(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_borrow_request(uuid) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_purchase_request(uuid, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_purchase_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_buyer_purchase(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_seller_purchase(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_purchase_request(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_borrow_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_borrow_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_borrower_handover(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_owner_handover(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_borrower_return(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_owner_return(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_borrow_request(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_purchase_request(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_purchase_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_buyer_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_seller_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_request(uuid) TO authenticated;
