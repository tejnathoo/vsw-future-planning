import { readMasterPromotionIndex, readStagingIndex } from "../sheets";

/**
 * Read-only tools for the conversational chat agent (PRD §12). Deliberately a
 * small subset of what the Promotion Agent can see, and NO write tools at all —
 * this loop only ever answers questions, it never mutates Staging or Master.
 */
export interface ChatToolDefinition {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, any>; required?: string[] };
  handler: (input: any) => Promise<unknown>;
}

export const CHAT_TOOLS: ChatToolDefinition[] = [
  {
    name: "read_master_snapshot",
    description:
      "Fresh read of every master-prospects row: row number, Organization Name, Why Them, Source Link. Use for questions about what's in Master, counts, or a specific org's Why Them/Source Link.",
    input_schema: { type: "object", properties: {} },
    handler: async () => {
      const rows = await readMasterPromotionIndex();
      return { count: rows.length, rows };
    },
  },
  {
    name: "read_staging_snapshot",
    description:
      "Fresh read of every data-staging row: row number, Organization Name, domain, Source URL, Why Them, Times Seen. Use for questions about what's queued in Staging or how many times an org has been seen.",
    input_schema: { type: "object", properties: {} },
    handler: async () => {
      const rows = await readStagingIndex();
      return { count: rows.length, rows };
    },
  },
];
