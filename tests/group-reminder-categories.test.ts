import { describe, expect, it } from "vitest";
import { groupReminderCategory } from "@/lib/services/group-reminder-categories";

describe("Group reminder category mapping", () => {
  it("maps every supported reminder type to one Engage category", () => {
    expect(
      [
        "CLASS_PREVIEW",
        "ATTENDANCE_CHECK_IN",
        "POST_CLASS_REFLECTION",
        "WELCOME_FIRST_TIME",
        "THIRD_CLASS_MILESTONE",
        "TENTH_CLASS_MILESTONE",
        "WEEKLY_CHALLENGE",
        "WEEKLY_TIP",
        "COMMUNITY_POLL",
        "INACTIVE_GROUP",
        "ORGANIZER_CANCELLATION",
      ].map(groupReminderCategory),
    ).toEqual([
      "BEFORE_CLASS",
      "BEFORE_CLASS",
      "AFTER_CLASS",
      "AFTER_CLASS",
      "AFTER_CLASS",
      "AFTER_CLASS",
      "CHALLENGES",
      "TIPS",
      "POLLS",
      "LOGISTICS",
      "LOGISTICS",
    ]);
  });

  it("fails closed into a valid Engage category for an unknown reminder type", () => {
    expect(groupReminderCategory("UNKNOWN_LEGACY_TYPE")).toBe("LOGISTICS");
  });
});
