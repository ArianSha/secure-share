"use client";

import { JazzProvider } from "jazz-tools/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { TunnelControls } from "./tunnel-controls";

const config = { serverUrl: "/jazz", initial: "device" as const };

function ConnectionState({
  error,
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="pb-4">Share text &amp; files</h1>
      <TunnelControls />
      {error ? (
        <FieldError role="alert">{error}</FieldError>
      ) : (
        <p role="status">Connecting to your workspace…</p>
      )}
      {retry ? (
        <Button className="mt-4" variant="outline" onClick={retry}>
          Reconnect
        </Button>
      ) : null}
    </main>
  );
}

export function SharingDataProvider({ children }: { children: ReactNode }) {
  return (
    <JazzProvider
      config={config}
      loading={<ConnectionState />}
      signedOut={
        <ConnectionState error="This sharing link is no longer available." />
      }
      error={(state) => (
        <ConnectionState
          error={state.error?.message ?? "Could not connect to this workspace."}
          retry={() => void state.retry()}
        />
      )}
    >
      {children}
    </JazzProvider>
  );
}
