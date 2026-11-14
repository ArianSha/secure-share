"use client";

import {
  AlignLeftIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FilesIcon,
  InboxIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { type DragEvent, type FormEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useShareSync } from "@/hooks/use-share-sync";
import { MAX_FILE_BYTES, type SharedItem } from "@/lib/share-state";
import { cn } from "@/lib/utils";
import { TunnelControls } from "./tunnel-controls";

type PendingFile = { id: string; file: File };

const timeFormatter = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readEntryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    return [file];
  }

  if (!entry.isDirectory) return [];

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const entries: FileSystemEntry[] = [];
  // Directory readers may return only one batch at a time.
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    entries.push(...batch);
  }

  return (await Promise.all(entries.map(readEntryFiles))).flat();
}

async function readDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items).filter(
    (item) => item.kind === "file",
  );
  if (items.length === 0) return Array.from(dataTransfer.files);

  // Capture entries and fallback files before the drop event finishes.
  const files = items.map((item) => {
    const entry = item.webkitGetAsEntry?.();
    if (entry) return readEntryFiles(entry);
    const file = item.getAsFile();
    return Promise.resolve(file ? [file] : []);
  });
  return (await Promise.all(files)).flat();
}

function SharedItemRow({
  item,
  onRemove,
  disabled,
}: {
  item: SharedItem;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const title = item.type === "text" ? item.text : item.name;
  const Icon = item.type === "text" ? AlignLeftIcon : FileIcon;

  async function copyText() {
    if (item.type !== "text") return;
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <li className="min-w-0 border-b px-2 py-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={title}>
            {title}
          </p>
          <p className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
            {item.type === "text" ? "Raw text" : formatFileSize(item.size)}
            <span aria-hidden="true">·</span>
            {timeFormatter.format(new Date(item.createdAt))}
          </p>
        </div>
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${item.type === "text" ? "text" : item.name}`}
            onClick={() => onRemove(item.id)}
          >
            <XIcon data-icon="inline-start" />
          </Button>
        ) : null}
      </div>
      {item.type === "text" ? (
        <>
          {expanded ? (
            <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-background p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere">
              {item.text}
            </pre>
          ) : null}
          <div className="mt-2 flex justify-end gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide text" : "View text"}
            </Button>
            <Button variant="ghost" size="xs" onClick={copyText}>
              {copied ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {copyError ? (
            <p className="mt-2 text-xs text-destructive" role="alert">
              Couldn’t copy. Open the text to select it manually.
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-2 flex justify-end gap-1">
          <Button
            variant="ghost"
            size="xs"
            render={
              <a
                href={`/api/share?file=${encodeURIComponent(item.id)}`}
                download={item.name}
              />
            }
            nativeButton={false}
          >
            <DownloadIcon data-icon="inline-start" />
            Download
          </Button>
        </div>
      )}
    </li>
  );
}

function SharingHistory({
  side,
  items,
  onRemove,
  disabled,
  loading,
}: {
  side: "left" | "right";
  items: SharedItem[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const outgoing = side === "left";
  const title = outgoing ? "You shared" : "They shared";
  const DirectionIcon = outgoing ? ArrowUpRightIcon : ArrowDownLeftIcon;

  return (
    <Sidebar
      side={side}
      collapsible="none"
      className={cn(
        "h-auto min-h-70 w-auto min-w-0 border-t sm:min-h-75 lg:min-h-0 lg:border-t-0",
        outgoing ? "sm:border-r" : "lg:border-l",
      )}
      data-position={side}
      role="complementary"
      aria-label={title}
    >
      <SidebarHeader className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2">
            <DirectionIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            {title}
          </h2>
          <Badge
            variant="secondary"
            aria-label={`${items.length} shared items`}
          >
            {items.length}
          </Badge>
        </div>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="p-3">
        {items.length ? (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <SharedItemRow
                key={item.id}
                item={item}
                onRemove={onRemove}
                disabled={disabled}
              />
            ))}
          </ul>
        ) : (
          <Empty className="flex-none px-4 lg:mt-18">
            <EmptyHeader>
              <EmptyMedia variant="history">
                {outgoing ? <SendIcon /> : <InboxIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {loading
                  ? "Loading shared items…"
                  : outgoing
                    ? "Nothing shared yet"
                    : "Nothing received yet"}
              </EmptyTitle>
              <EmptyDescription>
                {outgoing
                  ? "Text and files you share will appear here."
                  : "Text and files from the other person will appear here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

function TextComposer({
  onShare,
  disabled,
}: {
  onShare: (text: string) => Promise<boolean>;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    if (await onShare(text)) setText("");
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="shared-text">
            <AlignLeftIcon aria-hidden="true" />
            Text
          </FieldLabel>
          <InputGroup>
            <InputGroupTextarea
              id="shared-text"
              placeholder="Type or paste something to share…"
              disabled={disabled}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="min-h-36 max-h-72"
              aria-describedby="text-hint"
            />
            <InputGroupAddon
              align="block-end"
              className="flex-wrap justify-between"
            >
              <span id="text-hint" className="text-xs font-normal">
                Plain text, just as you wrote it.
              </span>
              <Button type="submit" disabled={disabled || !text.trim()}>
                Send text
                <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
    </form>
  );
}

function FileComposer({
  onShare,
  disabled,
}: {
  onShare: (files: File[]) => Promise<number>;
  disabled: boolean;
}) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  function addFiles(incoming: FileList | File[]) {
    if (disabled) return;
    if (Array.from(incoming).some((file) => file.size > MAX_FILE_BYTES)) {
      setFileError("Files must be 25 MB or smaller.");
      return;
    }
    const additions = Array.from(incoming, (file) => ({
      id: crypto.randomUUID(),
      file,
    }));
    setFiles((current) => [...current, ...additions]);
    setFileError(null);
  }

  function onDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }

  async function shareFiles() {
    if (!files.length || disabled) return;
    const count = await onShare(files.map(({ file }) => file));
    const sent = new Set(files.slice(0, count).map(({ id }) => id));
    setFiles((current) => current.filter(({ id }) => !sent.has(id)));
  }

  return (
    <section aria-labelledby="files-label">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="files-label" className="flex items-center gap-2">
          <FilesIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Files
        </h2>
        <span className="text-xs text-muted-foreground">
          Up to 25 MB per file
        </span>
      </div>
      <section
        className="rounded-lg border border-dashed border-input hover:border-primary hover:bg-accent data-[dragging=true]:border-primary data-[dragging=true]:bg-accent motion-safe:transition-colors"
        data-dragging={isDragging}
        aria-label="File drop area"
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          try {
            addFiles(await readDroppedFiles(event.dataTransfer));
          } catch {
            setFileError(
              "Couldn’t read the dropped items. Try choosing files instead.",
            );
          }
        }}
      >
        <Empty className="min-h-60">
          <EmptyHeader>
            <EmptyMedia variant="upload">
              <UploadIcon />
            </EmptyMedia>
            <EmptyTitle>
              {isDragging
                ? "Drop to add your files"
                : "Drop files or folders here"}
            </EmptyTitle>
            <EmptyDescription>Or choose them from your device</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <PlusIcon data-icon="inline-start" />
              Choose files
            </Button>
          </EmptyContent>
        </Empty>
      </section>
      <input
        ref={inputRef}
        type="file"
        disabled={disabled}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose files to share"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <FieldError>{fileError}</FieldError>
      {files.length ? (
        <div className="mt-4 flex flex-col gap-4">
          <ul
            className="flex max-h-52 flex-col gap-1 overflow-y-auto"
            aria-label="Files ready to share"
          >
            {files.map(({ id, file }) => (
              <li
                key={id}
                className="flex min-w-0 items-center gap-2 rounded-md bg-muted p-2"
              >
                <FileIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
                <span className="flex-1 truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.name} from selection`}
                  disabled={disabled}
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((item) => item.id !== id),
                    )
                  }
                >
                  <XIcon data-icon="inline-start" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => setFiles([])}
            >
              Clear selection
            </Button>
            <Button onClick={shareFiles} disabled={disabled}>
              Share {files.length === 1 ? "file" : `${files.length} files`}
              <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SharingWorkspace() {
  const {
    snapshot,
    pending,
    connected,
    error,
    shareText,
    shareFiles,
    removeItem,
  } = useShareSync();
  const outgoing =
    snapshot?.items.filter((item) => item.sender === snapshot.role) ?? [];
  const incoming =
    snapshot?.items.filter((item) => item.sender !== snapshot.role) ?? [];
  const disabled = pending || !snapshot || !connected;

  return (
    <TooltipProvider>
      <SidebarProvider className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[14rem_minmax(0,1fr)_14rem] xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        <SharingHistory
          side="left"
          items={outgoing}
          onRemove={(id) => void removeItem(id)}
          disabled={disabled}
          loading={!snapshot}
        />
        <div className="mx-auto w-full max-w-xl py-4">
          <h1 className="pb-4">Share text &amp; files</h1>
          <TunnelControls />
          <div
            className="flex items-center justify-between gap-3"
            role="status"
          ></div>
          {error ? <FieldError role="alert">{error}</FieldError> : null}
          <div className="py-10">
            <TextComposer onShare={shareText} disabled={disabled} />
            <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span>or</span>
              <Separator className="flex-1" />
            </div>
            <FileComposer onShare={shareFiles} disabled={disabled} />
          </div>
        </div>
        <SharingHistory side="right" items={incoming} loading={!snapshot} />
      </SidebarProvider>
    </TooltipProvider>
  );
}
