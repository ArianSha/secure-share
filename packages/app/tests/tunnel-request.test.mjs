import assert from "node:assert/strict";
import test from "node:test";
import { localTunnelOrigin } from "../src/lib/server/tunnel-request.ts";

function request(host = "localhost:3000", method = "GET", headers = {}) {
  return new Request(`http://${host}/api/tunnel`, {
    method,
    headers: { host, ...headers },
  });
}

test("derives the app target from a local host including non-default ports", () => {
  assert.equal(localTunnelOrigin(request()), "http://127.0.0.1:3000");
  assert.equal(
    localTunnelOrigin(request("127.0.0.1:43127")),
    "http://127.0.0.1:43127",
  );
  assert.equal(
    localTunnelOrigin(request("[::1]:3000")),
    "http://127.0.0.1:3000",
  );
});

test("requires the local page origin for all mutations", () => {
  for (const method of ["POST", "DELETE"]) {
    assert.equal(localTunnelOrigin(request("localhost:3000", method)), null);
    assert.equal(
      localTunnelOrigin(
        request("localhost:3000", method, { origin: "http://localhost:3000" }),
      ),
      "http://127.0.0.1:3000",
    );
    assert.equal(
      localTunnelOrigin(
        request("localhost:3000", method, { origin: "https://evil.example" }),
      ),
      null,
    );
    assert.equal(
      localTunnelOrigin(
        request("localhost:3000", method, { origin: "http://localhost:3001" }),
      ),
      null,
    );
  }
});

test("blocks public tunnel hosts, Cloudflare forwarding, and cross-site requests", () => {
  assert.equal(localTunnelOrigin(request("test.trycloudflare.com")), null);
  for (const headers of [
    { "cf-connecting-ip": "203.0.113.4" },
    { "x-forwarded-host": "test.trycloudflare.com" },
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
    { origin: "null" },
  ]) {
    assert.equal(
      localTunnelOrigin(request("localhost:3000", "GET", headers)),
      null,
    );
  }
});
