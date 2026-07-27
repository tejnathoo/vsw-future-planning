import { describe, expect, it } from "vitest";
import { parseBooking } from "../src/calcom/parseBooking";
import type { CalcomBookingPayload } from "../src/calcom/types";

function payload(overrides: Partial<CalcomBookingPayload["payload"]> = {}): CalcomBookingPayload {
  return {
    triggerEvent: "BOOKING_CREATED",
    createdAt: "2026-07-27T15:00:00Z",
    payload: {
      title: "30min between Tej and Guest",
      startTime: "2026-08-04T21:00:00Z",
      attendees: [{ name: "Jane Doe", email: "jane@acme.com", timeZone: "America/Los_Angeles" }],
      responses: {
        name: { label: "your_name", value: "Jane Doe" },
        email: { label: "email_address", value: "jane@acme.com" },
        "your-company-name": { label: "Company name", value: "Acme Robotics" },
        notes: { label: "additional_notes", value: "Wants to discuss Tier 2 sponsorship" },
      },
      ...overrides,
    },
  };
}

describe("parseBooking", () => {
  it("reads name/email from attendees and company/notes from responses", () => {
    const result = parseBooking(payload());
    expect(result).toEqual({
      name: "Jane Doe",
      email: "jane@acme.com",
      company: "Acme Robotics",
      companyFieldMissing: false,
      notes: "Wants to discuss Tier 2 sponsorship",
      startTime: "2026-08-04T21:00:00Z",
    });
  });

  it("falls back to responses.name/email when attendees is empty", () => {
    const result = parseBooking(payload({ attendees: [] }));
    expect(result.name).toBe("Jane Doe");
    expect(result.email).toBe("jane@acme.com");
  });

  it("finds the company field by label when the identifier key doesn't match", () => {
    const p = payload();
    delete p.payload.responses!["your-company-name"];
    p.payload.responses!["some-other-slug"] = { label: "Company Name", value: "Beta Corp" };
    const result = parseBooking(p);
    expect(result.company).toBe("Beta Corp");
    expect(result.companyFieldMissing).toBe(false);
  });

  it("flags companyFieldMissing rather than silently dropping it", () => {
    const p = payload();
    delete p.payload.responses!["your-company-name"];
    const result = parseBooking(p);
    expect(result.company).toBe("");
    expect(result.companyFieldMissing).toBe(true);
  });

  it("leaves notes undefined when not answered", () => {
    const p = payload();
    delete p.payload.responses!.notes;
    const result = parseBooking(p);
    expect(result.notes).toBeUndefined();
  });
});
