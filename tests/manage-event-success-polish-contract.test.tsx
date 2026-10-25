import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActionFormBesideSuccess,
  BESIDE_SUCCESS_FADE_OUT_MS,
  BESIDE_SUCCESS_HOLD_MS,
} from "@/components/admin/action-form-beside-success";
import { ActionFormSuccessCheckmark } from "@/components/admin/action-form-success-checkmark";

const root = process.cwd();

describe("Manage Event success polish", () => {
  afterEach(() => {
    cleanup();
  });

  it("scopes lime beside-submit UPDATED props only on Manage Event update ActionForm", () => {
    const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
    const actionForm = readFileSync(join(root, "src/components/admin/action-form.tsx"), "utf8");
    const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
    const checkmark = readFileSync(
      join(root, "src/components/admin/action-form-success-checkmark.tsx"),
      "utf8",
    );
    const beside = readFileSync(
      join(root, "src/components/admin/action-form-beside-success.tsx"),
      "utf8",
    );

    const updateFormBlock = page.slice(
      page.indexOf('id="manage-event-update"'),
      page.indexOf("</ActionForm>", page.indexOf('id="manage-event-update"')),
    );
    expect(updateFormBlock).toContain('successClassName="admin-manage-event-update-success"');
    expect(updateFormBlock).toContain("successCheckmark");
    expect(updateFormBlock).toContain("successBesideSubmit");
    expect(updateFormBlock).toContain('successStatusLabel="UPDATED"');

    const inviteFormIndex = page.indexOf("action={generateEventInviteLink}");
    expect(inviteFormIndex).toBeGreaterThan(-1);
    const inviteFormOpen = page.lastIndexOf("<ActionForm", inviteFormIndex);
    const inviteFormBlock = page.slice(
      inviteFormOpen,
      page.indexOf("</ActionForm>", inviteFormIndex),
    );
    expect(inviteFormBlock).toContain("action={generateEventInviteLink}");
    expect(inviteFormBlock).not.toContain("successClassName");
    expect(inviteFormBlock).not.toContain("successCheckmark");
    expect(inviteFormBlock).not.toContain("successBesideSubmit");
    expect(page.match(/successClassName="admin-manage-event-update-success"/g)?.length).toBe(1);
    expect(page.match(/successBesideSubmit/g)?.length).toBe(1);

    expect(actionForm).toContain("successClassName");
    expect(actionForm).toContain("successCheckmark");
    expect(actionForm).toContain("successBesideSubmit");
    expect(actionForm).toContain("ActionFormBesideSuccess");
    expect(actionForm).toContain("ActionFormSuccessCheckmark");
    expect(actionForm).toContain("successNonce");
    expect(actionForm).toContain("admin-manage-event-update-actions");
    expect(actionForm).toContain("!successBesideSubmit");
    expect(actionForm.toLowerCase()).not.toContain("anime.js");
    expect(checkmark.toLowerCase()).not.toContain("anime");
    expect(beside.toLowerCase()).not.toContain("anime");
    expect(beside).toContain("BESIDE_SUCCESS_HOLD_MS = 2000");
    expect(beside).toContain("BESIDE_SUCCESS_FADE_OUT_MS = 200");
    expect(beside).toContain("setTimeout");

    const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
    expect(actions).toContain('success: "Event updated."');
    expect(actions).toContain("successNonce: Date.now()");

    expect(css).toContain(".admin-manage-event-update-success");
    expect(css).toContain(".admin-manage-event-update-actions");
    expect(css).toContain("color: var(--manage-lime, #c7f36b)");
    expect(css).toContain("--admin-manage-event-success-pop-duration: 500ms");
    expect(css).toContain("--admin-manage-event-success-pop-easing: cubic-bezier(0.16, 1, 0.3, 1)");
    expect(css).toContain("--admin-manage-event-success-draw-duration: 480ms");
    expect(css).toContain("--admin-manage-event-success-draw-delay: 100ms");
    expect(css).toContain("--admin-manage-event-success-fade-out-duration: 200ms");
    expect(css).toContain("@keyframes admin-manage-event-success-pop");
    expect(css).toContain("@keyframes admin-manage-event-success-draw");
    expect(css).toContain("is-fading-out");
    // Avoid /s (es2018) — CI tsc target rejects it. One-shot uses both/forwards, not infinite.
    expect(css).toContain(
      "animation: admin-manage-event-success-pop var(--admin-manage-event-success-pop-duration)",
    );
    expect(css).toContain(
      "animation: admin-manage-event-success-draw var(--admin-manage-event-success-draw-duration)",
    );
    expect(css).not.toContain("animation-iteration-count: infinite");
  });

  it("renders the 24x24 lime-circle SVG with the branded check path", () => {
    const { container } = render(
      <ActionFormSuccessCheckmark className="action-form-success-checkmark" />,
    );
    const svg = container.querySelector("svg.action-form-success-checkmark");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelector("circle.action-form-success-checkmark__circle")).toBeTruthy();
    expect(svg?.querySelector("path.action-form-success-checkmark__mark")?.getAttribute("d")).toBe(
      "M9 16l5 5 9-9",
    );
  });
});

describe("Manage Event beside-submit UPDATED clear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows UPDATED with checkmark then clears after ~2s hold; replays on new nonce", () => {
    expect(BESIDE_SUCCESS_HOLD_MS).toBe(2000);
    expect(BESIDE_SUCCESS_FADE_OUT_MS).toBe(200);

    const { rerender } = render(
      <ActionFormBesideSuccess
        key="beside-1"
        successNonce={1}
        label="UPDATED"
        className="admin-manage-event-update-success"
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("UPDATED");
    expect(status.querySelector("svg.action-form-success-checkmark")).toBeTruthy();
    expect(status).not.toHaveTextContent("Event updated.");
    expect(status.className).not.toContain("is-fading-out");

    act(() => {
      vi.advanceTimersByTime(BESIDE_SUCCESS_HOLD_MS - 1);
    });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("status").className).not.toContain("is-fading-out");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status").className).toContain("is-fading-out");

    act(() => {
      vi.advanceTimersByTime(BESIDE_SUCCESS_FADE_OUT_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();

    rerender(
      <ActionFormBesideSuccess
        key="beside-2"
        successNonce={2}
        label="UPDATED"
        className="admin-manage-event-update-success"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("UPDATED");
    expect(screen.getByRole("status").className).not.toContain("is-fading-out");

    act(() => {
      vi.advanceTimersByTime(BESIDE_SUCCESS_HOLD_MS + BESIDE_SUCCESS_FADE_OUT_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
