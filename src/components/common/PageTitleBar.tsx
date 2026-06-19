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
      className={`mb-5 flex rounded-xl border app-border px-4 py-3 sm:px-5 sm:py-4 ${
        isMobile
          ? 'flex-col gap-2 mobile-title-glass sticky top-0 z-10'
          : 'flex-col gap-3 md:flex-row md:items-center md:justify-between sticky top-0 z-10 page-title-glass'
      }`}
    >
      <div>
        <Typography.Title level={4} className={`mb-1 ${isMobile ? '!text-lg' : '!text-xl sm:!text-2xl'}`}>
          {title}
        </Typography.Title>
        {description ? (
          <div className="page-title-description-wrap">
            <div className={`mb-0 app-text-soft page-title-description ${isMobile ? 'text-xs' : 'text-sm sm:text-base'}`}>{description}</div>
          </div>
        ) : null}
      </div>
      {extra ? (
        <div className="page-title-extra-wrap">
          <div className={`page-title-extra ${isMobile ? 'w-full pb-1' : 'w-full md:w-auto'}`}>
            <Space wrap className={isMobile ? 'w-full' : undefined}>
              {extra}
            </Space>
          </div>
        </div>
      ) : null}
    </div>
  )
}
