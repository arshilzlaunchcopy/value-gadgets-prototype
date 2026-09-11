# Build Prompt Part 3 — Prototype / Demo Mode

> Companion to `BUILD_PROMPT.md` and `BUILD_PROMPT_PART2.md`.
> This part lets the entire system run end to end with **zero external accounts**:
> no SSLCommerz, no Steadfast, no SMS gateway, no trade licence.
>
> Nothing here is throwaway code. Every mock sits behind the same interface the
> real implementation will use, so going live is a configuration change.

---

## 18. The adapter rule

**Never call an external service directly from application code.** Every integration goes through an interface with two implementations selected at runtime.

```
lib/integrations/
  payment/
    types.ts            ← PaymentAdapter interface
    sslcommerz.ts       ← real (written later, stubbed now)
    mock.ts             ← MockPaymentAdapter
    index.ts            ← factory: returns based on env
  sms/
    types.ts            ← SmsAdapter
    alpha-sms.ts        ← real
    mock.ts             ← MockSmsAdapter
    index.ts
  courier/
    types.ts            ← CourierAdapter
    steadfast.ts        ← real
    mock.ts             ← MockCourierAdapter
    index.ts
  fraud/
    types.ts            ← CourierScoreAdapter
    steadfast-score.ts  ← real
    mock.ts             ← MockCourierScoreAdapter
    index.ts
```

Factory pattern, one per integration:

```ts
// lib/integrations/courier/index.ts
import { MockCourierAdapter } from './mock';
import { SteadfastAdapter } from './steadfast';
import type { CourierAdapter } from './types';

let instance: CourierAdapter | null = null;

export function getCourier(): CourierAdapter {
  if (instance) return instance;
  instance = process.env.DEMO_MODE === 'true'
    ? new MockCourierAdapter()
    : new SteadfastAdapter({
        apiKey:    requireEnv('STEADFAST_API_KEY'),
        secretKey: requireEnv('STEADFAST_SECRET_KEY'),
      });
  return instance;
}
```

**Application code only ever imports `getCourier()`.** It never knows which one it got. Write the real adapter's method signatures now from the Part 2 spec, even if the bodies `throw new Error('not implemented')`. That forces the interface to be shaped correctly from day one.

---

## 19. Environment flags

```bash
DEMO_MODE=true                    # server: swaps all adapters to mocks
NEXT_PUBLIC_DEMO_MODE=true        # client: shows the demo banner + control panel
DEMO_SEED_TOKEN=<random-string>   # gates /demo reset and seed endpoints
```

When `DEMO_MODE=true`:
- A dismissible amber banner sits above the header: *"Demo store — orders are simulated, no real payments or deliveries."* Required for honesty if you show this publicly.
- The `/demo` control panel route becomes accessible
- All mock adapters are active
- Seed and reset endpoints are live

**A production deploy must fail the build if `DEMO_MODE=true` and `NODE_ENV=production` and the domain is not a preview URL.** Add that assertion. You do not want to accidentally ship a store that fakes payments.

---

## 20. Mock implementations

### 20.1 MockSmsAdapter

```ts
interface SmsAdapter {
  send(to: string, message: string, kind: SmsKind): Promise<SmsResult>;
}
```

Mock behaviour:
- Writes to a `demo_sms_log` table (to, message, kind, sent_at) instead of sending
- **OTP is always `123456`** in demo mode, plus the real generated code is shown in a toast and in the demo panel, so you can demo either way
- Simulates a 400ms delay so the UI's loading state is visible
- 5% simulated failure rate, toggleable in the demo panel, so you can show the error path
- The admin panel gets an **SMS Log** view reading from `demo_sms_log` — this is genuinely useful in production too, so build it properly

### 20.2 MockPaymentAdapter

```ts
interface PaymentAdapter {
  createSession(order: Order): Promise<{ redirectUrl: string; txnId: string }>;
  validate(valId: string): Promise<ValidationResult>;
  refund(txnId: string, amount: number): Promise<RefundResult>;
}
```

Mock behaviour:
- `createSession` returns `/demo/gateway?txn={id}&amount={total}&order={orderNumber}`
- Build `/demo/gateway` as a **convincing fake payment page**: card / bKash / Nagad tabs styled like a real BD gateway, the order amount displayed, and three buttons — **Pay Successfully**, **Payment Failed**, **Cancel**
- Choosing success fires a real POST to your actual `/api/payment/ipn` handler with a payload shaped exactly like SSLCommerz's, then redirects to your success page
- `validate` returns `VALID` only for transactions the mock gateway recorded as successful

This matters: **your real IPN handler, validation logic, and amount-tampering check all get exercised by the mock.** When you swap in SSLCommerz, that entire path is already tested. Do not shortcut it by having the demo just mark orders paid.

### 20.3 MockCourierAdapter

```ts
interface CourierAdapter {
  createOrder(p: DispatchPayload): Promise<{ consignmentId: string; trackingCode: string }>;
  createBulkOrders(p: DispatchPayload[]): Promise<BulkResult>;
  statusByInvoice(invoice: string): Promise<CourierStatus>;
  getBalance(): Promise<number>;
  createReturnRequest(r: ReturnRequest): Promise<ReturnResult>;
}
```

Mock behaviour:
- Generates plausible IDs: consignment `1` + 7 digits, tracking `VG` + 9 alphanumerics
- Writes a `shipments` row exactly as the real one would
- **Auto-advances status on a timer** via a scheduled function: `created → picked` after 2 min, `→ in_transit` after 5, `→ out_for_delivery` after 8, `→ delivered` after 12. Configurable speed in the demo panel, including an "instant" mode for live demos.
- 10% of parcels go to `returned` instead of `delivered`, so the return path and restocking logic get exercised and the dashboard has realistic numbers
- Fires your **real webhook endpoint** on each transition, with a Steadfast-shaped payload
- `getBalance` returns a decreasing number seeded at ৳25,000

### 20.4 MockCourierScoreAdapter

Deterministic, not random — the same phone must always return the same score, or demos become unreproducible.

```ts
// hash the phone, derive a stable profile
const h = hashPhone(phone);
const bucket = h % 100;

bucket < 10  → new customer:     0 parcels,  ratio null
bucket < 70  → good:      12–60 parcels, ratio 88–98%
bucket < 88  → mixed:      5–25 parcels, ratio 60–85%
bucket < 97  → risky:      4–18 parcels, ratio 30–55%
else         → flagged:               ratio <30%, 1–3 fraud reports
```

Publish a short list of **known demo phone numbers** in the demo panel — one that scores excellent, one mixed, one that trips the review queue, one that's outright blocked. That's how you demo the fraud system convincingly in 30 seconds.

---

## 21. Seed data — this is what sells the demo

An empty admin dashboard with three products looks like a school project. Invest here.

### 21.1 Catalog

**35–45 real products** across categories that match the brand: USB-C hubs and adapters, cables, chargers and power banks, audio, storage, phone accessories, small smart-home.

For each: real-sounding title, genuine spec table, 4–6 highlight bullets, realistic BD pricing (a ৳1,250 hub, a ৳3,400 power bank), a compare-at price on roughly 40% so discount badges appear, realistic stock levels with 4–5 products deliberately low-stock and 2 out-of-stock, and 3–5 images each.

**Images:** shoot or source clean product photos on white. Run them through the Phase 2 pipeline so the demo also proves the image performance story. Avoid obvious stock-photo watermarks — it undermines everything.

Build 6–8 categories with images, 4 collections (`New Arrivals`, `Best Sellers`, `Under ৳1,000`, `Eid Offers`), and 5–6 brands.

### 21.2 Transactional history

Generate **250–400 orders spread across the last 120 days**, with:
- A realistic weekly rhythm — weekends heavier, a spike around a simulated campaign date
- Growth trend over the period, so the dashboard chart slopes up
- Payment split roughly 35% online / 65% COD, matching the market
- Status distribution: ~70% delivered, 12% in transit, 8% processing, 6% returned, 4% cancelled
- Fraud scores distributed so the review queue has 5–8 orders sitting in it
- 60–90 customers with plausible Bangla names, valid-format `018/017/019` numbers, real division/district/upazila combinations, and varied order counts so the customer list shows LTV spread
- 40–60 approved reviews with a realistic rating curve (heavy 5s, some 4s, a few 2s), some with admin replies
- UTM data on orders so the attribution view isn't empty

### 21.3 Content

- A fully composed home page using 8–10 blocks, so the page builder demo starts from something real
- A configured header with a working mega menu and an announcement bar
- A populated 4-column footer
- 4 published blog posts with cover images (SEO proof)
- All policy pages written in English and Bangla
- One landing page at `/lp/usb-c-hub-8in1` built from the quick-order block

### 21.4 Mechanics

Write `supabase/seed/` as idempotent, re-runnable TypeScript. Use a fixed random seed so the data is identical every run — reproducible demos matter. Expose:

- `POST /api/demo/reset` — truncate transactional tables, re-seed, keep catalog and content
- `POST /api/demo/reset-all` — full wipe and re-seed
- `POST /api/demo/generate-orders?n=20` — add fresh orders on demand

All three gated by `DEMO_SEED_TOKEN`.

---

## 22. The demo control panel

Route `/demo`, only when `DEMO_MODE=true`. Floating launcher button, bottom-right, so it's reachable during a live walkthrough.

**Order controls**
- Order picker → buttons to force each status transition instantly
- "Run full lifecycle" — placed to delivered in ~8 seconds with visible UI updates
- Force an order into the review queue
- Trigger a return

**Payment controls**
- Fire a success, failure, or timeout IPN for any pending order
- **Fire a tampered IPN** with a mismatched amount, to demonstrate that the system rejects it. This is a genuinely impressive thing to show anyone technical.

**Courier controls**
- Delivery speed: instant / fast (seconds) / realistic (minutes)
- Force a return on the next dispatch
- Simulate a courier API outage, to show graceful degradation

**Fraud controls**
- Reference table of demo phone numbers and the score each produces
- Override the score for the next order

**Data controls**
- Generate N orders
- Jump the clock forward (shifts timestamps, so dashboard ranges fill)
- Reset transactional / reset all

**Environment readout**
- Which adapter each integration is currently using, with a mock/live badge

This panel is ~300 lines and it is the highest-leverage thing in the whole prototype. Build it in Phase 3, not at the end.

---

## 23. Revised phase order for the prototype

Reordered so the demo is presentable as early as possible, and so the parts that impress get built before the parts that only matter in production.

| Phase | Scope | Demoable after? |
|---|---|---|
| 1 | Foundation: scaffolding, brand tokens, Supabase, catalog migrations, RLS | no |
| 2 | Image pipeline (Part 2 §16.1) | no |
| 3 | **Adapter interfaces + all four mocks + demo control panel** | no |
| 4 | Seed data engine (§21) | no |
| 5 | Storefront: home, category, PDP, search, ISR | **yes — first showable build** |
| 6 | Cart + checkout + OTP (mock SMS) + orders | **yes — full customer journey** |
| 7 | Mock payment gateway + real IPN handler + validation | yes |
| 8 | Block system core + 8 starter blocks | no |
| 9 | **Page builder UI**: split view, drag-reorder, draft/publish, preview | **yes — the "this is Shopify" moment** |
| 10 | Header / footer / theme builders | yes |
| 11 | Admin core: dashboard, orders, products, inventory | **yes — the pitch-ready build** |
| 12 | Fraud scoring + review queue + mock courier dispatch + status sync | yes |
| 13 | Full block library + landing pages + quick order form | yes |
| 14 | SEO system (Part 1 §7) | yes |
| 15 | Admin extended: customers, discounts, content, media, settings, staff | yes |
| 16 | Bangla localisation pass | yes |
| — | *pause: prototype complete* | |
| 17 | Swap in real adapters: SSLCommerz, Alpha SMS, Steadfast | production |
| 18 | BD playbook: advance payment, warranty, manual orders, returns, reconciliation | production |
| 19 | Hardening: backups, monitoring, rate limits, WAF, load test, RLS audit | production |

**Phase 11 is your pitch build.** Storefront, checkout, payments, page builder, and a dashboard full of realistic data. Everything after that is depth.

---

## 24. Going live later — the checklist

Because the adapters were built correctly, the switch is short:

1. Obtain real credentials (trade licence → SSLCommerz; Steadfast account; SMS gateway)
2. Implement the four real adapter classes against the already-defined interfaces
3. Set `DEMO_MODE=false` and populate the real env vars
4. Run the existing integration test suite against sandbox credentials
5. Verify the amount-tampering test still fails correctly against the real gateway
6. Purge demo transactional data, keep catalog and content
7. Remove the demo banner, verify `/demo` returns 404 in production
8. Complete Phases 18 and 19

If swapping adapters requires touching any file outside `lib/integrations/`, the abstraction leaked. Fix it before going live, not after.

---

## 25. One note on "sell this"

If the goal becomes licensing this to other merchants rather than only running Value Gadgets BD, the architectural fork is **multi-tenancy**, and it is expensive to retrofit.

**Do not build it now.** But make two cheap decisions that keep the door open:

1. **Never hardcode brand values.** Colours, logo, store name, contact details, and policy text all live in `theme_settings` and `settings`, read at runtime. If "Value Gadgets BD" appears as a string literal anywhere outside a seed file, that's a bug.
2. **Keep `store_id` conceptually present** in your domain language even with one store. Name things `getStoreSettings()` rather than reaching for a global constant.

Those two habits cost nothing now and save weeks later. Actual row-level multi-tenancy, subdomain routing, and per-tenant billing are a separate project — decide on it only after you have a real customer asking.
