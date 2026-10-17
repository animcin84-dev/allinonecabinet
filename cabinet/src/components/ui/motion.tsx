import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion, useSpring, useTransform } from 'motion/react'
import * as m from 'motion/react-m'
import { useClub } from '../../app/context'
import { ClubIcon } from '../icons'

export const motionTiming = { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const }

export function useMotionPreference() {
  const systemReduced = useReducedMotion()
  const { settings } = useClub()
  return Boolean(systemReduced || settings?.reducedMotion)
}

// Adapted from Cult UI AnimatedNumber and Magic UI NumberTicker (MIT).
// Keep the actual balance readable immediately. Animate changes, never invent
// intermediate accessible balances or restart the balance from zero on navigation.
export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const { locale } = useClub()
  const reduced = useMotionPreference()
  const safeValue = Number.isFinite(value) ? value : 0
  const spring = useSpring(safeValue, { stiffness: 160, damping: 30, mass: 0.7 })
  const formatter = new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
    maximumFractionDigits: 1,
  })
  const display = useTransform(spring, (current) => formatter.format(current))
  useEffect(() => {
    if (reduced) spring.jump(safeValue)
    else spring.set(safeValue)
  }, [safeValue, reduced, spring])
  return (
    <span className={`animated-number ${className}`}>
      <span className="sr-only">{formatter.format(safeValue)}</span>
      {reduced ? (
        <span aria-hidden="true">{formatter.format(safeValue)}</span>
      ) : (
        <m.span aria-hidden="true">{display}</m.span>
      )}
    </span>
  )
}

// Magic UI BlurFade choreography, adapted without GPU-heavy blur or hidden
// off-screen content. One short route entrance; query/filter updates keep state.
export function PageReveal({ children }: { children: ReactNode }) {
  const reduced = useMotionPreference()
  return (
    <m.div
      className="page-reveal"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : motionTiming}
    >
      {children}
    </m.div>
  )
}

// Spectrum UI NotificationBell (Apache-2.0), modified for Solar/RU/KK and
// Allinone's local preference. A new unread event triggers one settling swing.
export function NotificationMark({ count, enabled }: { count: number; enabled: boolean }) {
  const reduced = useMotionPreference()
  const previous = useRef(count)
  const [ring, setRing] = useState(0)
  useEffect(() => {
    if (enabled && count > previous.current) setRing((current) => current + 1)
    previous.current = count
  }, [count, enabled])
  return (
    <>
      <m.span
        key={ring}
        className="notification-mark"
        aria-hidden="true"
        initial={false}
        animate={enabled && ring && !reduced ? { rotate: [0, 12, -9, 5, -2, 0] } : { rotate: 0 }}
        transition={{ duration: reduced ? 0 : 0.6, ease: 'easeInOut' }}
      >
        <ClubIcon name="bell" />
      </m.span>
      {enabled && count > 0 && (
        <span className="notification-count" aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </>
  )
}
