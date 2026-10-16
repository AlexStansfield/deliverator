import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { serverVersion } from "@/lib/env";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <form onSubmit={onSubmit} className="grid w-full max-w-[360px] gap-4 rounded-2xl border border-line bg-panel p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight">Deliverator</h1>
            <p className="text-[12px] text-muted">Sign in to manage your downloads</p>
          </div>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Username" htmlFor="login-username">
          <Input id="login-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="login-password" hint="First time? The password was printed to the server console on start.">
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Button type="submit" variant="primary" loading={busy}>
          Sign in
        </Button>
        <p className="text-center text-[11px] text-faint">v{serverVersion}</p>
      </form>
    </div>
  );
}
