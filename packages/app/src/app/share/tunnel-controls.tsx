"use client";

import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  LoaderCircleIcon,
  SquareIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSharingSession } from "@/contex/sharing-session";

const statusLabels = {
  stopped: "Offline",
  starting: "Connecting",
  running: "Live",
  stopping: "Stopping",
  error: "Offline",
};

export function TunnelControls() {
  const {
    tunnel,
    tunnelError,
    checkingTunnel,
    canManageTunnel,
    updatingTunnel,
    startTunnel,
    stopTunnel,
  } = useSharingSession();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const shareUrl = tunnel.url ? `${tunnel.url}/share` : null;
  const active =
    tunnel.status === "starting" ||
    tunnel.status === "running" ||
    tunnel.status === "stopping";
  const stopping = tunnel.status === "stopping";
  const error = tunnelError ?? tunnel.error ?? copyError;

  if (!checkingTunnel && !canManageTunnel) return null;

  async function copyUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(shareUrl);
      setCopyError(null);
    } catch {
      setCopyError(
        "Could not copy the link. Select the URL and copy it manually.",
      );
    }
  }

  return (
    <section aria-label="Sharing link" className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Anyone with the link can join.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant={active ? "outline" : "default"}
                  disabled={
                    checkingTunnel ||
                    !canManageTunnel ||
                    updatingTunnel ||
                    stopping
                  }
                  focusableWhenDisabled
                  onClick={() => void (active ? stopTunnel() : startTunnel())}
                />
              }
            >
              {updatingTunnel || stopping ? (
                <LoaderCircleIcon
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                />
              ) : active ? (
                <SquareIcon data-icon="inline-start" />
              ) : (
                <LinkIcon data-icon="inline-start" />
              )}
              {stopping
                ? "Stopping…"
                : updatingTunnel && !active
                  ? "Starting…"
                  : active
                    ? "Stop tunnel"
                    : "Start tunnel"}
            </TooltipTrigger>
            <TooltipContent align="end" className="max-w-72">
              Create a public link to this workspace. It stays available while
              this app and the tunnel are running.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {shareUrl ? (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tunnel-url" className="sr-only">
              Sharing URL
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="tunnel-url"
                value={shareUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Copy sharing link"
                  onClick={() => void copyUrl()}
                >
                  {copiedUrl === shareUrl ? <CheckIcon /> : <CopyIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      ) : null}
      {error ? <FieldError role="alert">{error}</FieldError> : null}
      <span role="status" className="sr-only">
        {copiedUrl === shareUrl && shareUrl
          ? "Sharing link copied."
          : statusLabels[tunnel.status]}
      </span>
    </section>
  );
}
