import LandlordLayout from "./LandlordLayout";
import LandlordDashboard from "./LandlordDashboard";

export default function DashboardPage() {
    return (
        <LandlordLayout pageTitle="Dashboard">
            <LandlordDashboard />
        </LandlordLayout>
    );
}