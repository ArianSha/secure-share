import type { RowOf } from "jazz-tools";
import type { app } from "./jazz/schema.ts";

export type ShareRole = "host" | "recipient";

export type SharedItem = {
  id: string;
  sender: ShareRole;
  createdAt: string;
} & (
  | { type: "text"; text: string }
  | { type: "file"; name: string; size: number }
);

export type ShareSnapshot = {
  role: ShareRole;
  items: SharedItem[];
};

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_WORKSPACE_BYTES = 256 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 100_000;

export function toSharedItem(
  row: RowOf<typeof app.items> & { $createdAt: Date },
): SharedItem {
  const base = {
    id: row.id,
    sender: row.sender,
    createdAt: row.$createdAt.toISOString(),
  };
  return row.type === "text"
    ? { ...base, type: "text", text: row.text }
    : { ...base, type: "file", name: row.name, size: row.size };
}
