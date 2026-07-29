import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import AccessDeniedPage from "@/app/admin/access-denied/page";

describe("foundation pages", () => {
  it("renders the public landing page", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /foundation is running/i })).toBeInTheDocument();
  });

  it("renders the access-denied state without exposing admin data", () => {
    render(<AccessDeniedPage />);
    expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByText(/does not have active administrator access/i)).toBeInTheDocument();
  });
});
