-- Phase 1 / 0005: merge evidence, notes, exceptional attendance, and general audit.
create table public.participant_merges (
  id uuid primary key default gen_random_uuid(), surviving_participant_id uuid not null references public.participants(id) on delete restrict,
  archived_duplicate_participant_id uuid not null references public.participants(id) on delete restrict, merged_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  merged_at timestamptz not null default now(), migrated_record_counts jsonb not null, merge_notes text,
  contact_resolution jsonb not null, affiliation_resolution jsonb not null, attendance_conflict_resolution jsonb not null,
  constraint participant_merge_distinct check (surviving_participant_id <> archived_duplicate_participant_id)
);
create index participant_merges_survivor_idx on public.participant_merges (surviving_participant_id, merged_at);
create index participant_merges_duplicate_idx on public.participant_merges (archived_duplicate_participant_id, merged_at);
create index participant_merges_actor_idx on public.participant_merges (merged_by_admin_id, merged_at);

create table public.participant_merge_conflicts (
  id uuid primary key default gen_random_uuid(), participant_merge_id uuid not null references public.participant_merges(id) on delete restrict,
  conflict_type public.merge_conflict_type not null, affected_record_ids jsonb not null, selected_resolution jsonb not null,
  reason text not null, created_at timestamptz not null default now(), constraint merge_conflict_reason_nonempty check (char_length(btrim(reason)) > 0)
);
create index participant_merge_conflicts_merge_idx on public.participant_merge_conflicts (participant_merge_id, created_at);

create table public.participant_notes (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.participants(id) on delete restrict,
  note text not null, created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  visibility_scope text not null default 'SYSTEM_ADMIN_ONLY', created_at timestamptz not null default now(), archived_at timestamptz,
  constraint participant_notes_scope check (visibility_scope = 'SYSTEM_ADMIN_ONLY'), constraint participant_notes_nonempty check (char_length(btrim(note)) > 0)
);
create index participant_notes_history_idx on public.participant_notes (participant_id, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(), actor_admin_id uuid references public.admin_profiles(id) on delete restrict, action text not null,
  entity_type text not null, entity_id uuid, old_values jsonb, new_values jsonb, reason text, request_id text,
  ip_address inet, user_agent text, created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, created_at);
create index audit_events_actor_idx on public.audit_events (actor_admin_id, created_at);
create index audit_events_action_idx on public.audit_events (action, created_at);
create index audit_events_request_idx on public.audit_events (request_id);

create table public.completed_event_invalidations (
  id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.events(id) on delete restrict,
  requested_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict, confirmed_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  reason text not null, confirmed_at timestamptz not null default now(), audit_event_id uuid references public.audit_events(id) on delete restrict,
  constraint invalidation_reason_nonempty check (char_length(btrim(reason)) > 0)
);
create index invalidations_actor_idx on public.completed_event_invalidations (confirmed_by_admin_id, confirmed_at);
