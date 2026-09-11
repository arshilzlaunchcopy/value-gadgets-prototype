# Prototype Runbook — Value Gadgets BD

> Follow top to bottom. Every step has a verification gate. Do not skip a gate.
> Companion to `BUILD_PROMPT.md`, `BUILD_PROMPT_PART2.md`, `BUILD_PROMPT_PART3.md`.

---

# PART A — Machine setup (~30 min, once)

### A1. Install the toolchain

```bash
# Node 20 LTS or newer
node --version        # need v20+

# If missing, install via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20 && nvm use 20 && nvm alias default 20

# Git
git --version

# Supabase CLI
npm install -g supabase
supabase --version

# Claude Code
npm install -g @anthropic-ai/claude-code
claude --version
```

### A2. Install Docker Desktop

Needed to run Supabase locally. Download from docker.com, install, launch it, and leave it running.

Local Supabase matters more than it sounds: you get instant `db reset`, zero free-tier bandwidth consumption, and you can wipe and re-seed forty times a day while iterating. You push to the cloud project only when you want to show someone.

```bash
docker --version
docker ps        # must not error
```

### A3. Sign in to Claude Code

```bash
cd ~
claude
# then inside the session:
/login
/model          # pick Claude Fable 5.1
/doctor         # confirms install health, PATH, settings
/exit
```

**Gate A:** `node -v` ≥ 20, `docker ps` runs clean, `claude --version` prints, `/doctor` reports no problems.

---

# PART B — Accounts (~20 min, all free, no paperwork)

| Service | What to do | Save |
|---|---|---|
| **GitHub** | Create a **private** repo `value-gadgets-bd` | repo URL |
| **Supabase** | New project, region **Singapore**, generate a strong DB password | project ref, DB password, Project URL, `anon` key, `service_role` key |
| **Netlify** | Sign up with GitHub | — |
| **Cloudflare** | Sign up, create an **R2 bucket** `vgbd-media`, generate an S3-compatible API token | account ID, access key ID, secret access key |

Skip for now: domain, SSLCommerz, Steadfast, SMS gateway, trade licence. All four are mocked.

**Gate B:** You have the Supabase project ref and all three keys written down, plus R2 credentials.

---

# PART C — Repo and Supabase (~45 min)

### C1. Scaffold

```bash
npx create-next-app@latest value-gadgets-bd \
  --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint
cd value-gadgets-bd
git init && git add -A && git commit -m "chore: scaffold"
git remote add origin git@github.com:YOURNAME/value-gadgets-bd.git
git push -u origin main
```

### C2. Drop in the spec files

Copy all three build prompt markdown files into the repo root:

```
BUILD_PROMPT.md
BUILD_PROMPT_PART2.md
BUILD_PROMPT_PART3.md
PROTOTYPE_RUNBOOK.md      ← this file
```

```bash
git add -A && git commit -m "docs: add build specs"
```

### C3. Initialise Supabase locally

```bash
supabase init
supabase start        # first run pulls ~1GB of Docker images, be patient
```

When it finishes it prints a block of local credentials. **Copy them.** They look like:

```
API URL:      http://127.0.0.1:54321
DB URL:       postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:   http://127.0.0.1:54323
anon key:     eyJhbGci...
service_role: eyJhbGci...
```

Open Studio at `http://127.0.0.1:54323` — that's your local database browser.

### C4. Link the cloud project

```bash
supabase link --project-ref YOUR_PROJECT_REF
# paste the DB password when asked
```

You now have two environments. Local for building, cloud for showing people.

### C5. Configure auth for phone OTP

Edit `supabase/config.toml`:

```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**"]
jwt_expiry = 3600
enable_signup = true

[auth.sms]
enable_signup = true
enable_confirmations = true
template = "Your Value Gadgets BD code is {{ .Code }}"
max_frequency = "60s"

[auth.sms.test_otp]
# demo-mode fixed codes; these work locally with NO SMS provider at all
"8801711111111" = "123456"
"8801722222222" = "123456"
"8801733333333" = "123456"
```

That `test_otp` block is the trick that lets you build and demo the entire OTP flow with no SMS account. Restart to apply:

```bash
supabase stop && supabase start
```

### C6. Environment files

Create `.env.local` (this is gitignored — confirm it's in `.gitignore`):

```bash
# ---- Supabase (LOCAL) ----
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from C3>
SUPABASE_SERVICE_ROLE_KEY=<local service_role key from C3>

# ---- Demo mode ----
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
DEMO_SEED_TOKEN=<run: openssl rand -hex 16>

# ---- Cloudflare R2 ----
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=vgbd-media
R2_PUBLIC_BASE_URL=

# ---- Site ----
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ---- Real integrations: empty until go-live ----
SSLCZ_STORE_ID=
SSLCZ_STORE_PASSWD=
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=
SMS_API_KEY=
SMS_SENDER_ID=
```

Also create `.env.example` with the same keys and empty values, and **commit that one**. Future you will need it.

### C7. Connect Netlify

1. Netlify → Add new site → Import from GitHub → pick the repo
2. Build command `npm run build`, publish directory `.next`
3. Install the Next.js plugin: `npm i -D @netlify/plugin-nextjs`, then add `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

4. In Netlify env vars, add the **cloud** Supabase URL and keys (not the local ones), plus `DEMO_MODE=true` and the R2 values.

**Gate C:** `supabase status` shows all services running, `npm run dev` serves the default Next page at localhost:3000, and a push to `main` produces a successful Netlify deploy.

---

# PART D — Configure Claude Code (~20 min, high leverage)

### D1. Generate and then rewrite CLAUDE.md

```bash
claude
/init
```

`/init` produces a starter file. Replace its contents with this — it's the persistent briefing Claude Code reads at the start of every single session:

```markdown
# Value Gadgets BD — Commerce Platform

## What this is
Self-hosted ecommerce platform + admin CMS for a Bangladeshi tech-accessory
retailer. Currently in PROTOTYPE / DEMO MODE: all external integrations are
mocked. See BUILD_PROMPT.md, BUILD_PROMPT_PART2.md, BUILD_PROMPT_PART3.md
for the full specification. Read the relevant section before starting a phase.

## Stack
Next.js 15 App Router · TypeScript strict · Tailwind v4 · shadcn/ui
Supabase (Postgres + Auth + Storage) · Cloudflare R2 for media
Netlify hosting · Zod · React Hook Form · TanStack Query + Table · Recharts

## Absolute rules
1. Money is `int` BDT. Never float, never decimal. ৳1,250 === 1250.
2. `SUPABASE_SERVICE_ROLE_KEY` is imported ONLY by `lib/supabase/admin.ts`.
   That file must never be imported by a client component.
3. Every table has RLS enabled AND explicit policies. Never one without the other.
4. All prices are recalculated server-side from the DB at checkout.
   The client sends variant IDs and quantities only.
5. order_items store SNAPSHOTS of title, price, sku, image. Never join to live
   product data for historical orders.
6. External services are called ONLY through adapters in lib/integrations/.
   Application code calls getCourier() / getPayment() / getSms() — never a
   concrete class.
7. No localStorage for cart. Cart is a DB row keyed by an httpOnly cookie.
8. Every schema change is a migration file in supabase/migrations/.
   Never change the database only through Studio.
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
supabase start / stop
supabase db reset        # re-runs all migrations + seed
supabase migration new <name>
npm run gen:types        # regenerate DB types — run after EVERY migration

## Definition of done for any phase
- npm run build passes, zero TS errors, zero lint warnings
- New tables have explicit RLS policies, verified with the anon key
- grep the .next output: service_role key must not appear
- Works at 360px viewport
- A migration file exists for every schema change
```

### D2. Add the type-generation script

In `package.json`:

```json
"scripts": {
  "gen:types": "supabase gen types typescript --local > src/lib/database.types.ts"
}
```

Run it after every migration. Skipping this is the number one cause of Claude Code writing code against a stale schema.

### D3. Set permissions

```bash
claude
/permissions
```

Allow without prompting: `npm run *`, `supabase *`, `git status`, `git diff`, `git log`, file reads within the repo.

Keep asking for: `git push`, `rm`, anything touching `.env.local`.

### D4. Set model and effort

```
/model          # Claude Fable 5.1
/effort high    # architecture-heavy work; drop to medium for routine CRUD
```

### D5. Create a verification skill

Create `.claude/skills/verify-phase/SKILL.md`:

```markdown
---
name: verify-phase
description: Run the full verification gate for a completed build phase.
---

Run every check and report a pass/fail table. Do not fix anything unless asked.

1. `npm run build` — report any TS or lint errors
2. `npm run lint`
3. `grep -r "service_role" .next/static/ || echo "clean"`
4. List tables added in this phase; for each, show its RLS policies from
   `supabase/migrations/`. Flag any table with RLS enabled and zero policies,
   and any table with no RLS at all.
5. Confirm `src/lib/database.types.ts` is newer than the newest migration file
6. Check that no file outside `src/lib/integrations/` imports a concrete
   adapter class (SteadfastAdapter, SslCommerzAdapter, AlphaSmsAdapter)
7. Report the diff stat
```

Invoke with `/verify-phase` after every phase.

```bash
git add -A && git commit -m "chore: claude code config"
```

**Gate D:** `CLAUDE.md` committed, `npm run gen:types` works, `/verify-phase` appears in the `/` menu.

---

# PART E — The phase runbook

### The loop, every single time

```
1. claude
2. /clear                          ← fresh context, CLAUDE.md still loads
3. /plan                           ← plan mode BEFORE any code
4. paste the phase prompt
5. read the plan. Reject it if it's wrong. This is the cheapest fix point.
6. approve → let it build
7. /verify-phase
8. manually test the gate items
9. /diff, then git commit
10. /exit
```

**One phase per session.** When `/context` shows the window filling, `/compact` — but it's usually better to finish, commit, and `/clear`.

---

### Phase 1 — Foundation

```
Read BUILD_PROMPT.md sections 2, 3, 4.1, 4.2, and 5.

Build Phase 1 only:
- Tailwind v4 theme with the brand tokens from section 3
- shadcn/ui init, base components: button, input, select, dialog, sheet,
  table, badge, card, tabs, toast
- src/lib/supabase/{client,server,admin}.ts — admin.ts marked server-only
- Migrations for: categories, brands, products, product_variants,
  product_images, collections, collection_products, product_categories,
  customers, addresses, bd_locations
- updated_at triggers on every table
- RLS enabled with explicit policies per the section 5 matrix
- The products_public view that omits cost_bdt
- The tsvector search column and GIN index from 4.7
- Seed bd_locations with all 8 divisions and 64 districts

Do NOT build any UI beyond the default layout. Do NOT scaffold later phases.
```

Then:

```bash
supabase db reset
npm run gen:types
/verify-phase
```

**Gate 1:** Studio shows every table. Querying `customers` with the anon key returns zero rows (RLS working), not an error and not data. `database.types.ts` has real types.

---

### Phase 2 — Image pipeline

```
Read BUILD_PROMPT_PART2.md section 16.1.

Build the image pipeline:
- An upload route that accepts an image, strips EXIF, and generates AVIF +
  WebP at widths [320,480,640,960,1280,1920] plus a JPEG fallback, using sharp
- A 20px LQIP base64 blur string
- Upload all variants to Cloudflare R2 under a content-hashed path
- Write width, height, blur_data_url, and the variant manifest back to
  product_images
- A <ProductImage> component that consumes the manifest and emits a correct
  srcSet with sizes, using next/image with a custom loader
- A CLI script `npm run images:ingest <dir>` for bulk seeding

Cache-Control on R2 objects: public, max-age=31536000, immutable
```

**Gate 2:** Upload one real product photo, confirm 13 objects appear in R2, and that the rendered `<img>` has a multi-width `srcSet` and a blur placeholder.

---

### Phase 3 — Adapters and demo panel

```
Read BUILD_PROMPT_PART3.md sections 18, 19, 20, 22.

Build:
- The four adapter interfaces in src/lib/integrations/{payment,sms,courier,fraud}
- Real adapter classes with correct method signatures whose bodies
  throw new Error('not implemented') — signatures per PART2 section 14.2
- All four mock adapters per section 20
- The factory functions selecting on DEMO_MODE
- /demo/gateway — the fake payment page with card/bKash/Nagad tabs and
  Pay Success / Payment Failed / Cancel buttons
- The /demo control panel per section 22
- The demo banner component
- A build-time assertion that fails if DEMO_MODE=true on a production deploy
- demo_sms_log table + migration
```

**Gate 3:** `/demo` loads and shows all four adapters badged as `mock`.

---

### Phase 4 — Seed engine

```
Read BUILD_PROMPT_PART3.md section 21.

Build supabase/seed/ as idempotent TypeScript with a fixed random seed:
- 40 products across 7 categories, realistic BD pricing, compare-at on ~40%,
  4 low-stock, 2 out-of-stock, full spec tables and highlight bullets
- 6 brands, 4 collections
- 75 customers with plausible Bangla names and valid 017/018/019 numbers
- 320 orders across 120 days with the distributions in section 21.2
- 50 approved reviews with a realistic rating curve
- UTM data on orders
- The three /api/demo/* endpoints, gated by DEMO_SEED_TOKEN

Use real product photos from public/seed-images/ through the Phase 2 pipeline.
```

Put 40 product photos in `public/seed-images/` before running this.

**Gate 4:** `supabase db reset` produces a database whose order table has 320 rows with a realistic date spread.

---

### Phases 5–16

Same pattern. The prompt template:

```
Read [spec file] section [N].
Build Phase [N] only: [paste the phase row from PART3 section 23].
Do not scaffold future phases.
Follow every rule in CLAUDE.md.
```

| Phase | Spec reference | Gate |
|---|---|---|
| 5 Storefront | P1 §6.1 | Lighthouse ≥85 mobile on PDP; SEO ≥95 |
| 6 Cart + checkout + OTP | P1 §6.1, §8 | Place a COD order end to end using test OTP `123456` |
| 7 Mock payments | P3 §20.2 | Tampered-IPN test: forge a success with the wrong amount, order must stay unpaid |
| 8 Block system core | P2 §13.1–13.3 | Add a new block type by adding one file only |
| 9 Page builder UI | P2 §13.7 | Rebuild the home page start to finish without touching code |
| 10 Header/footer/theme | P2 §13.4–13.5 | Change the logo, nav, and announcement bar from admin |
| 11 Admin core | P1 §6.2 | Dashboard charts populated from seed data |
| 12 Fraud + courier | P2 §14, P3 §20.3–20.4 | Run a full lifecycle from `/demo`, watch statuses advance |
| 13 Full block library | P2 §13.2 | Build a landing page from blocks |
| 14 SEO system | P1 §7 | Rich Results Test passes on Product, Breadcrumb, FAQ |
| 15 Admin extended | P1 §6.2 | — |
| 16 Bangla pass | P2 §15.3 | Toggle to Bangla, every string translates |

**Phase 11 is the pitch build.** Deploy it, show people, gather reactions before continuing.

---

# PART F — Working habits that matter

**Plan mode before every phase.** `/plan` costs two minutes and catches architectural mistakes before they become 800 lines of code. Reading a plan and saying "no, the cart should be server-side" is far cheaper than a refactor.

**`/clear` between phases, not `/compact`.** `CLAUDE.md` reloads on a fresh session, so you lose nothing that matters. A context window full of Phase 5's details makes Phase 6 worse, not better.

**Regenerate types after every migration.** `npm run gen:types`. If Claude Code starts writing code against columns that don't exist, this is why.

**Use `#` to capture decisions.** Typing `# cart totals are always recomputed server-side in lib/cart/totals.ts` during a session appends it to `CLAUDE.md`. Do this whenever you make a decision you'll want enforced later.

**`/code-review` before each commit.** Catches the small correctness bugs that accumulate.

**`/security-review` after Phases 6, 7, and 11.** Auth, payments, and admin are where a mistake actually costs something.

**Commit at every gate.** `/rewind` handles in-session mistakes; git handles everything else. Use conventional commits so history stays readable: `feat(checkout): ...`, `fix(rls): ...`.

**Adjust effort to the work.** `/effort high` for Phases 1, 3, 8, 12, 14. `/effort medium` is plenty for CRUD screens and burns fewer tokens.

**When a phase spans the whole codebase**, `/batch` decomposes it into parallel units in separate worktrees. Useful for the Bangla pass in Phase 16.

---

# PART G — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `supabase start` hangs | Docker not running, or ports taken | `docker ps`, then `supabase stop --no-backup && supabase start` |
| Queries return empty with no error | RLS on, no matching policy | Check policies in Studio → Authentication → Policies |
| Queries return everything unexpectedly | RLS not enabled on that table | `alter table X enable row level security;` |
| Claude Code references missing columns | Stale types | `npm run gen:types` |
| Netlify build fails, local passes | Missing env var | Compare Netlify env vars against `.env.example` |
| OTP never arrives locally | Expected — no SMS provider | Use a `test_otp` number from `config.toml` with code `123456` |
| Images 404 from R2 | Bucket not public, or wrong `R2_PUBLIC_BASE_URL` | Enable public access or attach a custom domain |
| Slow, drifting responses | Context window full | `/context`, then `/clear` |

---

# PART H — When you're ready to go live

1. Trade licence → SSLCommerz production application
2. Steadfast merchant account → API credentials
3. SMS gateway account + sender ID
4. Implement the four real adapter classes against the existing interfaces
5. `DEMO_MODE=false`, populate the real env vars
6. Run the tampering test against the real sandbox
7. Purge demo transactional data, keep catalog and content
8. Verify `/demo` returns 404 in production
9. Phases 18 and 19 from `BUILD_PROMPT_PART2.md`

**If step 4 requires touching any file outside `src/lib/integrations/`, the abstraction leaked.** Fix it then, not later.
