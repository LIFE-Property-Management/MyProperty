'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';

const NAV_CLASSES =
  'fixed top-0 left-0 z-40 flex flex-col w-60 h-dvh ' +
  'bg-surface md:border-r md:border-border';

const NAV_OPEN_MOBILE = 'translate-x-0';
const NAV_CLOSED_MOBILE = '-translate-x-full md:translate-x-0';

const BACKDROP_CLASSES = 'fixed inset-0 z-30 bg-primary-text/40 md:hidden';
const BACKDROP_OPEN = 'block';
const BACKDROP_CLOSED = 'hidden';

const BRAND_CLASSES = 'flex items-center px-4 py-5';

const LIST_CLASSES =
  'list-none flex flex-col gap-1 p-3 flex-1 overflow-y-auto m-0';

const LINK_BASE =
  'relative flex items-center gap-3 px-3 py-2 rounded-md ' +
  'text-sm font-medium ' +
  'transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const LINK_ACTIVE = 'bg-primary-light text-primary';
const LINK_INACTIVE = 'text-primary-text hover:bg-neutral-light';

const INDICATOR_CLASSES =
  'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-sm bg-primary';

const ACCOUNT_SLOT_CLASSES = 'border-t border-border p-3';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarProps {
  navItems: NavItem[];
  brand?: ReactNode;
  accountSlot?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({
  navItems,
  brand,
  accountSlot,
  isOpen,
  onClose,
  ariaLabel,
}: SidebarProps) {
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isDesktop) {
      firstLinkRef.current?.focus();
    }
  }, [isOpen, isDesktop]);

  const isInert = !isDesktop && !isOpen;

  return (
    <>
      <div
        onClick={onClose}
        className={
          BACKDROP_CLASSES + ' ' + (isOpen ? BACKDROP_OPEN : BACKDROP_CLOSED)
        }
      />

      <nav
        aria-label={ariaLabel ?? 'Sidebar navigation'}
        inert={isInert || undefined}
        className={
          NAV_CLASSES + ' ' + (isOpen ? NAV_OPEN_MOBILE : NAV_CLOSED_MOBILE)
        }
      >
        {brand && <div className={BRAND_CLASSES}>{brand}</div>}

        <ul className={LIST_CLASSES}>
          {navItems.map((item, index) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  ref={index === 0 ? firstLinkRef : undefined}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={onClose}
                  className={
                    LINK_BASE +
                    ' ' +
                    (active ? LINK_ACTIVE : LINK_INACTIVE)
                  }
                >
                  {active && (
                    <span className={INDICATOR_CLASSES} aria-hidden="true" />
                  )}
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {accountSlot && (
          <div className={ACCOUNT_SLOT_CLASSES}>{accountSlot}</div>
        )}
      </nav>
    </>
  );
}

Sidebar.displayName = 'Sidebar';

export default Sidebar;
