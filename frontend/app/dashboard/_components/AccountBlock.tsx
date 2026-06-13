"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/hooks";

/**
 * Avatar initials from the profile name (e.g. "Drin Prekaj" → "DP"). Falls back
 * to the first email character, then "U", so the avatar is never empty while
 * /me is loading or when a name is absent.
 */
function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null,
): string {
  const fromName = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`;
  if (fromName) return fromName.toUpperCase();
  return email ? email.charAt(0).toUpperCase() : "U";
}

export function AccountBlock() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { user, firstName, lastName, signOut } = useAuth();

  const email = user?.email ?? null;
  const role = user?.portal
    ? user.portal.charAt(0).toUpperCase() + user.portal.slice(1)
    : "User";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initials = getInitials(firstName, lastName, email);
  const displayName = fullName || email || "User";

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 hover:bg-neutral-light transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary font-medium text-sm">
          {initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-text">{role}</span>
        </span>
        {isOpen ? (
          <ChevronUp size={16} aria-hidden="true" data-testid="account-chevron-up" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" data-testid="account-chevron-down" />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-border rounded-md shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center px-3 py-2 text-sm text-primary-text hover:bg-neutral-light transition-colors duration-150"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountBlock;
