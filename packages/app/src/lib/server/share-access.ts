import type { ShareRole } from "../share-state.ts";
import type { TunnelState } from "../tunnel-state.ts";
import { localTunnelOrigin } from "./tunnel-request.ts";

// The server binds to loopback. Remote traffic must come through the currently
// running public tunnel. Possession of its URL is the only recipient gate.
export function shareRole(
  request: Request,
  tunnel: TunnelState,
): ShareRole | null {
  if (localTunnelOrigin(request)) return "host";
  if (
    tunnel.status !== "running" ||
    !tunnel.url ||
    !request.headers.get("cf-connecting-ip")
  )
    return null;
  const host = new URL(tunnel.url).host;
  if (request.headers.get("host") !== host) return null;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost !== host) return null;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return null;
  const origin = request.headers.get("origin");
  if (origin && origin !== tunnel.url) return null;
  if (request.method !== "GET" && origin !== tunnel.url) return null;
  return "recipient";
}
