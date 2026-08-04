-- Restore the approved post-registration communication fields after the booking-management RPC replacement.
create or replace function public.get_registration_confirmation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group_id uuid;
  v_token_id uuid;
  v_result jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,60}$' then
    raise exception 'invalid confirmation' using errcode = '42501';
  end if;
  select ct.id, ct.registration_group_id into v_token_id, v_group_id
    from public.confirmation_tokens ct
   where ct.token_hash = digest(p_token, 'sha256') and ct.revoked_at is null and ct.expires_at > now()
   for update;
  if v_group_id is null or not exists (select 1 from public.registration_group_results gr where gr.registration_group_id = v_group_id and gr.success) then
    raise exception 'invalid confirmation' using errcode = '42501';
  end if;
  update public.confirmation_tokens set last_accessed_at = now(), access_count = access_count + 1 where id = v_token_id;
  select jsonb_build_object(
    'participant_name', p.first_name || ' ' || p.last_name,
    'registration_group_id', rg.id, 'expires_at', ct.expires_at,
    'events', coalesce(jsonb_agg(jsonb_build_object(
      'event_id', e.id, 'registration_id', r.id, 'success', gr.success, 'reason', gr.reason,
      'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions,
      'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city, 'venue_state', v.state,
      'venue_postal_code', v.postal_code, 'host_organization_name', o.name,
      'communication_url', case when gr.success then e.communication_url else null end,
      'communication_label', case when gr.success then e.communication_label else null end
    ) order by e.starts_at), '[]'::jsonb)
  ) into v_result
    from public.registration_groups rg
    join public.participants p on p.id = rg.participant_id
    join public.confirmation_tokens ct on ct.registration_group_id = rg.id
    join public.registration_group_results gr on gr.registration_group_id = rg.id
    left join public.registrations r on r.id = gr.registration_id
    left join public.events e on e.id = gr.event_id
    left join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
    left join public.organizations o on o.id = e.host_organization_id
   where rg.id = v_group_id
   group by p.first_name, p.last_name, rg.id, ct.expires_at;
  return v_result;
end;
$$;

revoke all on function public.get_registration_confirmation(text) from public;
grant execute on function public.get_registration_confirmation(text) to anon, authenticated;
