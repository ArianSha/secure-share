export async function shareRequest(path: string, init: RequestInit = {}) {
  const timeout = AbortSignal.timeout(
    init.method && init.method !== "GET" ? 120_000 : 15_000,
  );
  const response = await fetch(path, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    headers: { ...init.headers, "X-Secure-Share": "1" },
  });
  if (response.status >= 500 || response.status === 429) {
    throw new Error("Sharing is temporarily unavailable. Please try again.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "This sharing link is unavailable. Check your connection and try again.",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Could not update the workspace.");
  return data;
}
