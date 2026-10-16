import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { PlugZap, Inbox } from "lucide-react";
import type { Download, DownloadState } from "@deliverator/shared";
import { buttonClass, Button } from "@/components/ui/Button";
import { useLiveState } from "@/lib/state";
import { useDownloadActions, type DownloadAction } from "@/lib/actions";
import { usePreferences } from "@/lib/prefs";
import { useToast } from "@/lib/toast";
import { StatTiles } from "@/components/downloads/StatTiles";
import { ProviderCards } from "@/components/downloads/ProviderCards";
import { FilterBar, STATUS_FILTERS, type StatusFilter } from "@/components/downloads/FilterBar";
import { DownloadTable, type Sort } from "@/components/downloads/DownloadTable";
import { DownloadCards } from "@/components/downloads/DownloadCards";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { cn } from "@/lib/cn";

const STATE_ORDER: DownloadState[] = ["downloading", "repairing", "extracting", "checking", "queued", "paused", "failed", "seeding", "completed"];

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

function sortDownloads(list: Download[], sort: Sort): Download[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const cmp: Record<Sort["key"], (a: Download, b: Download) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
    progress: (a, b) => a.progress - b.progress,
    size: (a, b) => a.size - b.size,
    speed: (a, b) => a.downloadSpeed + a.uploadSpeed - (b.downloadSpeed + b.uploadSpeed),
    eta: (a, b) => (a.eta ?? Infinity) - (b.eta ?? Infinity),
    added: (a, b) => (a.addedAt ?? a.completedAt ?? 0) - (b.addedAt ?? b.completedAt ?? 0),
  };
  return [...list].sort((a, b) => {
    const byState = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
    if (sort.key === "added" && byState !== 0) return byState;
    const r = cmp[sort.key](a, b) * dir;
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });
}

export function DownloadsPage() {
  const { snapshot, loaded } = useLiveState();
  const { prefs } = usePreferences();
  const { run } = useDownloadActions();
  const toast = useToast();
  const now = useNow();
  const narrow = useMediaQuery("(max-width: 760px)");

  const [status, setStatus] = useState<StatusFilter>("all");
  const [providerIds, setProviderIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "added", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);

  const providerMap = useMemo(() => new Map(snapshot.providers.map((p) => [p.id, p])), [snapshot.providers]);
  const enabledProviders = snapshot.providers.filter((p) => p.enabled);

  const visible = useMemo(() => {
    const matchStatus = STATUS_FILTERS.find((f) => f.id === status)?.match ?? (() => true);
    const q = search.trim().toLowerCase();
    return sortDownloads(
      snapshot.downloads.filter((d) => matchStatus(d) && (providerIds.size === 0 || providerIds.has(d.providerId)) && (!q || d.name.toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q))),
      sort,
    );
  }, [snapshot.downloads, status, providerIds, search, sort]);

  // Drop selections for downloads that disappeared.
  useEffect(() => {
    const ids = new Set(snapshot.downloads.map((d) => d.id));
    if ([...selected].some((id) => !ids.has(id))) setSelected(new Set([...selected].filter((id) => ids.has(id))));
    if (expanded && !ids.has(expanded)) setExpanded(null);
  }, [snapshot.downloads, selected, expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(new Set());
        setExpanded(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totals = snapshot.statuses.reduce((acc, s) => ({ down: acc.down + (s.connected ? s.downloadSpeed : 0), up: acc.up + (s.connected ? s.uploadSpeed : 0) }), { down: 0, up: 0 });

  const act = (ids: string[], action: DownloadAction, extra?: { category?: string }) => {
    if (action === "delete") {
      if (prefs.confirmDelete) return setConfirm({ ids });
      return void run.mutateAsync({ ids, action, deleteFiles: prefs.deleteFilesByDefault }).then(() => setSelected(new Set()));
    }
    void run.mutateAsync({ ids, action, category: extra?.category }).then(() => {
      if (ids.length > 1) toast.ok(`${action === "top" ? "Moved" : action === "bottom" ? "Moved" : action === "pause" ? "Paused" : action === "resume" ? "Resumed" : "Done"} ${ids.length} downloads`);
    });
  };

  const selectedCanDeleteFiles = confirm ? confirm.ids.some((id) => providerMap.get(snapshot.downloads.find((d) => d.id === id)?.providerId ?? "")?.capabilities.deleteFiles) : false;

  if (loaded && snapshot.providers.length === 0) {
    return (
      <div className="mx-auto grid max-w-[520px] justify-items-center gap-3 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-xl border border-line bg-panel text-muted">
          <PlugZap className="size-6" />
        </span>
        <h2 className="text-[17px] font-extrabold">No providers yet</h2>
        <p className="text-muted">Connect a qBittorrent or SABnzbd instance and your downloads will show up here as one list.</p>
        <Link to="/settings/providers" className={buttonClass({ variant: "primary" })}>
          Add a provider
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <StatTiles downloads={snapshot.downloads} totalDown={totals.down} totalUp={totals.up} />
      <ProviderCards providers={snapshot.providers} statuses={snapshot.statuses} downloads={snapshot.downloads} />
      <FilterBar downloads={snapshot.downloads} providers={enabledProviders} status={status} onStatus={setStatus} providerIds={providerIds} onProviderIds={setProviderIds} search={search} onSearch={setSearch} />

      {narrow ? (
        visible.length === 0 ? (
          <EmptyList filtered={snapshot.downloads.length > 0} />
        ) : (
          <DownloadCards downloads={visible} providers={providerMap} expanded={expanded} onExpanded={setExpanded} onAction={act} now={now} />
        )
      ) : (
        <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-panel">
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent/10 px-3.5 py-2 text-[12.5px]">
              <b className="text-accent">{selected.size} selected</b>
              <Button size="sm" variant="ghost" onClick={() => act([...selected], "pause")}>
                Pause
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act([...selected], "resume")}>
                Resume
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act([...selected], "top")}>
                Move to top
              </Button>
              <Button size="sm" variant="danger" onClick={() => act([...selected], "delete")}>
                Delete…
              </Button>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <EmptyList filtered={snapshot.downloads.length > 0} />
          ) : (
            <DownloadTable downloads={visible} providers={providerMap} selected={selected} onSelected={setSelected} expanded={expanded} onExpanded={setExpanded} sort={sort} onSort={setSort} onAction={act} now={now} />
          )}
          <div className="flex flex-wrap items-center gap-3.5 border-t border-line px-3.5 py-2 text-[12px] text-muted">
            <span>
              Showing <span className="font-mono tnum">{visible.length}</span> of <span className="font-mono tnum">{snapshot.downloads.length}</span>
            </span>
            <Freshness generatedAt={snapshot.generatedAt} now={now} />
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => act(snapshot.downloads.filter((d) => d.state === "downloading" || d.state === "queued").map((d) => d.id), "pause")}>
                Pause all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(snapshot.downloads.filter((d) => d.state === "paused").map((d) => d.id), "resume")}>
                Resume all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(snapshot.downloads.filter((d) => d.state === "completed").map((d) => d.id), "delete")}>
                Clear completed
              </Button>
            </span>
          </div>
        </section>
      )}

      <ConfirmDeleteDialog
        open={confirm !== null}
        count={confirm?.ids.length ?? 0}
        canDeleteFiles={selectedCanDeleteFiles}
        defaultDeleteFiles={prefs.deleteFilesByDefault}
        onCancel={() => setConfirm(null)}
        onConfirm={(deleteFiles) => {
          const ids = confirm?.ids ?? [];
          setConfirm(null);
          void run.mutateAsync({ ids, action: "delete", deleteFiles }).then(() => {
            setSelected(new Set());
            toast.ok(ids.length === 1 ? "Download deleted" : `${ids.length} downloads deleted`);
          });
        }}
      />
    </div>
  );
}

function EmptyList({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid justify-items-center gap-2 px-4 py-14 text-center text-muted">
      <Inbox className="size-6" />
      <p className="text-[13px]">{filtered ? "Nothing matches these filters." : "No downloads yet. Use Add to get started."}</p>
    </div>
  );
}

function Freshness({ generatedAt, now }: { generatedAt: number; now: number }) {
  const { live } = useLiveState();
  const age = Math.max(0, Math.round((now - generatedAt) / 1000));
  return (
    <span className={cn("font-mono tnum", age > 15 && "text-warn")} title={live ? "Live updates connected" : "Polling"}>
      {generatedAt === 0 ? "—" : age < 5 ? "live" : `updated ${age}s ago`}
    </span>
  );
}
