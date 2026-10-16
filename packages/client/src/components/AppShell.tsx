import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { ArrowDown, ArrowUp, LogOut, Plus } from "lucide-react";
import { formatSpeed } from "@deliverator/shared";
import { Logo } from "./ui/Logo";
import { Button } from "./ui/Button";
import { useAuth } from "@/lib/auth";
import { useLiveState } from "@/lib/state";
import { cn } from "@/lib/cn";
import { AddDownloadDialog } from "./AddDownloadDialog";
import { ThrottlePopover } from "./ThrottlePopover";

const tab = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-[7px] px-3 py-1 font-semibold transition-colors", isActive ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg");

export function AppShell() {
  const { username, logout } = useAuth();
  const { snapshot } = useLiveState();
  const [adding, setAdding] = useState(false);
  const totals = snapshot.statuses.reduce((acc, s) => ({ down: acc.down + (s.connected ? s.downloadSpeed : 0), up: acc.up + (s.connected ? s.uploadSpeed : 0) }), { down: 0, up: 0 });
  const showUp = snapshot.providers.some((p) => p.enabled && p.capabilities.uploadSpeedLimit);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-panel py-2.5 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] sm:gap-3">
        <NavLink to="/" className="flex items-center gap-2.5 text-[15px] font-extrabold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">Deliverator</span>
        </NavLink>
        <nav className="flex gap-0.5 rounded-[9px] bg-panel-2 p-[3px]" aria-label="Main">
          <NavLink to="/" end className={tab}>
            Downloads
          </NavLink>
          <NavLink to="/settings" className={tab}>
            Settings
          </NavLink>
        </nav>
        <div className="flex-1" />
        <div className="hidden items-center gap-3.5 font-mono text-[12.5px] tnum md:flex" aria-label="Total speeds">
          <span className="inline-flex items-center gap-1 text-down">
            <ArrowDown className="size-3" /> {formatSpeed(totals.down)}
          </span>
          {showUp ? (
            <span className="inline-flex items-center gap-1 text-up">
              <ArrowUp className="size-3" /> {formatSpeed(totals.up)}
            </span>
          ) : null}
        </div>
        <ThrottlePopover providers={snapshot.providers} statuses={snapshot.statuses} />
        <Button variant="primary" onClick={() => setAdding(true)} disabled={snapshot.providers.length === 0} title="Add download">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void logout()} title={`Sign out ${username ?? ""}`} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="min-w-0 flex-1 overflow-x-clip py-4 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">
        <Outlet />
      </main>
      <AddDownloadDialog open={adding} onOpenChange={setAdding} providers={snapshot.providers} />
    </div>
  );
}
