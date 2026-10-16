import { NavLink, Navigate, Route, Routes } from "react-router";
import { cn } from "@/lib/cn";
import { AccountSettings } from "./settings/AccountSettings";
import { PreferencesSettings } from "./settings/PreferencesSettings";
import { AboutSettings } from "./settings/AboutSettings";
import { ProvidersSettings } from "./settings/ProvidersSettings";

const sections = [
  { to: "/settings/providers", label: "Providers" },
  { to: "/settings/account", label: "Account" },
  { to: "/settings/preferences", label: "Preferences" },
  { to: "/settings/about", label: "About" },
];

export function SettingsPage() {
  return (
    <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="scrollbar-none flex gap-0.5 overflow-x-auto md:grid md:content-start" aria-label="Settings sections">
        {sections.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              cn(
                "whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-semibold",
                isActive ? "border-line bg-panel text-fg" : "border-transparent text-muted hover:text-fg",
              )
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
      <div className="grid content-start gap-3.5">
        <Routes>
          <Route index element={<Navigate to="providers" replace />} />
          <Route path="providers" element={<ProvidersSettings />} />
          <Route path="account" element={<AccountSettings />} />
          <Route path="preferences" element={<PreferencesSettings />} />
          <Route path="about" element={<AboutSettings />} />
        </Routes>
      </div>
    </div>
  );
}

export function SettingsHeading({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[17px] font-extrabold">
      {children}
      {actions ? <span className="ml-auto">{actions}</span> : null}
    </h2>
  );
}
