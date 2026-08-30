-- RC2: Archived cancelled Events remain in the database for historical access.
-- Only an active System Admin may archive one, and archival cannot be used to
-- restore or alter the approved cancelled lifecycle.
create or replace function public.prevent_invalid_event_archive()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    if not public.is_active_system_admin() then
      raise exception 'only an active System Admin may archive an event' using errcode = '42501';
    end if;
    if old.status <> 'CANCELLED' or new.archived_at is null then
      raise exception 'only cancelled events may be archived' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists events_archive_guard on public.events;
create trigger events_archive_guard
before update of archived_at on public.events
for each row execute function public.prevent_invalid_event_archive();

revoke all on function public.prevent_invalid_event_archive() from public;
