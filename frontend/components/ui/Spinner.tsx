'use client'

// Pure SVG loader. Rotation is driven by Tailwind's `animate-spin`, paired
// with `motion-reduce:animate-none` so users with prefers-reduced-motion
// see a static icon (Tailwind's animate-spin does NOT auto-respect the
// media query). Uses `currentColor` so it inherits from the nearest text
// color — inside a primary button it reads as white, standalone it falls
// back to the brand primary.

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  size?: SpinnerSize
  label?: string
  className?: string
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
}

function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  const wrapperClasses =
    'inline-flex items-center justify-center text-primary' +
    (className ? ' ' + className : '')

  const svgClasses = `animate-spin motion-reduce:animate-none ${SIZE_CLASSES[size]}`

  return (
    <span role="status" aria-label={label} className={wrapperClasses}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={svgClasses}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-25"
        />
        <path
          d="M4 12a8 8 0 018-8"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="opacity-75"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }
export default Spinner
