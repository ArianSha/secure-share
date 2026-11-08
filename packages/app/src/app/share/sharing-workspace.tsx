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
  MailIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
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
import { useSharingSession } from "@/contex/sharing-session";
import { cn } from "@/lib/utils";

type SharedItem = {
  id: string;
  createdAt: string;
} & ({ type: "text"; text: string } | { type: "file"; file: File });

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

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
}: {
  item: SharedItem;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const title = item.type === "text" ? item.text : item.file.name;
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
    <li className="min-w-0 border-b border-border px-[9px] py-3 animate-in fade-in-0 slide-in-from-bottom-1.5 animation-duration-[220ms] ease-out fill-mode-both motion-reduce:animate-none">
      <div className="flex min-w-0 items-center gap-[9px]">
        <span className="grid h-[34px] w-[30px] shrink-0 place-items-center rounded-[7px] border border-border bg-background text-primary [&>svg]:size-[15px] [&>svg]:shrink-0">
          <Icon aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium" title={title}>
            {title}
          </p>
          <p className="mt-1 flex flex-wrap gap-[5px] text-[10px] text-muted-foreground">
            {item.type === "text" ? "Raw text" : formatFileSize(item.file.size)}
            <span aria-hidden="true">·</span>
            {item.createdAt}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.type === "text" ? "text" : item.file.name}`}
          onClick={() => onRemove(item.id)}
        >
          <XIcon data-icon="inline-start" />
        </Button>
      </div>
      {item.type === "text" ? (
        <>
          {expanded ? (
            <pre className="mt-3 max-h-60 overflow-auto rounded-[7px] bg-background p-2.5 font-mono text-[11px]/[1.7] whitespace-pre-wrap wrap-anywhere">
              {item.text}
            </pre>
          ) : null}
          <div className="mt-[9px] flex justify-end gap-1">
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
            <p className="mt-2 text-[11px] text-destructive" role="alert">
              Couldn’t copy. Open the text to select it manually.
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-[9px] flex justify-end gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => downloadFile(item.file)}
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
}: {
  side: "left" | "right";
  items: SharedItem[];
  onRemove: (id: string) => void;
}) {
  const outgoing = side === "left";
  const title = outgoing ? "You shared" : "They shared";
  const DirectionIcon = outgoing ? ArrowUpRightIcon : ArrowDownLeftIcon;

  return (
    <Sidebar
      side={side}
      collapsible="none"
      className={cn(
        "h-auto min-h-[280px] w-auto min-w-0 border-t border-border animate-in fade-in-0 slide-in-from-bottom-1.5 animation-duration-[450ms] ease-out fill-mode-both motion-reduce:animate-none min-[540px]:min-h-[300px] min-[960px]:min-h-0 min-[960px]:border-t-0",
        outgoing ? "min-[540px]:border-r" : "min-[960px]:border-l",
      )}
      data-position={side}
      role="complementary"
      aria-label={title}
    >
      <SidebarHeader className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-[9px] text-[14px] font-[550] tracking-[-0.2px] [&>svg]:size-4 [&>svg]:text-muted-foreground">
            <DirectionIcon aria-hidden="true" />
            {title}
          </h2>
          <Badge
            variant="secondary"
            aria-label={`${items.length} shared items`}
          >
            {items.length}
          </Badge>
        </div>
        <p className="text-[11px]/[1.6] text-muted-foreground">
          {outgoing
            ? "Everything you send, in one place."
            : "Everything coming your way."}
        </p>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="p-3">
        {items.length ? (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <SharedItemRow key={item.id} item={item} onRemove={onRemove} />
            ))}
          </ul>
        ) : (
          <Empty className="mt-0 flex-none px-4 py-6 min-[960px]:mt-18">
            <EmptyHeader>
              <EmptyMedia variant="history">
                {outgoing ? <SendIcon /> : <InboxIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {outgoing ? "Nothing shared yet" : "Nothing received yet"}
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

function TextComposer({ onShare }: { onShare: (text: string) => void }) {
  const [text, setText] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    onShare(text);
    setText("");
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="shared-text">
            <AlignLeftIcon aria-hidden="true" />
            Text
          </FieldLabel>
          <InputGroup className="mt-1 overflow-hidden">
            <InputGroupTextarea
              id="shared-text"
              placeholder="Type or paste something to share…"
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
              className="min-h-36 max-h-72 px-4 pt-4"
              aria-describedby="text-hint"
            />
            <InputGroupAddon
              align="block-end"
              className="justify-between px-3 pb-3"
            >
              <span
                id="text-hint"
                className="max-w-[146px] text-[10px] font-normal min-[540px]:max-w-none min-[540px]:text-[11px] min-[960px]:max-w-[140px] min-[1200px]:max-w-none"
              >
                Plain text, just as you wrote it.
              </span>
              <Button type="submit" disabled={!text.trim()}>
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

function FileComposer({ onShare }: { onShare: (files: File[]) => void }) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  function addFiles(incoming: FileList | File[]) {
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

  function shareFiles() {
    if (!files.length) return;
    onShare(files.map(({ file }) => file));
    setFiles([]);
  }

  return (
    <section aria-labelledby="files-label">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2
          id="files-label"
          className="flex items-center gap-2 text-[14px] font-medium [&>svg]:size-4 [&>svg]:text-muted-foreground"
        >
          <FilesIcon aria-hidden="true" />
          Files
        </h2>
        <span className="text-[11px] text-muted-foreground">Any file type</span>
      </div>
      <section
        className="group/dropzone rounded-lg border border-dashed border-input hover:border-primary hover:bg-accent data-[dragging=true]:border-primary data-[dragging=true]:bg-accent motion-safe:transition-colors motion-safe:duration-[180ms]"
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
        <Empty className="min-h-[232px] px-5 py-7 min-[540px]:min-h-[246px]">
          <EmptyHeader>
            <EmptyMedia
              variant="upload"
              className="motion-safe:transition-transform motion-safe:duration-[180ms] motion-safe:group-hover/dropzone:-translate-y-[3px] motion-safe:group-data-[dragging=true]/dropzone:-translate-y-[3px]"
            >
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
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <PlusIcon data-icon="inline-start" />
              Choose files
            </Button>
          </EmptyContent>
        </Empty>
      </section>
      <input
        ref={inputRef}
        type="file"
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
        <div className="mt-3.5 flex flex-col gap-3.5">
          <ul
            className="flex max-h-52 flex-col gap-1 overflow-y-auto"
            aria-label="Files ready to share"
          >
            {files.map(({ id, file }) => (
              <li
                key={id}
                className="flex min-w-0 items-center gap-[9px] rounded-[7px] bg-muted px-[9px] py-[7px] text-[12px] [&>svg]:size-[15px] [&>svg]:shrink-0 [&>svg]:text-primary"
              >
                <FileIcon aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.name} from selection`}
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
            <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
              Clear selection
            </Button>
            <Button onClick={shareFiles}>
              Share {files.length === 1 ? "file" : `${files.length} files`}
              <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const noIncomingItems: SharedItem[] = [];

export function SharingWorkspace() {
  const { recipientEmail } = useSharingSession();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [announcement, setAnnouncement] = useState("");

  function shareText(text: string) {
    const item: SharedItem = {
      id: crypto.randomUUID(),
      type: "text",
      text,
      createdAt: timeFormatter.format(new Date()),
    };
    setItems((current) => [item, ...current]);
    setAnnouncement("Text added to You shared in this local preview.");
  }

  function shareFiles(files: File[]) {
    const createdAt = timeFormatter.format(new Date());
    const additions: SharedItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      type: "file",
      file,
      createdAt,
    }));
    setItems((current) => [...additions, ...current]);
    setAnnouncement(
      `${files.length} ${files.length === 1 ? "file" : "files"} added to You shared in this local preview.`,
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setAnnouncement("Item removed from your session history.");
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="grid min-h-[calc(100svh-56px)] grid-cols-1 min-[540px]:grid-cols-2 min-[960px]:grid-cols-[224px_minmax(0,1fr)_224px] min-[1200px]:grid-cols-[264px_minmax(0,1fr)_264px]">
        <SharingHistory side="left" items={items} onRemove={removeItem} />
        <main className="col-span-full row-start-1 flex min-w-0 flex-col px-[22px] pt-6 min-[540px]:px-8 min-[960px]:col-span-1 min-[960px]:col-start-2 min-[1200px]:px-12 min-[1200px]:pt-7">
          <div className="mx-auto w-full max-w-[560px] animate-in fade-in-0 slide-in-from-bottom-1.5 animation-duration-500 [animation-delay:70ms] ease-out fill-mode-both motion-reduce:animate-none">
            <div className="mb-7 flex flex-col items-start gap-3 min-[540px]:mb-[35px]">
              <span className="inline-flex items-center gap-[7px] text-[10px] font-[550] tracking-[1.4px] text-primary uppercase">
                <span
                  className="size-[5px] rounded-full bg-primary"
                  aria-hidden="true"
                />
                Your workspace
              </span>
              <h1 className="text-[29px]/[1.2] font-[550] tracking-[-1.3px] min-[540px]:text-[clamp(27px,2.5vw,34px)]">
                Share text &amp; files
              </h1>
              <p className="text-[13px]/[1.6] text-muted-foreground">
                A message, a document, or a little of both.
              </p>
            </div>
            <div className="mb-6 flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-[12px] [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
                <MailIcon aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Recipient</p>
                  <p className="truncate" title={recipientEmail ?? undefined}>
                    {recipientEmail ?? "No email added"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/" />}
                nativeButton={false}
              >
                {recipientEmail ? "Change" : "Add email"}
              </Button>
            </div>
            <TextComposer onShare={shareText} />
            <div className="my-6 flex items-center gap-3.5 text-[11px] text-muted-foreground">
              <Separator className="w-auto flex-1" />
              <span>or</span>
              <Separator className="w-auto flex-1" />
            </div>
            <FileComposer onShare={shareFiles} />
          </div>
          <footer className="mt-auto pt-[30px] pb-[22px] text-center text-[10px] text-muted-foreground min-[540px]:pt-8 min-[960px]:pt-12">
            Session history clears when you refresh.
          </footer>
        </main>
        <SharingHistory
          side="right"
          items={noIncomingItems}
          onRemove={removeItem}
        />
      </SidebarProvider>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </TooltipProvider>
  );
}
