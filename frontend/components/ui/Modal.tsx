"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  dismissOnBackdrop?: boolean;
  dismissOnEsc?: boolean;
  showCloseButton?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

const BACKDROP_CLASSES =
  "fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4";

const DIALOG_BASE_CLASSES =
  "relative w-full bg-surface border border-border " +
  "rounded-t-xl md:rounded-xl " +
  "max-h-[90vh] overflow-hidden flex flex-col";

const HEADER_CLASSES =
  "flex items-center justify-between px-6 py-4 border-b border-border";

const TITLE_CLASSES =
  "font-heading text-lg font-semibold text-primary-text";

const CLOSE_BUTTON_CLASSES =
  "p-1 rounded-md text-muted-text " +
  "hover:text-primary-text hover:bg-background " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
  "transition-colors";

const BODY_CLASSES = "px-6 py-4 overflow-y-auto flex-1 text-primary-text";

const FOOTER_CLASSES =
  "px-6 py-4 border-t border-border flex items-center justify-end gap-2";

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Modal({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
  footer,
  dismissOnBackdrop = false,
  dismissOnEsc = true,
  showCloseButton = true,
  initialFocusRef,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: one-shot SSR → client transition
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !dismissOnEsc) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, dismissOnEsc, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previousActiveElementRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    const elementToFocus =
      initialFocusRef?.current ??
      closeButtonRef.current ??
      (dialogRef.current?.querySelector(FOCUSABLE_SELECTORS) as HTMLElement | null);
    elementToFocus?.focus();
    return () => {
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen, initialFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.closest('[aria-hidden="true"]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!mounted) return null;
  if (!isOpen) return null;

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (dismissOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const showHeader = Boolean(title) || showCloseButton;

  const modalTree = (
    <div className={BACKDROP_CLASSES} onMouseDown={handleBackdropMouseDown}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={DIALOG_BASE_CLASSES + " " + SIZE_CLASSES[size]}
      >
        {showHeader && (
          <div className={HEADER_CLASSES}>
            {title ? (
              <h2 id={titleId} className={TITLE_CLASSES}>
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showCloseButton && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={CLOSE_BUTTON_CLASSES}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={BODY_CLASSES}>{children}</div>
        {footer && <div className={FOOTER_CLASSES}>{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modalTree, document.body);
}

Modal.displayName = "Modal";

export { Modal };
export default Modal;
