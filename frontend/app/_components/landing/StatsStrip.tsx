import { z } from "zod";
import StatsStripView, { type PublicStats } from "./StatsStripView";

// Public, global, cacheable landing-page stats. Fetched server-side so the
// numbers ship in the initial HTML (SEO + no client CORS hop) and are cached
// for 5 minutes via the Next data cache. The endpoint is unauthenticated.
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

async function getPublicStats(): Promise<PublicStats> {
    // Read at call time: in standalone runtime the var is present in process.env;
    // unset in dev (and tests) — fall back to zeros rather than fetch a bad URL.
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

export default async function StatsStrip() {
    const stats = await getPublicStats();
    return <StatsStripView {...stats} />;
}
