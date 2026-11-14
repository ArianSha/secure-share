import { randomBytes } from "node:crypto";
import { QuickTunnel } from "./quick-tunnel.ts";

const processState = globalThis as typeof globalThis & {
  secureShareTunnel?: { tunnel: QuickTunnel; controlToken: string };
};

// One local tunnel per Node process. Survives route hot reloads, never sent to RSC renders.
export function getTunnelController() {
  if (!processState.secureShareTunnel) {
    const tunnel = new QuickTunnel();
    processState.secureShareTunnel = {
      tunnel,
      controlToken: randomBytes(32).toString("hex"),
    };
    process.once("exit", () => tunnel.dispose());
  }
  return processState.secureShareTunnel;
}
