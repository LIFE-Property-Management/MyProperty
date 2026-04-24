'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 flex flex-col items-center justify-center text-center gap-4 min-h-[50vh]">
      <h1 className="text-2xl md:text-3xl text-[var(--color-primary-text)]">
        Something went wrong
      </h1>
      <p className="text-[var(--color-muted-text)] text-sm max-w-md">
        We couldn&apos;t load your dashboard. Please try again.
      </p>
      <Button variant="secondary" size="md" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
