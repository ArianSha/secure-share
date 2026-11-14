import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createJazz, memory } from "jazz-tools/backend";
import permissions from "../src/lib/jazz/permissions.ts";
import { app } from "../src/lib/jazz/schema.ts";

// Resolve the same source aliases Next uses, so these tests exercise the actual
// route handlers and streamed upload parsing without starting a public tunnel.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier))
      return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { GET, POST, DELETE } = await import("../src/app/api/share/route.ts");
const tunnel = {
  status: "running",
  url: "https://example.trycloudflare.com",
  error: null,
};
globalThis.secureShareTunnel = {
  tunnel: { snapshot: () => ({ ...tunnel }) },
  controlToken: "test-only",
};

async function setup(t) {
  const jazz = createJazz({
    app,
    permissions,
    store: memory(),
    authenticate: () => null,
  });
  await jazz.ready();
  globalThis.secureShareJazz = jazz;
  t.after(async () => {
    await jazz.close();
    delete globalThis.secureShareJazz;
  });
}

function request(role, method = "GET", query = "", body) {
  const origin = role === "host" ? "http://127.0.0.1:2525" : tunnel.url;
  const headers = { host: new URL(origin).host };
  if (role === "recipient") headers["cf-connecting-ip"] = "203.0.113.1";
  if (method !== "GET") {
    headers.origin = origin;
    headers["x-secure-share"] = "1";
  }
  if (typeof body === "string") headers["content-type"] = "application/json";
  return new Request(`${origin}/api/share${query}`, { method, headers, body });
}

test("full transfer: pre-join upload, late recipient, reply, download, refresh, and live deletion", async (t) => {
  await setup(t);
  const form = new FormData();
  const bytes = new Uint8Array([0, 255, 128, 13, 10]);
  form.set("file", new File([bytes], "résumé.bin"));
  const upload = await POST(request("host", "POST", "", form));
  assert.equal(upload.status, 201);
  const host = await upload.json();
  const item = host.items[0];
  const recipient = await (await GET(request("recipient"))).json();
  assert.equal(recipient.role, "recipient");
  assert.deepEqual(recipient.items, host.items);
  const download = await GET(request("recipient", "GET", `?file=${item.id}`));
  assert.equal(
    download.headers.get("content-type"),
    "application/octet-stream",
  );
  assert.match(
    download.headers.get("content-disposition"),
    /r%C3%A9sum%C3%A9.bin/,
  );
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
  const reply = await POST(
    request("recipient", "POST", "", JSON.stringify({ text: "I received it" })),
  );
  assert.equal(reply.status, 201);
  const changed = await (await GET(request("host"))).json();
  assert.equal(changed.items[0].sender, "recipient");
  assert.equal(changed.items.length, 2);
  assert.equal(
    (await DELETE(request("recipient", "DELETE", `?id=${item.id}`))).status,
    403,
  );
  assert.equal(
    (await DELETE(request("host", "DELETE", `?id=${item.id}`))).status,
    200,
  );
  assert.equal(
    (await GET(request("recipient", "GET", `?file=${item.id}`))).status,
    404,
  );
  assert.equal(
    (await (await GET(request("recipient"))).json()).items.length,
    1,
  );
  assert.equal(
    (await GET(request("recipient"))).headers.get("cache-control"),
    "no-store",
  );
});

test("rejects untrusted mutations, stopped tunnels, malformed bodies, and over-limit streams", async (t) => {
  await setup(t);
  const csrf = request(
    "host",
    "POST",
    "",
    JSON.stringify({ text: "Injected" }),
  );
  csrf.headers.delete("x-secure-share");
  assert.equal((await POST(csrf)).status, 403);
  assert.equal((await POST(request("host", "POST", "", "{"))).status, 400);
  assert.equal(
    (
      await POST(
        request(
          "host",
          "POST",
          "",
          JSON.stringify({ text: "x".repeat(100_001) }),
        ),
      )
    ).status,
    400,
  );
  const large = request("host", "POST", "", "x".repeat(601_025));
  large.headers.delete("content-length");
  assert.equal((await POST(large)).status, 413);
  const invalidForm = new FormData();
  invalidForm.set("file", "not a file");
  assert.equal(
    (await POST(request("host", "POST", "", invalidForm))).status,
    400,
  );
  tunnel.status = "stopped";
  try {
    assert.equal((await GET(request("recipient"))).status, 403);
    assert.equal((await GET(request("host"))).status, 200);
  } finally {
    tunnel.status = "running";
  }
  assert.equal((await globalThis.secureShareJazz.db.all(app.items)).length, 0);
});
