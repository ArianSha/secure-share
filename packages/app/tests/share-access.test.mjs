import assert from "node:assert/strict";
import test from "node:test";
import { shareRole } from "../src/lib/server/share-access.ts";

const tunnel = {
  status: "running",
  url: "https://example.trycloudflare.com",
  error: null,
};
function request(host, method = "GET", headers = {}) {
  return new Request(`http://${host}/api/share`, {
    method,
    headers: { host, ...headers },
  });
}
const forwarded = { "cf-connecting-ip": "203.0.113.1" };

test("identifies localhost hosts and link-only tunnel recipients separately", () => {
  assert.equal(shareRole(request("127.0.0.1:2525"), tunnel), "host");
  assert.equal(
    shareRole(request("example.trycloudflare.com", "GET", forwarded), tunnel),
    "recipient",
  );
  assert.equal(
    shareRole(
      request("example.trycloudflare.com", "POST", {
        ...forwarded,
        origin: tunnel.url,
      }),
      tunnel,
    ),
    "recipient",
  );
});

test("rejects stale, stopped, mismatched, and non-forwarded remote sessions", () => {
  for (const req of [
    request("example.trycloudflare.com"),
    request("old.trycloudflare.com", "GET", forwarded),
    request("127.0.0.1:2525", "GET", forwarded),
    request("example.trycloudflare.com", "GET", {
      ...forwarded,
      "x-forwarded-host": "evil.example",
    }),
    request("example.trycloudflare.com", "GET", {
      ...forwarded,
      "sec-fetch-site": "cross-site",
    }),
  ])
    assert.equal(shareRole(req, tunnel), null);
  assert.equal(
    shareRole(request("example.trycloudflare.com", "GET", forwarded), {
      ...tunnel,
      status: "stopped",
    }),
    null,
  );
});

test("requires same-origin mutations on both host and recipient routes", () => {
  for (const method of ["POST", "DELETE"]) {
    assert.equal(
      shareRole(
        request("example.trycloudflare.com", method, forwarded),
        tunnel,
      ),
      null,
    );
    assert.equal(
      shareRole(
        request("example.trycloudflare.com", method, {
          ...forwarded,
          origin: "https://evil.example",
        }),
        tunnel,
      ),
      null,
    );
    assert.equal(shareRole(request("127.0.0.1:2525", method), tunnel), null);
    assert.equal(
      shareRole(
        request("127.0.0.1:2525", method, { origin: "http://127.0.0.1:2525" }),
        tunnel,
      ),
      "host",
    );
  }
});
