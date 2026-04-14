import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from './auth-context'

export function ProtectedRoute() {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-slate-500">
        <p>Loading authentication...</p>
      </div>
    )
  }

  if (isAuthenticated === false) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
