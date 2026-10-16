import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SettingsHeading } from "../SettingsPage";
import { useAuth } from "@/lib/auth";

export function AccountSettings() {
  const { username } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setMsg({ kind: "bad", text: "The two new passwords do not match" });
    if (next.length < 8) return setMsg({ kind: "bad", text: "Use at least 8 characters" });
    setBusy(true);
    setMsg(null);
    try {
      await api("/auth/password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setMsg({ kind: "ok", text: "Password updated. Other signed-in sessions were logged out." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setMsg({ kind: "bad", text: err instanceof Error ? err.message : "Could not update password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsHeading>Account</SettingsHeading>
      <Card>
        <form onSubmit={onSubmit}>
          <CardBody>
            <h3 className="text-[14px] font-bold">Change password</h3>
            <p className="text-[12.5px] text-muted">Signed in as <b className="text-fg">{username}</b>.</p>
            {msg ? <Alert kind={msg.kind}>{msg.text}</Alert> : null}
            <Field label="Current password" htmlFor="pw-current">
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" htmlFor="pw-new">
                <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
              </Field>
              <Field label="Confirm" htmlFor="pw-confirm">
                <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={busy}>
                Update password
              </Button>
            </div>
          </CardBody>
        </form>
      </Card>
      <Card>
        <CardBody>
          <h3 className="text-[14px] font-bold">Locked out?</h3>
          <p className="text-[12.5px] text-muted">
            A random password is printed to the console on first start. To get a fresh one later, run this where Deliverator is installed and the new
            password is printed:
          </p>
          <pre className="overflow-x-auto rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-[12px]">docker exec deliverator deliverator reset-password</pre>
          <p className="text-[12.5px] text-muted">Outside Docker: <code className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[12px]">yarn cli reset-password</code></p>
        </CardBody>
      </Card>
    </>
  );
}
