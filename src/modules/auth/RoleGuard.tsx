import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'

import type { RoleCode } from '../../types/rbac'
import { useAuth } from './auth-context'

interface RoleGuardProps extends PropsWithChildren {
  allowRoles?: RoleCode[]
  requiredPermissions?: string[]
  fallbackPath?: string
}

export function RoleGuard({
  allowRoles = [],
  requiredPermissions = [],
  fallbackPath = '/app/unauthorized',
  children,
}: RoleGuardProps) {
  const { roles, hasPermission } = useAuth()

  const roleAllowed = allowRoles.length === 0 || allowRoles.some((role) => roles.includes(role))
  const permissionAllowed = requiredPermissions.every((permission) => hasPermission(permission))

  if (roleAllowed && permissionAllowed) {
    return <>{children}</>
  }

  return <Navigate to={fallbackPath} replace />
}
