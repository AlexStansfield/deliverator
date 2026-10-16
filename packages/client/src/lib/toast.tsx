import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

interface Toast {
  id: number;
  kind: "ok" | "bad" | "info";
  text: string;
}

interface ToastApi {
  ok: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++counter;
    setItems((list) => [...list.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === "bad" ? 8000 : 4000);
  }, []);
  const api = useMemo<ToastApi>(() => ({ ok: (t) => push("ok", t), error: (t) => push("bad", t), info: (t) => push("info", t) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex max-w-[520px] items-start gap-3 rounded-lg border px-3 py-2 text-[13px] shadow-xl",
              t.kind === "bad" ? "border-bad/40 bg-panel text-bad" : t.kind === "ok" ? "border-ok/40 bg-panel text-ok" : "border-line bg-panel text-fg",
            )}
          >
            <span className="min-w-0 break-words">{t.text}</span>
            <button className="text-muted hover:text-fg" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))} aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
