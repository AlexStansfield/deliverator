import { ArrowDownToLine, ArrowUpToLine, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import type { Download, ProviderSummary } from "@deliverator/shared";
import { cn } from "@/lib/cn";
import type { DownloadAction } from "@/lib/actions";

export function availableActions(d: Download, provider: ProviderSummary | undefined): DownloadAction[] {
  const caps = provider?.capabilities;
  const out: DownloadAction[] = [];
  if (caps?.pauseResume) {
    if (d.state === "downloading" || d.state === "queued" || d.state === "seeding" || d.state === "checking") out.push("pause");
    if (d.state === "paused" || d.state === "completed") out.push("resume");
  }
  if (caps?.retry && d.state === "failed") out.push("retry");
  if (caps?.reorder && (d.state === "downloading" || d.state === "queued" || d.state === "paused")) out.push("top", "bottom");
  out.push("delete");
  return out;
}

const ICONS: Record<DownloadAction, { icon: typeof Pause; title: string; danger?: boolean }> = {
  pause: { icon: Pause, title: "Pause" },
  resume: { icon: Play, title: "Resume" },
  retry: { icon: RotateCcw, title: "Retry" },
  top: { icon: ArrowUpToLine, title: "Move to top" },
  bottom: { icon: ArrowDownToLine, title: "Move to bottom" },
  delete: { icon: Trash2, title: "Delete", danger: true },
  setCategory: { icon: Pause, title: "Set category" },
};

export function RowActions({
  actions,
  onAction,
  size = 14,
  className,
  alwaysVisible,
}: {
  actions: DownloadAction[];
  onAction: (a: DownloadAction) => void;
  size?: number;
  className?: string;
  alwaysVisible?: boolean;
}) {
  return (
    <div className={cn("flex justify-end gap-0.5", !alwaysVisible && "opacity-40 transition-opacity group-hover:opacity-100 group-data-[open=true]:opacity-100", className)}>
      {actions
        .filter((a) => a !== "bottom" || size > 14)
        .map((a) => {
          const def = ICONS[a];
          const Icon = def.icon;
          return (
            <button
              key={a}
              title={def.title}
              aria-label={def.title}
              onClick={(e) => {
                e.stopPropagation();
                onAction(a);
              }}
              className={cn("rounded-md p-1 text-muted hover:bg-panel hover:text-fg", def.danger && "hover:text-bad")}
            >
              <Icon style={{ width: size, height: size }} />
            </button>
          );
        })}
    </div>
  );
}
