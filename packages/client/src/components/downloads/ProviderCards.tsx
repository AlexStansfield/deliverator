import { Link } from "react-router";
import { ArrowDown, ArrowUp, Pause, Play } from "lucide-react";
import { formatBytes, formatSpeed, type ProviderStatus, type ProviderSummary, type Download } from "@deliverator/shared";
import { Dot, ProviderTag } from "./bits";
import { Button } from "@/components/ui/Button";
import { useDownloadActions } from "@/lib/actions";

export function ProviderCards({ providers, statuses, downloads }: { providers: ProviderSummary[]; statuses: ProviderStatus[]; downloads: Download[] }) {
  const { providerPause } = useDownloadActions();
  if (providers.length === 0) return null;
  return (
    <section className="grid min-w-0 gap-2.5 md:grid-cols-2" aria-label="Providers">
      {providers.map((p) => {
        const s = statuses.find((x) => x.providerId === p.id);
        const count = downloads.filter((d) => d.providerId === p.id).length;
        const connected = Boolean(s?.connected) && p.enabled;
        return (
          <div key={p.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-line bg-panel px-3.5 py-2.5">
            <Dot ok={connected} />
            <Link to="/settings/providers" className="flex items-center gap-2 font-bold hover:underline">
              {p.name} <ProviderTag type={p.type} />
            </Link>
            {!p.enabled ? (
              <span className="text-[12.5px] text-muted">disabled</span>
            ) : connected ? (
              <span className="text-[12.5px] text-muted">
                {count} {count === 1 ? "item" : "items"}
                {s?.freeSpace != null ? ` · ${formatBytes(s.freeSpace)} free` : ""}
                {s?.paused ? " · queue paused" : ""}
              </span>
            ) : (
              <span className="min-w-0 truncate text-[12.5px] text-bad" title={s?.error ?? ""}>
                {s?.error ?? "Connecting…"}
              </span>
            )}
            <span className="ml-auto flex items-center gap-3 font-mono text-[12.5px] tnum">
              {connected ? (
                <>
                  <span className="inline-flex items-center gap-1 text-down">
                    <ArrowDown className="size-3" /> {formatSpeed(s?.downloadSpeed ?? 0)}
                  </span>
                  {p.capabilities.uploadSpeedLimit ? (
                    <span className="inline-flex items-center gap-1 text-up">
                      <ArrowUp className="size-3" /> {formatSpeed(s?.uploadSpeed ?? 0)}
                    </span>
                  ) : null}
                </>
              ) : null}
              {connected && !p.capabilities.altSpeedToggle ? (
                <Button
                  size="icon"
                  variant="ghost"
                  title={s?.paused ? "Resume queue" : "Pause queue"}
                  onClick={() => providerPause.mutate({ providerId: p.id, pause: !s?.paused })}
                >
                  {s?.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                </Button>
              ) : null}
            </span>
          </div>
        );
      })}
    </section>
  );
}
