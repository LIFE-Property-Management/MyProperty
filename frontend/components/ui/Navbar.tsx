"use client";

import { ReactNode, useEffect, useState } from "react";

type Props = {
  brand: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
};

export function Navbar({ brand, children, actions }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <nav className="bg-surface border-b border-border">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-primary-text font-semibold">{brand}</div>

        <div className="hidden md:flex items-center gap-6 flex-1 justify-center">{children}</div>

        <div className="hidden md:flex items-center gap-2">{actions}</div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
          className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-primary-text hover:bg-primary-light"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" className="block w-5 h-0.5 bg-current relative before:absolute before:left-0 before:-top-1.5 before:w-5 before:h-0.5 before:bg-current after:absolute after:left-0 after:top-1.5 after:w-5 after:h-0.5 after:bg-current" />
        </button>
      </div>

      {open && (
        <div
          id="mobile-nav-menu"
          role="region"
          aria-label="Mobile navigation"
          className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-3"
        >
          {children}
          {actions && <div className="pt-2 border-t border-border flex flex-col gap-2">{actions}</div>}
        </div>
      )}
    </nav>
  );
}
