import { describe, expect, it } from "vitest";
import { formatBookingMessage } from "../src/calcom/formatMessage";
import type { ParsedBooking } from "../src/calcom/types";

const opts = { adminUserId: "U08TKLJH4QL", sheetLink: "https://docs.google.com/spreadsheets/d/abc/edit#gid=0" };

const booking: ParsedBooking = {
  name: "Jane Doe",
  email: "jane@acme.com",
  company: "Acme Robotics",
  companyFieldMissing: false,
  notes: "Wants to discuss Tier 2 sponsorship",
  startTime: "2026-08-04T21:00:00Z",
};

describe("formatBookingMessage", () => {
  it("puts company and time in the headline, tags Tej, and links the spreadsheet in context", () => {
    const msg = formatBookingMessage(booking, opts);
    expect(msg.blocks[0].text.text).toContain("Acme Robotics");
    expect(msg.blocks[0].text.text).toContain("2:00 PM");
    expect(msg.blocks[0].text.text).toContain("<@U08TKLJH4QL>");
    expect(msg.blocks[0].text.text).not.toContain("—"); // no em dashes (Voice System hard rule)
    expect(msg.blocks[2].elements[0].text).toBe(`🔗 <${opts.sheetLink}|Open spreadsheet>`);
  });

  it("lists name, email, and notes as bullets", () => {
    const msg = formatBookingMessage(booking, opts);
    expect(msg.blocks[1].text.text).toBe("• Name: Jane Doe\n• Email: jane@acme.com\n• Notes: Wants to discuss Tier 2 sponsorship");
  });

  it("omits the notes bullet when there are none", () => {
    const msg = formatBookingMessage({ ...booking, notes: undefined }, opts);
    expect(msg.blocks[1].text.text).toBe("• Name: Jane Doe\n• Email: jane@acme.com");
  });

  it("surfaces a missing company rather than silently dropping it", () => {
    const msg = formatBookingMessage({ ...booking, company: "", companyFieldMissing: true }, opts);
    expect(msg.blocks[0].text.text).toContain("not captured");
  });

  it("plain-text fallback leads with company and time for notification previews", () => {
    const msg = formatBookingMessage(booking, opts);
    expect(msg.text.startsWith("New meeting booked: Acme Robotics")).toBe(true);
  });
});
