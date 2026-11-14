import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { QuickTunnel } from "../src/lib/server/quick-tunnel.ts";

const origin = "http://127.0.0.1:43127";

async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for tunnel state");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function fixture(t, behavior = "ready") {
  const directory = await mkdtemp(join(tmpdir(), "quick-tunnel-test-"));
  const binaryPath = join(directory, "cloudflared");
  const argvPath = join(directory, "argv.json");
  await writeFile(
    binaryPath,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(argvPath)}, JSON.stringify(process.argv.slice(2)));
const behavior = ${JSON.stringify(behavior)};
if (behavior === "ignore-stop") process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
if (behavior !== "silent") {
  console.error("Your quick Tunnel has been created!");
  process.stderr.write("https://test-public-");
  setTimeout(() => process.stderr.write("tunnel.trycloudflare.com\\n"), 10);
  setTimeout(() => console.log("Registered tunnel connection connIndex=0"), 100);
}
if (behavior === "crash") setTimeout(() => process.exit(7), 1500);
`,
    { mode: 0o700 },
  );
  const tunnel = new QuickTunnel({
    binaryPath,
    startupTimeoutMs: behavior === "silent" ? 750 : 5000,
    stopTimeoutMs: 50,
  });
  t.after(async () => {
    tunnel.stop();
    await waitFor(() =>
      ["stopped", "error"].includes(tunnel.snapshot().status),
    );
    tunnel.dispose();
    await rm(directory, { recursive: true, force: true });
  });
  return { tunnel, argvPath };
}

test("uses exact arguments, waits for readiness, deduplicates starts, and cleans up on stop", async (t) => {
  const { tunnel, argvPath } = await fixture(t);
  assert.equal(tunnel.start(origin).status, "starting");
  assert.equal(tunnel.snapshot().url, null);
  assert.equal(tunnel.start(origin).status, "starting");
  assert.throws(() => tunnel.start("http://127.0.0.1:43128"), { status: 409 });
  await waitFor(() => tunnel.snapshot().status === "running");
  assert.equal(
    tunnel.snapshot().url,
    "https://test-public-tunnel.trycloudflare.com",
  );
  const args = JSON.parse(await readFile(argvPath, "utf8"));
  assert.equal(args[0], "tunnel");
  assert.ok(!args.includes("--allowed-mail"));
  assert.equal(args[args.indexOf("--url") + 1], origin);
  assert.ok(args.includes("--no-autoupdate"));
  const configPath = args[args.indexOf("--config") + 1];
  assert.equal(await readFile(configPath, "utf8"), "{}\n");
  assert.equal(tunnel.stop().url, null);
  await waitFor(() => tunnel.snapshot().status === "stopped");
  await assert.rejects(readFile(configPath), { code: "ENOENT" });
  assert.equal(tunnel.stop().status, "stopped");
});

test("can cancel startup and start a fresh tunnel", async (t) => {
  const { tunnel } = await fixture(t);
  tunnel.start(origin);
  tunnel.stop();
  await waitFor(() => tunnel.snapshot().status === "stopped");
  tunnel.start("http://127.0.0.1:43128");
  await waitFor(() => tunnel.snapshot().status === "running");
});

test("does not publish a link until the tunnel connects", async (t) => {
  const { tunnel } = await fixture(t, "silent");
  tunnel.start(origin);
  await waitFor(() => tunnel.snapshot().status === "error");
  assert.equal(tunnel.snapshot().url, null);
  assert.match(tunnel.snapshot().error, /did not connect in time/);
});

test("clears the link when the child crashes", async (t) => {
  const { tunnel } = await fixture(t, "crash");
  tunnel.start(origin);
  await waitFor(() => tunnel.snapshot().status === "running");
  await waitFor(() => tunnel.snapshot().status === "error");
  assert.equal(tunnel.snapshot().url, null);
  assert.match(tunnel.snapshot().error, /code 7/);
});

test("escalates termination when the child ignores SIGTERM", async (t) => {
  const { tunnel } = await fixture(t, "ignore-stop");
  tunnel.start(origin);
  await waitFor(() => tunnel.snapshot().status === "running");
  tunnel.stop();
  await waitFor(() => tunnel.snapshot().status === "stopped");
});

test("reports a missing binary and clears the error on stop", async () => {
  const tunnel = new QuickTunnel({
    binaryPath: "/nonexistent/secure-share-cloudflared",
  });
  tunnel.start(origin);
  await waitFor(() => tunnel.snapshot().status === "error");
  assert.match(tunnel.snapshot().error, /was not found/);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(tunnel.stop().status, "stopped");
});

test("only allows the local app as the tunnel target", () => {
  const tunnel = new QuickTunnel();
  for (const target of [
    "https://example.com",
    "http://192.168.1.1:80",
    "http://127.0.0.1:3000/private",
    "http://user:password@127.0.0.1:3000",
  ]) {
    assert.throws(() => tunnel.start(target));
  }
});
