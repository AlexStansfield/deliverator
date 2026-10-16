import { cn } from "@/lib/cn";

export function Alert({ kind = "bad", children, className }: { kind?: "bad" | "ok" | "warn"; children: React.ReactNode; className?: string }) {
  const tone = { bad: "border-bad/40 bg-bad/10 text-bad", ok: "border-ok/40 bg-ok/10 text-ok", warn: "border-warn/40 bg-warn/10 text-warn" }[kind];
  return <div className={cn("rounded-lg border px-3 py-2 text-[13px]", tone, className)}>{children}</div>;
}
