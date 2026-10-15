import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RecurrenceScheduleManager,
  WEEKDAY_ALREADY_SCHEDULED_MESSAGE,
  alignDateToWeekday,
  weekdayAlreadyScheduled,
} from "@/components/admin/recurrence-schedule-manager";
import { addScheduleRule } from "@/lib/services/recurrence-actions";

vi.mock("@/lib/services/recurrence-actions", () => ({
  addScheduleRule: vi.fn(),
  changeScheduleRule: vi.fn(),
  extendSeriesEndDate: vi.fn(),
  stopScheduleRule: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin",
}));

afterEach(() => {
  cleanup();
  vi.mocked(addScheduleRule).mockReset();
});

const mondayRule = {
  id: "rule-monday",
  weekday: 1,
  local_start_time: "18:00:00",
  local_end_time: "19:00:00",
  effective_start_date: "2026-10-12",
  effective_end_date: null as string | null,
  supersedes_rule_id: null as string | null,
};

describe("weekdayAlreadyScheduled / alignDateToWeekday", () => {
  it("detects an active weekday overlap matching the RPC window", () => {
    expect(weekdayAlreadyScheduled([mondayRule], 1, "2026-10-20", "2026-12-31")).toBe(true);
    expect(
      weekdayAlreadyScheduled(
        [{ ...mondayRule, effective_end_date: "2026-10-13" }],
        1,
        "2026-10-20",
        "2026-12-31",
      ),
    ).toBe(false);
    expect(weekdayAlreadyScheduled([mondayRule], 2, "2026-10-20", "2026-12-31")).toBe(false);
  });

  it("aligns a mismatched calendar date to the selected weekday", () => {
    // 2026-10-19 is Monday; Tuesday is 2026-10-20
    expect(alignDateToWeekday("2026-10-19", 2)).toBe("2026-10-20");
    expect(alignDateToWeekday("2026-10-20", 2)).toBe("2026-10-20");
  });
});

describe("RecurrenceScheduleManager add-day guardrails", () => {
  it("blocks Add schedule with inline copy when the weekday is already scheduled", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <RecurrenceScheduleManager
        seriesId="series-a"
        seriesEndsOn="2026-12-31"
        timezone="America/New_York"
        canMutate
        rules={[mondayRule]}
        occurrences={[]}
        initialWeekday={1}
        initialEffectiveDate="2026-10-20"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Add day & time/ }));
    const dialog = screen.getByRole("dialog");
    const weekday = within(dialog).getByLabelText("Weekday");
    await user.selectOptions(weekday, "1");

    expect(within(dialog).getByRole("alert")).toHaveTextContent(WEEKDAY_ALREADY_SCHEDULED_MESSAGE);
    expect(within(dialog).getByRole("button", { name: "Add schedule" })).toBeDisabled();
    expect(addScheduleRule).not.toHaveBeenCalled();
  });
});
