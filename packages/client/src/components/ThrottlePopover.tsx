import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown, ArrowUp, Gauge } from "lucide-react";
import { formatSpeed, parseSpeed, type ProviderStatus, type ProviderSummary } from "@deliverator/shared";
import { cn } from "@/lib/cn";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { ProviderTag } from "./downloads/bits";
import { useDownloadActions } from "@/lib/actions";
import { usePreferences } from "@/lib/prefs";
import { useToast } from "@/lib/toast";

function LimitRow({ icon, current, presets, onSet }: { icon: React.ReactNode; current: number; presets: number[]; onSet: (bytes: number) => void }) {
  const [custom, setCustom] = useState<string | null>(null);
  const toast = useToast();
  // Clients round limits to their own units (SABnzbd works in KiB), so match presets loosely.
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1024, b * 0.005);
  const matched = current === 0 ? 0 : presets.find((p) => near(current, p));
  const isPreset = matched !== undefined;
  const seg = (active: boolean) =>
    cn("flex-1 whitespace-nowrap rounded-md px-1.5 py-1 font-mono text-[11.5px] transition-colors", active ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg");
  return (
    <div className="grid grid-cols-[18px_1fr] items-center gap-2">
      <span aria-hidden="true">{icon}</span>
      <div className="grid gap-1.5">
        <div className="flex gap-0.5 rounded-lg bg-panel-2 p-[3px]">
          <button className={seg(current === 0)} aria-pressed={current === 0} onClick={() => onSet(0)}>
            Unlimited
          </button>
          {presets.map((p) => (
            <button key={p} className={seg(matched === p)} aria-pressed={matched === p} onClick={() => onSet(p)}>
              {formatSpeed(p).replace("/s", "")}
            </button>
          ))}
          <button className={seg(!isPreset || custom !== null)} aria-pressed={!isPreset} onClick={() => setCustom(custom === null ? (isPreset ? "" : formatSpeed(current).replace("/s", "")) : null)}>
            {!isPreset && custom === null ? formatSpeed(current).replace("/s", "") : "Custom"}
          </button>
        </div>
        {custom !== null ? (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const bytes = parseSpeed(custom);
              if (bytes === null) return toast.error('Enter a speed like "3 MB" or "800k"');
              onSet(bytes);
              setCustom(null);
            }}
          >
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. 3 MB"
              className="w-full rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-[12px] outline-none focus:border-accent"
            />
            <Button size="sm" type="submit">
              Set
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function ThrottlePopover({ providers, statuses }: { providers: ProviderSummary[]; statuses: ProviderStatus[] }) {
  const { limits, providerPause } = useDownloadActions();
  const { prefs } = usePreferences();
  const enabled = providers.filter((p) => p.enabled);
  const limited = statuses.some((s) => {
    const p = providers.find((x) => x.id === s.providerId);
    return p?.enabled && s.connected && (s.limits.download > 0 || (s.limits.upload ?? 0) > 0 || s.limits.altEnabled || s.paused);
  });
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant={limited ? "default" : "ghost"} className={cn(limited && "border-warn text-warn")} title="Speed limits" aria-label="Speed limits">
          <Gauge className="size-4" />
          <span className="hidden sm:inline">{limited ? "Limited" : "Throttle"}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-40 grid w-[360px] max-w-[calc(100vw-24px)] gap-3.5 rounded-xl border border-line bg-panel p-3.5 shadow-2xl outline-none">
          <h3 className="text-[14px] font-extrabold">Speed limits</h3>
          {enabled.length === 0 ? <p className="text-[12.5px] text-muted">No providers configured.</p> : null}
          {enabled.map((p) => {
            const s = statuses.find((x) => x.providerId === p.id);
            const presets = prefs.speedPresets.filter((x) => x > 0);
            return (
              <div key={p.id} className="grid gap-2">
                <div className="flex items-center gap-2 text-[12.5px] font-bold">
                  <ProviderTag type={p.type} /> {p.name}
                  {!s?.connected ? <span className="ml-auto text-[11.5px] font-medium text-bad">offline</span> : null}
                </div>
                <LimitRow icon={<ArrowDown className="size-3.5 text-down" />} current={s?.limits.download ?? 0} presets={presets} onSet={(download) => limits.mutate({ providerId: p.id, limits: { download } })} />
                {p.capabilities.uploadSpeedLimit ? (
                  <LimitRow icon={<ArrowUp className="size-3.5 text-up" />} current={s?.limits.upload ?? 0} presets={presets} onSet={(upload) => limits.mutate({ providerId: p.id, limits: { upload } })} />
                ) : null}
                {p.capabilities.altSpeedToggle ? (
                  <Switch id={`alt-${p.id}`} label="Alternative speed limits" checked={Boolean(s?.limits.altEnabled)} onCheckedChange={(altEnabled) => limits.mutate({ providerId: p.id, limits: { altEnabled } })} />
                ) : (
                  <Switch id={`pause-${p.id}`} label="Pause whole queue" checked={Boolean(s?.paused)} onCheckedChange={(pause) => providerPause.mutate({ providerId: p.id, pause })} />
                )}
              </div>
            );
          })}
          <p className="text-[11.5px] text-faint">Limits are set on the client itself, so they stay in effect when Deliverator is closed. Presets are editable in Preferences.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
