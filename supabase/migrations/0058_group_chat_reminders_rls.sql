-- COMMUNITY-001: direct reads of the group-chat reminder queue are
-- restricted to the approved System Admin boundary.

alter table public.group_chat_reminders enable row level security;

drop policy if exists group_chat_reminders_system_admin_select on public.group_chat_reminders;
create policy group_chat_reminders_system_admin_select
on public.group_chat_reminders
for select
to authenticated
using (public.is_active_system_admin());
