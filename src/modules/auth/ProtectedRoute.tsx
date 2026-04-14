import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from './auth-context'

export function ProtectedRoute() {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-slate-500">
        <p>{t('common.loadingAuth', { defaultValue: 'Loading authentication...' })}</p>
      </div>
    )
  }

  if (isAuthenticated === false) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
