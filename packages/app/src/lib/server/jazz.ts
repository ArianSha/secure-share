import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  acceptDeviceAccounts,
  createJazz,
  type Jazz,
  sqlite,
} from "jazz-tools/backend";
import permissions from "../jazz/permissions.ts";
import { app } from "../jazz/schema.ts";
import { shareRole } from "./share-access.ts";
import { getTunnelController } from "./tunnel-controller.ts";

const state = globalThis as typeof globalThis & { secureShareJazz?: Jazz };

export function getJazz() {
  if (!state.secureShareJazz) {
    // This is runtime-owned data, never a source asset for Next's build trace.
    const path = resolve(
      /* turbopackIgnore: true */ process.env.JAZZ_DATA_DIR ?? "data/jazz",
    );
    mkdirSync(/* turbopackIgnore: true */ path, {
      recursive: true,
      mode: 0o700,
    });
    state.secureShareJazz = createJazz({
      app,
      permissions,
      store: sqlite({ path }),
      // Anonymous device identities are automatic and persist across refreshes.
      // The active tunnel's URL is the recipient's only access requirement.
      authenticate: (request) =>
        shareRole(request, getTunnelController().tunnel.snapshot())
          ? acceptDeviceAccounts(request)
          : null,
    });
  }
  return state.secureShareJazz;
}
