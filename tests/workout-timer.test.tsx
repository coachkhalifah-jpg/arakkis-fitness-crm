import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutTimer } from "@/components/workouts/workout-timer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

const steps = [
  {
    order: 1,
    title: "Get ready",
    durationSeconds: 10,
    kind: "prepare" as const,
    block: "Warmup",
  },
  {
    order: 2,
    title: "Dead bug",
    durationSeconds: 40,
    kind: "work" as const,
    cue: "Slow and controlled",
    block: "Circuit",
  },
];

describe("WorkoutTimer stage", () => {
  it("renders branded stage with Preferences mute default and secondary title", () => {
    const { container } = render(
      <WorkoutTimer title="15-Minute Core Finisher" theme="Core at home" steps={steps} />,
    );

    expect(container.querySelector(".workout-stage")).not.toBeNull();
    expect(screen.getByText("15-Minute Core Finisher")).toBeInTheDocument();
    expect(screen.getByText("Core at home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Get ready" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sound muted/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Sound muted/i })).toHaveTextContent("Muted");
    expect(screen.queryByText(/Back to events/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Slow and controlled")).not.toBeInTheDocument();
  });

  it("shows cue only for the current step and sticks unmute in localStorage", () => {
    render(<WorkoutTimer title="Core" steps={steps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Dead bug" })).toBeInTheDocument();
    expect(screen.getByText("Slow and controlled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sound muted/i }));
    expect(screen.getByRole("button", { name: /Sound on/i })).toHaveTextContent("Sound on");
    expect(window.localStorage.getItem("arakkis.workout.preferences.muted")).toBe("false");
  });
});
