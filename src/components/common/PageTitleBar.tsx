import type { ReactNode } from 'react'
import { Space, Typography } from 'antd'

interface PageTitleBarProps {
  title: string
  description?: string
  extra?: ReactNode
}

export function PageTitleBar({ title, description, extra }: PageTitleBarProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <Typography.Title level={4} className="mb-1 !text-xl sm:!text-2xl">
          {title}
        </Typography.Title>
        {description ? <Typography.Paragraph className="mb-0 text-sm text-slate-500 sm:text-base">{description}</Typography.Paragraph> : null}
      </div>
      {extra ? (
        <div className="page-title-extra w-full md:w-auto">
          <Space>{extra}</Space>
        </div>
      ) : null}
    </div>
  )
}
