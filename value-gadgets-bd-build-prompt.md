# Build Prompt — Value Gadgets BD Commerce Platform

> Paste this into Claude Code. Work through it phase by phase, not all at once.
> After each phase, run the build, commit, and verify before moving on.

---

## 0. How to use this document

This is a multi-session build. Tell Claude Code:

> Read `BUILD_PROMPT.md`. We are building this in phases. Start with Phase 1 only. Do not scaffold future phases. After Phase 1, stop and let me verify before continuing.

Keep this file in the repo root. Claude Code should re-read it at the start of each session to stay oriented.

---

## 1. Project brief

Build a self-hosted ecommerce platform and admin CMS for **Value Gadgets BD**, a Bangladeshi online retailer selling tech accessories (USB-C hubs, adapters, cables, chargers, audio, small smart-home devices).

This is not a Shopify clone. It is a focused, fast, SEO-first storefront plus an admin panel that a two-person team can run a real business from. Every feature below exists because the business needs it, not because Shopify has it.

### Non-negotiable product decisions

1. **No customer login wall.** Customers browse and add to cart with zero friction. Identity is established only at checkout, via phone OTP.
2. **Bangladesh-first.** BDT only, Bangla + English, bKash/Nagad/card via SSLCommerz, cash on delivery as a first-class payment method, Bangladeshi address hierarchy, local courier integration.
3. **SEO is a core feature, not a plugin.** Server-rendered pages, per-entity meta control, structured data, product feeds, and redirect management ship in v1.
4. **Cash on delivery fraud is the #1 operational risk.** Build defenses in from the start.

---

## 2. Tech stack

Use exactly this. Do not substitute.

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript strict mode |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) |
| Database | Supabase Postgres |
| Auth | Supabase Auth, phone OTP, custom SMS hook |
| Storage | Supabase Storage for product images |
| Server logic | Next.js Route Handlers + Server Actions; Supabase Edge Functions only for auth hooks |
| Validation | Zod on every boundary |
| Forms | React Hook Form + zodResolver |
| Admin data | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Email | Resend |
| Payments | SSLCommerz (sandbox first) |
| Hosting | Netlify with `@netlify/plugin-nextjs` |
| CDN / WAF | Cloudflare in front of Netlify |
| Bot protection | Cloudflare Turnstile |

**Hard rules:**
- No `localStorage` for cart state that matters. Cart lives in Postgres keyed by an httpOnly session cookie.
- No secret keys in any file under `app/` that is not a Route Handler or Server Action.
- Every database query from the browser goes through RLS. The `service_role` key appears in exactly one place: a server-only `lib/supabase/admin.ts` module that is never imported by a client component.
- Every price calculation happens server-side. The client sends product IDs and quantities, never prices.

---

## 3. Brand system

Derive the design from the logo: a rounded-square amber tile with a percent symbol on near-black, wordmark "VALUE" in white above "GADGETS BD" in amber.

```css
/* tailwind theme tokens */
--color-ink:        #1A1A1A;  /* primary background, dark surfaces */
--color-ink-soft:   #242424;  /* elevated cards on dark */
--color-ink-line:   #333333;  /* borders on dark */

--color-amber:      #FFC107;  /* primary brand, CTAs */
--color-amber-lite: #FFD65C;  /* gradient top stop, hovers */
--color-amber-deep: #E8A800;  /* pressed states */

--color-paper:      #FFFFFF;  /* light surfaces */
--color-paper-soft: #FAFAFA;  /* page background light mode */
--color-paper-line: #E8E8E8;

--color-success:    #16A34A;
--color-warn:       #F59E0B;
--color-danger:     #DC2626;

/* the logo gradient */
--gradient-brand: linear-gradient(135deg, #FFD65C 0%, #FFC107 100%);
```

### Design direction

The logo is confident and high-contrast. The site should feel the same: **dark chrome, bright product photography, amber only where you want a click.**

- **Header, footer, and admin shell:** `--color-ink`. Product grids and content: light.
- **Amber is scarce.** Buy buttons, active nav, discount badges, order status highlights. Nothing else. If three amber things are on screen at once, two are wrong.
- **Typography:** Inter or Geist for Latin, Noto Sans Bengali for Bangla. Product titles at `font-semibold`, prices at `font-bold tabular-nums`. Never letterspace body text.
- **Radius:** `rounded-2xl` on cards and the primary button, echoing the logo tile. `rounded-lg` on inputs. Nothing fully round except avatars.
- **Product cards:** white surface, 1:1 image, no drop shadow at rest, `ring-2 ring-amber` on hover. Discount badge is amber-on-ink, top-left, `rounded-lg`.
- **Avoid:** gradient text, glassmorphism, more than two font weights per screen, decorative icons next to every label.

Reference the second uploaded image for how the brand handles product marketing: bold spec callouts, feature strips, trust badges. Echo that structure in the PDP feature sections.

---

## 4. Database schema

Write these as numbered Supabase migrations in `supabase/migrations/`. Every table gets RLS enabled. Every table gets `created_at timestamptz default now()` and `updated_at timestamptz default now()` with a trigger.

### 4.1 Catalog

```
categories
  id uuid pk, parent_id uuid fk->categories null, name_en text, name_bn text,
  slug text unique, description_en text, description_bn text,
  image_url text, position int, is_active bool default true

brands
  id uuid pk, name text, slug text unique, logo_url text, is_active bool

products
  id uuid pk, brand_id uuid fk null,
  title_en text not null, title_bn text,
  slug text unique not null,
  description_en text, description_bn text,        -- rich text / markdown
  short_description text,
  specs jsonb,                                      -- [{label, value}] spec table
  highlights text[],                                -- bullet feature list
  status text check in ('draft','active','archived') default 'draft',
  is_featured bool default false,
  warranty_months int default 0,
  video_url text,
  published_at timestamptz,
  search_vector tsvector generated                  -- see 4.7

product_variants
  id uuid pk, product_id uuid fk cascade,
  sku text unique, option_name text, option_value text,   -- e.g. "Color" / "Space Grey"
  price_bdt int not null,                                  -- store PAISA-free whole taka as int
  compare_at_price_bdt int,                                -- for showing struck-through price
  cost_bdt int,                                            -- for margin reporting, admin-only
  stock_qty int default 0,
  low_stock_threshold int default 5,
  weight_grams int,
  is_default bool default false,
  position int

product_images
  id uuid pk, product_id uuid fk cascade, variant_id uuid fk null,
  url text, alt_text_en text not null, alt_text_bn text,
  width int, height int, position int

collections           -- curated/manual or rule-based groupings
  id uuid pk, title_en text, title_bn text, slug text unique,
  description_en text, rules jsonb, is_automatic bool default false,
  image_url text, position int, is_active bool

collection_products
  collection_id uuid, product_id uuid, position int, pk(collection_id, product_id)

product_categories
  product_id uuid, category_id uuid, pk(product_id, category_id)
```

**Note on money:** store all amounts as **integer taka**. No floats, no decimals. BDT has no practical subunit in retail. `price_bdt int` means ৳1,250 is `1250`.

### 4.2 Customers and addresses

```
customers
  id uuid pk references auth.users(id) on delete cascade,
  phone text unique not null,        -- E.164, +8801XXXXXXXXX
  full_name text,
  email text,
  is_blocked bool default false,
  block_reason text,
  total_orders int default 0,
  total_delivered int default 0,
  total_cancelled int default 0,
  total_returned int default 0,
  notes text                          -- admin-only internal notes

addresses
  id uuid pk, customer_id uuid fk cascade,
  recipient_name text, phone text,
  division text, district text, upazila text,
  area text, street_address text not null,
  postcode text, landmark text,
  is_default bool default false
```

Seed the Bangladesh geography: 8 divisions, 64 districts, ~495 upazilas into a `bd_locations` reference table with `division/district/upazila` levels. Address form is three dependent selects plus free-text street.

### 4.3 Cart and orders

```
carts
  id uuid pk, session_token text unique not null,   -- httpOnly cookie value
  customer_id uuid fk null,                          -- attached after OTP
  expires_at timestamptz default now() + interval '30 days'

cart_items
  id uuid pk, cart_id uuid fk cascade, variant_id uuid fk,
  quantity int check (quantity > 0)

orders
  id uuid pk,
  order_number text unique not null,                 -- VGBD-YYMMDD-XXXX
  customer_id uuid fk,
  status text check in (
    'pending_payment','confirmed','processing','packed',
    'shipped','delivered','cancelled','returned','refunded'
  ) default 'pending_payment',
  payment_method text check in ('sslcommerz','cod'),
  payment_status text check in ('unpaid','paid','partially_refunded','refunded','failed'),

  subtotal_bdt int, discount_bdt int default 0,
  shipping_bdt int, total_bdt int,
  coupon_code text, coupon_id uuid fk null,

  shipping_address jsonb not null,                   -- SNAPSHOT, not a fk
  customer_phone text not null,
  customer_name text, customer_email text,
  customer_note text,
  admin_note text,

  fraud_score int,                                   -- 0-100, see 4.6
  fraud_flags jsonb,
  is_phone_verified bool default false,

  courier text, tracking_id text, courier_response jsonb,
  placed_at timestamptz default now(),
  confirmed_at timestamptz, shipped_at timestamptz, delivered_at timestamptz,

  utm_source text, utm_medium text, utm_campaign text,
  landing_page text, referrer text

order_items
  id uuid pk, order_id uuid fk cascade, variant_id uuid fk,
  product_title text not null,        -- SNAPSHOT
  variant_label text,                  -- SNAPSHOT
  sku text,                            -- SNAPSHOT
  unit_price_bdt int not null,         -- SNAPSHOT
  quantity int, line_total_bdt int,
  image_url text                       -- SNAPSHOT

order_events
  id uuid pk, order_id uuid fk cascade,
  event_type text, from_status text, to_status text,
  actor_id uuid, actor_type text check in ('admin','customer','system'),
  note text, metadata jsonb, created_at timestamptz
```

**Critical:** order_items store *snapshots*. When a product price changes tomorrow, historical orders must not change. This is the most common mistake in hand-built commerce systems.

### 4.4 Payments

```
payment_transactions
  id uuid pk, order_id uuid fk,
  gateway text default 'sslcommerz',
  gateway_txn_id text, val_id text, bank_txn_id text,
  amount_bdt int, currency text default 'BDT',
  card_type text, card_issuer text,
  status text check in ('initiated','success','failed','cancelled','validated'),
  raw_initiate_response jsonb,
  raw_ipn_payload jsonb,
  raw_validation_response jsonb,
  validated_at timestamptz
```

Every gateway payload gets stored raw. When a dispute happens in four months you will need it.

### 4.5 Discounts and shipping

```
coupons
  id uuid pk, code text unique, description text,
  type text check in ('percentage','fixed','free_shipping'),
  value int,
  min_order_bdt int default 0,
  max_discount_bdt int,
  usage_limit int, usage_limit_per_customer int default 1, times_used int default 0,
  applies_to jsonb,                    -- {all:true} | {product_ids:[]} | {category_ids:[]}
  starts_at timestamptz, ends_at timestamptz,
  is_active bool default true

coupon_redemptions
  id uuid pk, coupon_id uuid, order_id uuid, customer_id uuid, discount_bdt int

shipping_zones
  id uuid pk, name text,               -- "Dhaka City", "Dhaka Suburb", "Outside Dhaka"
  districts text[], is_active bool

shipping_rates
  id uuid pk, zone_id uuid fk, name text,
  rate_bdt int, free_above_bdt int, estimated_days text, position int
```

### 4.6 COD fraud defense

This is Bangladesh-specific and it will save you real money.

```
otp_requests
  id uuid pk, phone text, ip inet, user_agent text,
  requested_at timestamptz, verified_at timestamptz,
  attempt_count int default 0, is_blocked bool default false

blocked_entities
  id uuid pk, type text check in ('phone','ip','email','device'),
  value text, reason text, blocked_by uuid, expires_at timestamptz

fraud_rules
  id uuid pk, name text, rule jsonb, score_delta int, is_active bool
```

Implement a `calculateFraudScore(order)` server function that adds points for:
- Customer's prior cancelled/returned ratio above 40% → +30
- First-time customer with COD order above ৳5,000 → +20
- Three or more orders from the same IP in one hour → +25
- Phone number with a prior blocked order → +50
- Delivery address outside serviced districts → +15
- Order placed between 1am and 5am local → +10

Orders scoring 50+ land in an admin **Review Queue** instead of auto-confirming. Orders scoring 80+ require OTP re-verification before confirmation.

### 4.7 SEO tables

```
seo_meta
  id uuid pk,
  entity_type text check in ('product','category','collection','page','post','home'),
  entity_id uuid null,                  -- null for 'home'
  locale text check in ('en','bn') default 'en',
  meta_title text, meta_description text,
  og_title text, og_description text, og_image_url text,
  canonical_url text,
  robots text default 'index,follow',
  schema_override jsonb,
  unique(entity_type, entity_id, locale)

redirects
  id uuid pk, from_path text unique, to_path text,
  status_code int check in (301,302,410) default 301,
  hit_count int default 0, last_hit_at timestamptz, is_active bool default true

pages                                   -- about, terms, privacy, refund, contact
  id uuid pk, slug text unique,
  title_en text, title_bn text,
  content_en text, content_bn text,     -- markdown
  is_published bool, position int, show_in_footer bool

posts                                   -- blog for SEO content
  id uuid pk, slug text unique,
  title_en text, excerpt_en text, content_en text,
  title_bn text, excerpt_bn text, content_bn text,
  cover_image_url text, cover_alt text,
  author_name text, reading_minutes int,
  status text check in ('draft','published'),
  published_at timestamptz,
  related_product_ids uuid[]

settings                                -- singleton key-value store
  key text pk, value jsonb, updated_by uuid
```

### 4.8 Ops

```
admin_users
  id uuid pk references auth.users(id),
  email text, full_name text,
  role text check in ('owner','manager','staff') default 'staff',
  is_active bool default true, last_login_at timestamptz

audit_log
  id uuid pk, actor_id uuid, actor_email text,
  action text, entity_type text, entity_id uuid,
  before jsonb, after jsonb, ip inet, created_at timestamptz

reviews
  id uuid pk, product_id uuid, customer_id uuid, order_id uuid,
  rating int check (rating between 1 and 5),
  title text, body text,
  is_verified_purchase bool, status text check in ('pending','approved','rejected'),
  admin_reply text, replied_at timestamptz

stock_movements
  id uuid pk, variant_id uuid, delta int, reason text,
  order_id uuid null, actor_id uuid, note text
```

### 4.9 Full-text search

Add a generated `search_vector` column on `products`:

```sql
alter table products add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title_en,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(title_bn,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(short_description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(highlights,' '),'')), 'C')
  ) stored;

create index products_search_idx on products using gin(search_vector);
```

Use `simple` not `english` — Bangla and product model numbers both break the English stemmer.

---

## 5. Row Level Security

Write explicit policies. Never leave a table with RLS on and no policy (silent total lockout) or RLS off (silent total exposure).

**Helper functions:**

```sql
create or replace function auth.is_admin() returns boolean as $$
  select exists (
    select 1 from admin_users
    where id = auth.uid() and is_active = true
  );
$$ language sql security definer stable;

create or replace function auth.admin_role() returns text as $$
  select role from admin_users where id = auth.uid() and is_active = true;
$$ language sql security definer stable;
```

**Policy matrix:**

| Table | Public (anon) | Customer | Admin |
|---|---|---|---|
| products, variants, images | SELECT where `status='active'` | same | ALL |
| categories, collections, brands | SELECT where `is_active` | same | ALL |
| pages, posts | SELECT where published | same | ALL |
| seo_meta | SELECT | SELECT | ALL |
| redirects | SELECT where `is_active` | same | ALL |
| reviews | SELECT where `status='approved'` | + INSERT own | ALL |
| carts, cart_items | none (server-only via service role) | none | SELECT |
| customers | none | SELECT/UPDATE where `id = auth.uid()` | ALL |
| addresses | none | ALL where `customer_id = auth.uid()` | SELECT |
| orders | none | SELECT where `customer_id = auth.uid()` | ALL |
| order_items | none | SELECT via parent order | ALL |
| payment_transactions | none | none | SELECT |
| coupons | none | none (validated server-side) | ALL |
| admin_users, audit_log | none | none | SELECT; ALL for `owner` |
| variants.cost_bdt | — | — | expose only via an admin-only view |

**Cost price must never leak.** Create a public view `products_public` that omits `cost_bdt` and have the storefront read from that, not the base table.

---

## 6. Feature specification

### 6.1 Storefront

**Home** — hero slider (admin-managed), category tiles, featured products, "new arrivals", a trust strip (warranty / fast delivery / verified seller) echoing the marketing image style, and a footer with trade license number, contact, and policy links.

**Category / collection pages** — server-rendered, filterable by price range, brand, in-stock, and variant options. Sort by relevance, price, newest. Filters must be URL-driven (`?brand=anker&min=500&sort=price_asc`) so they are crawlable and shareable. Paginate, do not infinite-scroll, and emit `rel=next/prev` semantics via canonical logic.

**Product detail page** — the money page. Build it as:
1. Gallery with zoom, thumbnails, variant-linked images
2. Title, rating summary, SKU, brand link
3. Price block: current price, struck compare-at, amber discount percentage badge
4. Variant selector (out-of-stock options disabled, not hidden)
5. Quantity stepper, **Buy Now** (amber, straight to checkout) and **Add to Cart** (outline)
6. Trust row: warranty months, delivery estimate by division, return policy
7. Spec table from `specs` jsonb
8. Feature highlight sections with images — mirror the layout language of the brand's marketing creatives
9. Description (rich text)
10. Reviews with verified-purchase badges
11. Related products from the same category

**Cart** — slide-over drawer plus a full page. Live totals computed server-side via Server Action on every change.

**Checkout** — single page, three steps, no account required:
1. **Phone** → enter number → Turnstile → OTP sent → 6-digit input → verified. Account silently created.
2. **Delivery** → division/district/upazila cascade, street address, optional note. Shipping cost recalculates on district change.
3. **Payment** → COD or SSLCommerz. Order summary with coupon input. Required checkbox linking Terms, Privacy, and Return & Refund policy.

**Order tracking** — `/track` page, phone + order number, no login. Shows status timeline and courier tracking ID.

**Account** — `/account` if they have a session: order history, addresses, profile. Reachable but never forced.

**Search** — instant search with debounce hitting the tsvector index, with a full results page at `/search?q=`.

### 6.2 Admin CMS at `/admin`

Dark shell using `--color-ink`, amber active states, collapsible sidebar.

**Dashboard** — today/7d/30d toggle: revenue, order count, AOV, conversion, COD vs online split, low-stock alerts, pending-review order count, top products, revenue sparkline.

**Orders** — filterable table (status, payment method, date range, fraud score, courier). Bulk status updates. Detail view with full timeline, fraud flags, payment transaction records, one-click courier dispatch, invoice PDF, SMS/email resend, refund initiation.

**Review Queue** — dedicated view for fraud-flagged orders with the customer's full order history visible inline. Approve or cancel with one click.

**Products** — table with inline stock editing, bulk price/status changes, CSV import/export, duplicate. Editor has tabs: Details, Variants, Images, SEO, Organization. Drag-to-reorder images and variants. Image upload compresses to WebP at 1600px max and auto-fills dimensions.

**Inventory** — low-stock view, stock movement log, bulk adjustment with reason codes.

**Categories & Collections** — drag-and-drop tree for categories, rule builder for automatic collections.

**Customers** — list with lifetime value, order counts, cancellation ratio. Detail view with order history, addresses, internal notes, block toggle.

**Discounts** — coupon CRUD with a live preview of what the discount does to a sample cart, plus redemption stats.

**Content** — pages and blog post editor (markdown with live preview), media library.

**SEO Center** — see section 7.

**Settings** — store info, trade license number (rendered in footer, required by SSLCommerz), contact details, shipping zones and rates, payment gateway credentials, SMS templates, email templates, analytics IDs, social links.

**Staff** — invite admins, assign roles, view audit log.

---

## 7. SEO system — build this properly

This is the differentiator. Implement all of it.

### 7.1 Rendering
- Product, category, collection, page, and post routes use `generateMetadata()` reading from `seo_meta` with sensible auto-generated fallbacks.
- ISR with `revalidate: 3600` plus on-demand revalidation: when an admin saves a product, call `revalidatePath()` for that product, its categories, and the sitemap.
- Never render price or stock client-side only; crawlers must see them in HTML.

### 7.2 Metadata
Fallback chain for every page: explicit `seo_meta` → generated template → site default.

Templates:
- Product: `{title} — Price in Bangladesh | Value Gadgets BD`
- Category: `{name} — Buy Online in Bangladesh | Value Gadgets BD`
- Post: `{title} | Value Gadgets BD Blog`

Meta description auto-generates from `short_description` truncated at 155 characters if not set. Admin sees a **live SERP preview** with pixel-width warnings, not character counts.

### 7.3 Structured data (JSON-LD)
Emit on the appropriate routes:
- `Organization` + `WebSite` with `SearchAction` — root layout
- `Product` with `offers` (price, BDT, availability, priceValidUntil), `aggregateRating`, `review`, `brand`, `sku`, `gtin` if available — PDP
- `BreadcrumbList` — all category and product pages
- `ItemList` — category and collection pages
- `Article` — blog posts
- `FAQPage` — where a product has an FAQ block
- `LocalBusiness` — contact page

Validate every type against Google's Rich Results Test before considering it done.

### 7.4 Sitemaps
Dynamic `app/sitemap.ts` producing an index that splits into:
- `/sitemap-products.xml` (chunked at 5,000 URLs)
- `/sitemap-categories.xml`
- `/sitemap-collections.xml`
- `/sitemap-posts.xml`
- `/sitemap-pages.xml`

Include accurate `lastmod` from `updated_at`. Exclude anything `noindex`, draft, or out of stock and archived.

### 7.5 Robots and canonicals
`app/robots.ts` disallowing `/admin`, `/checkout`, `/cart`, `/account`, `/api`, and any `?` faceted URL beyond one filter deep. Self-referencing canonicals everywhere. Filtered category URLs canonicalize to the base category unless the filter combination has meaningful search volume (make this an admin toggle per category).

### 7.6 Redirect management
Middleware checks the `redirects` table on 404 before rendering the not-found page. When an admin changes a product or category slug, **auto-create a 301** from the old path. Log hit counts so the admin can see which redirects matter. Admin UI for manual redirect CRUD plus CSV import.

### 7.7 Product feeds
Generate and cache:
- `/feeds/google-merchant.xml` — full Google Shopping RSS 2.0 feed with `g:` namespace, availability, price, condition, shipping, GTIN/MPN
- `/feeds/facebook-catalog.csv` — Meta commerce catalog format

These two feeds will drive more revenue than anything else in this section. Get the required fields exactly right.

### 7.8 Analytics and tracking
- GA4 with full ecommerce events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`
- Meta Pixel **plus server-side Conversions API** from the order confirmation Route Handler, with deduplication via `event_id`
- Google Search Console verification meta tag stored in settings
- Store UTM parameters and landing page on the order row for attribution

### 7.9 Performance (this is SEO)
- `next/image` everywhere with explicit width/height, AVIF and WebP, blur placeholders
- Fonts self-hosted via `next/font`, `display: swap`
- LCP element on the PDP is the main product image, priority-loaded
- Target: LCP under 2.5s on a 4G connection, CLS under 0.1, INP under 200ms
- Run Lighthouse on the PDP and category page before declaring any phase complete

### 7.10 Admin SEO Center
A dedicated section with:
- Site-wide defaults and title templates
- A table of all indexable entities showing meta title, description, whether they're set or auto-generated, and a completeness score
- Bulk-edit meta for filtered sets of products
- Missing alt-text report
- Redirect manager
- Broken internal link scanner
- Feed status and last-generated timestamp

---

## 8. Phone OTP implementation

Do it in this exact order.

1. **Edge Function `send-sms`** — receives Supabase's Send SMS Hook payload, calls the local SMS gateway (Alpha SMS / BulkSMSBD), returns success. Verify the hook signature using the secret from Supabase before doing anything.
2. **Rate limiting** — before sending: max 3 OTPs per phone per hour, max 10 per IP per hour, 60-second cooldown between requests. Record every attempt in `otp_requests`. Block after 5 failed verifications.
3. **Turnstile** — gate the "send OTP" endpoint with a Cloudflare Turnstile token, verified server-side.
4. **Verification** — `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`. On success you get a real Supabase session, so RLS works natively from then on.
5. **Cart merge** — on successful verification, attach the anonymous cart (identified by the session cookie) to the now-known `customer_id`.
6. **Progressive profiling** — after order placement, the confirmation page asks for name and email, optional, one field at a time. Never block the order on it.

**SMS templates** (store in settings, Bangla and English variants):
- OTP: `Your Value Gadgets BD verification code is {code}. Valid for 5 minutes.`
- Order confirmed: `Order {order_number} confirmed. Total Tk {total}. Track: {url}`
- Shipped: `Order {order_number} shipped via {courier}. Tracking: {tracking_id}`
- Delivered: `Order {order_number} delivered. Thank you! Review: {url}`

---

## 9. SSLCommerz payment flow

**Never trust the browser.** The flow is:

1. Server Action creates the order with `status='pending_payment'`, recalculating every price from the database.
2. Route Handler `POST /api/payment/initiate` calls SSLCommerz session API with the server-computed total. Store the response in `payment_transactions`. Return the gateway URL.
3. Browser redirects to SSLCommerz.
4. **`POST /api/payment/ipn`** receives the notification. Verify it, then call the **Order Validation API** with the `val_id`. Only if validation returns `VALID`/`VALIDATED` **and** the amount matches the stored order total **and** the currency is BDT do you mark the order paid. Store all three raw payloads.
5. `/api/payment/success` and `/api/payment/fail` are *display only*. They read the order's current status from the database. They never write payment status.

Write a test that forges a success redirect with a tampered amount and asserts the order remains unpaid. If that test does not exist, this feature is not done.

Also handle: duplicate IPNs (idempotency on `gateway_txn_id`), IPN arriving before the browser redirect, and IPN never arriving (a cron reconciliation job that queries pending orders older than 30 minutes against the gateway).

---

## 10. Build phases

Complete and verify each phase before starting the next.

**Phase 1 — Foundation**
Next.js + TS + Tailwind + shadcn scaffolding. Brand tokens. Supabase client modules (browser / server / admin). Migrations for catalog tables. RLS policies. Seed script with 20 realistic gadget products. Basic layout shell.

**Phase 2 — Storefront read paths**
Home, category, collection, PDP, search. Server-rendered, ISR. `next/image` pipeline. Lighthouse pass on PDP.

**Phase 3 — Cart**
Cart tables, session cookie, Server Actions for add/update/remove, drawer + page, server-side total calculation.

**Phase 4 — Auth**
Send SMS Hook Edge Function, rate limiting, Turnstile, OTP UI, cart merge, session handling.

**Phase 5 — Checkout and orders**
Address cascade with BD geography, shipping zone calculation, coupon validation, order creation with snapshots, COD path end-to-end.

**Phase 6 — Payments**
SSLCommerz sandbox integration, IPN, validation, reconciliation cron, the tampering test.

**Phase 7 — Admin core**
Auth-gated admin shell, dashboard, orders table + detail, product CRUD with variants and images, inventory.

**Phase 8 — Admin extended**
Customers, discounts, categories/collections, content editor, media library, settings, staff and audit log.

**Phase 9 — Fraud defense**
Fraud scoring, review queue, blocked entities, customer risk indicators.

**Phase 10 — SEO system**
Everything in section 7. This is a full phase, not a finishing touch.

**Phase 11 — Notifications**
SMS and email templates, order lifecycle triggers, abandoned-cart SMS after 6 hours.

**Phase 12 — Hardening**
Backup automation to R2, error monitoring, rate limiting on all mutation endpoints, Cloudflare WAF rules, load test, full security review of RLS policies.

---

## 11. Definition of done

A phase is complete when:
- `npm run build` passes with zero TypeScript errors and zero ESLint warnings
- Every new table has explicit RLS policies, verified by attempting access with the anon key
- No secret appears in any client bundle (`grep` the `.next` output for the service role key)
- New user-facing pages score 90+ on Lighthouse SEO and Accessibility
- The feature works on a 360px viewport
- Bangla text renders correctly with the Bengali font
- A migration file exists; nothing was changed only in the Supabase dashboard

---

## 12. Things to deliberately not build in v1

Resist these. They are scope traps.

Multi-currency. Multi-warehouse. A theme engine. Subscriptions. Wishlists. A loyalty program. Affiliate tracking. Live chat. Product bundles. Gift cards. Abandoned cart email sequences beyond one SMS. An app store. Multi-vendor marketplace features. AI product descriptions.

Ship the core, get real orders, then let actual demand decide what comes next.
