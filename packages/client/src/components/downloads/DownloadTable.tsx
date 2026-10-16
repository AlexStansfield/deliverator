import { Fragment } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import { formatBytes, formatEta, formatRelative, formatSpeed, type Download, type ProviderSummary } from "@deliverator/shared";
import { cn } from "@/lib/cn";
import type { DownloadAction } from "@/lib/actions";
import { ProgressBar, ProviderTag, StatusPill } from "./bits";
import { RowActions, availableActions } from "./RowActions";
import { DownloadDetails } from "./DownloadDetails";

export type SortKey = "name" | "progress" | "size" | "speed" | "eta" | "added";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

interface Props {
  downloads: Download[];
  providers: Map<string, ProviderSummary>;
  selected: Set<string>;
  onSelected: (s: Set<string>) => void;
  expanded: string | null;
  onExpanded: (id: string | null) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  onAction: (ids: string[], action: DownloadAction, extra?: { category?: string }) => void;
  now: number;
}

function progressLabel(d: Download): string {
  if (d.state === "queued") return d.usenet && d.usenet.queueIndex >= 0 ? `Queued · #${d.usenet.queueIndex + 1}` : "Queued";
  if (d.state === "repairing" || d.state === "extracting" || d.state === "checking") return d.usenet?.stage ?? (d.state === "checking" ? "Checking" : "Processing");
  return `${Math.floor(d.progress * 100)}%`;
}

function sizeLabel(d: Download): string {
  if (d.state === "seeding" && d.torrent) return `ratio ${d.torrent.ratio.toFixed(2)}`;
  if (d.state === "completed" || d.state === "extracting" || d.state === "repairing") return formatBytes(d.size);
  return `${formatBytes(d.downloaded)} / ${formatBytes(d.size)}`;
}

export function DownloadTable({ downloads, providers, selected, onSelected, expanded, onExpanded, sort, onSort, onAction, now }: Props) {
  const allSelected = downloads.length > 0 && downloads.every((d) => selected.has(d.id));
  const toggleAll = () => onSelected(allSelected ? new Set() : new Set(downloads.map((d) => d.id)));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelected(next);
  };
  const Th = ({ k, children, right }: { k?: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={cn("whitespace-nowrap px-3 py-2.5 text-left label-caps", right && "text-right")}>
      {k ? (
        <button className="inline-flex items-center gap-1 uppercase hover:text-fg" onClick={() => onSort({ key: k, dir: sort.key === k && sort.dir === "asc" ? "desc" : "asc" })}>
          {children}
          {sort.key === k ? sort.dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" /> : null}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="w-9 py-2.5 pl-3">
              <input type="checkbox" id="select-all" aria-label="Select all" checked={allSelected} onChange={toggleAll} />
            </th>
            <Th k="name">Name</Th>
            <Th k="progress">Progress</Th>
            <Th>Status</Th>
            <Th k="size" right>
              Size
            </Th>
            <Th k="speed" right>
              Speed
            </Th>
            <Th k="eta" right>
              ETA
            </Th>
            <Th k="added" right>
              Added
            </Th>
            <th className="w-[96px]" />
          </tr>
        </thead>
        <tbody>
          {downloads.map((d) => {
            const provider = providers.get(d.providerId);
            const open = expanded === d.id;
            const actions = availableActions(d, provider);
            return (
              <Fragment key={d.id}>
                <tr
                  data-open={open}
                  className={cn("group cursor-pointer border-b border-line transition-colors hover:bg-panel-2", open && "bg-panel-2")}
                  onClick={() => onExpanded(open ? null : d.id)}
                >
                  <td className="py-2.5 pl-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${d.name}`} checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                  </td>
                  <td className="max-w-[460px] px-3 py-2.5">
                    <div className="grid gap-0.5">
                      <span className="truncate font-semibold" title={d.name}>
                        {d.name}
                      </span>
                      <span className={cn("flex items-center gap-2 truncate text-[11.5px] text-faint", d.error && "text-bad")}>
                        {provider ? <ProviderTag type={provider.type} title={provider.name} /> : null}
                        {d.error ? <span className="truncate">{d.error}</span> : null}
                        {!d.error && d.category ? <span>{d.category}</span> : null}
                        {!d.error && d.savePath && d.state !== "completed" ? <span className="truncate">{d.savePath}</span> : null}
                      </span>
                    </div>
                  </td>
                  <td className="min-w-[160px] px-3 py-2.5">
                    <div className="grid gap-1.5">
                      <ProgressBar value={d.state === "queued" ? 0 : d.progress} state={d.state} animated={d.state === "downloading" && d.downloadSpeed > 0} />
                      <span className="flex justify-between font-mono text-[11.5px] text-muted tnum">
                        <span>{progressLabel(d)}</span>
                        <span>{sizeLabel(d)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill state={d.state} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12.5px] tnum">{formatBytes(d.size)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12.5px] leading-tight tnum">
                    {d.downloadSpeed > 0 ? (
                      <span className="inline-flex items-center gap-1 text-down">
                        <ArrowDown className="size-3" />
                        {formatSpeed(d.downloadSpeed)}
                      </span>
                    ) : null}
                    {d.uploadSpeed > 0 ? (
                      <span className="inline-flex items-center gap-1 text-up">
                        {d.downloadSpeed > 0 ? <br /> : null}
                        <ArrowUp className="size-3" />
                        {formatSpeed(d.uploadSpeed)}
                      </span>
                    ) : null}
                    {d.downloadSpeed === 0 && d.uploadSpeed === 0 ? <span className="text-faint">—</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12.5px] text-muted tnum">{formatEta(d.eta)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[12.5px] text-muted tnum" title={d.addedAt ? new Date(d.addedAt).toLocaleString() : undefined}>
                    {formatRelative(d.addedAt ?? d.completedAt, now)}
                  </td>
                  <td className="py-2.5 pr-2">
                    <RowActions actions={actions} onAction={(a) => onAction([d.id], a)} />
                  </td>
                </tr>
                {open ? (
                  <tr className="border-b border-line bg-bg">
                    <td colSpan={9} className="px-4 py-4 pl-12">
                      <DownloadDetails download={d} provider={provider} onAction={(a, extra) => onAction([d.id], a, extra)} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
