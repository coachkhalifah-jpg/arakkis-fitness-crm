-- Owner-approved pilot legal documents. Owner approval is the application's
-- legal-readiness approval for this pilot; this makes no claim of attorney review.

alter type public.acknowledgment_type add value if not exists 'LIABILITY_WAIVER';
alter type public.acknowledgment_type add value if not exists 'CANCELLATION_POLICY';
alter type public.acknowledgment_type add value if not exists 'TERMS_OF_USE';
alter type public.acknowledgment_type add value if not exists 'PRIVACY_POLICY';
alter type public.acknowledgment_type add value if not exists 'MEDIA_CONSENT';

-- PostgreSQL requires newly added enum labels to be committed before they can
-- be used by subsequent DDL/DML in the same migration.
commit;

alter table public.acknowledgment_versions alter column created_by_admin_id drop not null;
alter table public.registration_groups
  add column liability_acknowledgment_version_id uuid references public.acknowledgment_versions(id) on delete restrict,
  add column liability_acknowledged_at timestamptz,
  add column cancellation_policy_version_id uuid references public.acknowledgment_versions(id) on delete restrict,
  add column cancellation_policy_acknowledged_at timestamptz,
  add column terms_of_use_version_id uuid references public.acknowledgment_versions(id) on delete restrict,
  add column terms_of_use_acknowledged_at timestamptz,
  add column media_consent_version_id uuid references public.acknowledgment_versions(id) on delete restrict,
  add column media_consent_acknowledged_at timestamptz;

insert into public.acknowledgment_versions (id,type,version,exact_text,content_hash,effective_at,legal_status,created_by_admin_id)
values
('03500000-0000-0000-0000-000000000001','PARTICIPATION_RISK',1000,$p$
Participation Agreement

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

This Agreement governs participation in boxing and fitness activities offered by Eoke LLC. Participants must be at least 18 years old unless participating in a future authorized youth program.

Participants agree to follow instructor directions, exercise within their abilities, stop immediately if they experience pain, dizziness, or other concerning symptoms, and treat others respectfully.

A completed registration and acceptance of this Agreement and the Liability Waiver are required for every booking.

Eoke LLC may contact participants regarding registrations or schedule changes using the contact information provided. Marketing communications are optional where applicable.

This Agreement is governed by the laws of the Commonwealth of Virginia unless applicable law requires otherwise.$p$,digest($p$
Participation Agreement

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

This Agreement governs participation in boxing and fitness activities offered by Eoke LLC. Participants must be at least 18 years old unless participating in a future authorized youth program.

Participants agree to follow instructor directions, exercise within their abilities, stop immediately if they experience pain, dizziness, or other concerning symptoms, and treat others respectfully.

A completed registration and acceptance of this Agreement and the Liability Waiver are required for every booking.

Eoke LLC may contact participants regarding registrations or schedule changes using the contact information provided. Marketing communications are optional where applicable.

This Agreement is governed by the laws of the Commonwealth of Virginia unless applicable law requires otherwise.$p$,'sha256'),'2026-08-03T00:00:00Z','APPROVED',null),
('03500000-0000-0000-0000-000000000002','LIABILITY_WAIVER',1000,$p$
Assumption of Risk & Liability Waiver

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Participant understands boxing and fitness activities involve inherent risks including falls, collisions, overexertion, accidental contact, equipment misuse, and other foreseeable injuries.

To the fullest extent permitted by applicable law, participant releases Eoke LLC, its instructors, volunteers, and affiliates from claims arising from ordinary negligence. This release does not apply to gross negligence, reckless conduct, or intentional misconduct where such claims cannot legally be waived.

Participant is responsible for determining whether participation is appropriate and authorizes emergency services to be contacted if reasonably necessary.

This Liability Waiver is a separate required acknowledgment and must be accepted for every booking.$p$,digest($p$
Assumption of Risk & Liability Waiver

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Participant understands boxing and fitness activities involve inherent risks including falls, collisions, overexertion, accidental contact, equipment misuse, and other foreseeable injuries.

To the fullest extent permitted by applicable law, participant releases Eoke LLC, its instructors, volunteers, and affiliates from claims arising from ordinary negligence. This release does not apply to gross negligence, reckless conduct, or intentional misconduct where such claims cannot legally be waived.

Participant is responsible for determining whether participation is appropriate and authorizes emergency services to be contacted if reasonably necessary.

This Liability Waiver is a separate required acknowledgment and must be accepted for every booking.$p$,'sha256'),'2026-08-03T00:00:00Z','APPROVED',null),
('03500000-0000-0000-0000-000000000003','CANCELLATION_POLICY',1000,$p$
Cancellation & Refund Policy

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

The current program primarily offers free community classes. Paid offerings may be introduced under a future version of this policy.

Participants should cancel as early as practical if they cannot attend.

Eoke LLC may cancel, reschedule, relocate, or modify events because of weather, safety, facility issues, or other operational needs.

This Version 1.0 policy applies to the current pilot offering of free community classes only. References to paid classes, memberships, packages, donations, credits, and refunds are reserved for future versions if such services are introduced.

This policy is acknowledged with every booking.$p$,digest($p$
Cancellation & Refund Policy

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

The current program primarily offers free community classes. Paid offerings may be introduced under a future version of this policy.

Participants should cancel as early as practical if they cannot attend.

Eoke LLC may cancel, reschedule, relocate, or modify events because of weather, safety, facility issues, or other operational needs.

This Version 1.0 policy applies to the current pilot offering of free community classes only. References to paid classes, memberships, packages, donations, credits, and refunds are reserved for future versions if such services are introduced.

This policy is acknowledged with every booking.$p$,'sha256'),'2026-08-03T00:00:00Z','APPROVED',null),
('03500000-0000-0000-0000-000000000004','TERMS_OF_USE',1000,$p$
Terms of Use

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Users agree not to misuse the website or interfere with registrations.

Events, instructors, and schedules may change.

Website content belongs to Eoke LLC unless otherwise indicated.

Acceptance is required when a new version becomes effective.$p$,digest($p$
Terms of Use

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Users agree not to misuse the website or interfere with registrations.

Events, instructors, and schedules may change.

Website content belongs to Eoke LLC unless otherwise indicated.

Acceptance is required when a new version becomes effective.$p$,'sha256'),'2026-08-03T00:00:00Z','APPROVED',null),
('03500000-0000-0000-0000-000000000005','PRIVACY_POLICY',1000,$p$
Privacy Policy

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Name, email, phone number, affiliation, referral source, fitness experience, registration history, attendance history, follow-up history, consent records, remembered-device preference, IP address, and user agent when acknowledgments are recorded.

Information is used to operate classes, maintain attendance history, communicate regarding registrations, improve services, and satisfy legal obligations.

The service uses Supabase hosting and cookies or similar technology required for authentication and the remembered-device feature.

Information is shared only as reasonably necessary to operate events, with service providers, or when required by law. External group chats (such as WhatsApp) are governed by their own terms.

Current practices include collection of referral source, fitness experience, registration history, attendance and follow-up history, remembered-device preference, administrator access, Supabase-hosted services, and optional external community links (such as WhatsApp) governed by their own terms.$p$,digest($p$
Privacy Policy

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Name, email, phone number, affiliation, referral source, fitness experience, registration history, attendance history, follow-up history, consent records, remembered-device preference, IP address, and user agent when acknowledgments are recorded.

Information is used to operate classes, maintain attendance history, communicate regarding registrations, improve services, and satisfy legal obligations.

The service uses Supabase hosting and cookies or similar technology required for authentication and the remembered-device feature.

Information is shared only as reasonably necessary to operate events, with service providers, or when required by law. External group chats (such as WhatsApp) are governed by their own terms.

Current practices include collection of referral source, fitness experience, registration history, attendance and follow-up history, remembered-device preference, administrator access, Supabase-hosted services, and optional external community links (such as WhatsApp) governed by their own terms.$p$,'sha256'),'2026-08-03T00:00:00Z','APPROVED',null),
('03500000-0000-0000-0000-000000000006','MEDIA_CONSENT',1000,$p$
Photo & Video Consent

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Participation is not conditioned on granting media permission.

If granted, Eoke LLC may use photographs or videos for marketing, educational, or promotional purposes.

Future consent may be withdrawn in writing; materials already published may remain in circulation.

Photo & Video Consent is optional, separate from booking acceptance, and declining consent does not affect participation.$p$,digest($p$
Photo & Video Consent

Owner: Eoke LLC
Approval Status: Owner Approved
Owner Approval Date: August 3, 2026
Version: 1.0.0
Effective Date: August 3, 2026

Participation is not conditioned on granting media permission.

If granted, Eoke LLC may use photographs or videos for marketing, educational, or promotional purposes.

Future consent may be withdrawn in writing; materials already published may remain in circulation.

Photo & Video Consent is optional, separate from booking acceptance, and declining consent does not affect participation.$p$,'sha256'), '2026-08-03T00:00:00Z','APPROVED',null)
on conflict (id) do nothing;

-- Preserve the legacy DATA_USE contract while displaying the approved Privacy Policy text.
insert into public.acknowledgment_versions (id,type,version,exact_text,content_hash,effective_at,legal_status,created_by_admin_id)
select '03500000-0000-0000-0000-000000000007','DATA_USE',1000,exact_text,content_hash,effective_at,'APPROVED',null
from public.acknowledgment_versions where id='03500000-0000-0000-0000-000000000005'
on conflict (id) do nothing;

create table public.registration_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  registration_group_id uuid not null references public.registration_groups(id) on delete restrict,
  acknowledgment_version_id uuid not null references public.acknowledgment_versions(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  acceptance_method text not null,
  ip_address inet not null,
  user_agent text not null,
  unique (registration_group_id, acknowledgment_version_id)
);
create index registration_legal_acceptances_participant_idx on public.registration_legal_acceptances (participant_id, acknowledgment_version_id, accepted_at desc);
create index registration_legal_acceptances_group_idx on public.registration_legal_acceptances (registration_group_id, accepted_at);
alter table public.registration_legal_acceptances enable row level security;
revoke all on public.registration_legal_acceptances from anon, authenticated;

create or replace function public.prevent_registration_legal_acceptance_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'legal acceptance evidence cannot be deleted' using errcode = '42501'; end if;
  if new.participant_id is distinct from old.participant_id or new.registration_group_id is distinct from old.registration_group_id
     or new.acknowledgment_version_id is distinct from old.acknowledgment_version_id or new.accepted_at is distinct from old.accepted_at
     or new.acceptance_method is distinct from old.acceptance_method or new.ip_address is distinct from old.ip_address
     or new.user_agent is distinct from old.user_agent then
    raise exception 'legal acceptance evidence is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger registration_legal_acceptances_immutable before update or delete on public.registration_legal_acceptances for each row execute function public.prevent_registration_legal_acceptance_change();

create or replace function public.get_public_registration_config()
returns jsonb language sql security definer set search_path = public as $$
select jsonb_build_object(
  'participation', (select jsonb_build_object('id',v.id,'version',v.version,'text',v.exact_text) from public.acknowledgment_versions v where v.type='PARTICIPATION_RISK' and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null order by v.version desc limit 1),
  'data_use', (select jsonb_build_object('id',v.id,'version',v.version,'text',v.exact_text) from public.acknowledgment_versions v where v.type='DATA_USE' and v.legal_status in ('APPROVED','PROVISIONAL') and v.effective_at<=now() and v.retired_at is null order by v.version desc limit 1),
  'legal_documents', coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'type',v.type,'version',v.version,'text',v.exact_text,'effective_at',v.effective_at) order by v.type) from public.acknowledgment_versions v where v.type in ('PARTICIPATION_RISK','LIABILITY_WAIVER','CANCELLATION_POLICY','TERMS_OF_USE','PRIVACY_POLICY','MEDIA_CONSENT') and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null),'[]'::jsonb),
  'organizations', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.organizations o where o.active_status='ACTIVE'),'[]'::jsonb)
);
$$;
revoke all on function public.get_public_registration_config() from public;
grant execute on function public.get_public_registration_config() to anon, authenticated;

create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text default null,
  p_referral_source text default null,p_referral_source_other_text text default null,
  p_legal_document_version_ids uuid[] default null
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_result jsonb; v_group_id uuid; v_participant_id uuid; v_type public.acknowledgment_type; v_id uuid; v_terms_id uuid;
begin
  if p_legal_document_version_ids is null then raise exception 'current legal acknowledgments are required' using errcode='22023'; end if;
  foreach v_type in array array['PARTICIPATION_RISK','LIABILITY_WAIVER','CANCELLATION_POLICY']::public.acknowledgment_type[] loop
    if not exists (select 1 from public.acknowledgment_versions v where v.id=any(p_legal_document_version_ids) and v.type=v_type and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null) then raise exception 'required legal acknowledgment is unavailable' using errcode='22023'; end if;
  end loop;
  v_terms_id := (select v.id from public.acknowledgment_versions v where v.type='TERMS_OF_USE' and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null order by v.version desc limit 1);
  v_result := public.register_selected_events_with_referral(p_first_name,p_last_name,p_display_phone,p_normalized_phone,p_phone_country,p_email,p_normalized_email,p_fitness_experience,p_event_ids,p_participation_acknowledgment_version_id,p_data_use_acknowledgment_version_id,p_participation_acknowledged_at,p_data_use_acknowledged_at,p_ip_address,p_user_agent,p_idempotency_key,p_referral_source,p_referral_source_other_text);
  v_group_id := nullif(v_result->>'registration_group_id','')::uuid;
  select participant_id into v_participant_id from public.registration_groups where id=v_group_id;
  if v_terms_id is not null and v_terms_id <> all(p_legal_document_version_ids) and not exists (select 1 from public.registration_legal_acceptances a where a.participant_id=v_participant_id and a.acknowledgment_version_id=v_terms_id) then raise exception 'current Terms of Use acceptance is required' using errcode='22023'; end if;
  foreach v_id in array p_legal_document_version_ids loop
    if not exists (select 1 from public.acknowledgment_versions v where v.id=v_id and v.type in ('PARTICIPATION_RISK','LIABILITY_WAIVER','CANCELLATION_POLICY','TERMS_OF_USE','PRIVACY_POLICY','MEDIA_CONSENT') and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null) then raise exception 'invalid legal acknowledgment version' using errcode='22023'; end if;
    insert into public.registration_legal_acceptances(participant_id,registration_group_id,acknowledgment_version_id,accepted_at,acceptance_method,ip_address,user_agent) values(v_participant_id,v_group_id,v_id,coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent) on conflict (registration_group_id,acknowledgment_version_id) do nothing;
    select type into v_type from public.acknowledgment_versions where id=v_id;
    if v_type='LIABILITY_WAIVER' then update public.registration_groups set liability_acknowledgment_version_id=v_id,liability_acknowledged_at=coalesce(p_participation_acknowledged_at,now()) where id=v_group_id;
    elsif v_type='CANCELLATION_POLICY' then update public.registration_groups set cancellation_policy_version_id=v_id,cancellation_policy_acknowledged_at=coalesce(p_participation_acknowledged_at,now()) where id=v_group_id;
    elsif v_type='TERMS_OF_USE' then update public.registration_groups set terms_of_use_version_id=v_id,terms_of_use_acknowledged_at=coalesce(p_participation_acknowledged_at,now()) where id=v_group_id;
    elsif v_type='MEDIA_CONSENT' then update public.registration_groups set media_consent_version_id=v_id,media_consent_acknowledged_at=coalesce(p_participation_acknowledged_at,now()) where id=v_group_id;
    end if;
  end loop;
  return v_result;
end;
$$;
revoke all on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]) from public;
grant execute on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]) to anon, authenticated;
