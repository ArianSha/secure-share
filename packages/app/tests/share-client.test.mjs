import assert from "node:assert/strict";
import test from "node:test";
import { shareRequest } from "../src/lib/share-client.ts";

test("sends bounded same-origin requests without an email or bearer token", async (t) => {
  t.mock.method(globalThis, "fetch", async (_path, options) => {
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers["X-Secure-Share"], "1");
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ ok: true });
  });
  assert.deepEqual(await shareRequest("/api/share", { method: "POST" }), {
    ok: true,
  });
});

test("preserves actionable upload errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Workspace is full" }, { status: 413 }),
  );
  await assert.rejects(
    shareRequest("/api/share", { method: "POST" }),
    /Workspace is full/,
  );
});

test("server outages, invalid responses and stopped links are errors without login prompts", async (t) => {
  for (const response of [
    new Response("Unavailable", { status: 503 }),
    new Response("Unavailable", { status: 429 }),
    new Response("<html>Error</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    Response.json({ error: "Session stopped" }, { status: 403 }),
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(
      shareRequest("/api/share"),
      (error) => !/sign in|email/i.test(error.message),
    );
    mock.mock.restore();
  }
});
