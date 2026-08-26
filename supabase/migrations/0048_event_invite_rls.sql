-- Invite tokens are accessed only through server-authorized actions and
-- security-definer functions. No anon/authenticated table policy is needed.
alter table public.event_invite_links enable row level security;
