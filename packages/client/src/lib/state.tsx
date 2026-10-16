import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StateSnapshot, ProviderSummary, ProviderStatus, Download } from "@deliverator/shared";
import { api } from "./api";
import { apiUrl } from "./env";
import { useAuth } from "./auth";
import { usePreferences } from "./prefs";

const EMPTY: StateSnapshot = { providers: [], statuses: [], downloads: [], generatedAt: 0 };

interface LiveState {
  snapshot: StateSnapshot;
  /** true while the event stream is connected; polling takes over otherwise */
  live: boolean;
  loaded: boolean;
}

const Ctx = createContext<LiveState | null>(null);

/**
 * Keeps the ["state"] query fresh: first from GET /api/state, then from the SSE stream.
 * If the stream drops, React Query polls at the user's refresh interval until it is back.
 */
export function LiveStateProvider({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const { prefs } = usePreferences();
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);

  const query = useQuery({
    queryKey: ["state"],
    queryFn: () => api<StateSnapshot>("/state"),
    enabled: authenticated,
    refetchInterval: live ? false : prefs.refreshInterval,
    staleTime: 1000,
  });

  useEffect(() => {
    if (!authenticated) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      es = new EventSource(apiUrl("/events"));
      es.addEventListener("state", (ev) => {
        const snap = JSON.parse((ev as MessageEvent<string>).data) as StateSnapshot;
        qc.setQueryData(["state"], snap);
        if (!liveRef.current) {
          liveRef.current = true;
          setLive(true);
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (liveRef.current) {
          liveRef.current = false;
          setLive(false);
        }
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      if (retry) clearTimeout(retry);
      liveRef.current = false;
      setLive(false);
    };
  }, [authenticated, qc]);

  const value = useMemo<LiveState>(() => ({ snapshot: query.data ?? EMPTY, live, loaded: query.isSuccess }), [query.data, query.isSuccess, live]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveState(): LiveState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLiveState must be used inside LiveStateProvider");
  return v;
}

export function useProviderMap(): Map<string, { provider: ProviderSummary; status: ProviderStatus | undefined }> {
  const { snapshot } = useLiveState();
  return useMemo(() => {
    const m = new Map<string, { provider: ProviderSummary; status: ProviderStatus | undefined }>();
    for (const p of snapshot.providers) m.set(p.id, { provider: p, status: snapshot.statuses.find((s) => s.providerId === p.id) });
    return m;
  }, [snapshot.providers, snapshot.statuses]);
}

export type { Download };
