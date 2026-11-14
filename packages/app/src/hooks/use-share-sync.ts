"use client";

import { useAll, useSyncStatus } from "jazz-tools/react";
import { useRef, useState } from "react";
import { useSharingSession } from "@/contex/sharing-session";
import { sharedItemsQuery } from "@/lib/jazz/schema";
import { shareRequest } from "@/lib/share-client";
import { type ShareSnapshot, toSharedItem } from "@/lib/share-state";

export function useShareSync() {
  const { data, error: queryError } = useAll(sharedItemsQuery);
  const { link } = useSyncStatus();
  const { isHost } = useSharingSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mutating = useRef(false);
  const connected = link.state === "connected";
  const snapshot: ShareSnapshot | null =
    data && isHost !== null
      ? { role: isHost ? "host" : "recipient", items: data.map(toSharedItem) }
      : null;

  async function mutate(path: string, init: RequestInit): Promise<boolean> {
    if (mutating.current || !connected) return false;
    mutating.current = true;
    setPending(true);
    setError(null);
    try {
      await shareRequest(path, init);
      // Jazz's live query delivers the committed changes to every browser.
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not share. Please try again.",
      );
      return false;
    } finally {
      mutating.current = false;
      setPending(false);
    }
  }

  async function shareText(text: string) {
    return mutate("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  async function shareFiles(files: File[]) {
    let count = 0;
    for (const file of files) {
      const body = new FormData();
      body.set("file", file);
      if (!(await mutate("/api/share", { method: "POST", body }))) break;
      count++;
    }
    return count;
  }

  async function removeItem(id: string) {
    return mutate(`/api/share?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  return {
    snapshot,
    pending,
    connected,
    error:
      error ??
      queryError?.message ??
      (link.state === "offline"
        ? "Connection lost. Jazz is reconnecting…"
        : null),
    shareText,
    shareFiles,
    removeItem,
  };
}
