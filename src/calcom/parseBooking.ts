import type { CalcomBookingPayload, ParsedBooking } from "./types";

// The exact key cal.com uses for a custom question's response is normally its
// configured identifier, but this hasn't been confirmed against a live payload
// yet (Tej's Monday plan already includes a real test booking through the
// link before it goes to Andrew — that's when this gets its first live
// check). Try the known identifier and its common variants first, then fall
// back to a label search so a live shape mismatch doesn't just drop the one
// field Tej said matters most.
const COMPANY_KEY_CANDIDATES = ["your-company-name", "your_company_name", "yourCompanyName", "company", "company-name", "companyName"];

function stringValue(field: { value?: unknown } | undefined): string | undefined {
  const v = field?.value;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function findCompany(responses: CalcomBookingPayload["payload"]["responses"]): string | undefined {
  if (!responses) return undefined;
  for (const key of COMPANY_KEY_CANDIDATES) {
    const found = stringValue(responses[key]);
    if (found) return found;
  }
  for (const field of Object.values(responses)) {
    if (field.label && /company/i.test(field.label)) {
      const found = stringValue(field);
      if (found) return found;
    }
  }
  return undefined;
}

/** Pure extraction of the fields this bot's notification needs out of a raw BOOKING_CREATED payload. */
export function parseBooking(payload: CalcomBookingPayload): ParsedBooking {
  const p = payload.payload;
  const attendee = p.attendees?.[0];
  const responses = p.responses;

  const name = attendee?.name || stringValue(responses?.name) || "";
  const email = attendee?.email || stringValue(responses?.email) || "";
  const company = findCompany(responses);
  const notes = stringValue(responses?.notes);

  return {
    name,
    email,
    company: company || "",
    companyFieldMissing: !company,
    notes,
    startTime: p.startTime,
  };
}
