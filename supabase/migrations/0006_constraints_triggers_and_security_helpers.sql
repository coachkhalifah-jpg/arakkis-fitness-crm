-- Phase 1 / 0006: database-enforced invariants, immutable evidence, and authorization primitives.
create or replace function public.prevent_immutable_change()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'immutable table % cannot be changed', tg_table_name using errcode = '42501';
end;
$$;

create or replace function public.enforce_registration_invariants()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.registration_status = 'CANCELLED' and new.cancelled_at is null then new.cancelled_at = now(); end if;
  if new.registration_status = 'REGISTERED' and new.registration_outcome <> 'ACTIVE' then raise exception 'active registration must have ACTIVE outcome'; end if;
  if new.registration_outcome = 'MERGED_DUPLICATE' and new.registration_status <> 'CANCELLED' then raise exception 'merged duplicate must be cancelled'; end if;
  if new.whatsapp_opt_in then
    if new.whatsapp_opt_in_at is null or new.whatsapp_disclosure_version_id is null then raise exception 'WhatsApp opt-in evidence is required'; end if;
  elsif new.whatsapp_opt_in_at is not null or new.whatsapp_disclosure_version_id is not null then
    raise exception 'WhatsApp evidence requires opt-in';
  end if;
  return new;
end;
$$;
create trigger registrations_invariants before insert or update on public.registrations for each row execute function public.enforce_registration_invariants();

create or replace function public.enforce_event_capacity()
returns trigger language plpgsql set search_path = public as $$
declare active_count integer;
begin
  if new.capacity <> old.capacity then
    select count(*) into active_count from public.registrations where event_id = new.id and registration_status = 'REGISTERED' and registration_outcome = 'ACTIVE';
    if new.capacity < active_count then raise exception 'capacity cannot be below active registrations'; end if;
  end if;
  return new;
end;
$$;
create trigger events_capacity_guard before update on public.events for each row execute function public.enforce_event_capacity();

create or replace function public.record_attendance_transition()
returns trigger language plpgsql set search_path = public as $$
declare actor uuid;
begin
  actor := coalesce(new.updated_by_admin_id, auth.uid());
  if actor is null then raise exception 'attendance transition requires an administrator'; end if;
  if tg_op = 'INSERT' then
    insert into public.attendance_transitions (attendance_id, from_status, to_status, changed_by_admin_id, source) values (new.id, null, new.status, actor, 'CHECK_IN');
  elsif old.status is distinct from new.status or old.checked_in_at is distinct from new.checked_in_at or old.finalized_at is distinct from new.finalized_at then
    insert into public.attendance_transitions (attendance_id, from_status, to_status, changed_by_admin_id, source, reason) values (new.id, old.status, new.status, actor, 'CORRECTION', 'Database-recorded attendance change');
  end if;
  return new;
end;
$$;
create trigger attendance_transition_recorder after insert or update on public.attendance for each row execute function public.record_attendance_transition();

create or replace function public.record_notification_transition()
returns trigger language plpgsql set search_path = public as $$
declare actor uuid;
begin
  actor := auth.uid();
  if actor is null then raise exception 'notification transition requires an administrator'; end if;
  if tg_op = 'INSERT' then
    insert into public.notification_delivery_transitions (delivery_id, previous_status, new_status, actor_admin_id, channel)
    values (new.id, null, new.status, actor, new.channel);
  elsif old.status is distinct from new.status then
    insert into public.notification_delivery_transitions (delivery_id, previous_status, new_status, actor_admin_id, channel, note)
    values (new.id, old.status, new.status, actor, new.channel, new.delivery_note);
  end if;
  return new;
end;
$$;
create trigger notification_transition_recorder after insert or update on public.participant_notification_deliveries for each row execute function public.record_notification_transition();

create or replace function public.prevent_versioned_text_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'versioned evidence cannot be deleted' using errcode = '42501'; end if;
  if tg_table_name = 'acknowledgment_versions' and (new.type is distinct from old.type or new.version is distinct from old.version or new.exact_text is distinct from old.exact_text or new.content_hash is distinct from old.content_hash or new.effective_at is distinct from old.effective_at or new.created_by_admin_id is distinct from old.created_by_admin_id) then
    raise exception 'acknowledgment evidence is immutable' using errcode = '42501';
  end if;
  if tg_table_name = 'cancellation_template_versions' and (new.template_type is distinct from old.template_type or new.version is distinct from old.version or new.exact_text is distinct from old.exact_text or new.created_by_admin_id is distinct from old.created_by_admin_id) then
    raise exception 'cancellation template text is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger acknowledgment_versions_immutable before update or delete on public.acknowledgment_versions for each row execute function public.prevent_versioned_text_change();
create trigger cancellation_templates_immutable before update or delete on public.cancellation_template_versions for each row execute function public.prevent_versioned_text_change();

create or replace function public.prevent_application_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'application records are archived, not deleted' using errcode = '42501';
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['organizations','venues','admin_profiles','events','participants','participant_notification_deliveries'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','venues','admin_profiles','admin_invitations','admin_organization_assignments','admin_invitation_organizations','events','participants','event_eligible_organizations',
    'acknowledgment_versions','acknowledgment_acceptances','registration_groups','registrations','attendance','attendance_transitions','follow_up_tasks','confirmation_tokens',
    'cancellation_template_versions','event_cancellation_requests','event_cancellations','participant_notification_tasks','participant_notification_deliveries','notification_delivery_transitions',
    'over_capacity_overrides','possible_duplicate_cases','participant_merges','participant_merge_conflicts','participant_notes','audit_events','completed_event_invalidations'
  ] loop
    execute format('create trigger %I_no_delete before delete on public.%I for each row execute function public.prevent_application_delete()', t, t);
  end loop;
end $$;

create or replace function public.is_active_system_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$ select exists (select 1 from public.admin_profiles p where p.id = auth.uid() and p.role = 'SYSTEM_ADMIN' and p.status = 'ACTIVE'); $$;
create or replace function public.has_active_host_access(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$ select public.is_active_system_admin() or exists (select 1 from public.admin_profiles p join public.admin_organization_assignments a on a.admin_profile_id = p.id where p.id = auth.uid() and p.role = 'HOST_ADMIN' and p.status = 'ACTIVE' and a.organization_id = target_organization_id and a.revoked_at is null); $$;
create or replace function public.has_event_access(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$ select exists (select 1 from public.events e where e.id = target_event_id and public.has_active_host_access(e.host_organization_id)); $$;
create or replace function public.has_registration_event_access(target_registration_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$ select exists (select 1 from public.registrations r where r.id = target_registration_id and public.has_event_access(r.event_id)); $$;
revoke all on function public.is_active_system_admin() from public;
revoke all on function public.has_active_host_access(uuid) from public;
revoke all on function public.has_event_access(uuid) from public;
revoke all on function public.has_registration_event_access(uuid) from public;
grant execute on function public.is_active_system_admin() to authenticated;
grant execute on function public.has_active_host_access(uuid) to authenticated;
grant execute on function public.has_event_access(uuid) to authenticated;
grant execute on function public.has_registration_event_access(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['acknowledgment_acceptances','attendance_transitions','notification_delivery_transitions','event_cancellations','participant_merges','participant_merge_conflicts','completed_event_invalidations','audit_events','over_capacity_overrides'] loop
    execute format('create trigger %I_immutable before update or delete on public.%I for each row execute function public.prevent_immutable_change()', t, t);
  end loop;
end $$;
