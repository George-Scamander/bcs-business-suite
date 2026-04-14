import type { ReactNode } from 'react'
import { Card, Statistic } from 'antd'

interface MetricCardProps {
  title: string
  value: number | string
  suffix?: string
  prefix?: ReactNode
}

export function MetricCard({ title, value, suffix, prefix }: MetricCardProps) {
  return (
    <Card className="h-full">
      <Statistic title={title} value={value} suffix={suffix} prefix={prefix} />
    </Card>
  )
}
