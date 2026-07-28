import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import AdminPage from "@/app/admin/page";

describe("foundation pages", () => {
  it("renders the public landing page", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /foundation is running/i })).toBeInTheDocument();
  });

  it("renders the admin placeholder without fake access", () => {
    render(<AdminPage />);
    expect(screen.getByRole("heading", { name: /development placeholder/i })).toBeInTheDocument();
    expect(
      screen.getByText(/authentication and authorization will be implemented/i),
    ).toBeInTheDocument();
  });
});
