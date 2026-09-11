---
name: verify-phase
description: Run the full verification gate for a completed build phase.
---

Run every check and report a pass/fail table. Do not fix anything unless asked.

1. `npm run build` — report any TS or lint errors
2. `npm run lint`
3. `grep -r "service_role" .next/static/ || echo "clean"`
4. List tables added in this phase; for each, show its RLS policies from
   `supabase/migrations/`. Flag any table with RLS enabled and zero policies
   (other than the documented exceptions `otp_codes` and `demo_settings`),
   and any table with no RLS at all.
5. Confirm `src/lib/database.types.ts` is newer than the newest file in
   `supabase/migrations/`. If not, say "run npm run gen:types".
6. Check that no file outside `src/lib/integrations/` imports a concrete
   adapter class (SteadfastAdapter, SslCommerzAdapter, AlphaSmsAdapter,
   SteadfastScoreAdapter, or any Mock*Adapter).
7. `npm run db:verify-rls` if the database is reachable.
8. Report the diff stat
