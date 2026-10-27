import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import type { FreeTrialStatus } from "@shared/trial";

export function useFreeTrial() {
  const { getToken, isSignedIn, userId } = useAuth();
  return useQuery<FreeTrialStatus>({
    queryKey: ["free-trial", userId],
    enabled: Boolean(isSignedIn && userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/free-trial", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn't check your trial. Please try again.");
      return data;
    },
  });
}
