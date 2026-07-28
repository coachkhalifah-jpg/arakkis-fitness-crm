-- Phase 1 / 0004: cancellation templates, requests, immutable cancellations, and notification operations.
create table public.cancellation_template_versions (
  id uuid primary key default gen_random_uuid(), template_type public.cancellation_template_type not null, version integer not null,
  exact_text text not null, status public.template_status not null, created_at timestamptz not null default now(),
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict, retired_at timestamptz,
  unique (template_type, version), constraint template_version_positive check (version > 0), constraint template_text_nonempty check (char_length(exact_text) > 0)
);
create index cancellation_templates_current_idx on public.cancellation_template_versions (template_type, status, version desc);
create index cancellation_templates_creator_idx on public.cancellation_template_versions (created_by_admin_id, created_at desc);

create table public.event_cancellation_requests (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete restrict,
  requested_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict, reason text not null, urgency text not null,
  proposed_replacement_date date, cancellation_type public.cancellation_type not null, status public.cancellation_request_status not null default 'PENDING',
  requested_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  review_decision public.cancellation_request_status, review_reason text, withdrawn_by_admin_id uuid references public.admin_profiles(id) on delete restrict, withdrawn_at timestamptz,
  constraint cancellation_request_reason_nonempty check (char_length(btrim(reason)) > 0),
  constraint cancellation_request_rejection_reason check (status <> 'REJECTED' or char_length(btrim(coalesce(review_reason, ''))) > 0)
);
create unique index cancellation_requests_one_pending_idx on public.event_cancellation_requests (event_id) where status = 'PENDING';
create index cancellation_requests_event_status_idx on public.event_cancellation_requests (event_id, status);
create index cancellation_requests_requester_idx on public.event_cancellation_requests (requested_by_admin_id, requested_at desc);

create table public.event_cancellations (
  id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.events(id) on delete restrict,
  cancelled_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict, cancellation_type public.cancellation_type not null,
  reason text not null, active_registrations_affected integer not null check (active_registrations_affected >= 0), confirmed_at timestamptz not null,
  template_version_id uuid not null references public.cancellation_template_versions(id) on delete restrict, rendered_message_snapshot text not null,
  administrator_message_edits text, replacement_event_id uuid references public.events(id) on delete restrict,
  constraint cancellation_reason_nonempty check (char_length(btrim(reason)) > 0)
);
create index event_cancellations_actor_idx on public.event_cancellations (cancelled_by_admin_id, confirmed_at desc);
create index event_cancellations_replacement_idx on public.event_cancellations (replacement_event_id);

create table public.participant_notification_tasks (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.participants(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict, event_cancellation_id uuid not null references public.event_cancellations(id) on delete restrict,
  notification_type public.notification_type not null default 'EVENT_CANCELLED', status public.notification_task_status not null default 'PENDING',
  priority public.notification_priority not null default 'HIGH', template_version_id uuid not null references public.cancellation_template_versions(id) on delete restrict,
  template_type public.cancellation_template_type not null, suggested_message text not null, event_starts_at_snapshot timestamptz not null,
  created_at timestamptz not null, due_at timestamptz not null, completed_at timestamptz, completed_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  completion_reason text, unique (participant_id, event_id, notification_type), constraint notification_due_immediate check (due_at = created_at)
);
create index notification_tasks_queue_idx on public.participant_notification_tasks (status, priority, due_at);
create index notification_tasks_event_status_idx on public.participant_notification_tasks (event_id, status);

create table public.participant_notification_deliveries (
  id uuid primary key default gen_random_uuid(), participant_notification_task_id uuid not null references public.participant_notification_tasks(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict, status public.delivery_status not null default 'PENDING',
  channel public.delivery_channel not null, sent_at timestamptz, sent_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  delivery_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (participant_notification_task_id, registration_id)
);
create index notification_deliveries_task_status_idx on public.participant_notification_deliveries (participant_notification_task_id, status);
create index notification_deliveries_registration_idx on public.participant_notification_deliveries (registration_id);
create index notification_deliveries_status_idx on public.participant_notification_deliveries (status, updated_at);

create table public.notification_delivery_transitions (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.participant_notification_deliveries(id) on delete restrict,
  previous_status public.delivery_status, new_status public.delivery_status not null, actor_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  changed_at timestamptz not null default now(), channel public.delivery_channel not null, note text
);
create index notification_transitions_history_idx on public.notification_delivery_transitions (delivery_id, changed_at);

create table public.over_capacity_overrides (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null unique references public.registrations(id) on delete restrict, approved_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  reason text not null, capacity_at_override integer not null check (capacity_at_override > 0), active_registration_count_before integer not null check (active_registration_count_before >= 0),
  active_registration_count_after integer not null check (active_registration_count_after > active_registration_count_before), created_at timestamptz not null default now(), source public.override_source not null,
  constraint override_reason_nonempty check (char_length(btrim(reason)) > 0)
);
create index overrides_event_created_idx on public.over_capacity_overrides (event_id, created_at desc);
alter table public.registrations add constraint registrations_override_fk foreign key (over_capacity_override_id) references public.over_capacity_overrides(id) on delete restrict;

create table public.acknowledgment_acceptances (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.participants(id) on delete restrict,
  registration_group_id uuid not null references public.registration_groups(id) on delete restrict, acknowledgment_version_id uuid not null references public.acknowledgment_versions(id) on delete restrict,
  accepted_at timestamptz not null default now(), acceptance_method text not null, ip_address inet not null, user_agent text not null
);
create index acknowledgment_acceptances_participant_idx on public.acknowledgment_acceptances (participant_id, accepted_at desc);
create index acknowledgment_acceptances_group_idx on public.acknowledgment_acceptances (registration_group_id, acknowledgment_version_id);
create index acknowledgment_acceptances_version_idx on public.acknowledgment_acceptances (acknowledgment_version_id, accepted_at);
