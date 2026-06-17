import type { PropsWithChildren } from 'react'
import { App as AntApp, ConfigProvider, theme } from 'antd'

import '../../lib/i18n'
import { AuthProvider } from '../../modules/auth/auth-context'
import { ThemeProvider, useAppTheme } from './theme-context'

function AppProvidersInner({ children }: PropsWithChildren) {
  const { resolvedTheme } = useAppTheme()

  return (
    <ConfigProvider
      theme={{
        algorithm: [resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm],
        token: {
          colorPrimary: '#c10e0e',
          colorError: '#dc2626',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorInfo: '#0284c7',
          borderRadius: 10,
          borderRadiusLG: 12,
          borderRadiusSM: 6,
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
          boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        },
        components: {
          Menu: {
            itemBorderRadius: 8,
          },
        },
      }}
    >
      <AntApp>
        <AuthProvider>{children}</AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <AppProvidersInner>{children}</AppProvidersInner>
    </ThemeProvider>
  )
}
