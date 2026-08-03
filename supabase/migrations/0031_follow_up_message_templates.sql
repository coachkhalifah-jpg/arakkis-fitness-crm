-- Align supported follow-up templates with the approved engagement queue copy.

create or replace function public.phase6_default_follow_up_message(
  p_reason public.follow_up_reason,
  p_first_name text,
  p_event_name text,
  p_organization_name text
)
returns text language sql immutable set search_path = public as $$
  select case p_reason
    when 'FIRST_ATTENDANCE' then format(
      'Hey %s, thanks for joining us yesterday. How are you feeling after your first class? We would love to see you again.',
      p_first_name
    )
    else format(
      'Hey %s, we missed you at class. I hope everything is okay. There are more class dates available if you would like to rebook.',
      p_first_name
    )
  end;
$$;
