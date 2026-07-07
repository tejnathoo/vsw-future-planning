import type { MasterContactFields } from "../types";

export type ContactSlotDecision = "primary" | "secondary" | "ambiguous";

/**
 * Decide where a newly-attributed named contact goes on an existing
 * master-prospects row: primary (N-Q) if all blank, else secondary (R/S/T/U)
 * if all blank, else ambiguous — both slots are taken, so the caller must ask
 * Tej rather than silently overwrite someone. Pure + unit-tested.
 */
export function decideContactSlot(
  existing: Pick<
    MasterContactFields,
    "primaryName" | "primaryTitle" | "primaryEmail" | "primaryLinkedin" | "secondaryName" | "secondaryTitle" | "secondaryLinkedin" | "secondaryEmail"
  >
): ContactSlotDecision {
  const primaryEmpty =
    !existing.primaryName.trim() &&
    !existing.primaryTitle.trim() &&
    !existing.primaryEmail.trim() &&
    !existing.primaryLinkedin.trim();
  if (primaryEmpty) return "primary";
  const secondaryEmpty =
    !existing.secondaryName.trim() &&
    !existing.secondaryTitle.trim() &&
    !existing.secondaryLinkedin.trim() &&
    !existing.secondaryEmail.trim();
  if (secondaryEmpty) return "secondary";
  return "ambiguous";
}
