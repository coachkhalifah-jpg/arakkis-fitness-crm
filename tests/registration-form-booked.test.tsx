import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "@/components/registration/registration-form";
import { legalDocuments } from "@/lib/legal/documents";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/registration/actions", () => ({
  submitRegistration: vi.fn(),
  submitSlugRegistration: vi.fn(),
}));

afterEach(() => cleanup());

const baseOccurrence = {
  id: "occ-1",
  name: "Demo Weekly Flow",
  starts_at: "2030-09-24T18:00:00.000Z",
  ends_at: "2030-09-24T19:00:00.000Z",
  timezone: "America/New_York",
  venue_name: "Demo Garden Studio",
  host_organization_name: "Demo Organization A",
  active_registration_count: 1,
  capacity: 12,
  availability: "OPEN",
  visibility: "PUBLIC",
};

const legalPackage = {
  id: "package-a",
  version: "1",
  effective_at: "2026-01-01T00:00:00.000Z",
  content_hash: "hash-a",
  components: [
    {
      id: "component-0",
      type: "EOKE_PARTICIPATION_WAIVER",
      version: 1,
      text: "I agree",
      effective_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("RegistrationForm already-booked occurrences", () => {
  it("disables booked occurrence and links to manage instead of offering register", () => {
    render(
      <RegistrationForm
        events={[
          {
            ...baseOccurrence,
            manageHref: "/manage-bookings/reg-1",
          },
          {
            ...baseOccurrence,
            id: "occ-2",
            starts_at: "2030-10-01T18:00:00.000Z",
            ends_at: "2030-10-01T19:00:00.000Z",
          },
        ]}
        legalPackage={legalPackage}
        legalDocuments={legalDocuments}
        idempotencyKey="key-1"
        publicSlug="demo-recurring"
        seriesMode
        rememberedFirstName="JourneyA"
      />,
    );

    expect(screen.getByText(/you.?re booked/i)).toBeInTheDocument();
    const booked = screen.getByRole("checkbox", { name: /booked/i });
    expect(booked).toBeDisabled();
    expect(screen.getByRole("link", { name: /^manage$/i })).toHaveAttribute(
      "href",
      "/manage-bookings/reg-1",
    );
    const open = screen.getByRole("checkbox", { name: /open/i });
    expect(open).not.toBeDisabled();
    expect(open).toBeChecked();
    expect(screen.getByRole("button", { name: /continue as journeya/i })).toBeInTheDocument();
  });
});
