-- 20260913000400_phase16_bangla.sql
-- Phase 16: locale preference on customers (SMS/invoice language) and orders
-- (snapshot of the language the order was placed in), Bangla collection copy.

alter table public.customers add column if not exists locale text not null default 'en' check (locale in ('en', 'bn'));
alter table public.orders add column if not exists locale text not null default 'en' check (locale in ('en', 'bn'));
alter table public.collections add column if not exists description_bn text;
