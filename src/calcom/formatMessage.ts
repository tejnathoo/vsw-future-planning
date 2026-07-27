import { formatPacific12h } from "../time";
import type { ParsedBooking } from "./types";

export interface BookingMessageOptions {
  adminUserId: string;
  sheetLink: string;
}

/**
 * Company + when get top billing (Tej's ask: both visible without opening
 * anything else), everything else reads as a plain list below, and the
 * spreadsheet link is the one thing that goes in `context` — it's provenance,
 * not the result (slack-communication-style.md principle 5). No em dashes,
 * no throat-clearing openers (Stop Slop Guide / Voice System).
 */
export function formatBookingMessage(booking: ParsedBooking, opts: BookingMessageOptions) {
  const { date, time } = formatPacific12h(booking.startTime);
  const company = booking.companyFieldMissing ? "⚠️ company not captured, check the form mapping" : booking.company;

  const headline = `🙌 *New meeting booked: ${company}*\n${date} · ${time} PT\n\n<@${opts.adminUserId}> confirm with Andrew and/or Vivian, then update the spreadsheet.`;

  const detailLines = [`• Name: ${booking.name}`, `• Email: ${booking.email}`];
  if (booking.notes) detailLines.push(`• Notes: ${booking.notes}`);

  const fallback = [
    `New meeting booked: ${company}, ${date} at ${time} PT`,
    `Confirm with Andrew and/or Vivian, then update the spreadsheet.`,
    `Name: ${booking.name}`,
    `Email: ${booking.email}`,
    ...(booking.notes ? [`Notes: ${booking.notes}`] : []),
  ].join("\n");

  return {
    text: fallback,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: headline } },
      { type: "section", text: { type: "mrkdwn", text: detailLines.join("\n") } },
      { type: "context", elements: [{ type: "mrkdwn", text: `🔗 <${opts.sheetLink}|Open spreadsheet>` }] },
    ],
  };
}
