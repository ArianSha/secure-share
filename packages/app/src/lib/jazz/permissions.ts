import { schema as s } from "jazz-tools";
import { app } from "./schema.ts";

export default s.definePermissions(app, ({ policy }) => {
  // Anyone admitted through the link can subscribe. Mutations and binary reads
  // go through the bounded HTTP API, which assigns the sender and checks deletes.
  policy.items.allowRead.always();
  policy.items.allowInsert.never();
  policy.items.allowUpdate.never();
  policy.items.allowDelete.never();
  policy.files.allowRead.never();
  policy.files.allowInsert.never();
  policy.files.allowUpdate.never();
  policy.files.allowDelete.never();
});
