-- Pilot take-home workout timers (CSV-imported). Isolated from Events/registration.

create table public.take_home_workouts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  steps jsonb not null,
  active boolean not null default true,
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint take_home_workouts_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint take_home_workouts_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint take_home_workouts_steps_check check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 200)
);

create unique index take_home_workouts_active_slug_uq
  on public.take_home_workouts (slug)
  where active;

create index take_home_workouts_updated_idx
  on public.take_home_workouts (updated_at desc);

alter table public.take_home_workouts enable row level security;
grant select on public.take_home_workouts to anon, authenticated;
grant select, insert, update, delete on public.take_home_workouts to authenticated;

create policy take_home_workouts_public_read on public.take_home_workouts
  for select to anon, authenticated
  using (active = true);

create policy take_home_workouts_system_admin_all on public.take_home_workouts
  for all to authenticated
  using (public.is_active_system_admin())
  with check (public.is_active_system_admin());
