'use client'

// Tenant Portal — Card primitive.
// Surface container with configurable padding and optional mount animation.
// `as` picks between div/section/article for semantic flexibility — we resolve
// the matching motion component through a lookup object so TypeScript stays
// happy (dynamic bracket access on `motion` would widen the type). When
// animateOnMount is false, initial/animate are omitted so the element renders
// statically (useful when the card is part of a larger animated sequence).

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'
export type CardElement = 'div' | 'section' | 'article'

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  padding?: CardPadding
  as?: CardElement
  animateOnMount?: boolean
}

const BASE_CLASSES =
  'bg-white dark:bg-[#161b22] ' +
  'border border-[#e5e7eb] dark:border-[#30363d] ' +
  'rounded-xl ' +
  'shadow-sm'

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

// Lookup avoids dynamic `motion[as]` which TypeScript can't narrow cleanly.
const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
} as const

function Card({
  children,
  padding = 'md',
  as = 'div',
  animateOnMount = true,
  className,
  ...rest
}: CardProps) {
  const MotionTag = MOTION_TAGS[as]
  const classes =
    BASE_CLASSES +
    ' ' +
    PADDING_CLASSES[padding] +
    (className ? ' ' + className : '')

  const motionProps = animateOnMount
    ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
      }
    : {}

  return (
    <MotionTag className={classes} {...motionProps} {...rest}>
      {children}
    </MotionTag>
  )
}

export { Card }
export default Card
