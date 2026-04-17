"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY = "#275D2C";
const PRIMARY_LIGHT = "#e8f0e9";
const PRIMARY_DARK = "#1a3d1d";
const BG = "#fbfbff";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#4b5563";
const BORDER = "#e5e7eb";
const SIDEBAR_WIDTH = 240;

// ── Icons ────────────────────────────────────────────────────────────────────

function IconDashboard({ active }: { active: boolean }) {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="7" height="7" rx="2" fill={active ? PRIMARY : "none"} stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" />
    <rect x="10" y="1" width="7" height="7" rx="2" fill={active ? PRIMARY : "none"} stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" />
    <rect x="1" y="10" width="7" height="7" rx="2" fill={active ? PRIMARY : "none"} stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" />
    <rect x="10" y="10" width="7" height="7" rx="2" fill="none" stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" />
        </svg>
);
}

function IconProperties({ active }: { active: boolean }) {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 2L1.5 8v8h5v-4.5h5V16h5V8L9 2z" fill={active ? PRIMARY : "none"} stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
);
}

function IconTenants({ active }: { active: boolean }) {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="6" r="3.5" fill={active ? PRIMARY : "none"} stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" />
    <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke={active ? PRIMARY : TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
);
}

function IconMenu() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 5h14M3 10h14M3 15h14" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
);
}

function IconClose() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 5l10 10M15 5L5 15" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
);
}

function IconChevron({ open }: { open: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}>
    <path d="M3 5l4 4 4-4" stroke={TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
);
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ collapsed }: { collapsed: boolean }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
    <div style={{
        width: 32, height: 32, minWidth: 32,
            background: PRIMARY,
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
    }}>
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path d="M9 2L2 7v9h5v-5h4v5h5V7L9 2z" fill="#fff" fillOpacity={0.95} />
    </svg>
    </div>
    <span style={{
        fontFamily: "'Playfair Display', serif",
            fontSize: 17,
            fontWeight: 600,
            color: TEXT,
            letterSpacing: -0.3,
            whiteSpace: "nowrap",
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? "translateX(-8px)" : "translateX(0)",
            transition: "opacity 0.2s, transform 0.2s",
            pointerEvents: "none",
    }}>
    MyProperty
    </span>
    </div>
);
}

// ── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({
                     href,
                     label,
                     icon,
                     active,
                     collapsed,
                 }: {
    href: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    collapsed: boolean;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <Link
            href={href}
    aria-current={active ? "page" : undefined}
    style={{ textDecoration: "none" }}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
>
    <div style={{
        display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "10px 12px" : "10px 14px",
            borderRadius: 8,
            background: active ? PRIMARY_LIGHT : hovered ? "#f3f4f6" : "transparent",
            cursor: active ? "default" : "pointer",
            transition: "background 0.15s",
            justifyContent: collapsed ? "center" : "flex-start",
            position: "relative",
    }}>
    {/* Active indicator */}
    {active && (
        <div style={{
        position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 20,
            background: PRIMARY,
            borderRadius: "0 3px 3px 0",
    }} />
    )}
    <div style={{ flexShrink: 0, marginLeft: active ? 4 : 0 }}>{icon}</div>
    {!collapsed && (
        <span style={{
        fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: active ? 500 : 400,
            color: active ? PRIMARY : TEXT,
            whiteSpace: "nowrap",
            opacity: collapsed ? 0 : 1,
            transition: "opacity 0.15s",
    }}>
        {label}
        </span>
    )}
    </div>
    </Link>
);
}

// ── User Badge ────────────────────────────────────────────────────────────────

function UserBadge({ collapsed }: { collapsed: boolean }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ position: "relative" }}>
    <button
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={collapsed ? "User menu" : undefined}
    style={{
        display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            cursor: "pointer",
            background: "#fff",
            width: "100%",
            justifyContent: collapsed ? "center" : "space-between",
            transition: "background 0.15s",
            fontFamily: "inherit",
    }}
    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{
        width: 28, height: 28, minWidth: 28,
            borderRadius: "50%",
            background: PRIMARY_LIGHT,
            border: `1px solid ${PRIMARY}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color: PRIMARY,
            fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0,
    }}>
    JD
    </div>
    {!collapsed && (
        <div style={{ overflow: "hidden" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>John Doe</p>
    <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>Landlord</p>
    </div>
    )}
    </div>
    {!collapsed && <IconChevron open={open} />}
    </button>

        {/* Dropdown */}
        {open && !collapsed && (
            <div
                role="menu"
                style={{
                position: "absolute",
                    bottom: "100%",
                    left: 0,
                    right: 0,
                    marginBottom: 6,
                    background: "#fff",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}>
            {[
                { label: "Account settings" },
                { label: "Sign out", danger: true },
            ].map(item => (
                <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                style={{
                display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif",
                    color: item.danger ? "#b91c1c" : TEXT,
                    cursor: "pointer",
                    transition: "background 0.1s",
                    background: "none",
                    border: "none",
            }}
                onMouseEnter={e => (e.currentTarget.style.background = item.danger ? "#fef2f2" : "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
                onClick={() => setOpen(false)}
            >
                {item.label}
                </button>
            ))}
            </div>
        )}
        </div>
    );
    }

// ── Sidebar ───────────────────────────────────────────────────────────────────

    function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
        const pathname = usePathname();

        const navItems = [
            { href: "/dashboard", label: "Dashboard", icon: (active: boolean) => <IconDashboard active={active} /> },
            { href: "/dashboard/properties", label: "Properties", icon: (active: boolean) => <IconProperties active={active} /> },
            { href: "/dashboard/tenants", label: "Tenants", icon: (active: boolean) => <IconTenants active={active} /> },
        ];

        return (
            <>
                {/* Sidebar */}
            <div style={{
            width: collapsed ? 60 : SIDEBAR_WIDTH,
                minHeight: "100vh",
                background: "#fff",
                borderRight: `1px solid ${BORDER}`,
                display: "flex",
                flexDirection: "column",
                padding: "16px 10px",
                boxSizing: "border-box",
                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 40,
                overflow: "hidden",
        }}>
        {/* Top: logo + toggle */}
        <div style={{
            display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "space-between",
                marginBottom: 28,
                paddingLeft: collapsed ? 0 : 4,
        }}>
        {!collapsed && <Logo collapsed={collapsed} />}
        <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
            background: "none",
                border: "none",
                cursor: "pointer",
                padding: 6,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: TEXT_MUTED,
                flexShrink: 0,
        }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
            {collapsed ? <IconMenu /> : <IconClose />}
            </button>
            {collapsed && <Logo collapsed={collapsed} />}
            </div>

                {/* Nav */}
                <nav aria-label="Sidebar navigation" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                {navItems.map(item => {
                    const active = pathname === item.href;
                    return (
                        <NavItem
                            key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon(active)}
                    active={active}
                    collapsed={collapsed}
                    />
                );
                })}
                </nav>

                {/* User */}
                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
                <UserBadge collapsed={collapsed} />
            </div>
            </div>
            </>
            );
            }

// ── Top Bar ───────────────────────────────────────────────────────────────────

            function TopBar({ sidebarWidth, pageTitle }: { sidebarWidth: number; pageTitle: string }) {
                return (
                    <div style={{
                    position: "fixed",
                        top: 0,
                        left: sidebarWidth,
                        right: 0,
                        height: 56,
                        background: "#fff",
                        borderBottom: `1px solid ${BORDER}`,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 28px",
                        zIndex: 30,
                        transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                }}>
                <h1 style={{
                    margin: 0,
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 18,
                        fontWeight: 600,
                        color: TEXT,
                        letterSpacing: -0.2,
                }}>
                {pageTitle}
                </h1>
                </div>
            );
            }

// ── Layout ────────────────────────────────────────────────────────────────────

            export default function LandlordLayout({ children, pageTitle = "Dashboard" }: { children: React.ReactNode; pageTitle?: string }) {
                const [collapsed, setCollapsed] = useState(false);
                const sidebarWidth = collapsed ? 60 : SIDEBAR_WIDTH;

                return (
                    <>
                <div style={{ display: "flex", minHeight: "100vh", background: BG, fontFamily: "'DM Sans', sans-serif" }}>
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

                {/* Main content */}
                <div style={{
                    marginLeft: sidebarWidth,
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        minHeight: "100vh",
                }}>
                <TopBar sidebarWidth={sidebarWidth} pageTitle={pageTitle} />

                <main id="main-content" style={{
                    flex: 1,
                        padding: "84px 28px 28px",
                        maxWidth: 1200,
                        width: "100%",
                        boxSizing: "border-box",
                }}>
                {children}
                </main>
                </div>
                </div>
                </>
            );
}