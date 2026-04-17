'use client'

// Tenant Portal — Textarea primitive.
// Mirrors Input's label/helper/error structure but for multi-line text.
// No addon slots (there's no common use case for them on textareas). Min
// height is fixed at 6rem and the user can extend vertically via resize-y,
// never shrinking below the minimum. Ref is forwarded for React Hook Form.

import { forwardRef, TextareaHTMLAttributes, useId } from 'react'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
  containerClassName?: string
}

const CONTAINER_CLASSES = 'flex flex-col gap-1.5 w-full'

const LABEL_CLASSES =
  'text-sm font-medium text-[#111111] dark:text-[#f0f6fc]'

const HELPER_CLASSES = 'text-xs text-[#6b7280] dark:text-[#8b949e]'
const ERROR_CLASSES = 'text-xs text-[#931F1D] dark:text-[#f85149]'

const TEXTAREA_BASE =
  'w-full min-h-[6rem] px-3 py-2 ' +
  'rounded-md border ' +
  'bg-white dark:bg-[#161b22] ' +
  'text-[#111111] dark:text-[#f0f6fc] ' +
  'placeholder:text-[#6b7280] dark:placeholder:text-[#8b949e] ' +
  'focus:outline-none focus:ring-2 ' +
  'focus:border-transparent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'resize-y ' +
  'transition-colors duration-150'

const TEXTAREA_NEUTRAL =
  'border-[#e5e7eb] dark:border-[#30363d] focus:ring-[#275D2C] dark:focus:ring-[#3fb950]'

const TEXTAREA_ERROR =
  'border-[#931F1D] dark:border-[#f85149] focus:ring-[#931F1D] dark:focus:ring-[#f85149]'

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      helperText,
      error,
      containerClassName,
      id: idProp,
      className,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId()
    const textareaId = idProp ?? generatedId
    const describedById = `${textareaId}-description`

    const hasError = Boolean(error)
    const hasDescription = hasError || Boolean(helperText)

    const wrapperClasses =
      CONTAINER_CLASSES + (containerClassName ? ' ' + containerClassName : '')

    const textareaClasses =
      TEXTAREA_BASE +
      ' ' +
      (hasError ? TEXTAREA_ERROR : TEXTAREA_NEUTRAL) +
      (className ? ' ' + className : '')

    return (
      <div className={wrapperClasses}>
        {label && (
          <label htmlFor={textareaId} className={LABEL_CLASSES}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={textareaClasses}
          aria-invalid={hasError || undefined}
          aria-describedby={hasDescription ? describedById : undefined}
          {...rest}
        />
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
  },
)

Textarea.displayName = 'Textarea'

export { Textarea }
export default Textarea
