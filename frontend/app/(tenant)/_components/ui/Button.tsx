'use client'

// Tenant Portal — Button primitive.
// Motion-enabled button with four variants (primary/secondary/ghost/danger),
// three sizes, loading state that swaps leftIcon for a Spinner, and optional
// left/right icon slots. Ref is forwarded so React Hook Form's register() can
// attach a DOM ref to the underlying <button>. Type defaults to "button" to
// prevent accidental form submission — consumers opt into submit explicitly.

import { forwardRef, ReactNode } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import Spinner from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 ' +
  'font-medium rounded-md ' +
  'transition-colors duration-150 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-[#275D2C] dark:focus-visible:ring-[#3fb950] ' +
  'focus-visible:ring-offset-[#fbfbff] dark:focus-visible:ring-offset-[#0d1117] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

// Hover/active shades are derived by darkening base ~15%/25% (light) and
// lightening proportionally (dark). These hex values are fixed by the spec.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#275D2C] text-white hover:bg-[#1f4a24] active:bg-[#18391c] ' +
    'dark:bg-[#3fb950] dark:text-[#0d1117] dark:hover:bg-[#2ea043] dark:active:bg-[#238636]',
  secondary:
    'bg-white text-[#111111] border border-[#e5e7eb] hover:bg-[#fbfbff] active:bg-[#f3f4f6] ' +
    'dark:bg-[#161b22] dark:text-[#f0f6fc] dark:border-[#30363d] dark:hover:bg-[#1c2128] dark:active:bg-[#22272e]',
  ghost:
    'bg-transparent text-[#111111] hover:bg-[#f3f4f6] active:bg-[#e5e7eb] ' +
    'dark:text-[#f0f6fc] dark:hover:bg-[#1c2128] dark:active:bg-[#22272e]',
  danger:
    'bg-[#931F1D] text-white hover:bg-[#7a1917] active:bg-[#621411] ' +
    'dark:bg-[#f85149] dark:text-[#0d1117] dark:hover:bg-[#e0453e] dark:active:bg-[#c73a33]',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    children,
    className,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes =
    BASE_CLASSES +
    ' ' +
    SIZE_CLASSES[size] +
    ' ' +
    VARIANT_CLASSES[variant] +
    (fullWidth ? ' w-full' : '') +
    (className ? ' ' + className : '')

  // When loading, the spinner replaces leftIcon but children stay visible.
  const resolvedLeft = isLoading ? <Spinner size="sm" /> : leftIcon

  return (
    <motion.button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      {...rest}
    >
      {resolvedLeft}
      {children}
      {!isLoading && rightIcon}
    </motion.button>
  )
})

Button.displayName = 'Button'

export { Button }
export default Button
