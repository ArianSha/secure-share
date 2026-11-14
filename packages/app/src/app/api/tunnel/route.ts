import { type NextRequest, NextResponse } from "next/server";
import { TunnelError } from "@/lib/server/quick-tunnel";
import { getTunnelController } from "@/lib/server/tunnel-controller";
import { localTunnelOrigin } from "@/lib/server/tunnel-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieName = "secure-share-tunnel-owner";
const headers = { "Cache-Control": "no-store" };

function forbidden() {
  return NextResponse.json(
    { error: "Tunnel controls are available only from this app on localhost." },
    { status: 403, headers },
  );
}

export function GET(request: NextRequest) {
  if (!localTunnelOrigin(request)) return forbidden();
  const { tunnel, controlToken } = getTunnelController();
  const response = NextResponse.json(tunnel.snapshot(), { headers });
  response.cookies.set(cookieName, controlToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/tunnel",
  });
  return response;
}

export async function POST(request: NextRequest) {
  const origin = localTunnelOrigin(request);
  if (!origin) return forbidden();
  const { tunnel, controlToken } = getTunnelController();
  if (request.cookies.get(cookieName)?.value !== controlToken)
    return forbidden();
  try {
    return NextResponse.json(tunnel.start(origin), {
      status: 202,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof TunnelError
            ? error.message
            : "Could not start the tunnel.",
      },
      { status: error instanceof TunnelError ? error.status : 500, headers },
    );
  }
}

export function DELETE(request: NextRequest) {
  if (!localTunnelOrigin(request)) return forbidden();
  const { tunnel, controlToken } = getTunnelController();
  if (request.cookies.get(cookieName)?.value !== controlToken)
    return forbidden();
  return NextResponse.json(tunnel.stop(), { status: 202, headers });
}
