import { schema as s } from "jazz-tools";
import { migrations } from "./migrations/index.ts";

export const app = s.defineApp(
  {
    items: s.table(
      {
        sender: s.enum("host", "recipient"),
        type: s.enum("text", "file"),
        text: s.string().default(""),
        name: s.string().default(""),
        size: s.int().default(0),
        blobId: s.uuid().optional(),
      },
      {},
    ),
    // Keep binaries out of live list queries; fetch only when downloading.
    files: s.table({ content: s.bytes() }, {}),
  },
  { migrations },
);

export const sharedItemsQuery = app.items
  .select("*", "$createdAt")
  .orderBy("$createdAt", "desc");
