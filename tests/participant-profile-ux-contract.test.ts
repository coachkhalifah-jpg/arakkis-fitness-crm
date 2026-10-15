import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profilePage = readFileSync(
  resolve(process.cwd(), "src/app/admin/participants/[id]/page.tsx"),
  "utf8",
);
const contactForm = readFileSync(
  resolve(process.cwd(), "src/components/admin/participant-contact-correction-form.tsx"),
  "utf8",
);
const recoveryPanel = readFileSync(
  resolve(process.cwd(), "src/components/admin/participant-manage-recovery-panel.tsx"),
  "utf8",
);
const disclosure = readFileSync(
  resolve(process.cwd(), "src/components/admin/people-profile-disclosure.tsx"),
  "utf8",
);

describe("admin People profile UX IA contract", () => {
  it("deep-links registrations to admin Event detail and follow-ups to the community queue", () => {
    expect(profilePage).toContain("href={`/admin/events/${event.id}`}");
    expect(profilePage).toContain(
      "`/admin/community?status=${statusParam}&task=${task.id}#selected-touchpoint`",
    );
    expect(profilePage).toContain('href="/admin/community?status=ALL"');
  });

  it("splits Upcoming from History and surfaces attendance summary fields", () => {
    expect(profilePage).toContain('id="upcoming"');
    expect(profilePage).toContain('id="history"');
    expect(profilePage).toContain("First attended");
    expect(profilePage).toContain("Last attended");
    expect(profilePage).toContain("Cancellations");
    expect(profilePage).toContain("participantHistoryDetailLabel");
    expect(profilePage).not.toContain("Registration and attendance");
  });

  it("uses clickable contact links and always shows the Goals section", () => {
    expect(profilePage).toContain("telHref(");
    expect(profilePage).toContain("mailto:");
    expect(profilePage).toContain('id="goals"');
    expect(profilePage).toContain("No goals on file.");
    expect(profilePage).toContain("Fitness experience");
  });

  it("places EDIT CONTACT above Active, right-aligned above Participation snapshot", () => {
    const statusActionsIndex = profilePage.indexOf(
      'data-testid="participant-profile-status-actions"',
    );
    const contactFormIndex = profilePage.indexOf("<ParticipantContactCorrectionForm");
    const activeIndex = profilePage.indexOf(
      '<span className="ops-status">Active</span>',
      statusActionsIndex,
    );
    const snapshotIndex = profilePage.indexOf("Participation snapshot");
    expect(statusActionsIndex).toBeGreaterThan(-1);
    expect(contactFormIndex).toBeGreaterThan(statusActionsIndex);
    expect(activeIndex).toBeGreaterThan(contactFormIndex);
    expect(snapshotIndex).toBeGreaterThan(activeIndex);
    expect(profilePage).toContain("ops-people-profile-status-actions");
    expect(contactForm).toContain('data-testid="participant-edit-contact"');
    expect(contactForm).toContain('data-testid="participant-contact-form"');
    expect(contactForm).not.toContain("ops-venue-edit-panel");
    expect(contactForm).not.toContain(">Contact<");
  });

  it("uses collapsible sections defaulting collapsed (UAT-027)", () => {
    expect(disclosure).toContain("DisclosureToggle");
    expect(disclosure).toContain("defaultOpen = false");
    expect(profilePage).toContain('<PeopleProfileDisclosure id="goals"');
    expect(profilePage).toContain('<PeopleProfileDisclosure\n            id="upcoming"');
    expect(profilePage).toContain('<PeopleProfileDisclosure\n            id="history"');
    expect(profilePage).toContain('<PeopleProfileDisclosure\n            id="follow-up-history"');
    expect(profilePage).toContain('id="remove-person"');
    expect(profilePage).not.toMatch(/PeopleProfileDisclosure[^>]*defaultOpen=\{true\}/);
  });

  it("orders Goals → Upcoming → History → Follow-up → System Admin only (UAT-027)", () => {
    const goalsIndex = profilePage.indexOf('id="goals"');
    const upcomingIndex = profilePage.indexOf('id="upcoming"');
    const historyIndex = profilePage.indexOf('id="history"');
    const followUpIndex = profilePage.indexOf('id="follow-up-history"');
    const systemAdminIndex = profilePage.indexOf('data-testid="participant-system-admin-only"');
    const recoveryIndex = profilePage.indexOf("<ParticipantManageRecoveryPanel");
    const removeIndex = profilePage.indexOf('id="remove-person"');
    expect(goalsIndex).toBeGreaterThan(-1);
    expect(upcomingIndex).toBeGreaterThan(goalsIndex);
    expect(historyIndex).toBeGreaterThan(upcomingIndex);
    expect(followUpIndex).toBeGreaterThan(historyIndex);
    expect(systemAdminIndex).toBeGreaterThan(followUpIndex);
    expect(recoveryIndex).toBeGreaterThan(systemAdminIndex);
    expect(removeIndex).toBeGreaterThan(recoveryIndex);
    expect(profilePage).toContain("System Admin only");
    expect(recoveryPanel).toContain("embedded");
  });

  it("places Remove from People under manage recovery inside System Admin only (UAT-027)", () => {
    expect(profilePage).toContain("<ParticipantArchiveForm");
    expect(profilePage).toContain("<ParticipantDeleteLeanForm");
    expect(profilePage).toContain("Remove from People");
    expect(profilePage).toContain("embedded");
    expect(recoveryPanel).toContain("System Admin only");
    expect(profilePage).not.toContain("ParticipantForceDeleteForm");
  });
});
