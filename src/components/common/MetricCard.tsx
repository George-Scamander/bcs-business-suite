import type { KeyboardEvent, ReactNode } from 'react'
import { Card, Statistic } from 'antd'

interface MetricCardProps {
  title: string
  value: number | string
  suffix?: string
  prefix?: ReactNode
  onClick?: () => void
}

export function MetricCard({ title, value, suffix, prefix, onClick }: MetricCardProps) {
  const isClickable = typeof onClick === 'function'

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isClickable) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <Card
      className={`h-full ${isClickable ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
      hoverable={isClickable}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? title : undefined}
    >
      <Statistic title={title} value={value} suffix={suffix} prefix={prefix} />
    </Card>
  )
}
