"use client";

import { useQuery } from "@tanstack/react-query";
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
        const r = await fetch("/api/public-stats");
        if (!r.ok) return EMPTY_STATS;
        const result = publicStatsSchema.safeParse(await r.json());
        if (result.success) return result.data;
        return EMPTY_STATS;
      } catch {
        return EMPTY_STATS;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
