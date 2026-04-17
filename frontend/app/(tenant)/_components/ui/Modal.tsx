'use client'

// Tenant Portal — Modal primitive.
// Portal-rendered dialog with backdrop, escape-to-close, body scroll lock,
// and basic focus management. Dismiss-on-backdrop defaults to false because
// this portal is forms-first (MT-5 rejection modal, MT-6 document upload
// preview, etc.) and losing a half-typed form to an accidental click is
// worse than requiring an explicit Cancel.
//
// Focus management: we save document.activeElement before opening, focus the
// close button (or a consumer-provided initialFocusRef) on open, and restore
// focus to the saved element on close. A full focus trap is NOT implemented
// here — see the phase-2 TODO below; the M2.7 a11y audit will wire it in
// with a dedicated dep.
//
// Consumers passing an onClose defined inline in a parent component should
// wrap it in useCallback; otherwise the escape-key effect re-subscribes on
// every parent render.

import {
  useEffect,
  useId,
  useRef,
  useState,
  ReactNode,
  MouseEvent,
  RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

export type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
  dismissOnBackdrop?: boolean
  dismissOnEsc?: boolean
  showCloseButton?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

const BACKDROP_CLASSES =
  'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4'

const DIALOG_BASE_CLASSES =
  'relative w-full ' +
  'bg-white dark:bg-[#161b22] ' +
  'border border-[#e5e7eb] dark:border-[#30363d] ' +
  'rounded-xl shadow-lg ' +
  'max-h-[90vh] overflow-hidden ' +
  'flex flex-col'

const HEADER_CLASSES =
  'flex items-center justify-between ' +
  'px-6 py-4 ' +
  'border-b border-[#e5e7eb] dark:border-[#30363d]'

const TITLE_CLASSES =
  'font-serif text-lg font-semibold text-[#111111] dark:text-[#f0f6fc]'

const CLOSE_BUTTON_CLASSES =
  'p-1 rounded-md ' +
  'text-[#6b7280] dark:text-[#8b949e] ' +
  'hover:text-[#111111] dark:hover:text-[#f0f6fc] ' +
  'hover:bg-[#f3f4f6] dark:hover:bg-[#1c2128] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#275D2C] dark:focus-visible:ring-[#3fb950] ' +
  'transition-colors duration-150'

const BODY_CLASSES =
  'px-6 py-4 overflow-y-auto flex-1 text-[#111111] dark:text-[#f0f6fc]'

const FOOTER_CLASSES =
  'px-6 py-4 ' +
  'border-t border-[#e5e7eb] dark:border-[#30363d] ' +
  'flex items-center justify-end gap-2'

function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  dismissOnBackdrop = false,
  dismissOnEsc = true,
  showCloseButton = true,
  initialFocusRef,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Wait for client mount before touching document.body (createPortal target).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: one-shot SSR → client transition
    setMounted(true)
  }, [])

  // Escape-to-close.
  useEffect(() => {
    if (!isOpen || !dismissOnEsc) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, dismissOnEsc, onClose])

  // Body scroll lock while open. Saves and restores the prior overflow value
  // so nested callers don't leak state.
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  // Focus management: save prior focus on open, restore on close.
  useEffect(() => {
    if (!isOpen) return
    previousActiveElementRef.current =
      (document.activeElement as HTMLElement | null) ?? null
    const elementToFocus =
      initialFocusRef?.current ?? closeButtonRef.current
    elementToFocus?.focus()
    return () => {
      previousActiveElementRef.current?.focus()
    }
  }, [isOpen, initialFocusRef])

  if (!mounted) return null

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (dismissOnBackdrop && event.target === event.currentTarget) {
      onClose()
    }
  }

  const showHeader = Boolean(title) || showCloseButton

  const modalTree = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={BACKDROP_CLASSES}
          onMouseDown={handleBackdropMouseDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={DIALOG_BASE_CLASSES + ' ' + SIZE_CLASSES[size]}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
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
            {/* TODO(phase-2): implement focus trap for WCAG 2.1 AA compliance (M2.7) */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalTree, document.body)
}

export { Modal }
export default Modal
