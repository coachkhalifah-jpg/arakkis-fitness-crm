-- Phase 1 / 0001: extensions, enum vocabulary, and common conventions.
create extension if not exists pgcrypto;

create type public.organization_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
create type public.participant_status as enum ('ACTIVE', 'ARCHIVED');
create type public.admin_role as enum ('SYSTEM_ADMIN', 'HOST_ADMIN');
create type public.admin_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');
create type public.event_status as enum ('DRAFT', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED');
create type public.event_visibility as enum ('PUBLIC', 'AFFILIATION_RESTRICTED');
create type public.attendance_processing_state as enum ('NOT_STARTED', 'OPEN', 'FINALIZED', 'REOPENED');
create type public.submission_source as enum ('PUBLIC', 'SYSTEM_ADMIN', 'HOST_ADMIN', 'WALK_IN');
create type public.registration_status as enum ('REGISTERED', 'CANCELLED');
create type public.registration_outcome as enum ('ACTIVE', 'PARTICIPANT_CANCELLED', 'ADMIN_CANCELLED', 'EVENT_CANCELLED', 'MERGED_DUPLICATE');
create type public.attendance_status as enum ('NOT_RECORDED', 'ATTENDED', 'NO_SHOW', 'EXCUSED');
create type public.follow_up_reason as enum ('FIRST_ATTENDANCE', 'NO_SHOW');
create type public.follow_up_status as enum ('PENDING', 'COMPLETED', 'DISMISSED');
create type public.notification_type as enum ('EVENT_CANCELLED');
create type public.notification_task_status as enum ('PENDING', 'COMPLETED', 'DISMISSED');
create type public.notification_priority as enum ('HIGH');
create type public.delivery_status as enum ('PENDING', 'SENT', 'FAILED', 'DECLINED', 'NOT_REQUIRED');
create type public.delivery_channel as enum ('WHATSAPP', 'SMS', 'EMAIL', 'PHONE', 'OTHER');
create type public.cancellation_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
create type public.cancellation_type as enum ('PERMANENT', 'RESCHEDULING_PLANNED', 'REPLACEMENT_DATE_TO_BE_ANNOUNCED');
create type public.cancellation_template_type as enum ('PERMANENT_CANCELLATION', 'REPLACEMENT_DATE_PENDING', 'REPLACEMENT_EVENT_AVAILABLE');
create type public.template_status as enum ('DRAFT', 'PUBLISHED', 'RETIRED');
create type public.acknowledgment_type as enum ('PARTICIPATION_RISK', 'DATA_USE', 'WHATSAPP_DISCLOSURE');
create type public.legal_status as enum ('DRAFT', 'PROVISIONAL', 'APPROVED', 'RETIRED', 'REVOKED');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED', 'REPLACED');
create type public.duplicate_case_status as enum ('OPEN', 'MERGED', 'DISMISSED');
create type public.merge_conflict_type as enum ('CONTACT', 'AFFILIATION', 'REGISTRATION', 'ATTENDANCE', 'OTHER');
create type public.whatsapp_invitation_status as enum ('NOT_APPLICABLE', 'PENDING', 'SENT', 'FAILED');
create type public.attendance_transition_source as enum ('CHECK_IN', 'FINALIZE', 'CORRECTION', 'REOPEN', 'CANCELLATION', 'INVALIDATION', 'MERGE');
create type public.override_source as enum ('WALK_IN', 'ADMIN_REGISTRATION', 'OTHER');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
