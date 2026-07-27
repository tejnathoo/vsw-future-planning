import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { masterSheetLink } from "../sheets";
import { formatBookingMessage } from "./formatMessage";
import { parseBooking } from "./parseBooking";
import type { CalcomBookingPayload } from "./types";
import { verifyCalcomSignature } from "./verifySignature";

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/**
 * cal.com needs a plain HTTP endpoint to POST booking events to. The Slack
 * side of this bot runs in Socket Mode (no inbound port), so this is a second,
 * independent listener in the same process/Railway service rather than a
 * separate deployment — `PORT` already existed in .env.example, unused until
 * now. Requires a public domain enabled for this Railway service (one-time
 * dashboard/CLI step, since Socket Mode never needed one) and a webhook
 * subscription created in cal.com pointing at <that domain>/webhooks/calcom.
 */
export function startCalcomWebhookServer(slackClient: any): void {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[calcom] CALCOM_WEBHOOK_SECRET not set — booking-notification webhook is disabled");
    return;
  }
  const channel = process.env.VSW_FUTURE_PLANNING_CHANNEL_ID;
  const adminUserId = process.env.SLACK_ADMIN_USER_ID;
  if (!channel || !adminUserId) {
    console.warn("[calcom] VSW_FUTURE_PLANNING_CHANNEL_ID or SLACK_ADMIN_USER_ID not set — booking-notification webhook is disabled");
    return;
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST" || req.url !== "/webhooks/calcom") {
      res.writeHead(404).end();
      return;
    }

    let rawBody: string;
    try {
      rawBody = await readRawBody(req);
    } catch (e: any) {
      console.error("[calcom] failed reading request body:", e.message);
      res.writeHead(400).end();
      return;
    }

    const sigHeader = req.headers["x-cal-signature-256"];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!verifyCalcomSignature(rawBody, signature, secret)) {
      console.warn("[calcom] rejected webhook: signature mismatch");
      res.writeHead(401).end();
      return;
    }

    // Ack once the signature checks out — cal.com retries on non-2xx, and a
    // downstream Slack hiccup shouldn't turn into a retry storm.
    res.writeHead(200).end();

    let payload: CalcomBookingPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e: any) {
      console.error("[calcom] invalid JSON payload:", e.message);
      return;
    }

    if (payload.triggerEvent !== "BOOKING_CREATED") return;

    try {
      const booking = parseBooking(payload);
      const message = formatBookingMessage(booking, { adminUserId, sheetLink: masterSheetLink() });
      await slackClient.chat.postMessage({ channel, ...message });
      console.log(`[calcom] posted booking notification for ${booking.company || "(unknown company)"}`);
    } catch (e: any) {
      console.error("[calcom] failed to post booking notification:", e.message);
    }
  });

  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => {
    console.log(`[calcom] webhook listener up on :${port}/webhooks/calcom`);
  });
}
