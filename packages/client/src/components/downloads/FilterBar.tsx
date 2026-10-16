import { Search } from "lucide-react";
import type { DownloadState, ProviderSummary, Download } from "@deliverator/shared";
import { cn } from "@/lib/cn";
import { ProviderTag } from "./bits";

export type StatusFilter = "all" | "active" | DownloadState;

export const STATUS_FILTERS: { id: StatusFilter; label: string; match: (d: Download) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "downloading", label: "Downloading", match: (d) => d.state === "downloading" },
  { id: "queued", label: "Queued", match: (d) => d.state === "queued" || d.state === "checking" || d.state === "repairing" || d.state === "extracting" },
  { id: "paused", label: "Paused", match: (d) => d.state === "paused" },
  { id: "seeding", label: "Seeding", match: (d) => d.state === "seeding" },
  { id: "completed", label: "Completed", match: (d) => d.state === "completed" },
  { id: "failed", label: "Failed", match: (d) => d.state === "failed" },
];

export function FilterBar({
  downloads,
  providers,
  status,
  onStatus,
  providerIds,
  onProviderIds,
  search,
  onSearch,
}: {
  downloads: Download[];
  providers: ProviderSummary[];
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  providerIds: Set<string>;
  onProviderIds: (ids: Set<string>) => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] border px-2 py-1 text-[12.5px] font-semibold transition-colors",
      active ? "border-line bg-panel-2 text-fg" : "border-transparent text-muted hover:bg-panel-2 hover:text-fg",
    );
  return (
    <section className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Filters">
      <div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label="Status">
        {STATUS_FILTERS.map((f) => {
          const n = downloads.filter(f.match).length;
          if (f.id !== "all" && n === 0 && status !== f.id) return null;
          return (
            <button key={f.id} className={chip(status === f.id)} aria-pressed={status === f.id} onClick={() => onStatus(f.id)}>
              {f.label}
              <b className={cn("font-mono text-[11.5px] font-medium", status === f.id ? "text-accent" : "text-faint")}>{n}</b>
            </button>
          );
        })}
      </div>
      {providers.length > 1 ? (
        <>
          <span className="hidden h-5 w-px bg-line sm:block" />
          <div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label="Provider">
            {providers.map((p) => {
              const active = providerIds.has(p.id);
              return (
                <button
                  key={p.id}
                  className={chip(active)}
                  aria-pressed={active}
                  onClick={() => {
                    const next = new Set(providerIds);
                    if (active) next.delete(p.id);
                    else next.add(p.id);
                    onProviderIds(next);
                  }}
                >
                  <ProviderTag type={p.type} /> {p.name}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      <label className="flex min-w-0 basis-full items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-muted sm:ml-auto sm:basis-auto sm:max-w-[260px]">
        <Search className="size-3.5 shrink-0" />
        <input
          id="downloads-search"
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search downloads"
          className="w-full min-w-0 bg-transparent text-fg outline-none placeholder:text-faint"
        />
      </label>
    </section>
  );
}
