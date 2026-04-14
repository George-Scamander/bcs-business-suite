import { Navigate } from 'react-router-dom'

import { useAuth } from '../../auth/auth-context'

export function AppEntryPage() {
  const { roles } = useAuth()

  if (roles.includes('super_admin')) {
    return <Navigate to="/app/admin/dashboard" replace />
  }

  if (roles.includes('project_manager')) {
    return <Navigate to="/app/pm/dashboard" replace />
  }

  return <Navigate to="/app/bd/dashboard" replace />
}
