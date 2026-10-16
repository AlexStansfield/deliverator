import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { AppInfo } from "@deliverator/shared";
import { api, onUnauthorized } from "./api";

interface AuthState {
  info: AppInfo | undefined;
  loading: boolean;
  authenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["info"], queryFn: () => api<AppInfo>("/info"), staleTime: 60_000 });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: { username: string } }>("/auth/me"),
    enabled: info.data?.authenticated === true,
    retry: false,
  });

  useEffect(
    () =>
      onUnauthorized(() => {
        qc.setQueryData<AppInfo>(["info"], (old) => (old ? { ...old, authenticated: false } : old));
        qc.removeQueries({ queryKey: ["me"] });
      }),
    [qc],
  );

  const login = useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      api<{ user: { username: string } }>("/auth/login", { method: "POST", json: vars }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["info"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSettled: async () => {
      qc.clear();
      await qc.invalidateQueries({ queryKey: ["info"] });
    },
  });

  const value: AuthState = {
    info: info.data,
    loading: info.isLoading,
    authenticated: info.data?.authenticated === true,
    username: me.data?.user.username ?? null,
    login: async (username, password) => {
      await login.mutateAsync({ username, password });
    },
    logout: async () => {
      await logout.mutateAsync();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
