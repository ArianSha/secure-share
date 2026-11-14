import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { TunnelState } from "../tunnel-state";

export class TunnelError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class QuickTunnel {
  private state: TunnelState = {
    status: "stopped",
    url: null,
    error: null,
  };
  private child: ChildProcess | null = null;
  private origin: string | null = null;
  private configDirectory: string | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private killTimer: ReturnType<typeof setTimeout> | undefined;
  private options: {
    binaryPath?: string;
    startupTimeoutMs?: number;
    stopTimeoutMs?: number;
  };

  constructor(options: QuickTunnel["options"] = {}) {
    this.options = options;
  }

  snapshot(): TunnelState {
    return { ...this.state };
  }

  start(origin: string): TunnelState {
    const target = new URL(origin);
    if (
      target.protocol !== "http:" ||
      target.hostname !== "127.0.0.1" ||
      target.origin !== origin
    ) {
      throw new TunnelError("The tunnel must connect to the local app.");
    }
    if (this.child) {
      if (
        this.origin === origin &&
        ["starting", "running"].includes(this.state.status)
      ) {
        return this.snapshot();
      }
      throw new TunnelError(
        "Stop the current tunnel before starting another.",
        409,
      );
    }

    // An explicit empty config keeps a user's named-tunnel ingress out of this tunnel.
    const configDirectory = mkdtempSync(join(tmpdir(), "secure-share-tunnel-"));
    const configPath = join(configDirectory, "config.yml");
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith("TUNNEL_")) delete env[key];
    }
    let child: ChildProcess;
    try {
      writeFileSync(configPath, "{}\n", { mode: 0o600 });
      child = spawn(
        /* turbopackIgnore: true */
        this.options.binaryPath ??
          process.env.CLOUDFLARED_PATH ??
          "cloudflared",
        [
          "tunnel",
          "--config",
          configPath,
          "--no-autoupdate",
          "--url",
          origin,
          "--grace-period",
          "2s",
          "--metrics",
          "127.0.0.1:0",
        ],
        {
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env,
        },
      );
    } catch {
      rmSync(configDirectory, { recursive: true, force: true });
      throw new TunnelError("Could not launch cloudflared.", 500);
    }

    this.child = child;
    this.origin = origin;
    this.configDirectory = configDirectory;
    this.state = { status: "starting", url: null, error: null };
    let connected = false;
    let candidateUrl: string | null = null;
    let diagnostic: string | null = null;
    const readers = [child.stdout, child.stderr].flatMap((input) =>
      input ? [createInterface({ input })] : [],
    );
    for (const reader of readers) {
      reader.on("line", (line) => {
        if (this.child !== child || this.state.status !== "starting") return;
        const url = line.match(
          /https:\/\/(?!login\.)[a-z0-9-]+\.trycloudflare\.com\b/,
        );
        if (url) candidateUrl = url[0];
        if (line.includes("Registered tunnel connection")) connected = true;
        if (
          /failed to request quick Tunnel|quick tunnel provisioning failed/i.test(
            line,
          )
        ) {
          diagnostic =
            "Cloudflare could not create the tunnel. Check your connection and try again.";
        }
        if (connected && candidateUrl) {
          clearTimeout(this.startupTimer);
          this.state = { ...this.state, status: "running", url: candidateUrl };
        }
      });
    }

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (this.child !== child) return;
      this.fail(
        error.code === "ENOENT"
          ? "cloudflared was not found. Install it or set CLOUDFLARED_PATH, then restart the app."
          : "Could not run cloudflared. Check that its binary is executable.",
      );
    });
    child.once("close", (code) => {
      for (const reader of readers) reader.close();
      rmSync(configDirectory, { recursive: true, force: true });
      if (this.child !== child) return;
      clearTimeout(this.startupTimer);
      clearTimeout(this.killTimer);
      this.child = null;
      this.origin = null;
      this.configDirectory = null;
      if (this.state.status === "stopping") {
        this.state = {
          status: "stopped",
          url: null,
          error: null,
        };
      } else if (this.state.status !== "error") {
        this.state = {
          ...this.state,
          status: "error",
          url: null,
          error:
            diagnostic ??
            `cloudflared exited unexpectedly${code === null ? "." : ` (code ${code}).`} Start the tunnel again.`,
        };
      }
    });
    this.startupTimer = setTimeout(() => {
      this.fail(
        diagnostic ??
          "The tunnel did not connect in time. Check your connection and try again.",
      );
    }, this.options.startupTimeoutMs ?? 30_000);
    this.startupTimer.unref();
    return this.snapshot();
  }

  stop(): TunnelState {
    clearTimeout(this.startupTimer);
    if (!this.child) {
      this.state = {
        status: "stopped",
        url: null,
        error: null,
      };
    } else if (this.state.status !== "stopping") {
      this.state = {
        ...this.state,
        status: "stopping",
        url: null,
        error: null,
      };
      this.terminate();
    }
    return this.snapshot();
  }

  // Called synchronously on the Next.js process's exit, including dev-worker restarts.
  dispose(): void {
    this.child?.kill("SIGKILL");
    if (this.configDirectory) {
      rmSync(this.configDirectory, { recursive: true, force: true });
    }
  }

  private fail(message: string): void {
    clearTimeout(this.startupTimer);
    this.state = { ...this.state, status: "error", url: null, error: message };
    this.terminate();
  }

  private terminate(): void {
    const child = this.child;
    if (!child) return;
    child.kill("SIGTERM");
    clearTimeout(this.killTimer);
    this.killTimer = setTimeout(
      () => child.kill("SIGKILL"),
      this.options.stopTimeoutMs ?? 3_000,
    );
    this.killTimer.unref();
  }
}
