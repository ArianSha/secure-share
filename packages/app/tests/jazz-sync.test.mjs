import assert from "node:assert/strict";
import test from "node:test";
import { createJazzClient } from "jazz-tools/client";
import { startTestJazz } from "jazz-tools/testing";
import permissions from "../src/lib/jazz/permissions.ts";
import { app, sharedItemsQuery } from "../src/lib/jazz/schema.ts";
import { ShareStore } from "../src/lib/server/share-store.ts";

async function waitFor(predicate) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for Jazz live query");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("anonymous Jazz clients receive live inserts/deletes but cannot bypass the upload API", {
  timeout: 30_000,
}, async (t) => {
  const backend = await startTestJazz({ app, permissions });
  const clients = [];
  const unsubscribers = [];
  t.after(async () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
    await Promise.all(clients.map((client) => client.close()));
    await backend.stop();
  });
  async function client() {
    let saved = null;
    const session = await createJazzClient({
      serverUrl: backend.url,
      initial: "device",
      store: {
        read: async () => saved,
        update: async (change) => {
          saved = change(saved);
        },
      },
    });
    clients.push(session);
    return session;
  }
  const alice = await client();
  const bob = await client();
  let aliceRows;
  let bobRows;
  const errors = [];
  const rejected = [];
  unsubscribers.push(bob.db.onMutationError((error) => rejected.push(error)));
  unsubscribers.push(
    alice.db.subscribe(sharedItemsQuery, {
      onUpdate: (rows) => {
        aliceRows = rows;
      },
      onError: (error) => errors.push(error),
    }),
  );
  unsubscribers.push(
    bob.db.subscribe(sharedItemsQuery, {
      onUpdate: (rows) => {
        bobRows = rows;
      },
      onError: (error) => errors.push(error),
    }),
  );
  await waitFor(() => aliceRows && bobRows);
  const store = new ShareStore(backend.jazz);
  const item = await store.add("host", "Live through Jazz");
  await waitFor(() => aliceRows.length === 1 && bobRows.length === 1);
  assert.equal(bobRows[0].text, "Live through Jazz");
  await assert.rejects(
    bob.db
      .insert(app.items, { sender: "host", type: "text", text: "spoofed host" })
      .wait(),
  );
  await assert.rejects(bob.db.delete(app.items, item.id).wait());
  const file = await store.add(
    "host",
    new File(["private binary"], "test.txt"),
  );
  await waitFor(() => bobRows.length === 2);
  assert.deepEqual(await bob.db.all(app.files), []);
  await store.remove(item.id, "host");
  await waitFor(() => aliceRows.length === 1 && bobRows.length === 1);
  assert.equal(bobRows[0].id, file.id);
  assert.deepEqual(errors, []);
  assert.equal(rejected.length, 2);
});
