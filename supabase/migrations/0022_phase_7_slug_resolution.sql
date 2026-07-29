-- Resolve a public slug only inside the trusted server-side registration action.
-- The public RPC intentionally does not return the private event UUID.
create or replace function public.phase7_event_id_by_slug(p_slug text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select e.id
  from public.events e
  join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = e.venue_id and v.active_status = 'ACTIVE'
  where p_slug is not null
    and p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and e.public_slug = lower(btrim(p_slug))
    and e.archived_at is null
    and e.visibility = 'PUBLIC'
  limit 1;
$$;

revoke all on function public.phase7_event_id_by_slug(text) from public, anon, authenticated;
grant execute on function public.phase7_event_id_by_slug(text) to service_role;
