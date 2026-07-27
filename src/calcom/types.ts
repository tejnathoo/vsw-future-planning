export interface CalcomResponseField {
  label?: string;
  value?: unknown;
  isHidden?: boolean;
}

export interface CalcomAttendee {
  name?: string;
  email?: string;
  timeZone?: string;
}

export interface CalcomBookingPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    title?: string;
    startTime: string;
    endTime?: string;
    attendees?: CalcomAttendee[];
    responses?: Record<string, CalcomResponseField>;
  };
}

/** What this bot actually needs out of a booking, already resolved from the raw payload. */
export interface ParsedBooking {
  name: string;
  email: string;
  company: string;
  companyFieldMissing: boolean;
  notes?: string;
  startTime: string; // ISO
}
