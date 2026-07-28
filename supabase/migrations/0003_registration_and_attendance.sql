-- Phase 1 / 0003: restricted-event eligibility, acknowledgments, registration, and attendance.
create table public.event_eligible_organizations (
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(), primary key (event_id, organization_id)
);
create index event_eligible_org_lookup_idx on public.event_eligible_organizations (organization_id, event_id);

create table public.acknowledgment_versions (
  id uuid primary key default gen_random_uuid(), type public.acknowledgment_type not null, version integer not null,
  exact_text text not null, content_hash bytea not null, effective_at timestamptz not null, retired_at timestamptz,
  legal_status public.legal_status not null, created_at timestamptz not null default now(),
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  unique (type, version), constraint acknowledgment_version_positive check (version > 0),
  constraint acknowledgment_text_nonempty check (char_length(exact_text) > 0)
);
create index acknowledgment_current_idx on public.acknowledgment_versions (type, legal_status, version desc);
create index acknowledgment_effective_idx on public.acknowledgment_versions (effective_at, retired_at);

create table public.registration_groups (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.participants(id) on delete restrict,
  submission_source public.submission_source not null,
  participation_acknowledgment_version_id uuid not null references public.acknowledgment_versions(id) on delete restrict,
  participation_acknowledged_at timestamptz not null,
  data_use_acknowledgment_version_id uuid not null references public.acknowledgment_versions(id) on delete restrict,
  data_use_acknowledged_at timestamptz not null, submitted_at timestamptz not null default now(),
  created_by_admin_id uuid references public.admin_profiles(id) on delete restrict, idempotency_key text,
  unique (submission_source, idempotency_key)
);
create index registration_groups_participant_idx on public.registration_groups (participant_id, submitted_at desc);

create table public.possible_duplicate_cases (
  id uuid primary key default gen_random_uuid(), candidate_participant_id uuid not null references public.participants(id) on delete restrict,
  possible_match_participant_id uuid references public.participants(id) on delete restrict,
  source_registration_id uuid, source_registration_group_id uuid references public.registration_groups(id) on delete restrict,
  matching_signals jsonb not null, normalized_values jsonb not null, status public.duplicate_case_status not null default 'OPEN',
  reviewed_by_admin_id uuid references public.admin_profiles(id) on delete restrict, reviewed_at timestamptz,
  review_notes text, created_at timestamptz not null default now(),
  constraint duplicate_case_source check (source_registration_id is not null or source_registration_group_id is not null)
);
create index duplicate_cases_queue_idx on public.possible_duplicate_cases (status, created_at);
create index duplicate_cases_candidate_idx on public.possible_duplicate_cases (candidate_participant_id, possible_match_participant_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(), registration_group_id uuid not null references public.registration_groups(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict, event_id uuid not null references public.events(id) on delete restrict,
  affiliation_organization_id_at_registration uuid references public.organizations(id) on delete restrict,
  affiliation_other_text_at_registration text, registration_status public.registration_status not null default 'REGISTERED',
  registration_outcome public.registration_outcome not null default 'ACTIVE', registered_at timestamptz not null default now(),
  cancelled_at timestamptz, cancellation_reason text, possible_duplicate_case_id uuid references public.possible_duplicate_cases(id) on delete restrict,
  whatsapp_opt_in boolean not null default false, whatsapp_invitation_status public.whatsapp_invitation_status not null default 'NOT_APPLICABLE',
  whatsapp_opt_in_at timestamptz, whatsapp_disclosure_version_id uuid references public.acknowledgment_versions(id) on delete restrict,
  whatsapp_invitation_sent_at timestamptz, whatsapp_invitation_sent_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  created_by_admin_id uuid references public.admin_profiles(id) on delete restrict, over_capacity_override_id uuid,
  constraint registrations_outcome_consistency check (
    (registration_outcome = 'ACTIVE' and registration_status = 'REGISTERED') or
    (registration_outcome in ('PARTICIPANT_CANCELLED', 'ADMIN_CANCELLED', 'EVENT_CANCELLED', 'MERGED_DUPLICATE') and registration_status = 'CANCELLED')
  ),
  constraint registrations_whatsapp_evidence check ((not whatsapp_opt_in) or (whatsapp_opt_in_at is not null and whatsapp_disclosure_version_id is not null)),
  constraint registrations_cancel_metadata check ((registration_status = 'REGISTERED') or (cancelled_at is not null))
);
create unique index registrations_active_unique_idx on public.registrations (participant_id, event_id) where registration_status = 'REGISTERED' and registration_outcome = 'ACTIVE';
create index registrations_event_status_idx on public.registrations (event_id, registration_status);
create index registrations_participant_event_idx on public.registrations (participant_id, event_id);
create index registrations_group_idx on public.registrations (registration_group_id);
create index registrations_whatsapp_idx on public.registrations (event_id, whatsapp_opt_in, whatsapp_invitation_status);

alter table public.possible_duplicate_cases add constraint duplicate_cases_source_registration_fk
  foreign key (source_registration_id) references public.registrations(id) on delete restrict;

create table public.attendance (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null unique references public.registrations(id) on delete restrict,
  status public.attendance_status not null default 'NOT_RECORDED', checked_in_at timestamptz, finalized_at timestamptz,
  updated_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict, updated_at timestamptz not null default now()
);
create index attendance_status_updated_idx on public.attendance (status, updated_at);

create table public.attendance_transitions (
  id uuid primary key default gen_random_uuid(), attendance_id uuid not null references public.attendance(id) on delete restrict,
  from_status public.attendance_status, to_status public.attendance_status not null,
  changed_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict, changed_at timestamptz not null default now(),
  reason text, source public.attendance_transition_source not null,
  constraint attendance_transition_reason check (source in ('CHECK_IN', 'FINALIZE') or char_length(coalesce(btrim(reason), '')) > 0)
);
create index attendance_transitions_history_idx on public.attendance_transitions (attendance_id, changed_at);
create index attendance_transitions_actor_idx on public.attendance_transitions (changed_by_admin_id, changed_at);

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.participants(id) on delete restrict,
  event_id uuid references public.events(id) on delete restrict, reason public.follow_up_reason not null, trigger_key text unique,
  due_at timestamptz not null, status public.follow_up_status not null default 'PENDING', suggested_message text,
  completion_notes text, created_at timestamptz not null default now(), completed_at timestamptz,
  completed_by_admin_id uuid references public.admin_profiles(id) on delete restrict
);
create index follow_up_queue_idx on public.follow_up_tasks (status, due_at);
create index follow_up_participant_idx on public.follow_up_tasks (participant_id, created_at desc);
create index follow_up_event_reason_idx on public.follow_up_tasks (event_id, reason);

create table public.confirmation_tokens (
  id uuid primary key default gen_random_uuid(), registration_group_id uuid not null references public.registration_groups(id) on delete restrict,
  token_hash bytea not null unique, issued_at timestamptz not null default now(), expires_at timestamptz not null,
  revoked_at timestamptz, last_accessed_at timestamptz, access_count integer not null default 0 check (access_count >= 0)
);
create unique index confirmation_tokens_one_active_idx on public.confirmation_tokens (registration_group_id) where revoked_at is null;
create index confirmation_tokens_expiry_idx on public.confirmation_tokens (expires_at, revoked_at);
create index confirmation_tokens_group_idx on public.confirmation_tokens (registration_group_id, revoked_at);
