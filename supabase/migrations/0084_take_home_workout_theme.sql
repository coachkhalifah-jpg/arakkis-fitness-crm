-- 0084 — Optional theme line on take-home workouts (run-page secondary meta).
-- Cue/block live in steps jsonb; no Events/People coupling.

alter table public.take_home_workouts
  add column theme text;

alter table public.take_home_workouts
  add constraint take_home_workouts_theme_check
  check (theme is null or char_length(btrim(theme)) between 1 and 160);

comment on column public.take_home_workouts.theme is
  'Optional session focus line shown as secondary meta on /workouts/[slug].';
