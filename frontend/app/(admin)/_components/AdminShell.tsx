"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/hooks";

// Minimal admin-portal chrome: a top header with the brand and a sign-out
// control, plus a centered page container. Deliberately lighter than the
// landlord DashboardShell — the admin portal is a single stakeholder dashboard,
// so there is no sidebar navigation to render.
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-surface border-b border-border h-14 px-4 md:px-6">
        <span className="font-heading text-lg font-semibold">MyProperty Admin</span>
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden text-sm text-muted-text md:inline">{user.email}</span>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-sm text-primary-text hover:bg-neutral-light transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Sign out
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl p-6">
        {children}
      </main>
    </>
  );
}

AdminShell.displayName = "AdminShell";

export default AdminShell;
