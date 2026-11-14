import { getJazz } from "@/lib/server/jazz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getJazz().next().GET(request);
}
export function POST(request: Request) {
  return getJazz().next().POST(request);
}
export function DELETE(request: Request) {
  return getJazz().next().DELETE(request);
}
