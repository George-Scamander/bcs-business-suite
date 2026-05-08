import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/auth-context'

export function AppEntryPage() {
  const { t } = useTranslation()
  const { roles, isLoading } = useAuth()

  // Prevent premature routing before role data is ready.
  if (isLoading || roles.length === 0) {
    return (
      <div className="grid min-h-[240px] place-items-center text-slate-500">
        <p>{t('common.loadingPermissions', { defaultValue: 'Loading permissions...' })}</p>
      </div>
    )
  }

  if (roles.includes('super_admin')) {
    return <Navigate to="/app/admin/dashboard" replace />
  }

  if (roles.includes('project_manager')) {
    return <Navigate to="/app/pm/dashboard" replace />
  }

  return <Navigate to="/app/bd/dashboard" replace />
}
