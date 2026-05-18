import type {
  ReactNode,
} from 'react'
import {
  Grid,
  Space,
  Typography,
} from 'antd'

interface PageTitleBarProps {
  title: string
  description?: ReactNode
  extra?: ReactNode
}

export function PageTitleBar({ title, description, extra }: PageTitleBarProps) {
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false

  return (
    <div
      className={`mb-5 flex rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4 ${
        isMobile ? 'flex-col gap-2' : 'flex-col gap-3 md:flex-row md:items-center md:justify-between'
      }`}
    >
      <div>
        <Typography.Title level={4} className={`mb-1 ${isMobile ? '!text-lg' : '!text-xl sm:!text-2xl'}`}>
          {title}
        </Typography.Title>
        {description ? <div className={`mb-0 text-slate-500 ${isMobile ? 'text-xs' : 'text-sm sm:text-base'}`}>{description}</div> : null}
      </div>
      {extra ? (
        <div className={`page-title-extra ${isMobile ? 'w-full overflow-x-auto pb-1' : 'w-full md:w-auto'}`}>
          <Space wrap={!isMobile} className={isMobile ? 'mobile-action-scroll min-w-max' : undefined}>
            {extra}
          </Space>
        </div>
      ) : null}
    </div>
  )
}
