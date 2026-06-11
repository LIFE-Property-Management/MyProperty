import { z } from "zod";

// Server-side data helpers. These run only in Server Components / route
// handlers — never import them from a client ("use client") component.

export interface PublicStats {
    rentCollected: number;
    currency: string;
    propertiesManaged: number;
    landlordsOnboarded: number;
}

const publicStatsSchema = z.object({
    rentCollected: z.number(),
    currency: z.string(),
    propertiesManaged: z.number().int().nonnegative(),
    landlordsOnboarded: z.number().int().nonnegative(),
});

const EMPTY_STATS: PublicStats = {
    rentCollected: 0,
    currency: "",
    propertiesManaged: 0,
    landlordsOnboarded: 0,
};

/**
 * Public, global landing-page stats. Fetched server-side (no client CORS hop)
 * and cached for 5 minutes via the Next data cache, then validated. Any failure
 * — unset backend URL, non-OK response, bad payload, network error — degrades to
 * zeros so the landing page always renders. The backend endpoint is anonymous.
 *
 * NEXT_PUBLIC_API_BASE_URL is read at call time: present in the standalone
 * runtime, unset in dev/tests (falls back to zeros rather than fetch a bad URL).
 */
export async function getPublicStats(): Promise<PublicStats> {
    const backend = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    if (!backend) return EMPTY_STATS;
    try {
        const res = await fetch(`${backend}/api/v1/stats/public`, {
            next: { revalidate: 300 },
        });
        if (!res.ok) return EMPTY_STATS;
        const parsed = publicStatsSchema.safeParse(await res.json());
        return parsed.success ? parsed.data : EMPTY_STATS;
    } catch {
        return EMPTY_STATS;
    }
}
