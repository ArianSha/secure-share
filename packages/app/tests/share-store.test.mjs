import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJazz, memory, sqlite } from "jazz-tools/backend";
import permissions from "../src/lib/jazz/permissions.ts";
import { app } from "../src/lib/jazz/schema.ts";
import { ShareStore } from "../src/lib/server/share-store.ts";
import { MAX_FILE_BYTES, MAX_WORKSPACE_BYTES } from "../src/lib/share-state.ts";

async function fixture(t, storage = memory()) {
  const jazz = createJazz({
    app,
    permissions,
    store: storage,
    authenticate: () => null,
  });
  await jazz.ready();
  t.after(() => jazz.close());
  return { jazz, store: new ShareStore(jazz) };
}

test("late recipients and refreshed browsers see earlier uploads and subsequent changes", async (t) => {
  const { store } = await fixture(t);
  const file = new File([new Uint8Array([0, 255, 10, 20])], "résumé.bin");
  const item = await store.add("host", file);
  const firstRecipientLoad = await store.snapshot("recipient");
  assert.equal(firstRecipientLoad.role, "recipient");
  assert.equal(firstRecipientLoad.items[0].sender, "host");
  assert.equal(firstRecipientLoad.items[0].name, file.name);
  assert.deepEqual(
    await (await store.file(item.id)).file.arrayBuffer(),
    await file.arrayBuffer(),
  );
  await store.add("recipient", "Reply from the recipient");
  const hostRefresh = await store.snapshot("host");
  assert.equal(hostRefresh.items.length, 2);
  assert.equal(hostRefresh.items[0].sender, "recipient");
  assert.deepEqual(
    (await store.snapshot("recipient")).items,
    hostRefresh.items,
  );
  await store.remove(item.id, "host");
  assert.equal((await store.snapshot("recipient")).items.length, 1);
  assert.equal(await store.file(item.id), undefined);
});

test("only the uploader's side can remove items; invalid uploads do not change the workspace", async (t) => {
  const { store } = await fixture(t);
  const item = await store.add("host", "A message");
  await assert.rejects(store.remove(item.id, "recipient"), { status: 403 });
  await assert.rejects(
    store.remove("00000000-0000-0000-0000-000000000000", "host"),
    { status: 404 },
  );
  await assert.rejects(store.add("recipient", "   "), { status: 400 });
  await assert.rejects(store.add("recipient", "a".repeat(100_001)), {
    status: 400,
  });
  assert.equal((await store.snapshot("host")).items.length, 1);
});

test("enforces file and active workspace limits; deleting makes room", async (t) => {
  const { jazz, store } = await fixture(t);
  await assert.rejects(
    store.add("host", new File([new Uint8Array(MAX_FILE_BYTES + 1)], "large")),
    { status: 413 },
  );
  // Seed byte accounting without allocating a quarter-gigabyte fixture.
  const seeded = await jazz.db.serializableTransaction((tx) =>
    Array.from({ length: 10 }, () =>
      tx.insert(app.items, {
        sender: "host",
        type: "text",
        text: "seed",
        size: MAX_FILE_BYTES,
      }),
    ),
  );
  await seeded.wait();
  assert.ok(MAX_WORKSPACE_BYTES < 11 * MAX_FILE_BYTES);
  const file = new File([new Uint8Array(MAX_FILE_BYTES)], "allowed");
  await assert.rejects(store.add("host", file), { status: 413 });
  await store.remove(seeded.value[0].id, "host");
  await assert.doesNotReject(store.add("host", file));
});

test("Jazz SQLite retains metadata and binary content after the server restarts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "secure-share-jazz-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await fixture(t, sqlite({ path: directory }));
  const item = await first.store.add(
    "host",
    new File(["persistent bytes"], "persistent.txt"),
  );
  await first.jazz.close();
  const second = await fixture(t, sqlite({ path: directory }));
  assert.equal(
    (await second.store.snapshot("recipient")).items[0].name,
    "persistent.txt",
  );
  assert.equal(
    await (await second.store.file(item.id)).file.text(),
    "persistent bytes",
  );
});
