# Value Gadgets BD - commerce platform prototype

Next.js 15 storefront + admin CMS for a Bangladeshi tech-accessory retailer.
Currently in **demo mode**: payments, SMS, courier and courier-score are mocked
behind adapters. See `BUILD_PROMPT.md`, `BUILD_PROMPT_PART2.md`,
`BUILD_PROMPT_PART3.md` and `PROTOTYPE_RUNBOOK.md` for the specification and
`CLAUDE.md` for the working rules.

## Setup (no Supabase CLI, no Docker)

```bash
npm install
cp .env.example .env.local      # fill in the Supabase values
npm run db:push                 # apply supabase/migrations/*.sql over Postgres
npm run gen:types               # src/lib/database.types.ts via the Management API
npm run seed:images             # placeholder product images through the image pipeline (once)
npm run seed                    # catalog, 75 customers, 320 orders, 50 reviews (idempotent)
npm run dev
```

`DATABASE_URL` must point at the **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`,
user `postgres.<ref>`). The direct `db.<ref>.supabase.co` host is IPv6-only.

## Scripts

| Script | What it does |
|---|---|
| `npm run db:push` | Apply pending migrations, tracked in `public._migrations`. `-- --dry-run` to list. |
| `npm run db:new <name>` | Create `supabase/migrations/<timestamp>_<name>.sql` |
| `npm run db:verify-rls` | Anon-key smoke test: locked tables return 0 rows, public views never expose `cost_bdt` |
| `npm run gen:types` | Regenerate DB types (`-- --cli` shells out to `npx supabase` instead) |
| `npm run seed` | Idempotent full seed. `-- --reset` (transactional only), `-- --reset-all`, `-- --orders 20` |
| `npm run seed:images` | Render placeholder PNGs into `public/seed-images/`, ingest, write `src/lib/seed/data/images.generated.ts` |
| `npm run images:ingest <dir>` | Bulk-ingest real photos (`<dir>/<product-slug>/1.jpg` or `<slug>__1.jpg`) |

## Storefront, cart, checkout, payments (Phases 5-7)

- `/`, `/category/[slug]`, `/collection/[slug]`, `/products/[slug]` (SSG + ISR 1h), `/search?q=`.
  Filters are URL params (`?brand=&min=&max=&in_stock=1&sort=&page=`); filtered URLs are `noindex`.
- Cart lives in Postgres keyed by the httpOnly `vgbd_cart` cookie. All mutations are Server Actions;
  totals (coupons, shipping zones) are always recomputed on the server.
- Checkout reserves stock for 30 minutes (`reserve_stock` SQL function). Expired holds are released
  by `POST /api/cron/release-reservations` (Netlify scheduled function every 10 min).
- OTP: `POST` via Server Actions -> `otp_codes` (hashed, 5 min TTL, 3/phone/h, 10/IP/h, 60 s cooldown,
  5 failed max). Success signs the shopper in with a synthetic email identity. Demo mode shows the code.
- Online payment: `getPayment().createSession()` -> gateway -> `POST /api/payment/ipn` (validation API,
  amount + currency check, idempotent on `gateway_txn_id`). `/api/payment/{success,fail,cancel}` are
  display-only. `POST /api/payment/reconcile` (cron, 30 min) queries the gateway for lost IPNs.
- Tests: `npm test` runs the tampering suite against the demo database.

Lighthouse: run `node scripts/lh-proxy.mjs` and audit `http://localhost:3001/...` (gzip, like the CDN).
Use `--throttling-method=devtools`; Lighthouse's simulated mode reports decoded sizes here.

## Blocks, page builder, theme, admin (Phases 8-11)

- **Blocks**: `src/lib/blocks/types/<name>.tsx` = one block (zod schema, metadata, component, optional
  server loader). Adding a file is all it takes; the registry uses webpack `require.context` and the admin
  form is derived from the schema. Starter blocks: hero slider, banner grid, rich text, image with text,
  product carousel, category tiles, trust badges, FAQ accordion (emits FAQPage JSON-LD).
- **Page builder** at `/admin/pages/<pageType>[/<targetId>]`: block list with drag handles, live preview
  iframe (375 / 768 / 1280), settings panel, autosaved draft, publish (`publish_page` SQL function),
  discard, named save points and revision restore. Previews use signed 2-hour tokens (`/preview/...`).
- **Theme** at `/admin/theme` (announcement bar with schedule, header, footer, brand) and **Navigation**
  at `/admin/navigation` (main / mobile / footer menus, two levels, mega-menu panels). Saving revalidates
  every page (`layout` tag).
- **Admin** at `/admin` (sign in with the seeded owner: `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`):
  dashboard (today / 7d / 30d, Recharts), orders (filters, bulk status, detail with fraud panel, dispatch,
  notes, SMS resend), products (inline stock, bulk status, duplicate, CSV export, tabbed editor with
  variants, pipeline image uploads, SEO with SERP preview, organization), inventory, media, SMS log.

## Demo mode

With `DEMO_MODE=true`:

- `/demo` - control panel: force order transitions, run a full lifecycle, fire success / failed /
  timeout / **tampered** IPNs at the real `/api/payment/ipn`, courier speed / outage / forced return,
  fraud reference phones, SMS log, generate orders, shift the clock, reset.
- `/demo/gateway?txn=...` - fake card / bKash / Nagad gateway. "Pay successfully" POSTs an
  SSLCommerz-shaped IPN to the real handler over HTTP.
- `POST /api/demo/reset`, `/api/demo/reset-all`, `/api/demo/generate-orders?n=20`,
  `/api/demo/courier/tick` - gated by `Authorization: Bearer <DEMO_SEED_TOKEN>`.
- A production build **fails** if `DEMO_MODE=true` on a Netlify production context that is not a
  `*.netlify.app` domain (see `next.config.ts`).

## Keep-alive

`.github/workflows/keepalive.yml` pings the DB every 3 days so the Supabase free tier does not pause.
Set repository variable `SITE_URL` (deployed site) and/or secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

## Media

Images are processed once at upload (`sharp`): EXIF stripped, AVIF + WebP at 320-1920px, a JPEG
fallback, a 20px blur placeholder, content-hashed keys. Stored in Cloudflare R2 when the `R2_*`
variables are set, otherwise in the Supabase Storage bucket `product-images` (with a warning).
Render with `<ProductImage manifest={row.manifest} ... />`.
