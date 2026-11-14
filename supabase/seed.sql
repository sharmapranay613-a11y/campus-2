-- ============================================================================
-- CampusConnect: 05 - Optional Seed Data (FOR DEVELOPMENT/DEMO ONLY)
-- IMPORTANT:
--   1. Do NOT run this in production.
--   2. First register at least one real student account through the CampusConnect
--      Registration UI (or Supabase Auth Dashboard) so auth.users & profiles exist.
--   3. This script checks for existing profiles and inserts sample campus items
--      for the earliest registered profile only if items table is currently empty.
-- ============================================================================

DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No profiles found in public.profiles. Register at least one student user via Supabase Auth first, then re-run seed.sql.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.items LIMIT 1) THEN
    RAISE NOTICE 'public.items already contains records. Skipping seed insertion.';
    RETURN;
  END IF;

  INSERT INTO public.items (
    owner_id,
    title,
    description,
    category,
    condition,
    image_url,
    pickup_location,
    listing_type,
    price,
    borrow_duration,
    available,
    is_sold
  )
  VALUES
    (
      v_owner_id,
      'Introduction to Algorithms (CLRS 4th Edition)',
      'Clean hardcover copy used for CS 301. No highlighting or torn pages; includes original quick-reference bookmark.',
      'Textbooks',
      'Like New',
      NULL,
      'Main Science Library Lobby',
      'borrow_or_buy',
      48.00,
      '2 Weeks',
      true,
      false
    ),
    (
      v_owner_id,
      'Texas Instruments TI-84 Plus CE Graphing Calculator',
      'Fully charged with USB charging cable included. Approved for calculus, physics, and engineering midterms.',
      'Calculators & Electronics',
      'Good',
      NULL,
      'Engineering Building Room 204',
      'borrow_only',
      NULL,
      '7 Days',
      true,
      false
    ),
    (
      v_owner_id,
      'Organic Chemistry Glassware & Molecular Model Kit',
      'Complete 124-piece atom/bond modeling kit with sturdy organizer case. Helpful for Chem 210 stereochemistry labs.',
      'Lab Equipment',
      'Like New',
      NULL,
      'Chemistry Atrium Bench',
      'sell_only',
      22.50,
      NULL,
      true,
      false
    ),
    (
      v_owner_id,
      'Staedtler Precision Drafting Compass & Architectural Scale',
      'Aluminum triangular scale ruler (metric + imperial) and geared metal compass in protective sleeve.',
      'Drafting & Tools',
      'Good',
      NULL,
      'Architecture Studio Hallway',
      'borrow_or_buy',
      18.00,
      '1 Semester',
      true,
      false
    );

  RAISE NOTICE 'Seeded 4 sample items for profile %.', v_owner_id;
END;
$$;
