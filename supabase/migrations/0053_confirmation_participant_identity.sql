-- Read-only identity check used to distinguish the current confirmation's
-- participant from an unrelated remembered-device cookie.
create or replace function public.get_confirmation_participant_id(p_token text)
returns uuid language sql security definer set search_path = public, extensions as $$
  select rg.participant_id
  from public.confirmation_tokens ct
  join public.registration_groups rg on rg.id = ct.registration_group_id
  where ct.token_hash = digest(coalesce(p_token, ''), 'sha256')
    and ct.revoked_at is null
    and ct.expires_at > now()
    and exists (
      select 1
      from public.registration_group_results gr
      where gr.registration_group_id = rg.id and gr.success
    )
  limit 1;
$$;

revoke all on function public.get_confirmation_participant_id(text) from public;
grant execute on function public.get_confirmation_participant_id(text) to service_role;
