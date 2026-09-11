# Build Prompt Part 2 — Editable Content, Courier, Bangladesh Playbook

> Companion to `BUILD_PROMPT.md`. Keep both in the repo root.
> This part covers the page builder, Steadfast integration, Bangladesh-specific
> commerce features, and the image performance pipeline.

---

## 13. The editable content system

This is the "Shopify feel" the business actually wants: an admin can rebuild the home page, reorder product page sections, edit the header nav, and rewrite the footer without a developer.

### 13.1 Core principle — schema-derived blocks

Every block type is defined **once** in `lib/blocks/registry.ts` as a Zod schema plus metadata. From that single definition, derive:

1. The TypeScript prop types for the React component
2. The runtime validation when settings are saved
3. The admin settings form, auto-generated field-by-field from the schema

```ts
// lib/blocks/types/hero-slider.ts
export const heroSliderSchema = z.object({
  slides: z.array(z.object({
    image_desktop: z.string().url().describe('Desktop image (1920x720)'),
    image_mobile:  z.string().url().describe('Mobile image (750x900)'),
    alt_text:      z.string().min(1),
    heading_en:    z.string().optional(),
    heading_bn:    z.string().optional(),
    subheading_en: z.string().optional(),
    cta_label_en:  z.string().optional(),
    cta_href:      z.string().optional(),
    text_position: z.enum(['left','center','right']).default('left'),
  })).min(1).max(6),
  autoplay_ms: z.number().int().min(0).max(15000).default(5000),
  show_dots:   z.boolean().default(true),
});

export const heroSliderBlock = defineBlock({
  type: 'hero_slider',
  label: 'Hero Slider',
  icon: 'GalleryHorizontal',
  allowedOn: ['home', 'custom', 'landing'],
  schema: heroSliderSchema,
  component: HeroSlider,
  defaults: { slides: [], autoplay_ms: 5000, show_dots: true },
});
```

The admin form generator maps Zod types to controls: `z.string().url()` on a field named `image_*` → media picker; `z.enum()` → select; `z.boolean()` → switch; `z.array(z.object())` → repeater with drag-to-reorder; `.describe()` → the field's help text. Adding a block = adding one file. Nothing else changes.

### 13.2 Block library for v1

**Layout & content**
`hero_slider`, `banner_grid` (1/2/3/4-up promotional images), `rich_text`, `image_with_text`, `spacer_divider`, `video_embed`, `html_raw` (owner role only)

**Commerce**
`product_carousel` (source: manual list / collection / category / newest / best-selling / on-sale), `product_grid`, `category_tiles`, `collection_showcase`, `featured_product` (single product spotlight with buy button), `countdown_deal` (flash sale with live timer), `recently_viewed`

**Trust & conversion** — these matter more in Bangladesh than anywhere
`trust_badges` (warranty / delivery / genuine product / easy return), `feature_strip` (icon + label row, matching the brand's marketing creative style), `spec_highlight` (the "8-in-1" style callout grid), `testimonial_carousel`, `faq_accordion` (auto-emits FAQPage JSON-LD), `brand_logos`, `stats_row`

**Capture**
`newsletter_signup`, `whatsapp_cta`, `messenger_cta`, `quick_order_form` (see 15.6)

### 13.3 Schema

```sql
content_blocks
  id uuid pk,
  scope text check in ('template','instance'),
  page_type text check in ('home','product','category','collection','page','landing','custom'),
  target_id uuid null,           -- null + scope='template' → applies to every page of that type
                                 -- set  + scope='instance' → overrides for that one entity
  block_type text not null,
  position int not null,
  settings jsonb not null,
  is_visible bool default true,
  visible_from timestamptz,      -- schedule a campaign banner
  visible_until timestamptz,
  locale text null,              -- null = both languages
  created_by uuid, updated_by uuid

content_revisions
  id uuid pk,
  page_type text, target_id uuid null,
  snapshot jsonb not null,       -- full ordered block array at save time
  label text,                    -- "Eid campaign layout"
  created_by uuid, created_at timestamptz

navigation_menus
  id uuid pk, handle text unique,   -- 'main', 'footer_col_1', 'mobile', 'topbar'
  title text

navigation_items
  id uuid pk, menu_id uuid fk, parent_id uuid fk null,
  label_en text, label_bn text,
  link_type text check in ('url','category','collection','product','page','post'),
  link_target text,              -- resolved to href at render
  icon text, badge_label text, badge_color text,
  is_mega bool default false,    -- renders as a mega-menu panel
  mega_layout jsonb,             -- column definitions + optional featured image
  position int, opens_new_tab bool default false

theme_settings                   -- singleton, jsonb blob
  key text pk, value jsonb
```

### 13.4 Header builder

Admin controls, all stored in `theme_settings`:
- **Announcement bar** — text (en/bn), background colour, link, dismissible toggle, schedule window. Use it for free-delivery thresholds and campaign messaging.
- **Logo** — upload, height, separate mobile logo
- **Layout** — logo-left / logo-centre, sticky on/off, transparent-over-hero on/off
- **Main menu** — tree editor with drag-to-reorder and mega-menu panel builder
- **Utilities** — show/hide search, cart, track-order, phone number, language switcher
- **Mobile** — separate simplified menu tree, bottom tab bar toggle (Home / Categories / Search / Cart / Account)

### 13.5 Footer builder

- 1–4 link columns, each a `navigation_menu` with an editable heading
- About block: logo, short description, social icons
- Contact block: phone, WhatsApp, email, address
- **Trade licence and TIN number field** — SSLCommerz requires this visible in the footer
- Payment method badges (uploadable image row)
- Newsletter signup toggle
- Copyright line with `{year}` token

### 13.6 Template vs instance overrides

Product pages get a **default section order** set once as a template. Any individual product can override it, so a flagship USB-C hub can have a custom feature-comparison layout while every other product uses the standard one.

Resolution at render time:
```
blocks = instance_blocks(page_type, target_id)
       ?? template_blocks(page_type)
```

PDP core sections (gallery, price, variants, buy buttons) are **fixed and not reorderable** — they are the conversion path. Only the sections *below* the fold are block-driven. Do not let the admin break the buy button.

### 13.7 Editor UX

- Split view: block list with drag handles on the left, live preview iframe on the right
- Click a block → settings panel slides in
- **Draft / Publish separation.** Editing never touches the live site until Publish. Preview via a signed URL with a `?preview_token=` param.
- Mobile / tablet / desktop preview toggle
- Revision history with one-click restore and named save points
- Duplicate block, hide block, schedule block

### 13.8 Cache invalidation

On publish, call `revalidatePath()` for every route the change affects. Header, footer, and theme settings changes invalidate `/` with `revalidateTag('layout')`. Get this right or admins will publish changes and see nothing for an hour.

---

## 14. Steadfast Courier integration

Base URL `https://portal.packzy.com/api/v1`. Auth via `Api-Key` and `Secret-Key` headers. Store both in Netlify env vars, never client-side.

### 14.1 Schema

```sql
couriers
  id uuid pk, code text unique,       -- 'steadfast','pathao','redx'
  name text, is_active bool, is_default bool,
  config jsonb,                        -- endpoint + credential references
  supported_districts text[]

shipments
  id uuid pk, order_id uuid fk,
  courier_code text,
  consignment_id text, tracking_code text, invoice_ref text,
  cod_amount_bdt int, delivery_charge_bdt int,
  status text,                         -- courier's raw status string
  normalized_status text check in (
    'created','picked','in_transit','out_for_delivery',
    'delivered','partial_delivered','returned','cancelled','lost','on_hold'
  ),
  note text,
  dispatched_at timestamptz, delivered_at timestamptz,
  raw_create_response jsonb,
  last_webhook_payload jsonb,
  last_polled_at timestamptz

courier_score_cache
  phone text pk,
  courier_code text,
  total_parcels int, total_delivered int, total_cancelled int,
  success_ratio numeric,
  fraud_report_count int default 0,
  raw jsonb,
  checked_at timestamptz,
  expires_at timestamptz               -- cache 7 days

courier_reconciliation
  id uuid pk, date date, courier_code text,
  expected_cod_bdt int, received_cod_bdt int,
  delivered_count int, returned_count int,
  variance_bdt int, notes text, reconciled_by uuid
```

### 14.2 Client module

Write `lib/courier/steadfast.ts` with typed methods:

| Method | Endpoint | Notes |
|---|---|---|
| `createOrder(payload)` | `POST /create_order` | `invoice`, `recipient_name`, `recipient_phone`, `recipient_address`, `cod_amount`, `note`. Returns `consignment_id` + `tracking_code` |
| `createBulkOrders(payloads)` | `POST /create_order/bulk-order` | Chunk at 500. Use for end-of-day dispatch |
| `statusByConsignmentId(id)` | `GET /status_by_cid/{id}` | |
| `statusByInvoice(invoice)` | `GET /status_by_invoice/{invoice}` | Prefer this — your `order_number` is the invoice |
| `statusByTrackingCode(code)` | `GET /status_by_trackingcode/{code}` | |
| `getBalance()` | `GET /get_balance` | Surface on the admin dashboard |
| `createReturnRequest(...)` | return endpoint | For refused deliveries |
| `checkCourierScore(phone)` | courier score endpoint | **Rate-limited. See 14.5** |

Requirements for all of them:
- Exponential-backoff retry, 3 attempts, only on 5xx and network errors — never on 4xx
- 15-second timeout, 8-second connect timeout
- Log every request and response to a `courier_api_log` table for 30 days
- Normalize phone numbers before sending: accept `01712345678`, `8801712345678`, `+8801712345678` and with spaces or dashes; Steadfast wants the local 11-digit form
- Idempotency: never create a shipment if one already exists for that `order_id` with a non-cancelled status

### 14.3 Dispatch flow — get this ordering right

**Do not dispatch on OTP verification.** OTP proves phone control, not delivery intent. The flow is:

```
Order placed (OTP verified)
   ↓
Fraud score computed (internal rules + cached courier score)
   ↓
├── Score < 30 AND paid online     → auto-confirm → auto-dispatch to Steadfast
├── Score < 30 AND COD < ৳3,000    → auto-confirm → auto-dispatch
├── Score 30–59                    → admin Review Queue
└── Score ≥ 60                     → admin Review Queue + advance-payment requirement
```

Make each of those thresholds an editable setting, not a constant. You will tune them.

Dispatch payload mapping:
```ts
{
  invoice:           order.order_number,
  recipient_name:    order.shipping_address.recipient_name,
  recipient_phone:   normalizeBD(order.customer_phone),
  recipient_address: [street_address, area, upazila, district, division]
                       .filter(Boolean).join(', '),
  cod_amount:        order.payment_method === 'cod' ? order.total_bdt : 0,
  note:              [order.customer_note, itemSummary(order)]
                       .filter(Boolean).join(' | '),
}
```

**`cod_amount` must be `0` for prepaid orders.** Sending the full amount on an already-paid order means the courier collects the money twice and you spend a week untangling it.

### 14.4 Status sync

Two mechanisms, because neither is sufficient alone:

1. **Webhook** — expose `POST /api/courier/steadfast/webhook`, verify the bearer token from settings, update `shipments.status` and `normalized_status`, append an `order_events` row, and advance `orders.status`. Respond 200 fast; process asynchronously.
2. **Polling fallback** — a scheduled function every 30 minutes that polls `status_by_invoice` for all shipments not in a terminal state and last polled over 2 hours ago. Webhooks get missed.

Maintain a **status mapping table** in settings so the admin can remap a new courier status string without a deploy.

On `delivered`: set `orders.delivered_at`, increment `customers.total_delivered`, and for COD mark `payment_status='paid'`. On `returned`: increment `customers.total_returned`, restock inventory with a `stock_movements` row, and raise the customer's risk profile.

### 14.5 Courier score / fraud check

Returns delivery history for a phone number: total parcels, delivered, cancelled, success ratio, fraud report count.

**Treat it as advisory, with these guardrails:**
- Call it **server-side only**, from the order-creation path, never from the browser
- **Cache in `courier_score_cache` for 7 days.** The endpoint is rate-limited and repeated lookups will get you throttled
- Wrap in a 5-second timeout. **On timeout or error, proceed with a null score and add +10 to the internal fraud score** — never block checkout on a third-party outage
- Some community libraries implement this by logging into the merchant panel rather than a documented API. If your account has the official endpoint, use it. If you fall back to the panel method, expect it to break without warning and isolate it behind a feature flag
- Store the raw response; the shape may change

Score contribution:
```
success_ratio >= 90%           → −20  (trusted, can raise COD auto-confirm ceiling)
success_ratio 70–89%           →   0
success_ratio 50–69%           → +20
success_ratio < 50%            → +40
total_parcels = 0 (new)        → +10
fraud_report_count > 0         → +50
```

Display it in the admin order detail as a clear panel: ratio, delivered/cancelled counts, and a plain-language risk label. The person confirming orders needs to read it in two seconds.

### 14.6 Multi-courier readiness

Build the client against a `CourierAdapter` interface even though Steadfast is the only implementation in v1. Pathao and RedX get added later without touching the dispatch logic. Route by district via `couriers.supported_districts`, with a manual override per order.

### 14.7 Admin courier tooling

- **Bulk dispatch** — select orders, one click, push via the bulk endpoint, show per-order success/failure
- **Label + invoice printing** — A4 or thermal 4x6, Bangla-capable, with barcode
- **Balance widget** on the dashboard with a low-balance warning
- **Daily COD reconciliation view** — delivered orders vs. Steadfast payout, with variance flagged
- **One-click return request** from the order detail on a refused delivery

---

## 15. Bangladesh commerce playbook

These are the things that separate a store that works here from a generic template.

### 15.1 Partial advance payment for COD

The single most effective anti-fraud measure in this market. Require the delivery charge (typically ৳100–150) as an advance via bKash before dispatch, for:
- First-time customers with COD orders above a configurable threshold
- Any order with a fraud score ≥ 60
- All orders shipping outside the serviced Dhaka zones, if the admin enables it

Implementation: order enters `awaiting_advance` status, customer gets an SMS with a payment link for the advance amount only, order auto-confirms on successful payment, and auto-cancels after 24 hours with no payment. The advance is deducted from the COD amount sent to Steadfast.

### 15.2 Facebook-traffic landing pages

Most gadget sales in Bangladesh come from Facebook ads, not organic search. Build a `landing` page type using the same block system, with:
- Its own URL (`/lp/{slug}`), no header or footer chrome, or a stripped version
- A `quick_order_form` block: name, phone, address, quantity — **three fields, one screen**
- Optional OTP: a per-landing-page toggle. Lower friction converts better on cold traffic; require OTP only above a price threshold
- Per-page Meta Pixel event overrides and UTM capture
- A/B variant support: two block arrangements, 50/50 split, conversion tracked

This will outperform your category pages for paid traffic. Build it.

### 15.3 Bangla throughout

- Full `en`/`bn` toggle persisted in a cookie, with `hreflang` tags and separate `seo_meta` rows per locale
- Noto Sans Bengali, subset and self-hosted
- Optional Bangla numerals for prices (`৳১,২৫০`) as a theme setting — many customers prefer it, some find it harder to scan, so make it switchable
- SMS templates and invoices in Bangla
- **DBID registration requires Bangla-language terms and conditions**, so the `pages` table supporting `content_bn` is a compliance requirement, not a nice-to-have

### 15.4 Gadget-specific: warranty and serials

```sql
product_units                    -- optional per-unit tracking for high-value items
  id uuid pk, variant_id uuid, serial_no text unique, imei text,
  order_id uuid null, status text check in ('in_stock','sold','returned','rma'),
  warranty_starts_at date, warranty_ends_at date

warranty_claims
  id uuid pk, order_id uuid, unit_id uuid null, customer_id uuid,
  issue_description text, status text check in ('open','received','repairing','replaced','rejected','closed'),
  admin_note text, resolved_at timestamptz
```

Warranty is the number one purchase objection for gadgets in Bangladesh. Show remaining warranty on the customer's order page, give them a claim form, and put a claims queue in the admin. This is a differentiator against the marketplaces.

### 15.5 Payments beyond SSLCommerz

Build the payment layer as a `PaymentAdapter` interface. v1 ships SSLCommerz + COD. Plan for:
- **bKash direct Checkout (Tokenized)** — meaningfully cheaper than routing bKash through an aggregator, and worth adding once bKash is a large share of your volume
- **Nagad direct** — same reasoning
- **EMI display** — for items above ৳5,000, show the monthly instalment on the PDP. SSLCommerz supports card EMI across many banks and it visibly lifts conversion on higher-priced items

### 15.6 Operational realities

- **Manual order entry.** Many customers will call or message on Messenger. Admin needs a "Create Order" form that runs the same fraud check and dispatch path.
- **Duplicate order guard.** Same phone + same variant within 10 minutes → flag, don't silently create two.
- **Stock reservation.** Hold stock for 30 minutes at checkout start, release on abandonment. Facebook ad spikes cause real overselling.
- **Delivery zones.** Inside Dhaka / Dhaka Suburb / Outside Dhaka, with per-zone rates and per-zone estimated days shown on the PDP.
- **WhatsApp and Messenger share buttons** on every product. Product sharing in BD happens in chat apps, not on Twitter.
- **Abandoned cart SMS** at 6 hours, once, with an opt-out. Email open rates here are low; SMS works.
- **Invoice PDF** in Bangla and English with the trade licence number.
- **Return and exchange request flow** for customers, wired to the Steadfast return endpoint.

---

## 16. Image and page performance

The store must be usable on a 3G connection on a ৳12,000 Android phone. That is the real device.

### 16.1 Pipeline — pre-generate, do not optimize per request

Netlify's on-demand image optimization consumes function invocations and Supabase's free bandwidth is 5 GB. Both run out. Do the work once at upload time instead.

**On upload, a Supabase Edge Function (or Netlify background function) using `sharp`:**
1. Strips EXIF
2. Generates widths `[320, 480, 640, 960, 1280, 1920]`
3. Emits AVIF and WebP for each, plus one JPEG fallback
4. Produces a 20px LQIP, stored as a base64 blur string on the `product_images` row
5. Uploads all variants to **Cloudflare R2** (10 GB free) under a content-hashed path
6. Writes back `width`, `height`, `blur_data_url`, and the variant manifest

Serve from R2 through Cloudflare with `Cache-Control: public, max-age=31536000, immutable`. Content-hashed filenames make that safe. Zero per-request cost, permanent CDN caching.

Use `next/image` with `unoptimized` plus an explicit `srcSet` built from the manifest, or a thin custom loader pointing at R2.

### 16.2 Page-level rules

- PDP main image: `priority`, `fetchPriority="high"`, correct `sizes`. It is the LCP element.
- Every other image: `loading="lazy"`, `decoding="async"`, always with explicit `width`/`height` to prevent CLS.
- Category grids: first 4 images eager, the rest lazy.
- Fonts: `next/font` self-hosted, `display: swap`, Bengali subset loaded only when the locale is `bn`.
- No client-side data fetching for anything above the fold.
- Ship the block renderer as server components. Only `countdown_deal`, carousels, and the cart drawer are client components.
- Route-segment ISR with on-demand revalidation, so pages are static HTML from the CDN.

### 16.3 Cloudflare configuration

- Cache Rules: cache `/_next/static/*`, `/images/*`, and R2 paths at the edge, bypass `/admin/*`, `/api/*`, `/checkout*`
- Tiered Cache on, Brotli on, Early Hints on
- Turnstile on the OTP endpoint and the quick-order form
- Rate limiting: 10 req/min on `/api/otp/*`, 30 req/min on `/api/orders/*`
- Bot Fight Mode on, with a WAF skip rule for the Steadfast webhook IPs

### 16.4 Budgets — enforce these in CI

| Metric | Target | Measured on |
|---|---|---|
| LCP | < 2.5s | PDP, throttled 4G |
| CLS | < 0.1 | PDP, category |
| INP | < 200ms | PDP with variant switching |
| JS transferred | < 180 KB gzip | PDP |
| Initial HTML | < 60 KB gzip | PDP |
| Lighthouse Performance | ≥ 85 mobile | PDP, category, home |
| Lighthouse SEO | ≥ 95 | all public routes |

Add a Lighthouse CI step to the Netlify build that fails on regression.

---

## 17. Revised build phases

Replaces section 10 of Part 1.

| Phase | Scope |
|---|---|
| 1 | Foundation: scaffolding, brand tokens, Supabase clients, catalog migrations, RLS, seed data |
| 2 | **Image pipeline** (16.1) — build this before the storefront so every image ships through it |
| 3 | Storefront read paths: home, category, PDP, search, ISR, Lighthouse pass |
| 4 | **Block system core**: registry, schema-derived admin forms, renderer, 6 starter blocks |
| 5 | Cart: tables, session cookie, server actions, drawer, stock reservation |
| 6 | Auth: SMS hook Edge Function, rate limiting, Turnstile, OTP UI, cart merge |
| 7 | Checkout: BD address cascade, shipping zones, coupons, order snapshots, COD |
| 8 | Payments: SSLCommerz sandbox, IPN, validation, reconciliation cron, tampering test |
| 9 | Admin core: shell, dashboard, orders table + detail, product CRUD, inventory |
| 10 | **Fraud + Steadfast**: scoring, courier score cache, review queue, dispatch, webhook, polling |
| 11 | **Page builder UI**: editor split view, drag-reorder, draft/publish, revisions, preview |
| 12 | **Header/footer/theme builders**: nav tree, mega menu, announcement bar, theme settings |
| 13 | Admin extended: customers, discounts, content, media library, settings, staff, audit log |
| 14 | Full block library (13.2) + landing page type + quick order form |
| 15 | SEO system (section 7 of Part 1) — full phase |
| 16 | BD playbook: advance payment, warranty, manual orders, returns, reconciliation |
| 17 | Notifications: SMS and email templates, lifecycle triggers, abandoned cart |
| 18 | Hardening: R2 backups, monitoring, rate limits, WAF, load test, RLS audit |

Phases 2, 4, and 10 are the ones that are painful to retrofit. Do not defer them.
