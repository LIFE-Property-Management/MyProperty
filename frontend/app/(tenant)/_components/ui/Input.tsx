'use client'

// Tenant Portal — Input primitive.
// Labeled text input with optional helperText/error and optional left/right
// addons (e.g. a currency symbol). Ref is forwarded so React Hook Form's
// register() can attach directly to the DOM element. When an error is
// present it takes visual priority over helperText and sets aria-invalid.
// An addon wrapper is used only when addons are actually provided, so the
// standalone input keeps the simpler single-border styling.

import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftAddon?: ReactNode
  rightAddon?: ReactNode
  containerClassName?: string
}

const CONTAINER_CLASSES = 'flex flex-col gap-1.5 w-full'

const LABEL_CLASSES =
  'text-sm font-medium text-[#111111] dark:text-[#f0f6fc]'

const HELPER_CLASSES = 'text-xs text-[#6b7280] dark:text-[#8b949e]'
const ERROR_CLASSES = 'text-xs text-[#931F1D] dark:text-[#f85149]'

const STANDALONE_INPUT_BASE =
  'w-full h-10 px-3 ' +
  'rounded-md border ' +
  'bg-white dark:bg-[#161b22] ' +
  'text-[#111111] dark:text-[#f0f6fc] ' +
  'placeholder:text-[#6b7280] dark:placeholder:text-[#8b949e] ' +
  'focus:outline-none focus:ring-2 ' +
  'focus:border-transparent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'transition-colors duration-150'

const STANDALONE_INPUT_NEUTRAL =
  'border-[#e5e7eb] dark:border-[#30363d] focus:ring-[#275D2C] dark:focus:ring-[#3fb950]'

const STANDALONE_INPUT_ERROR =
  'border-[#931F1D] dark:border-[#f85149] focus:ring-[#931F1D] dark:focus:ring-[#f85149]'

const ADDON_WRAPPER_BASE =
  'flex items-center ' +
  'rounded-md border ' +
  'bg-white dark:bg-[#161b22] ' +
  'focus-within:ring-2 focus-within:border-transparent'

const ADDON_WRAPPER_NEUTRAL =
  'border-[#e5e7eb] dark:border-[#30363d] ' +
  'focus-within:ring-[#275D2C] dark:focus-within:ring-[#3fb950]'

const ADDON_WRAPPER_ERROR =
  'border-[#931F1D] dark:border-[#f85149] ' +
  'focus-within:ring-[#931F1D] dark:focus-within:ring-[#f85149]'

const NESTED_INPUT_CLASSES =
  'flex-1 h-10 px-3 ' +
  'bg-transparent border-0 ' +
  'text-[#111111] dark:text-[#f0f6fc] ' +
  'placeholder:text-[#6b7280] dark:placeholder:text-[#8b949e] ' +
  'focus:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const ADDON_BASE =
  'flex items-center px-3 text-[#6b7280] dark:text-[#8b949e]'
const LEFT_ADDON_BORDER = 'border-r border-[#e5e7eb] dark:border-[#30363d]'
const RIGHT_ADDON_BORDER = 'border-l border-[#e5e7eb] dark:border-[#30363d]'

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    leftAddon,
    rightAddon,
    containerClassName,
    id: idProp,
    className,
    ...rest
  },
  ref,
) {
  const generatedId = useId()
  const inputId = idProp ?? generatedId
  const describedById = `${inputId}-description`

  const hasError = Boolean(error)
  const hasAddon = Boolean(leftAddon || rightAddon)
  const hasDescription = hasError || Boolean(helperText)

  const wrapperClasses =
    CONTAINER_CLASSES + (containerClassName ? ' ' + containerClassName : '')

  const sharedInputAria = {
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasDescription ? describedById : undefined,
  }

  const inputElement = hasAddon ? (
    <div
      className={
        ADDON_WRAPPER_BASE +
        ' ' +
        (hasError ? ADDON_WRAPPER_ERROR : ADDON_WRAPPER_NEUTRAL)
      }
    >
      {leftAddon && (
        <span className={ADDON_BASE + ' ' + LEFT_ADDON_BORDER}>
          {leftAddon}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={
          NESTED_INPUT_CLASSES + (className ? ' ' + className : '')
        }
        {...sharedInputAria}
        {...rest}
      />
      {rightAddon && (
        <span className={ADDON_BASE + ' ' + RIGHT_ADDON_BORDER}>
          {rightAddon}
        </span>
      )}
    </div>
  ) : (
    <input
      ref={ref}
      id={inputId}
      className={
        STANDALONE_INPUT_BASE +
        ' ' +
        (hasError ? STANDALONE_INPUT_ERROR : STANDALONE_INPUT_NEUTRAL) +
        (className ? ' ' + className : '')
      }
      {...sharedInputAria}
      {...rest}
    />
  )

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASSES}>
          {label}
        </label>
      )}
      {inputElement}
      {hasError ? (
        <span id={describedById} className={ERROR_CLASSES}>
          {error}
        </span>
      ) : helperText ? (
        <span id={describedById} className={HELPER_CLASSES}>
          {helperText}
        </span>
      ) : null}
    </div>
  )
})

Input.displayName = 'Input'

export { Input }
export default Input
