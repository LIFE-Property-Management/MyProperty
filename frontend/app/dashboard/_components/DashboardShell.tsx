"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, LayoutDashboard, Building2, Users, Mail } from "lucide-react";
import { Sidebar, type NavItem } from "@/components/ui/Sidebar";
import { AccountBlock } from "./AccountBlock";

// TODO Batch K (Keycloak generalization):
// MockProvider and KeycloakInit are NOT wrapped in app/dashboard/layout.tsx yet.
// MSW will not intercept landlord API calls and Keycloak will not initialize
// for landlord auth until the dashboard layout mirrors the provider-wrapping
// pattern in app/(tenant)/layout.tsx.

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "Properties", icon: Building2 },
  { href: "/dashboard/tenants", label: "Tenants", icon: Users },
  { href: "/dashboard/invites", label: "Invites", icon: Mail },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/properties": "Properties",
  "/dashboard/tenants": "Tenants",
  "/dashboard/invites": "Invites",
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-surface border-b border-border h-14 px-4 md:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center w-9 h-9 rounded-md text-primary-text hover:bg-neutral-light transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className="text-base">{pageTitle}</span>
      </header>

      <Sidebar
        navItems={NAV_ITEMS}
        brand={<span className="font-heading text-lg font-semibold">MyProperty</span>}
        accountSlot={<AccountBlock />}
        isOpen={isOpen}
        onClose={handleClose}
        ariaLabel="Landlord navigation"
      />

      <main id="main-content" className="md:ml-60 p-6">
        {children}
      </main>
    </>
  );
}

DashboardShell.displayName = "DashboardShell";

export default DashboardShell;
