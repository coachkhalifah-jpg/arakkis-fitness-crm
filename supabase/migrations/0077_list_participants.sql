-- 0077 — UAT-015 / DEC-063: System Admin paginated ACTIVE People directory browse.
-- Search (phase6_search_participants) remains for filtered lookup and CSV export.
-- List is System Admin–only, ACTIVE participants only, bounded page size.

create or replace function public.phase6_list_participants(
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  display_phone text,
  email text,
  primary_affiliation_organization_id uuid,
  status public.participant_status,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  bounded_page integer := greatest(coalesce(p_page, 1), 1);
  bounded_size integer := least(greatest(coalesce(p_page_size, 25), 1), 50);
  page_offset integer;
begin
  if not public.is_active_system_admin() then
    raise exception 'participant unavailable' using errcode = '42501';
  end if;

  page_offset := (bounded_page - 1) * bounded_size;

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.display_phone,
    p.email,
    p.primary_affiliation_organization_id,
    p.status,
    count(*) over() as total_count
  from public.participants p
  where p.status = 'ACTIVE'
  order by p.last_name, p.first_name, p.id
  limit bounded_size
  offset page_offset;
end;
$$;

revoke all on function public.phase6_list_participants(integer, integer) from public;
grant execute on function public.phase6_list_participants(integer, integer) to authenticated;
