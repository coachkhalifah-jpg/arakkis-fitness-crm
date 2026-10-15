-- 0084 — Optional theme line on take-home workouts (run-page secondary meta).
-- Cue/block live in steps jsonb; no Events/People coupling.
-- Idempotent: safe if theme was already added manually or by a prior apply.

alter table public.take_home_workouts
  add column if not exists theme text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'take_home_workouts_theme_check'
      and conrelid = 'public.take_home_workouts'::regclass
  ) then
    alter table public.take_home_workouts
      add constraint take_home_workouts_theme_check
      check (theme is null or char_length(btrim(theme)) between 1 and 160);
  end if;
end $$;

comment on column public.take_home_workouts.theme is
  'Optional session focus line shown as secondary meta on /workouts/[slug].';
