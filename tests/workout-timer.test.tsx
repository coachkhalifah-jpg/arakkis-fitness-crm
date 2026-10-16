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
  {
    order: 3,
    title: "Rest",
    durationSeconds: 20,
    kind: "rest" as const,
    block: "Circuit",
  },
];

describe("WorkoutTimer stage", () => {
  it("renders dial board, progress rows, and collapsed movements", () => {
    const { container } = render(
      <WorkoutTimer title="15-Minute Core Finisher" theme="Core at home" steps={steps} />,
    );

    expect(container.querySelector(".workout-stage__dial")).not.toBeNull();
    expect(container.querySelector(".workout-stage__ring-progress")).not.toBeNull();
    expect(screen.getByText(/15-Minute Core Finisher/)).toBeInTheDocument();
    expect(screen.getByText(/Core at home/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Get ready" })).toBeInTheDocument();
    expect(screen.getByText("Elapsed")).toBeInTheDocument();
    expect(screen.getByText("Round")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByLabelText("Upcoming intervals")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Movements/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("columnheader", { name: "Exercises" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sound muted/i })).toHaveTextContent("Muted");
  });

  it("pauses from the dial, jumps to a selected upcoming interval, and expands movements", () => {
    const { container } = render(<WorkoutTimer title="Core" steps={steps} />);

    fireEvent.click(screen.getByRole("button", { name: /Start timer/i }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pause timer/i }));
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start Dead bug/i }));
    expect(screen.getByRole("heading", { name: "Dead bug" })).toBeInTheDocument();
    expect(screen.getByText("Slow and controlled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    expect(container.querySelector(".workout-stage__movements-plus")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Movements/i }));
    expect(screen.getByRole("button", { name: /Movements/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("columnheader", { name: "Exercises" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: /Dead bug/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Sound muted/i }));
    expect(window.localStorage.getItem("arakkis.workout.preferences.muted")).toBe("false");
  });
});
