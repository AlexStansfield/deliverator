import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@deliverator/shared";
import { api } from "./api";
import { useAuth } from "./auth";

export function usePreferences() {
  const { authenticated } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api<UserPreferences>("/settings/preferences"),
    enabled: authenticated,
    staleTime: Infinity,
  });
  const save = useMutation({
    mutationFn: (prefs: UserPreferences) => api<UserPreferences>("/settings/preferences", { method: "PUT", json: prefs }),
    onMutate: (prefs) => qc.setQueryData(["preferences"], prefs),
    onSuccess: (prefs) => qc.setQueryData(["preferences"], prefs),
  });
  const prefs = query.data ?? DEFAULT_PREFERENCES;
  return {
    prefs,
    loaded: query.isSuccess,
    update: (patch: Partial<UserPreferences>) => save.mutateAsync({ ...prefs, ...patch }),
    saving: save.isPending,
  };
}
