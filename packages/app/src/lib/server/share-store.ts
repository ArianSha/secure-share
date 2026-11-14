import type { Jazz } from "jazz-tools/backend";
import { app, sharedItemsQuery } from "../jazz/schema.ts";
import type { ShareRole } from "../share-state.ts";
import {
  MAX_FILE_BYTES,
  MAX_TEXT_LENGTH,
  MAX_WORKSPACE_BYTES,
  toSharedItem,
} from "../share-state.ts";
import { getJazz } from "./jazz.ts";

export class ShareError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class ShareStore {
  private jazz: Jazz;
  constructor(jazz: Jazz) {
    this.jazz = jazz;
  }

  async snapshot(role: ShareRole) {
    const rows = await this.jazz.db.all(sharedItemsQuery);
    return { role, items: rows.map(toSharedItem) };
  }

  async add(sender: ShareRole, value: string | File) {
    const isText = typeof value === "string";
    if (isText && (!value.trim() || value.length > MAX_TEXT_LENGTH)) {
      throw new ShareError("Enter text up to 100,000 characters.");
    }
    if (!isText && value.size > MAX_FILE_BYTES) {
      throw new ShareError("Files must be 25 MB or smaller.", 413);
    }
    const bytes = isText ? Buffer.byteLength(value) : value.size;
    const content = isText
      ? undefined
      : new Uint8Array(await value.arrayBuffer());
    // The capacity check and insert commit together, even for concurrent uploads.
    const write = await this.jazz.db.serializableTransaction(async (tx) => {
      const rows = await tx.all(app.items);
      if (
        rows.length >= 1000 ||
        rows.reduce((total, row) => total + row.size, 0) + bytes >
          MAX_WORKSPACE_BYTES
      ) {
        throw new ShareError(
          "Workspace is full. Remove shared items to make room.",
          413,
        );
      }
      const blob = content ? tx.insert(app.files, { content }) : undefined;
      const row = tx.insert(app.items, {
        sender,
        type: isText ? "text" : "file",
        text: isText ? value : "",
        name: isText ? "" : value.name,
        size: bytes,
        blobId: blob?.id,
      });
      return { id: row.id };
    });
    await write.wait();
    return write.value;
  }

  async file(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const row = await this.jazz.db.one(sharedItemsQuery.where({ id }));
    if (row?.type !== "file" || !row.blobId) return undefined;
    const blob = await this.jazz.db.one(app.files.where({ id: row.blobId }));
    if (!blob) return undefined;
    return {
      item: toSharedItem(row),
      file: new Blob([blob.content as Uint8Array<ArrayBuffer>]),
    };
  }

  async remove(id: string, sender: ShareRole) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new ShareError("This item has already been removed.", 404);
    const write = await this.jazz.db.serializableTransaction(async (tx) => {
      const row = await tx.one(app.items.where({ id }));
      if (!row)
        throw new ShareError("This item has already been removed.", 404);
      if (row.sender !== sender)
        throw new ShareError("You can only remove items you shared.", 403);
      tx.delete(app.items, id);
      if (row.blobId) tx.delete(app.files, row.blobId);
    });
    await write.wait();
  }
}

export function getShareStore() {
  return new ShareStore(getJazz());
}
