-- 20260912000100_foundation.sql
-- Shared helpers, admin_users (needed by is_admin() which every RLS policy uses).
--
-- NOTE: helper functions live in `public`, not `auth`, because on hosted Supabase
-- the `postgres` role cannot CREATE objects in the `auth` schema.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at trigger + helper to attach it
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.apply_updated_at(tbl regclass)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists set_updated_at on %s', tbl);
  execute format(
    'create trigger set_updated_at before update on %s for each row execute function public.set_updated_at()',
    tbl
  );
end;
$$;

-- Immutable wrapper so array_to_string can be used in a generated column.
create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$
  select array_to_string(arr, sep);
$$;

-- ---------------------------------------------------------------------------
-- admin_users (BUILD_PROMPT §4.8)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.admin_users');

-- security definer: reads admin_users without triggering its RLS (no recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.admin_users
  where id = auth.uid() and is_active = true;
$$;

alter table public.admin_users enable row level security;

drop policy if exists "admin_users: self select" on public.admin_users;
create policy "admin_users: self select"
  on public.admin_users for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "admin_users: admins select" on public.admin_users;
create policy "admin_users: admins select"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin_users: owner all" on public.admin_users;
create policy "admin_users: owner all"
  on public.admin_users for all
  to authenticated
  using (public.admin_role() = 'owner')
  with check (public.admin_role() = 'owner');

-- ---------------------------------------------------------------------------
-- audit_log (BUILD_PROMPT §4.8) - admin SELECT, owner ALL. Writes via service role.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.audit_log');
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log: admins select" on public.audit_log;
create policy "audit_log: admins select"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

drop policy if exists "audit_log: owner all" on public.audit_log;
create policy "audit_log: owner all"
  on public.audit_log for all
  to authenticated
  using (public.admin_role() = 'owner')
  with check (public.admin_role() = 'owner');
