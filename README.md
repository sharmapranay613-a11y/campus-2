# CampusConnect

A college-only student marketplace where verified students can **borrow, buy, and sell** textbooks, graphing calculators, lab equipment, drafting tools, and academic gear—enforced by Supabase PostgreSQL Row Level Security (RLS), atomic `SECURITY DEFINER` workflow RPCs, and Supabase Storage.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI / shadcn-style primitives, Lucide React
- **Backend & Database:** Supabase (PostgreSQL, Auth, Storage, RLS, PL/pgSQL RPCs)
- **Validation:** Zod
- **Deployment:** Vercel (SPA rewrites via `vercel.json`)

---

## 1. Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Fill in:

- `VITE_SUPABASE_URL` — Your Supabase project URL (`Project Settings -> API`)
- `VITE_SUPABASE_ANON_KEY` — Your Supabase `anon` public key (`Project Settings -> API`). **Never** place `service_role` keys in frontend code or `VITE_*` variables.
- `VITE_ALLOWED_EMAIL_DOMAINS` — Comma-separated allowed college domains or suffixes (e.g., `stanford.edu,mit.edu` or `edu`). Defaults to `edu`.
- `VITE_CAMPUS_NAME` — Optional campus brand display title (defaults to `CampusConnect`).

---

## 2. Supabase Database & Storage Setup

Open your Supabase project's **SQL Editor** and execute the scripts in `supabase/` **in this exact order**:

1. `supabase/schema.sql` — Creates `profiles`, `items`, `borrow_requests`, `purchase_requests`, CHECK constraints, foreign keys, and partial unique indexes.
2. `supabase/functions.sql` — Creates `updated_at` triggers, `handle_new_user()` profile auto-creation trigger, direct-mutation column guard triggers, and all 12 `SECURITY DEFINER` workflow RPCs (`create_borrow_request`, `respond_borrow_request`, `confirm_borrower_handover`, `confirm_owner_handover`, `confirm_borrower_return`, `confirm_owner_return`, `cancel_borrow_request`, `create_purchase_request`, `respond_purchase_request`, `confirm_buyer_purchase`, `confirm_seller_purchase`, `cancel_purchase_request`).
3. `supabase/rls_policies.sql` — Enables RLS and applies strict row-level policies on all 4 tables.
4. `supabase/storage_policies.sql` — Provisions the `item-images` public bucket (5 MB limit, JPEG/PNG/WebP) and folder-scoped policies (`<auth.uid()>/...`).
5. `supabase/verify_database.sql` — Read-only queries to confirm tables, RLS, indexes, functions, and storage policies are active.
6. *(Optional, dev/demo only)* `supabase/seed.sql` — Inserts 4 sample items for the first registered student profile.

### Supabase Auth Configuration

1. Go to **Authentication -> URL Configuration** and add:
   - Site URL: `http://localhost:3000` (or your Vercel production URL)
   - Redirect URLs: `http://localhost:3000/login`, `https://your-app.vercel.app/login`
2. Email verification: If enabled in **Authentication -> Providers -> Email**, `CampusConnect` displays a verification notice on registration and automatically creates the student profile via `handle_new_user()` (or on first sign-in).

---

## 3. Running Locally & Testing

```bash
npm install
npm run dev       # Starts Vite on http://localhost:3000
npm run lint      # TypeScript typecheck
npm run build     # Production Vite build
npm test          # Runs pure validation & workflow state-machine unit tests
```

---

## 4. Two-Account Manual Verification Checklist

Test end-to-end against a live Supabase project using **Student A (Owner)** and **Student B (Borrower/Buyer)** in separate browser profiles:

1. **Auth & Domain Guard**
   - Attempt registration with a non-college domain (e.g. `@gmail.com`) -> blocked with validation error.
   - Register Student A and Student B with valid college emails -> profiles created in `public.profiles`.
   - Visit `/my-listings`, `/requests`, `/transactions`, `/profile` while signed out -> redirected to `/login`.
2. **Listing & Storage**
   - Student A creates a `borrow_or_buy` listing with a JPG/PNG image -> uploaded to `item-images/<studentA_id>/...`.
   - Verify `borrow_only` forces `price = null` and `sell_only` forces `borrow_duration = null`.
   - Student B opens `/items/:id/edit` -> blocked; Student B cannot modify or delete Student A's listing or Storage image.
3. **Borrowing Two-Party Workflow**
   - Student B requests to borrow Student A's item -> `status = 'pending'`.
   - Student B submits duplicate pending request -> blocked by partial unique index.
   - Student A approves -> `status = 'approved'`, item reserved (`available = false`).
   - Student B confirms received (`borrower_handover_confirmed = true`) -> still `approved` (not `borrowed` yet!).
   - Student A confirms handed over -> transitions atomically to `borrowed` with `borrowed_at`.
   - Student B confirms returned -> still `borrowed`.
   - Student A confirms received back -> transitions to `returned` with `returned_at`, and item `available = true` again.
4. **Purchase Two-Party Workflow**
   - Student B submits a purchase offer -> `status = 'pending'`.
   - Student A accepts -> `status = 'awaiting_confirmation'` (`is_sold` remains `false`!).
   - Student B confirms purchase -> still `awaiting_confirmation`.
   - Student A confirms sale -> atomically marks request `sold`, item `is_sold = true`, `available = false`, and rejects competing pending requests.
5. **Security Verification**
   - Attempt direct REST `PATCH` on `borrow_requests` or `items.is_sold` from browser console -> rejected by RLS and `guard_*` triggers.

---

## 5. Deploying to Vercel via GitHub

1. Push this repository to GitHub (`.env` is gitignored; never commit real keys).
2. Import the GitHub repository in **Vercel**.
3. Set Environment Variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ALLOWED_EMAIL_DOMAINS`
4. Deploy. `vercel.json` handles Vite production output (`dist/`) and SPA rewrites (`/(.*) -> /index.html`).
