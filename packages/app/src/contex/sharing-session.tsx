"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { stoppedTunnel, type TunnelState } from "@/lib/tunnel-state";

type SharingSession = {
  isHost: boolean | null;
  tunnel: TunnelState;
  tunnelError: string | null;
  checkingTunnel: boolean;
  canManageTunnel: boolean;
  updatingTunnel: boolean;
  startTunnel: () => Promise<void>;
  stopTunnel: () => Promise<void>;
};

const SharingSessionContext = createContext<SharingSession | null>(null);

export function SharingSessionProvider({ children }: { children: ReactNode }) {
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const [tunnel, setTunnel] = useState<TunnelState>(stoppedTunnel);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [checkingTunnel, setCheckingTunnel] = useState(true);
  const [canManageTunnel, setCanManageTunnel] = useState(false);
  const [updatingTunnel, setUpdatingTunnel] = useState(false);
  const mutating = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    // Recipient browsers use the content API, never localhost-only controls.
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      window.location.hostname,
    );
    setIsHost(local);
    if (!local) {
      setCheckingTunnel(false);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      if (mutating.current) {
        timer = setTimeout(refresh, 1000);
        return;
      }
      const version = ++requestVersion.current;
      let keepPolling = true;
      try {
        const response = await fetch("/api/tunnel", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted || version !== requestVersion.current)
          return;
        if (!response.ok) {
          setPollError(data.error ?? "Could not check the tunnel.");
          setCanManageTunnel(false);
          keepPolling = response.status !== 403;
        } else {
          setTunnel((current) =>
            current.status === data.status &&
            current.url === data.url &&
            current.error === data.error
              ? current
              : data,
          );
          setCanManageTunnel(true);
          setPollError(null);
        }
      } catch {
        if (!controller.signal.aborted && version === requestVersion.current) {
          setPollError("Could not reach the local app. Reconnecting…");
          setCanManageTunnel(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingTunnel(false);
          if (keepPolling) timer = setTimeout(refresh, 2000);
        }
      }
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  async function updateTunnel(method: "POST" | "DELETE") {
    if (mutating.current) return;
    mutating.current = true;
    ++requestVersion.current;
    setUpdatingTunnel(true);
    setTunnelError(null);
    try {
      const response = await fetch("/api/tunnel", {
        method,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not update the tunnel.");
      setTunnel(data);
    } catch (error) {
      setTunnelError(
        error instanceof Error
          ? error.message
          : "Could not reach the local app.",
      );
    } finally {
      mutating.current = false;
      setUpdatingTunnel(false);
    }
  }

  return (
    <SharingSessionContext
      value={{
        isHost,
        tunnel,
        tunnelError: tunnelError ?? pollError,
        checkingTunnel,
        canManageTunnel,
        updatingTunnel,
        startTunnel: () => updateTunnel("POST"),
        stopTunnel: () => updateTunnel("DELETE"),
      }}
    >
      {children}
    </SharingSessionContext>
  );
}

export function useSharingSession() {
  const session = useContext(SharingSessionContext);
  if (!session) {
    throw new Error("useSharingSession requires a SharingSessionProvider");
  }
  return session;
}
