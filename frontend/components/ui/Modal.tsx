"use client";

import { ReactNode, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-lg bg-surface border border-border rounded-t-lg md:rounded-lg shadow-xl max-h-[90vh] flex flex-col"
      >
        {title && (
          <header className="px-4 md:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-primary-text">{title}</h2>
          </header>
        )}
        <div className="px-4 md:px-6 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="px-4 md:px-6 py-4 border-t border-border flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
