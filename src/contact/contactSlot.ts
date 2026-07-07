import type { MasterContactFields } from "../types";

export type ContactSlotDecision = "primary" | "secondary" | "ambiguous";

/**
 * Decide where a newly-attributed named contact goes on an existing
 * master-prospects row: primary (N-Q) if all blank, else secondary (R/S) if
 * blank, else ambiguous — both slots are taken, so the caller must ask Tej
 * rather than silently overwrite someone. Pure + unit-tested.
 */
export function decideContactSlot(
  existing: Pick<MasterContactFields, "primaryName" | "primaryTitle" | "primaryEmail" | "primaryLinkedin" | "secondaryName">
): ContactSlotDecision {
  const primaryEmpty =
    !existing.primaryName.trim() &&
    !existing.primaryTitle.trim() &&
    !existing.primaryEmail.trim() &&
    !existing.primaryLinkedin.trim();
  if (primaryEmpty) return "primary";
  if (!existing.secondaryName.trim()) return "secondary";
  return "ambiguous";
}
