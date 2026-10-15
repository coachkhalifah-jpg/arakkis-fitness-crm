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

  it("uses clickable contact links and hides empty Goals chrome", () => {
    expect(profilePage).toContain("telHref(");
    expect(profilePage).toContain("mailto:");
    expect(profilePage).toContain("goalsText || fitnessExperience");
    expect(profilePage).toContain("Fitness experience");
    expect(profilePage).not.toContain("No goals on file");
  });

  it("places manage recovery near Upcoming and clarifies the 72-hour window", () => {
    const recoveryIndex = profilePage.indexOf("<ParticipantManageRecoveryPanel");
    const upcomingIndex = profilePage.indexOf('id="upcoming-title"');
    expect(recoveryIndex).toBeGreaterThan(-1);
    expect(upcomingIndex).toBeGreaterThan(recoveryIndex);
    expect(recoveryPanel).toContain("72 hours");
    expect(recoveryPanel).toContain("expire 72 hours after issue");
  });

  it("places EDIT CONTACT in the detail head next to Active (Org-style), not a mid-page Contact panel", () => {
    const statusActionsIndex = profilePage.indexOf('className="ops-org-detail-status-actions"');
    const contactFormIndex = profilePage.indexOf("<ParticipantContactCorrectionForm");
    const goalsIndex = profilePage.indexOf("goalsText || fitnessExperience");
    expect(statusActionsIndex).toBeGreaterThan(-1);
    expect(contactFormIndex).toBeGreaterThan(statusActionsIndex);
    expect(goalsIndex).toBeGreaterThan(contactFormIndex);
    expect(profilePage).toContain("ops-status");
    expect(contactForm).toContain('data-testid="participant-edit-contact"');
    expect(contactForm).toContain('data-testid="participant-contact-form"');
    expect(contactForm).not.toContain("ops-venue-edit-panel");
    expect(contactForm).not.toContain(">Contact<");
  });
});
