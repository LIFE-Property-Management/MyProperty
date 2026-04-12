"use client";

import { useState } from "react";
import Link from "next/link";

const PRIMARY = "#275D2C";
const PRIMARY_LIGHT = "#e8f0e9";
const BG = "#fbfbff";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const ERROR = "#b91c1c";
const ERROR_LIGHT = "#fef2f2";
const WARNING = "#92400e";
const WARNING_LIGHT = "#fffbeb";
const SUCCESS = "#166534";
const SUCCESS_LIGHT = "#f0fdf4";

// ── Mock Data ─────────────────────────────────────────────────────────────────

const overduePayments = [
    { id: "1", tenant: "John Smith", property: "123 Main St", amount: 400, daysOverdue: 12 },
    { id: "2", tenant: "Sara Jones", property: "456 Oak Ave", amount: 550, daysOverdue: 5 },
    { id: "3", tenant: "Mike Ross", property: "789 Elm St", amount: 320, daysOverdue: 3 },
];

const expiringLeases = [
    { id: "1", tenant: "Anna Belle", property: "22 Rose Ln", leaseEndDate: "Apr 20, 2026", daysRemaining: 14 },
    { id: "2", tenant: "Chris Ward", property: "88 Pine Rd", leaseEndDate: "Apr 28, 2026", daysRemaining: 22 },
    { id: "3", tenant: "Lena Müller", property: "5 Cedar Blvd", leaseEndDate: "May 1, 2026", daysRemaining: 25 },
];

const recentPayments = [
    { id: "1", tenant: "Tom Baker", property: "14 Birch St", amount: 480, method: "Digital", datePaid: "Apr 1, 2026" },
    { id: "2", tenant: "Mia Fox", property: "33 Maple Ave", amount: 600, method: "Cash", datePaid: "Mar 31, 2026" },
    { id: "3", tenant: "Jay Park", property: "7 Willow Way", amount: 350, method: "Digital", datePaid: "Mar 30, 2026" },
    { id: "4", tenant: "Nora Quinn", property: "61 Spruce Ct", amount: 420, method: "Cash", datePaid: "Mar 29, 2026" },
    { id: "5", tenant: "Sam Lee", property: "9 Aspen Dr", amount: 510, method: "Digital", datePaid: "Mar 28, 2026" },
];

const upcomingPayments = Array.from({ length: 18 }, (_, i) => ({
    id: String(i + 1),
    tenant: ["Elena Vasic", "Marko Petrovic", "Ana Jovic", "Stefan Novak", "Nina Popovic", "Luka Ilic"][i % 6],
    property: [`${10 + i * 3} Some St`, `${20 + i * 2} Other Ave`, `${5 + i} Third Rd`][i % 3],
    amount: [380, 450, 500, 620, 290, 410][i % 6],
    dueDate: `Apr ${5 + i}, 2026`,
}));

const ITEMS_PER_PAGE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function TenantLink({ id, name }: { id: string; name: string }) {
    return (
        <Link
            href={`/dashboard/tenants/${id}`}
            style={{
                color: PRIMARY,
                fontWeight: 500,
                textDecoration: "none",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
        >
            {name}
        </Link>
    );
}

function Badge({ label, type }: { label: string; type: "error" | "warning" | "success" | "neutral" }) {
    const colors = {
        error: { bg: ERROR_LIGHT, color: ERROR },
        warning: { bg: WARNING_LIGHT, color: WARNING },
        success: { bg: SUCCESS_LIGHT, color: SUCCESS },
        neutral: { bg: "#f3f4f6", color: TEXT_MUTED },
    };
    const c = colors[type];
    return (
        <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            background: c.bg,
            color: c.color,
        }}>
      {label}
    </span>
    );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div style={{
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: "20px 24px",
            flex: 1,
            minWidth: 160,
        }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: TEXT_MUTED, fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600, color: TEXT, fontFamily: "'Playfair Display', serif" }}>{value}</p>
        </div>
    );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT, fontFamily: "'Playfair Display', serif", letterSpacing: -0.2 }}>
                {title}
            </h2>
            {subtitle && <p style={{ margin: "3px 0 0", fontSize: 13, color: TEXT_MUTED, fontFamily: "'DM Sans', sans-serif" }}>{subtitle}</p>}
        </div>
    );
}

// ── Table Shell ───────────────────────────────────────────────────────────────

function Table({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) {
    return (
        <div style={{
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: "hidden",
        }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: "#f9fafb" }}>
                    {headers.map(h => (
                        <th key={h} style={{
                            padding: "10px 16px",
                            textAlign: "left",
                            fontSize: 12,
                            fontWeight: 500,
                            color: TEXT_MUTED,
                            fontFamily: "'DM Sans', sans-serif",
                            whiteSpace: "nowrap",
                            letterSpacing: 0.3,
                            textTransform: "uppercase",
                        }}>
                            {h}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {empty ? (
                    <tr>
                        <td colSpan={headers.length} style={{
                            padding: "32px 16px",
                            textAlign: "center",
                            fontSize: 14,
                            color: TEXT_MUTED,
                            fontFamily: "'DM Sans', sans-serif",
                        }}>
                            Nothing to show here
                        </td>
                    </tr>
                ) : children}
                </tbody>
            </table>
        </div>
    );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
    return (
        <td style={{
            padding: "12px 16px",
            fontSize: 14,
            color: muted ? TEXT_MUTED : TEXT,
            fontFamily: "'DM Sans', sans-serif",
            borderBottom: `1px solid ${BORDER}`,
            whiteSpace: "nowrap",
        }}>
            {children}
        </td>
    );
}

function Tr({ children }: { children: React.ReactNode }) {
    const [hovered, setHovered] = useState(false);
    return (
        <tr
            style={{ background: hovered ? "#f9fafb" : "#fff", transition: "background 0.1s" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {children}
        </tr>
    );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return null;

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, fontFamily: "'DM Sans', sans-serif" }}>
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        style={{
                            width: 32, height: 32,
                            borderRadius: 6,
                            border: `1px solid ${p === page ? PRIMARY : BORDER}`,
                            background: p === page ? PRIMARY : "#fff",
                            color: p === page ? "#fff" : TEXT,
                            fontSize: 13,
                            fontFamily: "'DM Sans', sans-serif",
                            cursor: "pointer",
                            fontWeight: p === page ? 500 : 400,
                        }}
                    >
                        {p}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function LandlordDashboard() {
    const [upcomingPage, setUpcomingPage] = useState(1);
    const pagedUpcoming = upcomingPayments.slice((upcomingPage - 1) * ITEMS_PER_PAGE, upcomingPage * ITEMS_PER_PAGE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32, fontFamily: "'DM Sans', sans-serif" }}>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" />

            {/* Section 1 — Overview */}
            <section>
                <SectionHeader title="Overview" />
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <StatCard label="Total properties" value={12} />
                    <StatCard label="Total active tenants" value={9} />
                </div>
            </section>

            {/* Section 2 — Overdue Payments */}
            <section>
                <SectionHeader
                    title="Overdue payments"
                    subtitle={overduePayments.length > 0 ? `${overduePayments.length} tenant${overduePayments.length > 1 ? "s" : ""} with outstanding rent` : undefined}
                />
                <Table
                    headers={["Tenant", "Property", "Amount", "Days overdue"]}
                    empty={overduePayments.length === 0}
                >
                    {overduePayments.map(row => (
                        <Tr key={row.id}>
                            <Td><TenantLink id={row.id} name={row.tenant} /></Td>
                            <Td muted>{row.property}</Td>
                            <Td>€{row.amount}</Td>
                            <Td>
                                <Badge
                                    label={`${row.daysOverdue} day${row.daysOverdue > 1 ? "s" : ""}`}
                                    type={row.daysOverdue >= 10 ? "error" : "warning"}
                                />
                            </Td>
                        </Tr>
                    ))}
                </Table>
            </section>

            {/* Section 3 — Leases Expiring Soon */}
            <section>
                <SectionHeader
                    title="Leases expiring soon"
                    subtitle="Leases ending within the next 30 days"
                />
                <Table
                    headers={["Tenant", "Property", "Lease end date", "Days remaining"]}
                    empty={expiringLeases.length === 0}
                >
                    {expiringLeases.map(row => (
                        <Tr key={row.id}>
                            <Td><TenantLink id={row.id} name={row.tenant} /></Td>
                            <Td muted>{row.property}</Td>
                            <Td muted>{row.leaseEndDate}</Td>
                            <Td>
                                <Badge
                                    label={`${row.daysRemaining} day${row.daysRemaining > 1 ? "s" : ""}`}
                                    type={row.daysRemaining <= 14 ? "error" : "warning"}
                                />
                            </Td>
                        </Tr>
                    ))}
                </Table>
            </section>

            {/* Section 4 — Recent Payments */}
            <section>
                <SectionHeader
                    title="Recent payments"
                    subtitle="Last 5 payments across all properties"
                />
                <Table
                    headers={["Tenant", "Property", "Amount", "Method", "Date paid"]}
                    empty={recentPayments.length === 0}
                >
                    {recentPayments.map(row => (
                        <Tr key={row.id}>
                            <Td><TenantLink id={row.id} name={row.tenant} /></Td>
                            <Td muted>{row.property}</Td>
                            <Td>€{row.amount}</Td>
                            <Td>
                                <Badge
                                    label={row.method}
                                    type={row.method === "Digital" ? "success" : "neutral"}
                                />
                            </Td>
                            <Td muted>{row.datePaid}</Td>
                        </Tr>
                    ))}
                </Table>
            </section>

            {/* Section 5 — Upcoming Payments */}
            <section>
                <SectionHeader
                    title="Upcoming payments"
                    subtitle="All payments due in the next 30 days"
                />
                <Table
                    headers={["Tenant", "Property", "Amount", "Due date"]}
                    empty={upcomingPayments.length === 0}
                >
                    {pagedUpcoming.map(row => (
                        <Tr key={row.id}>
                            <Td><TenantLink id={row.id} name={row.tenant} /></Td>
                            <Td muted>{row.property}</Td>
                            <Td>€{row.amount}</Td>
                            <Td muted>{row.dueDate}</Td>
                        </Tr>
                    ))}
                </Table>
                <Pagination
                    page={upcomingPage}
                    total={upcomingPayments.length}
                    perPage={ITEMS_PER_PAGE}
                    onChange={setUpcomingPage}
                />
            </section>
        </div>
    );
}   