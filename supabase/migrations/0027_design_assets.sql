-- DEC-053: System Admin-managed, non-sensitive public design assets.
create table public.design_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  event_id uuid references public.events(id) on delete restrict,
  category_key text,
  storage_path text not null unique,
  original_filename text,
  mime_type text not null,
  byte_size integer not null,
  alt_text text not null,
  focal_position text not null default 'center',
  active boolean not null default true,
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint design_assets_type_check check (asset_type in (
    'PUBLIC_BACKGROUND_DESKTOP', 'PUBLIC_BACKGROUND_MOBILE',
    'EVENT_IMAGE_DESKTOP', 'EVENT_IMAGE_MOBILE', 'CATEGORY_IMAGE'
  )),
  constraint design_assets_scope_check check (
    (asset_type in ('EVENT_IMAGE_DESKTOP', 'EVENT_IMAGE_MOBILE') and event_id is not null and category_key is null)
    or (asset_type = 'CATEGORY_IMAGE' and event_id is null and category_key is not null and char_length(btrim(category_key)) between 1 and 80)
    or (asset_type in ('PUBLIC_BACKGROUND_DESKTOP', 'PUBLIC_BACKGROUND_MOBILE') and event_id is null and category_key is null)
  ),
  constraint design_assets_path_check check (char_length(btrim(storage_path)) between 1 and 500),
  constraint design_assets_filename_check check (original_filename is null or char_length(original_filename) between 1 and 255),
  constraint design_assets_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')),
  constraint design_assets_size_check check (byte_size between 1 and 5242880),
  constraint design_assets_alt_check check (char_length(btrim(alt_text)) between 1 and 240),
  constraint design_assets_focal_check check (focal_position in ('top', 'center', 'bottom', 'left', 'right'))
);

create unique index design_assets_active_global_uq on public.design_assets(asset_type)
  where active and event_id is null and category_key is null;
create unique index design_assets_active_event_uq on public.design_assets(event_id, asset_type)
  where active and event_id is not null;
create unique index design_assets_active_category_uq on public.design_assets(asset_type, category_key)
  where active and category_key is not null;
create index design_assets_public_lookup_idx on public.design_assets(asset_type, event_id, category_key)
  where active;

alter table public.design_assets enable row level security;
grant select on public.design_assets to anon;
grant select, insert, update, delete on public.design_assets to authenticated;
create policy design_assets_public_read on public.design_assets
  for select to anon, authenticated using (active = true);
create policy design_assets_system_admin_all on public.design_assets
  for all to authenticated using (public.is_active_system_admin()) with check (public.is_active_system_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-assets', 'design-assets', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy design_assets_storage_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'design-assets');
create policy design_assets_storage_system_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'design-assets' and public.is_active_system_admin());
create policy design_assets_storage_system_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'design-assets' and public.is_active_system_admin())
  with check (bucket_id = 'design-assets' and public.is_active_system_admin());
create policy design_assets_storage_system_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'design-assets' and public.is_active_system_admin());

create or replace function public.get_public_event_by_slug(p_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id,
    'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone, 'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE'),
    'registration_deadline', e.registration_deadline, 'visibility', e.visibility,
    'host_organization_name', o.name, 'venue_name', v.name, 'venue_street', v.street,
    'venue_city', v.city, 'venue_state', v.state, 'series_slug', s.public_slug,
    'occurrences', case when s.id is null then jsonb_build_array(jsonb_build_object(
      'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'capacity', e.capacity, 'active_registration_count', (select count(*)::integer from public.registrations r2 where r2.event_id = e.id and r2.registration_status = 'REGISTERED' and r2.registration_outcome = 'ACTIVE')
    )) else coalesce((select jsonb_agg(jsonb_build_object(
      'name', e2.name, 'starts_at', e2.starts_at, 'ends_at', e2.ends_at, 'timezone', e2.timezone,
      'capacity', e2.capacity, 'active_registration_count', (select count(*)::integer from public.registrations r3 where r3.event_id = e2.id and r3.registration_status = 'REGISTERED' and r3.registration_outcome = 'ACTIVE')
    ) order by e2.starts_at) from public.events e2 where e2.event_series_id = s.id and e2.archived_at is null and e2.status = 'OPEN' and e2.starts_at > now() and e2.starts_at <= now() + interval '14 days'), '[]'::jsonb) end,
    'availability', case when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
      when public.phase7_registration_available(e.id) then 'OPEN' when e.status = 'CANCELLED' then 'CANCELLED'
      when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
      when e.registration_paused_at is not null then 'PAUSED'
      when e.registration_opens_at is not null and e.registration_opens_at > now() then 'NOT_YET_OPEN'
      when e.registration_closes_at is not null and e.registration_closes_at <= now() then 'CLOSED'
      when e.registration_deadline < now() then 'CLOSED' else 'FULL' end
  )
  from public.events e
  join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = e.venue_id and v.organization_id = o.id and v.active_status = 'ACTIVE'
  left join public.event_series s on s.id = e.event_series_id
  where p_slug is not null and p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and e.archived_at is null
    and ((e.public_slug = lower(btrim(p_slug))) or (s.public_slug = lower(btrim(p_slug)))) and e.starts_at > now()
  order by e.starts_at limit 1;
$$;
revoke all on function public.get_public_event_by_slug(text) from public;
grant execute on function public.get_public_event_by_slug(text) to anon, authenticated;
