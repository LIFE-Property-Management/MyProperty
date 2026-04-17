import dynamic from "next/dynamic";
import LandlordLayout from "./LandlordLayout";

const LandlordDashboard = dynamic(() => import("./LandlordDashboard"), {
  loading: () => (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="flex items-center justify-center py-24"
    >
      <div className="h-8 w-8 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

export default function DashboardPage() {
  return (
    <LandlordLayout pageTitle="Dashboard">
      <LandlordDashboard />
    </LandlordLayout>
  );
}
