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

describe("admin People profile UX IA contract", () => {
  it("deep-links registrations to admin Event detail and follow-ups to the community queue", () => {
    expect(profilePage).toContain("href={`/admin/events/${event.id}`}");
    expect(profilePage).toContain(
      "`/admin/community?status=${statusParam}&task=${task.id}#selected-touchpoint`",
    );
    expect(profilePage).toContain('href="/admin/community?status=ALL"');
  });

  it("splits Upcoming from History and surfaces attendance summary fields", () => {
    expect(profilePage).toContain('id="upcoming-title"');
    expect(profilePage).toContain('id="history-title"');
    expect(profilePage).toContain("First attended");
    expect(profilePage).toContain("Last attended");
    expect(profilePage).toContain("Cancellations");
    expect(profilePage).toContain("participantHistoryDetailLabel");
    expect(profilePage).not.toContain("Registration and attendance");
  });

  it("uses clickable contact links and always shows the Goals section", () => {
    expect(profilePage).toContain("telHref(");
    expect(profilePage).toContain("mailto:");
    expect(profilePage).toContain('id="goals-title"');
    expect(profilePage).toContain("No goals on file.");
    expect(profilePage).toContain("Fitness experience");
  });

  it("places manage recovery near Upcoming and clarifies the 72-hour window", () => {
    const recoveryIndex = profilePage.indexOf("<ParticipantManageRecoveryPanel");
    const upcomingIndex = profilePage.indexOf('id="upcoming-title"');
    expect(recoveryIndex).toBeGreaterThan(-1);
    expect(upcomingIndex).toBeGreaterThan(recoveryIndex);
    expect(recoveryPanel).toContain("72 hours");
    expect(recoveryPanel).toContain("expire 72 hours after issue");
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

  it("places Goals above System Admin–only manage recovery", () => {
    const goalsIndex = profilePage.indexOf('id="goals-title"');
    const recoveryIndex = profilePage.indexOf("<ParticipantManageRecoveryPanel");
    expect(goalsIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeGreaterThan(goalsIndex);
    expect(recoveryPanel).toContain("System Admin only");
  });
});
