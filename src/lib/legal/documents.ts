export type LegalDocument = {
  slug: string;
  type: string;
  title: string;
  version: string;
  effectiveDate: string;
  required: "EVERY_BOOKING" | "VERSION_CHANGE" | "INFORMATIONAL" | "OPTIONAL";
  versionId: string;
  sections: Array<{ heading?: string; text: string }>;
};

export const legalDocuments: LegalDocument[] = [
  {
    slug: "participation-agreement",
    type: "PARTICIPATION_RISK",
    title: "Participation Agreement",
    version: "1.0.0",
    effectiveDate: "August 3, 2026",
    required: "EVERY_BOOKING",
    versionId: "03500000-0000-0000-0000-000000000001",
    sections: [
      {
        text: "This Agreement governs participation in boxing and fitness activities offered by Eoke LLC. Participants must be at least 18 years old unless participating in a future authorized youth program.",
      },
      {
        heading: "Participant Responsibilities",
        text: "Participants agree to follow instructor directions, exercise within their abilities, stop immediately if they experience pain, dizziness, or other concerning symptoms, and treat others respectfully.",
      },
      {
        heading: "Registration",
        text: "A completed registration and acceptance of this Agreement and the Liability Waiver are required for every booking.",
      },
      {
        heading: "Communications",
        text: "Eoke LLC may contact participants regarding registrations or schedule changes using the contact information provided. Marketing communications are optional where applicable.",
      },
      {
        heading: "Governing Law",
        text: "This Agreement is governed by the laws of the Commonwealth of Virginia unless applicable law requires otherwise.",
      },
    ],
  },
  {
    slug: "liability-waiver",
    type: "LIABILITY_WAIVER",
    title: "Assumption of Risk & Liability Waiver",
    version: "1.0.0",
    effectiveDate: "August 3, 2026",
    required: "EVERY_BOOKING",
    versionId: "03500000-0000-0000-0000-000000000002",
    sections: [
      {
        heading: "Assumption of Risk",
        text: "Participant understands boxing and fitness activities involve inherent risks including falls, collisions, overexertion, accidental contact, equipment misuse, and other foreseeable injuries.",
      },
      {
        heading: "Release",
        text: "To the fullest extent permitted by applicable law, participant releases Eoke LLC, its instructors, volunteers, and affiliates from claims arising from ordinary negligence. This release does not apply to gross negligence, reckless conduct, or intentional misconduct where such claims cannot legally be waived.",
      },
      {
        heading: "Medical",
        text: "Participant is responsible for determining whether participation is appropriate and authorizes emergency services to be contacted if reasonably necessary.",
      },
    ],
  },
  {
    slug: "cancellation",
    type: "CANCELLATION_POLICY",
    title: "Cancellation & Refund Policy",
    version: "1.0.0",
    effectiveDate: "August 3, 2026",
    required: "EVERY_BOOKING",
    versionId: "03500000-0000-0000-0000-000000000003",
    sections: [
      {
        heading: "Current MVP",
        text: "The current program primarily offers free community classes. Paid offerings may be introduced under a future version of this policy.",
      },
      {
        heading: "Participant Cancellations",
        text: "Participants should cancel as early as practical if they cannot attend.",
      },
      {
        heading: "Organizer Changes",
        text: "Eoke LLC may cancel, reschedule, relocate, or modify events because of weather, safety, facility issues, or other operational needs.",
      },
      {
        heading: "MVP Scope",
        text: "This Version 1.0 policy applies to the current pilot offering of free community classes only. References to paid classes, memberships, packages, donations, credits, and refunds are reserved for future versions if such services are introduced.",
      },
    ],
  },
  {
    slug: "terms",
    type: "TERMS_OF_USE",
    title: "Terms of Use",
    version: "1.0.0",
    effectiveDate: "August 3, 2026",
    required: "VERSION_CHANGE",
    versionId: "03500000-0000-0000-0000-000000000004",
    sections: [
      {
        heading: "Use",
        text: "Users agree not to misuse the website or interfere with registrations.",
      },
      { heading: "Availability", text: "Events, instructors, and schedules may change." },
      {
        heading: "Intellectual Property",
        text: "Website content belongs to Eoke LLC unless otherwise indicated.",
      },
    ],
  },
  {
    slug: "privacy",
    type: "PRIVACY_POLICY",
    title: "Privacy Policy",
    version: "1.0.0",
    effectiveDate: "August 3, 2026",
    required: "INFORMATIONAL",
    versionId: "03500000-0000-0000-0000-000000000005",
    sections: [
      {
        heading: "Information Collected",
        text: "Name, email, phone number, affiliation, referral source, fitness experience, registration history, attendance history, follow-up history, consent records, remembered-device preference, IP address, and user agent when acknowledgments are recorded.",
      },
      {
        heading: "Use",
        text: "Information is used to operate classes, maintain attendance history, communicate regarding registrations, improve services, and satisfy legal obligations.",
      },
      {
        heading: "Technology",
        text: "The service uses Supabase hosting and cookies or similar technology required for authentication and the remembered-device feature.",
      },
      {
        heading: "Sharing",
        text: "Information is shared only as reasonably necessary to operate events, with service providers, or when required by law. External group chats (such as WhatsApp) are governed by their own terms.",
      },
      {
        heading: "Current Practices",
        text: "Current practices include collection of referral source, fitness experience, registration history, attendance and follow-up history, remembered-device preference, administrator access, Supabase-hosted services, and optional external community links (such as WhatsApp) governed by their own terms.",
      },
    ],
  },
  {
    slug: "media-consent",
    type: "MEDIA_CONSENT",
    title: "Photo & Video Consent",
    version: "1.0.0",
    effectiveDate: "August 3, 2026",
    required: "OPTIONAL",
    versionId: "03500000-0000-0000-0000-000000000006",
    sections: [
      {
        heading: "Consent",
        text: "Participation is not conditioned on granting media permission.",
      },
      {
        heading: "Permitted Uses",
        text: "If granted, Eoke LLC may use photographs or videos for marketing, educational, or promotional purposes.",
      },
      {
        heading: "Withdrawal",
        text: "Future consent may be withdrawn in writing; materials already published may remain in circulation.",
      },
    ],
  },
];

export function legalDocumentBySlug(slug: string) {
  return legalDocuments.find((document) => document.slug === slug) ?? null;
}
