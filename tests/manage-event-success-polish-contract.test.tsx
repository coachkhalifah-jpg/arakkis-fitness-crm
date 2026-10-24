import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActionFormSuccessCheckmark } from "@/components/admin/action-form-success-checkmark";

const root = process.cwd();

describe("Manage Event success polish", () => {
  afterEach(() => {
    cleanup();
  });

  it("scopes lime success + checkmark props only on Manage Event update ActionForm", () => {
    const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
    const actionForm = readFileSync(join(root, "src/components/admin/action-form.tsx"), "utf8");
    const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
    const checkmark = readFileSync(
      join(root, "src/components/admin/action-form-success-checkmark.tsx"),
      "utf8",
    );

    const updateFormBlock = page.slice(
      page.indexOf('id="manage-event-update"'),
      page.indexOf("</ActionForm>", page.indexOf('id="manage-event-update"')),
    );
    expect(updateFormBlock).toContain('successClassName="admin-manage-event-update-success"');
    expect(updateFormBlock).toContain("successCheckmark");

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
    expect(page.match(/successClassName="admin-manage-event-update-success"/g)?.length).toBe(1);

    expect(actionForm).toContain("successClassName");
    expect(actionForm).toContain("successCheckmark");
    expect(actionForm).toContain("ActionFormSuccessCheckmark");
    expect(actionForm.toLowerCase()).not.toContain("anime.js");
    expect(checkmark.toLowerCase()).not.toContain("anime");

    expect(css).toContain(".admin-manage-event-update-success");
    expect(css).toContain("color: var(--manage-lime, #c7f36b)");
    expect(css).toContain("@keyframes admin-manage-event-success-pop");
    expect(css).toContain("@keyframes admin-manage-event-success-draw");
    // Avoid /s (es2018) — CI tsc target rejects it. One-shot uses both/forwards, not infinite.
    expect(css).toContain(
      "animation: admin-manage-event-success-pop 420ms cubic-bezier(0.2, 0.9, 0.25, 1) both",
    );
    expect(css).toContain(
      "animation: admin-manage-event-success-draw 360ms ease-out 160ms forwards",
    );
    expect(css).not.toContain("animation-iteration-count: infinite");
  });

  it("renders the 32x32 lime-circle SVG with the branded check path", () => {
    const { container } = render(
      <ActionFormSuccessCheckmark className="action-form-success-checkmark" />,
    );
    const svg = container.querySelector("svg.action-form-success-checkmark");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelector("circle.action-form-success-checkmark__circle")).toBeTruthy();
    expect(svg?.querySelector("path.action-form-success-checkmark__mark")?.getAttribute("d")).toBe(
      "M9 16l5 5 9-9",
    );
  });
});
