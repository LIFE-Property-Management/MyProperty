import LandingNav from "./_components/landing/LandingNav";
import HeroSection from "./_components/landing/HeroSection";
import DashboardPreview from "./_components/landing/DashboardPreview";
import FeaturesGrid from "./_components/landing/FeaturesGrid";
import HowItWorks from "./_components/landing/HowItWorks";
import StatsStrip from "./_components/landing/StatsStrip";
import FinalCTA from "./_components/landing/FinalCTA";
import LandingFooter from "./_components/landing/LandingFooter";

export default function HomePage() {
    return (
        <>
            <LandingNav />
            <main id="main-content" className="flex-1">
                <HeroSection />
                <DashboardPreview />
                <FeaturesGrid />
                <HowItWorks />
                <StatsStrip />
                <FinalCTA />
            </main>
            <LandingFooter />
        </>
    );
}
