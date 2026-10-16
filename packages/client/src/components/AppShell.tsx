import { NavLink, Outlet } from "react-router";
import { LogOut } from "lucide-react";
import { Logo } from "./ui/Logo";
import { Button } from "./ui/Button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const tab = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-[7px] px-3 py-1 font-semibold transition-colors", isActive ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg");

export function AppShell() {
  const { username, logout } = useAuth();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-panel px-[max(16px,env(safe-area-inset-left))] py-2.5 pr-[max(16px,env(safe-area-inset-right))]">
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
        <div id="shell-actions" className="flex items-center gap-2" />
        <Button variant="ghost" size="sm" onClick={() => void logout()} title={`Sign out ${username ?? ""}`}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </header>
      <main className="flex-1 px-[max(16px,env(safe-area-inset-left))] py-4 pr-[max(16px,env(safe-area-inset-right))]">
        <Outlet />
      </main>
    </div>
  );
}
