import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { WhatToBring } from "@/components/registration/what-to-bring";
import { participantInstructionLines } from "@/lib/registration/participant-instructions";

afterEach(() => cleanup());

describe("participantInstructionLines", () => {
  it("preserves non-empty instruction lines from participant_instructions text", () => {
    expect(participantInstructionLines("Bring gloves\n\nWater bottle\n  ")).toEqual([
      "Bring gloves",
      "Water bottle",
    ]);
    expect(participantInstructionLines(null)).toEqual([]);
    expect(participantInstructionLines("   ")).toEqual([]);
  });
});

describe("Before you arrive prep chrome", () => {
  it("renders the shared northstar disclosure heading and instruction list", () => {
    render(
      <WhatToBring
        eventId="prep-shared"
        instructions={["Bring gloves", "Arrive 10 minutes early"]}
        variant="northstar"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Before you arrive" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", "what-to-bring-prep-shared");
    expect(document.querySelector(".confirmation-prep")).toHaveClass("is-expanded");
    expect(document.querySelector(".confirmation-prep-content")).toHaveClass("is-open");
    expect(screen.getByText("Bring gloves")).toBeInTheDocument();
    expect(screen.getByText("Arrive 10 minutes early")).toBeInTheDocument();
    expect(document.querySelectorAll(".confirmation-prep-list li")).toHaveLength(2);
  });

  it("collapses and expands the shared prep disclosure", async () => {
    const user = userEvent.setup();
    render(<WhatToBring eventId="prep-toggle" instructions={["Wraps"]} variant="northstar" />);

    const trigger = screen.getByRole("button", { name: "Before you arrive" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".confirmation-prep")).not.toHaveClass("is-expanded");
    expect(document.querySelector(".confirmation-prep-content")).not.toHaveClass("is-open");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector(".confirmation-prep")).toHaveClass("is-expanded");
    expect(screen.getByText("Wraps")).toBeInTheDocument();
  });
});
