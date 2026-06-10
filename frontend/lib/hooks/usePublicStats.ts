"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import { z } from "zod";

const publicStatsSchema = z.object({
  rentCollected: z.number(),
  propertiesManaged: z.number().int().nonnegative(),
  landlordsOnboarded: z.number().int().nonnegative(),
});

export type PublicStats = z.infer<typeof publicStatsSchema>;

const EMPTY_STATS: PublicStats = {
  rentCollected: 0,
  propertiesManaged: 0,
  landlordsOnboarded: 0,
};

export function usePublicStats() {
  return useQuery<PublicStats>({
    queryKey: queryKeys.landing.stats(),
    queryFn: async () => {
      try {
        const r = await apiClient.get(ENDPOINTS.publicStats);
        const result = publicStatsSchema.safeParse(r.data);
        if (result.success) return result.data;
        console.warn("Public stats schema mismatch:", result.error);
        return EMPTY_STATS;
      } catch {
        return EMPTY_STATS;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
