import { useMutation } from "@tanstack/react-query";
import type { AddDownloadResult, SpeedLimits } from "@deliverator/shared";
import { api } from "./api";
import { useToast } from "./toast";

export type DownloadAction = "pause" | "resume" | "delete" | "top" | "bottom" | "retry" | "setCategory";

export function useDownloadActions() {
  const toast = useToast();
  const run = useMutation({
    mutationFn: (vars: { ids: string[]; action: DownloadAction; deleteFiles?: boolean; category?: string }) =>
      api<{ ok: boolean; done: number }>("/downloads/actions", { method: "POST", json: vars }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });
  const add = useMutation({
    mutationFn: async (vars: { urls: string[]; files: File[]; providerId?: string; category?: string; paused: boolean }) => {
      if (vars.files.length === 0) {
        return api<AddDownloadResult>("/downloads", {
          method: "POST",
          json: { urls: vars.urls, providerId: vars.providerId, category: vars.category, paused: vars.paused },
        });
      }
      const form = new FormData();
      form.set("urls", vars.urls.join("\n"));
      if (vars.providerId) form.set("providerId", vars.providerId);
      if (vars.category) form.set("category", vars.category);
      form.set("paused", String(vars.paused));
      for (const f of vars.files) form.append("files", f, f.name);
      return api<AddDownloadResult>("/downloads", { method: "POST", body: form });
    },
  });
  const limits = useMutation({
    mutationFn: (vars: { providerId: string; limits: Partial<SpeedLimits> }) =>
      api(`/providers/${vars.providerId}/limits`, { method: "POST", json: vars.limits }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change limits"),
  });
  const providerPause = useMutation({
    mutationFn: (vars: { providerId: string; pause: boolean }) => api(`/providers/${vars.providerId}/${vars.pause ? "pause" : "resume"}`, { method: "POST" }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not pause"),
  });
  return { run, add, limits, providerPause };
}
