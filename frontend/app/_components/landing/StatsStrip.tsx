import { getPublicStats } from "@/lib/api/server";
import StatsStripView from "./StatsStripView";

// Public, global, cacheable landing-page stats — fetched server-side (see
// getPublicStats) so the numbers ship in the initial HTML with no client CORS
// hop. Presentation lives in the pure StatsStripView.
export default async function StatsStrip() {
    const stats = await getPublicStats();
    return <StatsStripView {...stats} />;
}
