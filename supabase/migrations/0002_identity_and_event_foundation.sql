-- Phase 1 / 0002: organization, venue, admin identity, event, and participant foundations.
create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  organization_type text, street text, city text, state text, postal_code text,
  active_status public.organization_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  constraint organizations_name_nonempty check (char_length(btrim(name)) between 1 and 200)
);
create unique index organizations_active_name_uq on public.organizations (lower(btrim(name))) where active_status = 'ACTIVE';
create index organizations_status_name_idx on public.organizations (active_status, lower(name));

create table public.venues (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete restrict,
  name text not null, street text not null, city text not null, state text not null, postal_code text not null,
  timezone text not null default 'America/New_York', active_status public.organization_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  constraint venues_name_nonempty check (char_length(btrim(name)) > 0)
);
create index venues_org_status_idx on public.venues (organization_id, active_status);

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete restrict, display_name text not null,
  email text not null, normalized_email text generated always as (lower(btrim(email))) stored,
  role public.admin_role not null, status public.admin_status not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint admin_email_nonempty check (char_length(btrim(email)) > 3)
);
create unique index admin_profiles_active_email_uq on public.admin_profiles (normalized_email) where status <> 'DEACTIVATED';
create index admin_profiles_role_status_idx on public.admin_profiles (role, status);

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(), invited_email text not null,
  normalized_email text generated always as (lower(btrim(invited_email))) stored,
  role public.admin_role not null default 'HOST_ADMIN', status public.invitation_status not null default 'PENDING',
  token_hash bytea not null unique, token_expires_at timestamptz not null, issued_at timestamptz not null default now(),
  invited_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  accepted_auth_user_id uuid references auth.users(id) on delete restrict,
  accepted_admin_profile_id uuid references public.admin_profiles(id) on delete restrict,
  accepted_at timestamptz, revoked_at timestamptz, suspended_at timestamptz, reactivated_at timestamptz
);
create index admin_invitations_email_status_idx on public.admin_invitations (normalized_email, status);
create index admin_invitations_status_expiry_idx on public.admin_invitations (status, token_expires_at);

create table public.admin_organization_assignments (
  admin_profile_id uuid not null references public.admin_profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(), revoked_at timestamptz,
  primary key (admin_profile_id, organization_id)
);
create unique index admin_assignments_active_uq on public.admin_organization_assignments (admin_profile_id, organization_id) where revoked_at is null;
create index admin_assignments_org_scope_idx on public.admin_organization_assignments (organization_id, revoked_at, admin_profile_id);

create table public.events (
  id uuid primary key default gen_random_uuid(), host_organization_id uuid not null references public.organizations(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete restrict, name text not null,
  description text, participant_instructions text, starts_at timestamptz not null, ends_at timestamptz not null,
  timezone text not null, capacity integer not null, registration_deadline timestamptz not null,
  status public.event_status not null default 'DRAFT', visibility public.event_visibility not null default 'PUBLIC',
  whatsapp_group_invite_url text, whatsapp_invitation_message text,
  attendance_processing_state public.attendance_processing_state not null default 'NOT_STARTED',
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  constraint events_name_nonempty check (char_length(btrim(name)) > 0),
  constraint events_time_order check (ends_at > starts_at), constraint events_capacity_positive check (capacity > 0)
);
create index events_public_schedule_idx on public.events (status, starts_at);
create index events_host_scope_idx on public.events (host_organization_id, starts_at, status);
create index events_deadline_status_idx on public.events (registration_deadline, status);
create index events_attendance_state_idx on public.events (attendance_processing_state, starts_at);

create table public.participants (
  id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null,
  normalized_first_name text not null, normalized_last_name text not null, display_phone text not null,
  normalized_phone text not null, phone_country text not null, email text, normalized_email text,
  primary_affiliation_organization_id uuid references public.organizations(id) on delete restrict,
  affiliation_other_text text, fitness_experience text, status public.participant_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  constraint participants_first_name_nonempty check (char_length(btrim(first_name)) > 0),
  constraint participants_last_name_nonempty check (char_length(btrim(last_name)) > 0),
  constraint participants_phone_nonempty check (char_length(btrim(display_phone)) > 0),
  constraint participants_email_normalized check (email is null or normalized_email = lower(btrim(email)))
);
create index participants_exact_match_idx on public.participants (normalized_phone, normalized_first_name, normalized_last_name);
create index participants_name_idx on public.participants (normalized_last_name, normalized_first_name);
create index participants_email_idx on public.participants (normalized_email) where normalized_email is not null;
create index participants_affiliation_status_idx on public.participants (primary_affiliation_organization_id, status);

create table public.admin_invitation_organizations (
  invitation_id uuid not null references public.admin_invitations(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(), primary key (invitation_id, organization_id)
);
