import { describe, expect, it } from "vitest";
import { venueSchema } from "@/lib/services/phase-3";

const address = {
  name: "Jefferson Tennis Courts",
  street: "1 Jefferson Avenue",
  city: "Brooklyn",
  state: "NY",
  postalCode: "11201",
  timezone: "America/New_York",
};

describe("Independent/Public Venue business model", () => {
  it("accepts an independent Venue with no owning Organization", () => {
    expect(venueSchema.parse({ ...address, organizationId: null })).toMatchObject({
      name: address.name,
      organizationId: null,
    });
  });

  it("continues to accept an Organization Venue", () => {
    const organizationId = "00000000-0000-0000-0000-000000000001";
    expect(venueSchema.parse({ ...address, organizationId })).toMatchObject({
      name: address.name,
      organizationId,
    });
  });
});
