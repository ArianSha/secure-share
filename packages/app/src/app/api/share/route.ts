import { shareRole } from "@/lib/server/share-access";
import { getShareStore, ShareError } from "@/lib/server/share-store";
import { getTunnelController } from "@/lib/server/tunnel-controller";
import { MAX_FILE_BYTES, MAX_TEXT_LENGTH } from "@/lib/share-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const role = shareRole(request, getTunnelController().tunnel.snapshot());
  if (!role)
    return Response.json(
      { error: "This sharing session is no longer available." },
      { status: 403, headers },
    );
  const store = getShareStore();
  const url = new URL(request.url);
  const id = url.searchParams.get("file");
  if (id) {
    const entry = await store.file(id);
    if (!entry?.file || entry.item.type !== "file")
      return Response.json(
        { error: "File no longer available." },
        { status: 404, headers },
      );
    return new Response(entry.file, {
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(entry.item.name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)}`,
      },
    });
  }
  return Response.json(await store.snapshot(role), { headers });
}

export async function POST(request: Request) {
  const role = shareRole(request, getTunnelController().tunnel.snapshot());
  if (!role)
    return Response.json(
      { error: "This sharing session is no longer available." },
      { status: 403, headers },
    );
  // Require a custom header as well as a same-origin mutation (including multipart).
  if (request.headers.get("x-secure-share") !== "1")
    return Response.json(
      { error: "Invalid sharing request." },
      { status: 403, headers },
    );
  const type = request.headers.get("content-type") ?? "";
  const limit = type.startsWith("multipart/form-data")
    ? MAX_FILE_BYTES + 64 * 1024
    : MAX_TEXT_LENGTH * 6 + 1024;
  try {
    // Bound actual streamed bytes; Content-Length alone can be absent or incorrect.
    const reader = request.body?.getReader();
    if (!reader) throw new ShareError("Empty sharing request.");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ShareError(
          "Upload is too large. Files must be 25 MB or smaller.",
          413,
        );
      }
      chunks.push(value);
    }
    const body = new Response(new Blob(chunks), {
      headers: { "Content-Type": type },
    });
    let value: string | File;
    if (type.startsWith("multipart/form-data")) {
      const form = await body.formData();
      const files = form.getAll("file");
      if (files.length !== 1 || !(files[0] instanceof File))
        throw new ShareError("Choose one file per upload.");
      value = files[0];
    } else if (type.split(";")[0] === "application/json") {
      const data = await body.json();
      if (typeof data?.text !== "string")
        throw new ShareError("Enter text to share.");
      value = data.text;
    } else throw new ShareError("Expected text or a file.", 415);
    const store = getShareStore();
    await store.add(role, value);
    return Response.json(await store.snapshot(role), { status: 201, headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ShareError
            ? error.message
            : "Could not read this upload.",
      },
      { status: error instanceof ShareError ? error.status : 400, headers },
    );
  }
}

export async function DELETE(request: Request) {
  const role = shareRole(request, getTunnelController().tunnel.snapshot());
  if (!role || request.headers.get("x-secure-share") !== "1")
    return Response.json(
      { error: "This sharing session is no longer available." },
      { status: 403, headers },
    );
  try {
    const store = getShareStore();
    await store.remove(new URL(request.url).searchParams.get("id") ?? "", role);
    return Response.json(await store.snapshot(role), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ShareError
            ? error.message
            : "Could not remove this item.",
      },
      { status: error instanceof ShareError ? error.status : 500, headers },
    );
  }
}
