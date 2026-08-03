-- Community engagement queue: manually copyable group-chat reminders.

create type public.group_chat_reminder_type as enum (
  'CLASS_PREVIEW',
  'ATTENDANCE_CHECK_IN',
  'POST_CLASS_REFLECTION',
  'WELCOME_FIRST_TIME',
  'THIRD_CLASS_MILESTONE',
  'TENTH_CLASS_MILESTONE',
  'WEEKLY_CHALLENGE',
  'WEEKLY_TIP',
  'COMMUNITY_POLL',
  'INACTIVE_GROUP',
  'ORGANIZER_CANCELLATION'
);

create table public.group_chat_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid references public.events(id) on delete restrict,
  reminder_type public.group_chat_reminder_type not null,
  trigger_key text not null unique,
  due_at timestamptz not null,
  status public.follow_up_status not null default 'PENDING',
  suggested_message text not null,
  copied_at timestamptz,
  copied_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  completion_notes text,
  completed_at timestamptz,
  completed_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  completion_outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_chat_reminder_message_length check (char_length(suggested_message) between 1 and 2000),
  constraint group_chat_reminder_completion_outcome_allowed check (
    completion_outcome is null or completion_outcome in ('CONTACTED', 'NO_RESPONSE', 'FOLLOW_UP_NOT_NEEDED', 'WRONG_CONTACT_INFORMATION')
  ),
  constraint group_chat_reminder_completion_consistency check (
    (status = 'PENDING' and completed_at is null and completed_by_admin_id is null and completion_outcome is null)
    or (status in ('COMPLETED', 'DISMISSED') and completed_at is not null and completed_by_admin_id is not null)
  )
);

create index group_chat_reminders_queue_idx on public.group_chat_reminders (status, due_at);
create index group_chat_reminders_event_idx on public.group_chat_reminders (event_id, reminder_type);

create trigger group_chat_reminders_updated_at
before update on public.group_chat_reminders
for each row execute function public.set_updated_at();

revoke insert, update, delete on public.group_chat_reminders from authenticated;
grant select on public.group_chat_reminders to authenticated;

create or replace function public.phase6_update_group_chat_reminder(
  p_reminder_id uuid,
  p_suggested_message text
)
returns public.group_chat_reminders language plpgsql security definer set search_path = public, auth as $$
declare result public.group_chat_reminders%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_suggested_message, ''))) = 0 then raise exception 'message is required' using errcode = '22023'; end if;
  if char_length(p_suggested_message) > 2000 then raise exception 'message is too long' using errcode = '22023'; end if;
  update public.group_chat_reminders
  set suggested_message = p_suggested_message
  where id = p_reminder_id and status = 'PENDING'
  returning * into result;
  if not found then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (auth.uid(), 'GROUP_CHAT_REMINDER_MESSAGE_UPDATED', 'GROUP_CHAT_REMINDER', p_reminder_id, jsonb_build_object('message_updated', true));
  return result;
end;
$$;

create or replace function public.phase6_record_group_chat_reminder_copy(p_reminder_id uuid)
returns public.group_chat_reminders language plpgsql security definer set search_path = public, auth as $$
declare result public.group_chat_reminders%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  update public.group_chat_reminders set copied_at = now(), copied_by_admin_id = auth.uid()
  where id = p_reminder_id returning * into result;
  if not found then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (auth.uid(), 'GROUP_CHAT_REMINDER_COPIED', 'GROUP_CHAT_REMINDER', p_reminder_id, jsonb_build_object('copied', true));
  return result;
end;
$$;

create or replace function public.phase6_complete_group_chat_reminder(
  p_reminder_id uuid,
  p_outcome text default 'CONTACTED',
  p_notes text default null
)
returns public.group_chat_reminders language plpgsql security definer set search_path = public, auth as $$
declare result public.group_chat_reminders%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  if p_outcome not in ('CONTACTED', 'NO_RESPONSE', 'FOLLOW_UP_NOT_NEEDED', 'WRONG_CONTACT_INFORMATION') then raise exception 'invalid completion outcome' using errcode = '22023'; end if;
  update public.group_chat_reminders
  set status = 'COMPLETED', completed_at = now(), completed_by_admin_id = auth.uid(),
      completion_outcome = p_outcome, completion_notes = nullif(left(btrim(coalesce(p_notes, '')), 500), '')
  where id = p_reminder_id and status = 'PENDING'
  returning * into result;
  if not found then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, reason)
    values (auth.uid(), 'GROUP_CHAT_REMINDER_COMPLETED', 'GROUP_CHAT_REMINDER', p_reminder_id, p_outcome);
  return result;
end;
$$;

create or replace function public.phase6_dismiss_group_chat_reminder(p_reminder_id uuid, p_reason text)
returns public.group_chat_reminders language plpgsql security definer set search_path = public, auth as $$
declare result public.group_chat_reminders%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'reason is required' using errcode = '22023'; end if;
  update public.group_chat_reminders
  set status = 'DISMISSED', completed_at = now(), completed_by_admin_id = auth.uid(), completion_notes = left(btrim(p_reason), 500)
  where id = p_reminder_id and status = 'PENDING'
  returning * into result;
  if not found then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, reason)
    values (auth.uid(), 'GROUP_CHAT_REMINDER_DISMISSED', 'GROUP_CHAT_REMINDER', p_reminder_id, left(btrim(p_reason), 500));
  return result;
end;
$$;

create or replace function public.phase6_snooze_group_chat_reminder(p_reminder_id uuid, p_due_at timestamptz)
returns public.group_chat_reminders language plpgsql security definer set search_path = public, auth as $$
declare result public.group_chat_reminders%rowtype; previous_due_at timestamptz;
begin
  if not public.is_active_system_admin() then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  if p_due_at is null or p_due_at <= now() then raise exception 'invalid snooze date' using errcode = '22023'; end if;
  select due_at into previous_due_at from public.group_chat_reminders where id = p_reminder_id and status = 'PENDING' for update;
  if previous_due_at is null then raise exception 'reminder unavailable' using errcode = '42501'; end if;
  update public.group_chat_reminders set due_at = p_due_at where id = p_reminder_id returning * into result;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, old_values, new_values)
    values (auth.uid(), 'GROUP_CHAT_REMINDER_SNOOZED', 'GROUP_CHAT_REMINDER', p_reminder_id,
      jsonb_build_object('due_at', previous_due_at), jsonb_build_object('due_at', p_due_at));
  return result;
end;
$$;

revoke all on function public.phase6_update_group_chat_reminder(uuid, text) from public;
revoke all on function public.phase6_record_group_chat_reminder_copy(uuid) from public;
revoke all on function public.phase6_complete_group_chat_reminder(uuid, text, text) from public;
revoke all on function public.phase6_dismiss_group_chat_reminder(uuid, text) from public;
revoke all on function public.phase6_snooze_group_chat_reminder(uuid, timestamptz) from public;
grant execute on function public.phase6_update_group_chat_reminder(uuid, text) to authenticated;
grant execute on function public.phase6_record_group_chat_reminder_copy(uuid) to authenticated;
grant execute on function public.phase6_complete_group_chat_reminder(uuid, text, text) to authenticated;
grant execute on function public.phase6_dismiss_group_chat_reminder(uuid, text) to authenticated;
grant execute on function public.phase6_snooze_group_chat_reminder(uuid, timestamptz) to authenticated;
