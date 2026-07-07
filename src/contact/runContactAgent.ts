import { decideContactSlot } from "./contactSlot";
import { matchMasterOrg, type OrgMatchResult } from "./matchOrg";
import { parseContactMessage } from "../paths/contact";
import { processItems } from "../pipeline";
import {
  appendAggregate,
  coerceBoolean,
  masterSheetLink,
  readMasterContactFields,
  readMasterPromotionIndex,
  updateMasterContactFields,
  updateMasterFields,
} from "../sheets";
import { bulletMessage } from "../slack/reply";
import type { MasterContactFieldUpdates, MasterContactFields, MasterFieldKey, ParsedContact, ParsedContactMessage } from "../types";
import { addPendingQuestion, type PendingQuestion } from "../promote/agent/pendingQuestions";

const FIELD_LABELS: Record<MasterFieldKey, string> = {
  prospectId: "Prospect ID",
  organizationName: "Organization Name",
  category: "Category",
  subsector: "Subsector",
  hqGeography: "HQ / Geography",
  potentialMutualValue: "Potential Mutual Value",
  programmingAngle: "Programming Angle",
  sourceType: "Source Type",
  sourceLink: "Source Link",
  warmLead: "Warm Lead?",
  warmLeadPerson: "Warm Lead Person",
  warmLeadPath: "Warm Lead Path",
  stage: "Stage",
  lastTouchDate: "Last Touch Date",
  lastTouchChannel: "Last Touch Channel",
  nextStep: "Next Step",
  nextFollowUpDate: "Next Follow-up Date",
  owner: "Owner",
  fundingType: "Funding Type",
  estimatedCapacity: "Estimated Capacity",
  targetAskRange: "Target Ask Range",
  exclusivityPlay: "Exclusivity Play?",
  budgetWindow: "Budget Window",
};

/** Apply each field update independently so one invalid value (e.g. a bad Category) doesn't block the rest. */
async function applyFieldUpdates(rowNumber: number, updates: ParsedContactMessage["fieldUpdates"]): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];
  for (const update of updates) {
    try {
      await updateMasterFields(rowNumber, [update]);
      applied.push(`${FIELD_LABELS[update.field]} → ${update.field === "warmLead" ? (coerceBoolean(update.value) ? "Yes" : "No") : update.value}`);
    } catch (e: any) {
      failed.push(`${FIELD_LABELS[update.field]}: ${e.message}`);
    }
  }
  return { applied, failed };
}

interface SlackClient {
  chat: { postMessage: (args: any) => Promise<any> };
}

interface ContactMentionCtx {
  channel: string;
  threadTs: string;
  userNote?: string;
  slackClient: SlackClient;
}

export type ContactMentionResult =
  | { status: "applied"; message: ReturnType<typeof bulletMessage> }
  | { status: "asked" } // question already posted in-thread — nothing more to reply
  | { status: "error"; message: { text: string } };

/**
 * Apply a parsed contact message to one already-matched master-prospects row.
 * Writes only through updateMasterContactFields (N/O/P/Q/R/S/T + append-only
 * F/AF) — never any other column. Returns "asked" if a slot conflict (both
 * primary and secondary already taken) needs Tej's call rather than guessing.
 */
async function applyContactUpdate(
  rowNumber: number,
  organization: string,
  parsed: ParsedContactMessage,
  ctx: ContactMentionCtx
): Promise<ContactMentionResult> {
  const current = await readMasterContactFields(rowNumber);
  const effective = { ...current };
  const fields: MasterContactFieldUpdates = {};
  const applied: string[] = [];

  for (const contact of parsed.contacts) {
    if (contact.isGenericInbox) {
      if (contact.email) {
        fields.genericIntakeEmail = contact.email;
        effective.genericIntakeEmail = contact.email;
        applied.push(`Generic inbox: ${contact.email}`);
      }
      continue;
    }

    const slot = decideContactSlot(effective);
    if (slot === "ambiguous") {
      await askSlotConflict(rowNumber, organization, contact, ctx);
      return { status: "asked" };
    }

    if (slot === "primary") {
      fields.primaryName = contact.name || "";
      fields.primaryTitle = contact.title || "";
      fields.primaryEmail = contact.email || "";
      fields.primaryLinkedin = contact.linkedin || "";
      Object.assign(effective, {
        primaryName: fields.primaryName,
        primaryTitle: fields.primaryTitle,
        primaryEmail: fields.primaryEmail,
        primaryLinkedin: fields.primaryLinkedin,
      });
      applied.push(`Primary contact: ${contact.name || "(unnamed)"}${contact.title ? `, ${contact.title}` : ""}`);
    } else {
      fields.secondaryName = contact.name || "";
      fields.secondaryTitle = contact.title || "";
      fields.secondaryLinkedin = contact.linkedin || "";
      fields.secondaryEmail = contact.email || "";
      Object.assign(effective, {
        secondaryName: fields.secondaryName,
        secondaryTitle: fields.secondaryTitle,
        secondaryLinkedin: fields.secondaryLinkedin,
        secondaryEmail: fields.secondaryEmail,
      });
      applied.push(`Secondary contact: ${contact.name || "(unnamed)"}${contact.title ? `, ${contact.title}` : ""}`);
    }
  }

  if (parsed.notesAddition) {
    fields.notes = appendAggregate(current.notes, parsed.notesAddition);
  }
  if (parsed.whyThemAddition) {
    fields.whyThem = appendAggregate(current.whyThem, parsed.whyThemAddition);
  }

  if (Object.keys(fields).length > 0) {
    await updateMasterContactFields(rowNumber, fields);
  }

  const { applied: fieldsApplied, failed: fieldsFailed } = await applyFieldUpdates(rowNumber, parsed.fieldUpdates);
  applied.push(...fieldsApplied);

  const bullets = applied.length > 0 ? applied : ["Nothing new to write (already up to date)."];
  const extraSections = fieldsFailed.length > 0 ? [`Couldn't apply:\n${fieldsFailed.map((f) => `• ${f}`).join("\n")}`] : [];
  const message = bulletMessage(
    `Updated ${organization}!`,
    bullets,
    `📋 <${masterSheetLink()}|Open Master Prospects> (row ${rowNumber})`,
    extraSections
  );
  return { status: "applied", message };
}

async function askSlotConflict(
  rowNumber: number,
  organization: string,
  contact: ParsedContact,
  ctx: ContactMentionCtx
): Promise<void> {
  const question = `${organization} (row ${rowNumber}) already has both a primary and secondary contact. Should "${contact.name || "this contact"}" replace the primary, replace the secondary, or just go in Notes?`;
  await ctx.slackClient.chat.postMessage({
    channel: ctx.channel,
    thread_ts: ctx.threadTs,
    text: `🤔 ${question}\n\n(No rush — reply here whenever.)`,
  });
  addPendingQuestion({
    id: `contact-${rowNumber}-${Date.now()}`,
    kind: "contact",
    organization,
    channel: ctx.channel,
    threadTs: ctx.threadTs,
    question,
    askedAt: new Date().toISOString(),
    payload: { stage: "slot_conflict", rowNumber, organization, contact },
  });
}

async function askOrgMatch(
  parsed: ParsedContactMessage,
  matchResult: OrgMatchResult,
  ctx: ContactMentionCtx
): Promise<void> {
  const question =
    matchResult.status === "ambiguous"
      ? `"${parsed.organizationNameGuess}" matches more than one row in Master: ${matchResult.candidates.join(", ")}. Which one (or a row number)?`
      : `I couldn't find "${parsed.organizationNameGuess}" in master-prospects. Is this a new org I should add (say so), or does it already exist under a different name/row (tell me the name or row number)?`;
  await ctx.slackClient.chat.postMessage({
    channel: ctx.channel,
    thread_ts: ctx.threadTs,
    text: `🤔 ${question}\n\n(No rush — reply here whenever.)`,
  });
  addPendingQuestion({
    id: `contact-org-${Date.now()}`,
    kind: "contact",
    organization: parsed.organizationNameGuess,
    channel: ctx.channel,
    threadTs: ctx.threadTs,
    question,
    askedAt: new Date().toISOString(),
    payload: { stage: "org_match", parsed },
  });
}

/** Entry point for the "contact" route (router.ts) — a plain @mention attributing a contact/generic inbox, and/or changing any other field on an existing row (e.g. "make this a warm pathway"). */
export async function handleContactMention(text: string, ctx: ContactMentionCtx): Promise<ContactMentionResult> {
  const parsed = await parseContactMessage(text, ctx.userNote);
  if (!parsed.organizationNameGuess) {
    return { status: "error", message: { text: "I couldn't tell which company this is for — mention me again with the company name up front." } };
  }
  if (parsed.contacts.length === 0 && parsed.fieldUpdates.length === 0 && !parsed.whyThemAddition && !parsed.notesAddition) {
    return { status: "error", message: { text: `I couldn't find a name, email, LinkedIn, or a clear change to make for ${parsed.organizationNameGuess} in that message — try again with those details.` } };
  }

  const masterIndex = await readMasterPromotionIndex();
  const matchResult = await matchMasterOrg(parsed.organizationNameGuess, masterIndex);

  if (matchResult.status === "matched") {
    return applyContactUpdate(matchResult.rowNumber, matchResult.organization, parsed, ctx);
  }

  await askOrgMatch(parsed, matchResult, ctx);
  return { status: "asked" };
}

export type ResumeContactResult =
  | { status: "applied"; message: ReturnType<typeof bulletMessage> }
  | { status: "asked" }
  | { status: "staged"; message: { text: string } }
  | { status: "not_understood"; message: { text: string } };

/** Resume a held contact-attribution question after Tej replies in-thread. */
export async function resumePendingContact(pending: PendingQuestion, answer: string, ctx: ContactMentionCtx): Promise<ResumeContactResult> {
  const stage = pending.payload?.stage as "org_match" | "slot_conflict" | undefined;

  if (stage === "slot_conflict") {
    const { rowNumber, organization, contact } = pending.payload as { rowNumber: number; organization: string; contact: ParsedContact };
    const current = await readMasterContactFields(rowNumber);
    const fields: MasterContactFieldUpdates = {};
    if (/primary/i.test(answer)) {
      fields.primaryName = contact.name || "";
      fields.primaryTitle = contact.title || "";
      fields.primaryEmail = contact.email || "";
      fields.primaryLinkedin = contact.linkedin || "";
    } else if (/secondary/i.test(answer)) {
      fields.secondaryName = contact.name || "";
      fields.secondaryTitle = contact.title || "";
      fields.secondaryLinkedin = contact.linkedin || "";
      fields.secondaryEmail = contact.email || "";
    } else {
      fields.notes = appendAggregate(current.notes, `Contact (unresolved primary/secondary): ${contact.name || ""} — ${[contact.title, contact.email, contact.linkedin].filter(Boolean).join(", ")}`);
    }
    await updateMasterContactFields(rowNumber, fields);
    const message = bulletMessage(`Updated ${organization}!`, [`Applied "${contact.name}" per your answer`], `📋 <${masterSheetLink()}|Open Master Prospects> (row ${rowNumber})`);
    return { status: "applied", message };
  }

  if (stage === "org_match") {
    const parsed = (pending.payload as { parsed: ParsedContactMessage }).parsed;
    const masterIndex = await readMasterPromotionIndex();

    const rowMatch = answer.match(/row\s*#?(\d+)/i);
    if (rowMatch) {
      const rowNumber = parseInt(rowMatch[1], 10);
      const entry = masterIndex.find((m) => m.rowNumber === rowNumber);
      if (!entry) return { status: "not_understood", message: { text: `I couldn't find row ${rowNumber} in Master — double check the row number and try mentioning me again.` } };
      const result = await applyContactUpdate(rowNumber, entry.organization, parsed, ctx);
      return result.status === "applied" ? { status: "applied", message: result.message } : { status: "asked" };
    }

    if (/^(yes|y|add|new|it'?s new)\b/i.test(answer.trim())) {
      await processItems([{ organization: parsed.organizationNameGuess, evidence: `Slack contact-attribution message` }], {
        sourceLabel: "Manual (Slack contact)",
        sourceUrl: `slack://${pending.channel}/${pending.threadTs}`,
        sourceSlug: "slack-contact",
        tier: "-",
        extractor: "Manual",
        forceReviewForNewOrgs: false,
        userNote: pending.question,
      });
      return { status: "staged", message: { text: `Got it — staged "${parsed.organizationNameGuess}" in data-staging. Once it's Approved and promoted to Master, mention me again with the contact info and I'll attach it.` } };
    }

    // Treat anything else as a corrected org name.
    const matchResult = await matchMasterOrg(answer.trim(), masterIndex);
    if (matchResult.status === "matched") {
      const result = await applyContactUpdate(matchResult.rowNumber, matchResult.organization, parsed, ctx);
      return result.status === "applied" ? { status: "applied", message: result.message } : { status: "asked" };
    }
    return {
      status: "not_understood",
      message: { text: `I still couldn't match that to a Master row — mention me again with the exact organization name (or "row <number>") and the contact details.` },
    };
  }

  return { status: "not_understood", message: { text: `I lost track of what this reply was for — mention me again with the company + contact info.` } };
}
