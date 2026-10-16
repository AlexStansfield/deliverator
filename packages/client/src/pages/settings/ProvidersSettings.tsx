import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROVIDER_TYPES, type ProviderSummary, type ProviderType } from "@deliverator/shared";
import { api } from "@/lib/api";
import { useLiveState } from "@/lib/state";
import { useToast } from "@/lib/toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, NativeSelect } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Switch } from "@/components/ui/Switch";
import { Dialog } from "@/components/ui/Dialog";
import { ProviderTag, Dot } from "@/components/downloads/bits";
import { SettingsHeading } from "../SettingsPage";

const LABELS: Record<ProviderType, string> = { qbittorrent: "qBittorrent", sabnzbd: "SABnzbd" };
const PLACEHOLDER_URL: Record<ProviderType, string> = { qbittorrent: "http://qbittorrent:8080", sabnzbd: "http://sabnzbd:8080" };

interface FormState {
  type: ProviderType;
  name: string;
  url: string;
  username: string;
  password: string;
  apiKey: string;
  enabled: boolean;
}

const blank = (): FormState => ({ type: "qbittorrent", name: "", url: "", username: "", password: "", apiKey: "", enabled: true });

function ProviderForm({ initial, onDone }: { initial: ProviderSummary | null; onDone: () => void }) {
  const [f, setF] = useState<FormState>(() => (initial ? { ...blank(), type: initial.type, name: initial.name, url: initial.url, enabled: initial.enabled, username: initial.username ?? "" } : blank()));
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const set = (patch: Partial<FormState>) => {
    setF((s) => ({ ...s, ...patch }));
    setTest(null);
  };
  const body = () => ({ type: f.type, name: f.name.trim(), url: f.url.trim(), enabled: f.enabled, username: f.username, password: f.password, apiKey: f.apiKey, ...(initial ? { id: initial.id } : {}) });

  const testConn = useMutation({
    mutationFn: () => api<{ ok: boolean; version?: string; error?: string }>("/providers/test", { method: "POST", json: body() }),
    onSuccess: (r) => setTest(r.ok ? { ok: true, text: `Connected · ${r.version}` } : { ok: false, text: r.error ?? "Failed" }),
    onError: (err) => setTest({ ok: false, text: err instanceof Error ? err.message : "Failed" }),
  });
  const save = useMutation({
    mutationFn: () => (initial ? api(`/providers/${initial.id}`, { method: "PUT", json: body() }) : api("/providers", { method: "POST", json: body() })),
    onSuccess: () => {
      toast.ok(initial ? "Provider updated" : "Provider added");
      onDone();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate();
  };
  const secretHint = initial ? "Leave blank to keep the saved one." : undefined;

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="p-type">
          <NativeSelect id="p-type" value={f.type} onChange={(e) => set({ type: e.target.value as ProviderType })} disabled={Boolean(initial)}>
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Display name" htmlFor="p-name">
          <Input id="p-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={`e.g. Dixie ${LABELS[f.type]}`} required maxLength={60} />
        </Field>
      </div>
      <Field label="URL" htmlFor="p-url" hint="As reachable from where Deliverator runs. Inside Docker that is usually the container name, not localhost.">
        <Input id="p-url" type="url" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder={PLACEHOLDER_URL[f.type]} required />
      </Field>
      {f.type === "qbittorrent" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username" htmlFor="p-user">
            <Input id="p-user" value={f.username} onChange={(e) => set({ username: e.target.value })} placeholder="admin" autoComplete="off" />
          </Field>
          <Field label="Password" htmlFor="p-pass" hint={secretHint}>
            <Input id="p-pass" type="password" value={f.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
          </Field>
        </div>
      ) : (
        <Field label="API key" htmlFor="p-key" hint={secretHint ?? "SABnzbd → Config → General → API Key"}>
          <Input id="p-key" value={f.apiKey} onChange={(e) => set({ apiKey: e.target.value })} autoComplete="off" className="font-mono text-[12.5px]" />
        </Field>
      )}
      {initial ? <Switch id="p-enabled" label="Enabled" checked={f.enabled} onCheckedChange={(enabled) => set({ enabled })} /> : null}
      {test ? <Alert kind={test.ok ? "ok" : "bad"}>{test.text}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" loading={testConn.isPending} onClick={() => testConn.mutate()} disabled={!f.url}>
          Test connection
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {initial ? "Save changes" : "Save provider"}
        </Button>
      </div>
    </form>
  );
}

export function ProvidersSettings() {
  const { snapshot } = useLiveState();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<ProviderSummary | null | "new">(null);
  const [removing, setRemoving] = useState<ProviderSummary | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api(`/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.ok("Provider removed");
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: ["state"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
  });

  const testExisting = async (p: ProviderSummary) => {
    setTesting(p.id);
    try {
      const r = await api<{ ok: boolean; version?: string; error?: string }>("/providers/test", { method: "POST", json: { id: p.id, type: p.type, name: p.name, url: p.url } });
      if (r.ok) toast.ok(`${p.name}: connected (${r.version})`);
      else toast.error(`${p.name}: ${r.error}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      <SettingsHeading
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            + Add provider
          </Button>
        }
      >
        Providers
      </SettingsHeading>
      <p className="max-w-[62ch] text-[12.5px] text-muted">A provider is a download client Deliverator talks to. Add as many as you like; their downloads all show up in one list.</p>

      {snapshot.providers.length === 0 && editing !== "new" ? (
        <Card>
          <CardBody className="items-center justify-items-center py-8 text-center">
            <p className="text-[13px] text-muted">No providers yet. Add your qBittorrent or SABnzbd instance to get going.</p>
            <Button variant="primary" onClick={() => setEditing("new")}>
              Add provider
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {editing === "new" ? (
        <Card>
          <CardBody>
            <h3 className="text-[14px] font-bold">New provider</h3>
            <ProviderForm initial={null} onDone={() => setEditing(null)} />
          </CardBody>
        </Card>
      ) : null}

      {snapshot.providers.map((p) => {
        const s = snapshot.statuses.find((x) => x.providerId === p.id);
        const isEditing = editing !== null && editing !== "new" && editing.id === p.id;
        return (
          <Card key={p.id}>
            <CardBody>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-line bg-panel-2">
                  <ProviderTag type={p.type} />
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <b className="text-[14px]">{p.name}</b>
                  <span className="break-all font-mono text-[12px] text-muted">{p.url}</span>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-[12.5px]">
                    <Dot ok={Boolean(s?.connected) && p.enabled} />
                    {!p.enabled ? <span className="text-muted">Disabled</span> : s?.connected ? <span className="text-ok">Connected{s.version ? ` · ${s.version}` : ""}</span> : <span className="max-w-[260px] truncate text-bad" title={s?.error ?? ""}>{s?.error ?? "Connecting…"}</span>}
                  </span>
                  <Button size="sm" loading={testing === p.id} onClick={() => void testExisting(p)}>
                    Test
                  </Button>
                  <Button size="sm" onClick={() => setEditing(isEditing ? null : p)}>
                    {isEditing ? "Close" : "Edit"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRemoving(p)}>
                    Remove
                  </Button>
                </div>
              </div>
              {isEditing ? (
                <div className="border-t border-line pt-3">
                  <ProviderForm initial={p} onDone={() => setEditing(null)} />
                </div>
              ) : null}
            </CardBody>
          </Card>
        );
      })}

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)} title={`Remove ${removing?.name ?? "provider"}?`}>
        <p className="text-[13px] text-muted">Deliverator forgets this connection. Nothing changes on the client itself and no downloads are touched.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setRemoving(null)}>Cancel</Button>
          <Button variant="primary" className="bg-bad text-white" loading={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
            Remove
          </Button>
        </div>
      </Dialog>
    </>
  );
}
