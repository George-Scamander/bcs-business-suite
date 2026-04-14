import type { ReactNode } from 'react'
import { Space, Typography } from 'antd'

interface PageTitleBarProps {
  title: string
  description?: string
  extra?: ReactNode
}

export function PageTitleBar({ title, description, extra }: PageTitleBarProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <Typography.Title level={4} className="mb-1">
          {title}
        </Typography.Title>
        {description ? <Typography.Paragraph className="mb-0 text-slate-500">{description}</Typography.Paragraph> : null}
      </div>
      {extra ? <Space>{extra}</Space> : null}
    </div>
  )
}
