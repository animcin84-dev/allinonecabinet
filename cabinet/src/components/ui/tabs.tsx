import { Tabs } from '@base-ui/react/tabs'
import type { ReactNode } from 'react'

// Adapted from shadcn's Base preset (MIT); Base UI owns keyboard/focus and
// ARIA connections. Its measured indicator animates selection without domMax.
export function AnimatedTabs({
  value,
  onValueChange,
  label,
  tabs,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  label: string
  tabs: string[][]
  children: ReactNode
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => typeof next === 'string' && onValueChange(next)}
    >
      <Tabs.List className="tabs premium-tabs" aria-label={label}>
        {tabs.map(([id, title]) => (
          <Tabs.Tab key={id} value={id} className="tab">
            {title}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="tabs-indicator" />
      </Tabs.List>
      <Tabs.Panel key={value} value={value} className="tab-panel">
        {children}
      </Tabs.Panel>
    </Tabs.Root>
  )
}
