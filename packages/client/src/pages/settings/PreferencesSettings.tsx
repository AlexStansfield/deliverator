import { usePreferences } from "@/lib/prefs";
import { themes, SYSTEM_THEME_ID } from "@/theme/themes";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, NativeSelect } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { SettingsHeading } from "../SettingsPage";
import { cn } from "@/lib/cn";

export function PreferencesSettings() {
  const { prefs, update } = usePreferences();
  return (
    <>
      <SettingsHeading>Preferences</SettingsHeading>
      <Card>
        <CardBody>
          <h3 className="text-[14px] font-bold">Theme</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Theme">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={prefs.theme === t.id}
                onClick={() => void update({ theme: t.id })}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2 text-left text-[13px] font-semibold",
                  prefs.theme === t.id ? "border-accent" : "border-line hover:border-muted",
                )}
              >
                <span className="flex overflow-hidden rounded-md border border-line" aria-hidden="true">
                  {[t.tokens.bg, t.tokens.panel2, t.tokens.accent, t.tokens.down].map((c, i) => (
                    <span key={i} className="size-4" style={{ background: c }} />
                  ))}
                </span>
                {t.name}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={prefs.theme === SYSTEM_THEME_ID}
              onClick={() => void update({ theme: SYSTEM_THEME_ID })}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border p-2 text-left text-[13px] font-semibold",
                prefs.theme === SYSTEM_THEME_ID ? "border-accent" : "border-line hover:border-muted",
              )}
            >
              <span className="grid size-4 place-items-center rounded-md border border-line text-[10px]" aria-hidden="true">
                A
              </span>
              Follow system
            </button>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h3 className="text-[14px] font-bold">Behaviour</h3>
          <Field label="Refresh interval" htmlFor="pref-refresh" hint="How often the list updates while the page is open.">
            <NativeSelect id="pref-refresh" value={prefs.refreshInterval} onChange={(e) => void update({ refreshInterval: Number(e.target.value) })} className="max-w-[200px]">
              <option value={1000}>1 second</option>
              <option value={2000}>2 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
            </NativeSelect>
          </Field>
          <Switch id="pref-confirm" label="Confirm before deleting" checked={prefs.confirmDelete} onCheckedChange={(v) => void update({ confirmDelete: v })} />
          <Switch
            id="pref-delete-files"
            label="Also delete downloaded files by default when removing a download"
            checked={prefs.deleteFilesByDefault}
            onCheckedChange={(v) => void update({ deleteFilesByDefault: v })}
          />
        </CardBody>
      </Card>
    </>
  );
}
