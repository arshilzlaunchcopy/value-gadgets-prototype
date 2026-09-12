# Value Gadgets BD — Commerce Platform

## What this is
Self-hosted ecommerce platform + admin CMS for a Bangladeshi tech-accessory
retailer. Currently in PROTOTYPE / DEMO MODE: all external integrations are
mocked. See BUILD_PROMPT.md, BUILD_PROMPT_PART2.md, BUILD_PROMPT_PART3.md
for the full specification and PROTOTYPE_RUNBOOK.md for the phase loop.
Read the relevant section before starting a phase.

## Stack
Next.js 15 App Router · TypeScript strict · Tailwind v4 · shadcn/ui
Supabase (Postgres + Auth + Storage) · Cloudflare R2 for media (optional,
falls back to Supabase Storage) · Netlify hosting · Zod · React Hook Form ·
TanStack Query + Table · Recharts

## Environment constraints (this machine)
- NO Supabase CLI, NO Docker. All DB access is the cloud project via API keys
  and a direct Postgres connection (session pooler, see .env.local).
- Migrations are applied by `scripts/migrate.ts`, not `supabase db push`.
- Types are generated from the Supabase Management API, not the CLI.

## Absolute rules
1. Money is `int` BDT. Never float, never decimal. ৳1,250 === 1250.
2. `SUPABASE_SERVICE_ROLE_KEY` is imported ONLY by `src/lib/supabase/admin.ts`.
   That file must never be imported by a client component.
3. Every table has RLS enabled AND explicit policies. Never one without the other.
   Documented exceptions (RLS on, zero policies, service-role-only by design):
   `otp_codes`, `demo_settings`.
4. All prices are recalculated server-side from the DB at checkout.
   The client sends variant IDs and quantities only.
5. order_items store SNAPSHOTS of title, price, sku, image. Never join to live
   product data for historical orders.
6. External services are called ONLY through adapters in src/lib/integrations/.
   Application code calls getCourier() / getPayment() / getSms() /
   getCourierScore() — never a concrete class.
7. No localStorage for cart. Cart is a DB row keyed by an httpOnly cookie.
8. Every schema change is a migration file in supabase/migrations/.
   Never change the database only through the dashboard.
9. Brand values (colors, name, contact, policies) come from settings at runtime.
   No hardcoded "Value Gadgets BD" string outside seed files.

## Brand
ink #1A1A1A · ink-soft #242424 · amber #FFC107 · amber-lite #FFD65C
Amber is scarce: CTAs, active nav, discount badges only.
rounded-2xl on cards and primary buttons. Inter + Noto Sans Bengali.

## Commands
npm run dev              # next dev
npm run build            # must pass with zero TS errors before any commit
npm run lint
npm run db:push          # apply pending supabase/migrations/*.sql (tracks in _migrations)
npm run db:new <name>    # create supabase/migrations/<timestamp>_<name>.sql
npm run db:verify-rls    # anon-key smoke test of RLS
npm run gen:types        # regenerate src/lib/database.types.ts — run after EVERY migration
npm run seed:images      # generate + ingest placeholder product images (once)
npm run seed             # idempotent full seed (catalog + customers + orders + reviews)
npm run images:ingest <dir>   # bulk-ingest real photos through the image pipeline
npm test                 # Vitest against the demo DB (IPN tampering, totals) - needs DEMO_MODE=true
node scripts/lh-proxy.mjs     # gzip proxy on :3001 for Lighthouse runs (mirrors the CDN)

## Blocks, theme, admin (Phases 8-11)
- A block = ONE file in src/lib/blocks/types/*.tsx exporting `defineBlock({...})`
  (zod schema + component + optional loader). The registry discovers files with
  webpack require.context; admin forms come from schemaToFields(schema). Never
  hand-write a block form.
- content_drafts = working copy; content_blocks = live rows. Publish goes through
  the publish_page() SQL function and revalidates the `content` tags. Header /
  footer / menus are cached under tag `layout`.
- Admin sign-in: Supabase email+password, must have an active admin_users row.
  Demo owner from DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD (seeded). Server actions
  call requireAdmin() first, always.
- TanStack Table is pinned to v8 (v9 pre-release has a different API).

## Auth model (Phase 6)
Phone OTP over our own `otp_codes` table (hashed codes, rate limits in settings.otp).
A verified phone becomes a Supabase EMAIL session: email `<local>@PHONE_EMAIL_DOMAIN`,
password HMAC-SHA256(AUTH_PEPPER, E.164). NOT Supabase phone auth. Demo: code shown on
screen, 123456 always accepted. See src/lib/auth/{otp,identity}.ts.

## Definition of done for any phase
- npm run build passes, zero TS errors, zero lint warnings
- New tables have explicit RLS policies, verified with the anon key
- grep the .next output: service_role key must not appear
- Works at 360px viewport
- A migration file exists for every schema change
