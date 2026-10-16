import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileUp } from "lucide-react";
import { detectFileKind, detectLinkKind, type AddDownloadResult, type ProviderSummary } from "@deliverator/shared";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Field, NativeSelect, Textarea } from "./ui/Input";
import { Switch } from "./ui/Switch";
import { Alert } from "./ui/Alert";
import { useDownloadActions } from "@/lib/actions";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/cn";

const AUTO = "__auto__";

export function AddDownloadDialog({ open, onOpenChange, providers }: { open: boolean; onOpenChange: (o: boolean) => void; providers: ProviderSummary[] }) {
  const { add } = useDownloadActions();
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [providerId, setProviderId] = useState(AUTO);
  const [category, setCategory] = useState("");
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<AddDownloadResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setFiles([]);
    setProviderId(AUTO);
    setCategory("");
    setPaused(false);
    setResult(null);
    // Pre-fill from the clipboard when it holds a magnet / nzb link (best effort).
    navigator.clipboard?.readText?.().then((clip) => {
      if (clip && detectLinkKind(clip.trim()) !== "unknown" && clip.length < 4000) setText(clip.trim());
    }).catch(() => undefined);
  }, [open]);

  const enabled = providers.filter((p) => p.enabled);
  const urls = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [text],
  );

  /** Mirror of the server's routing so the dialog can say where each item will go. */
  const routing = useMemo(() => {
    const items = [...urls.map((u) => ({ label: u, kind: detectLinkKind(u) })), ...files.map((f) => ({ label: f.name, kind: detectFileKind(f.name) }))];
    const counts = new Map<string, number>();
    let unknown = 0;
    for (const it of items) {
      let target: ProviderSummary | undefined;
      if (providerId !== AUTO) target = enabled.find((p) => p.id === providerId);
      else {
        const c = enabled.filter((p) => (it.kind === "torrent" ? p.capabilities.torrents : it.kind === "nzb" ? p.capabilities.nzbs : true));
        target = c.length === 1 || (c.length > 1 && it.kind !== "unknown") ? c[0] : undefined;
      }
      if (target) counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
      else unknown++;
    }
    return { counts, unknown, total: items.length };
  }, [urls, files, providerId, enabled]);

  const targetProvider = providerId === AUTO ? (routing.counts.size === 1 ? enabled.find((p) => p.id === [...routing.counts.keys()][0]) : undefined) : enabled.find((p) => p.id === providerId);
  const categories = targetProvider ? targetProvider.categories : [...new Set(enabled.flatMap((p) => p.categories))].sort();

  async function submit() {
    setResult(null);
    try {
      const r = await add.mutateAsync({ urls, files, providerId: providerId === AUTO ? undefined : providerId, category: category || undefined, paused });
      if (r.failed.length === 0) {
        toast.ok(r.added.length === 1 ? "Download added" : `${r.added.length} downloads added`);
        onOpenChange(false);
      } else {
        setResult(r);
        if (r.added.length > 0) {
          setText(r.failed.map((f) => f.url).filter((u) => urls.includes(u)).join("\n"));
          setFiles((fs) => fs.filter((f) => r.failed.some((x) => x.url === f.name)));
        }
      }
    } catch (err) {
      setResult({ added: [], failed: [{ url: "", reason: err instanceof Error ? err.message : "Could not add" }] });
    }
  }

  const onFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const accepted = [...list].filter((f) => detectFileKind(f.name) !== "unknown");
    const rejected = [...list].length - accepted.length;
    if (rejected > 0) toast.error(rejected === 1 ? "Only .torrent and .nzb files can be added" : `${rejected} files skipped: only .torrent and .nzb files can be added`);
    setFiles((fs) => [...fs, ...accepted]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add download">
      {enabled.length === 0 ? <Alert kind="warn">Add a provider in Settings first.</Alert> : null}
      <Field label="Links" htmlFor="add-links">
        <Textarea
          id="add-links"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste magnet links, .torrent URLs or .nzb URLs, one per line"
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
          }}
        />
      </Field>
      <div
        className={cn("rounded-[10px] border border-dashed px-3 py-3 text-center text-[12.5px] text-muted", dragging ? "border-accent bg-accent/10 text-fg" : "border-line bg-panel-2")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <input ref={fileInput} id="add-files" type="file" multiple accept=".torrent,.nzb,.nzb.gz" className="hidden" onChange={(e) => onFiles(e.target.files)} />
        {files.length > 0 ? (
          <ul className="grid gap-1 text-left">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 font-mono text-[12px] text-fg">
                <FileUp className="size-3.5 shrink-0 text-muted" />
                <span className="truncate">{f.name}</span>
                <button className="ml-auto text-muted hover:text-bad" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>
                  remove
                </button>
              </li>
            ))}
            <li>
              <button className="text-muted underline-offset-2 hover:underline" onClick={() => fileInput.current?.click()}>
                add more files
              </button>
            </li>
          </ul>
        ) : (
          <span>
            or drop <b className="text-fg">.torrent</b> / <b className="text-fg">.nzb</b> files here ·{" "}
            <button className="underline underline-offset-2 hover:text-fg" onClick={() => fileInput.current?.click()}>
              browse
            </button>
          </span>
        )}
      </div>
      {routing.total > 0 ? (
        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-2 text-[12.5px]", routing.unknown > 0 ? "border-warn/40 bg-warn/10 text-fg" : "border-ok/30 bg-ok/10 text-muted")}>
          <Check className={cn("size-3.5", routing.unknown > 0 ? "text-warn" : "text-ok")} />
          {[...routing.counts].map(([id, n]) => {
            const p = enabled.find((x) => x.id === id);
            return (
              <span key={id}>
                {n} → <b className="text-fg">{p?.name ?? id}</b>
              </span>
            );
          })}
          {routing.unknown > 0 ? <span>{routing.unknown} unclear: pick a provider below</span> : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Send to" htmlFor="add-provider">
          <NativeSelect id="add-provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value={AUTO}>Auto-detect by link type</option>
            {enabled.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Category" htmlFor="add-category">
          <NativeSelect id="add-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Default</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {result && result.failed.length > 0 ? (
        <Alert>
          {result.added.length > 0 ? <div className="mb-1 text-fg">{result.added.length} added. These failed:</div> : null}
          <ul className="grid gap-0.5">
            {result.failed.map((f, i) => (
              <li key={i} className="break-all">
                {f.url ? <span className="font-mono text-[12px]">{f.url.slice(0, 80)}</span> : null}
                {f.url ? " · " : ""}
                {f.reason}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <div className="flex items-center gap-2">
        <Switch id="add-paused" label="Start paused" checked={paused} onCheckedChange={setPaused} />
        <span className="flex-1" />
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" loading={add.isPending} disabled={routing.total === 0 || enabled.length === 0 || (routing.unknown > 0 && providerId === AUTO)} onClick={() => void submit()}>
          {routing.total <= 1 ? "Add download" : `Add ${routing.total} downloads`}
        </Button>
      </div>
    </Dialog>
  );
}
