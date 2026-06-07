const fakeProperties = [
    { address: "Maple Street 12", tenant: "Sarah Johnson", rent: "$1,200", status: "Paid" },
    { address: "Oak Avenue 7B", tenant: "Michael Chen", rent: "$950", status: "Pending" },
    { address: "Pine Road 34", tenant: "Emma Wilson", rent: "$1,500", status: "Paid" },
];

const sidebarItems = ["Dashboard", "Properties", "Tenants"];

export default function DashboardPreview() {
    return (
        <section className="px-6 py-16 md:py-20 bg-background">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-3xl md:text-4xl font-semibold text-primary-text tracking-tight mb-3">
                        Your portfolio at a glance
                    </h2>
                    <p className="text-muted-text text-lg max-w-lg mx-auto">
                        One dashboard to see everything — leases, payments, and tenants.
                    </p>
                </div>

                {/* Faux browser window */}
                <div
                    className="rounded-xl border border-border shadow-lg overflow-hidden pointer-events-none select-none"
                    aria-hidden="true"
                >
                    {/* Browser chrome */}
                    <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-400" />
                        <span className="w-3 h-3 rounded-full bg-yellow-400" />
                        <span className="w-3 h-3 rounded-full bg-green-400" />
                        <div className="ml-4 flex-1 max-w-xs h-5 bg-background border border-border rounded-md" />
                    </div>

                    {/* Dashboard layout */}
                    <div className="flex bg-background min-h-[320px]">
                        {/* Sidebar */}
                        <aside className="hidden md:flex flex-col w-44 border-r border-border bg-surface py-4 px-3 gap-1 flex-shrink-0">
                            {sidebarItems.map((item, i) => (
                                <div
                                    key={item}
                                    className={`rounded-md px-3 py-2 text-sm font-medium ${
                                        i === 0
                                            ? "bg-primary-light text-primary"
                                            : "text-muted-text"
                                    }`}
                                >
                                    {item}
                                </div>
                            ))}
                        </aside>

                        {/* Main content */}
                        <div className="flex-1 p-5 overflow-hidden">
                            {/* Stat cards */}
                            <div className="grid grid-cols-3 gap-3 mb-5">
                                {[
                                    { label: "Properties", value: "3" },
                                    { label: "Active leases", value: "3" },
                                    { label: "This month", value: "$3,650" },
                                ].map(({ label, value }) => (
                                    <div
                                        key={label}
                                        className="bg-surface border border-border rounded-lg px-4 py-3"
                                    >
                                        <p className="text-xs text-muted-text mb-1">{label}</p>
                                        <p className="font-heading text-lg font-semibold text-primary-text">
                                            {value}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Properties table */}
                            <div className="bg-surface border border-border rounded-lg overflow-hidden">
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 px-4 py-2.5 border-b border-border">
                                    <span className="text-xs font-medium text-muted-text">
                                        Property
                                    </span>
                                    <span className="text-xs font-medium text-muted-text hidden md:block">
                                        Tenant
                                    </span>
                                    <span className="text-xs font-medium text-muted-text">
                                        Rent
                                    </span>
                                    <span className="text-xs font-medium text-muted-text">
                                        Status
                                    </span>
                                </div>
                                {fakeProperties.map((row) => (
                                    <div
                                        key={row.address}
                                        className="grid grid-cols-3 md:grid-cols-4 gap-4 px-4 py-3 border-b border-border last:border-b-0"
                                    >
                                        <span className="text-sm text-primary-text truncate">
                                            {row.address}
                                        </span>
                                        <span className="text-sm text-muted-text truncate hidden md:block">
                                            {row.tenant}
                                        </span>
                                        <span className="text-sm text-primary-text">
                                            {row.rent}
                                        </span>
                                        <span
                                            className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${
                                                row.status === "Paid"
                                                    ? "bg-primary-light text-primary"
                                                    : "bg-surface border border-border text-muted-text"
                                            }`}
                                        >
                                            {row.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
