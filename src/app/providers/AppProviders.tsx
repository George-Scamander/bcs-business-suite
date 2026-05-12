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
          colorInfo: '#c10e0e',
          borderRadius: 10,
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
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
