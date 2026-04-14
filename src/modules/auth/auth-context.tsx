import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import type { LocaleCode, Permission, Profile, Role, RoleCode } from '../../types/rbac'
import { recordLogin, recordOperationLog } from '../../lib/supabase/logs'
import { supabase } from '../../lib/supabase/client'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  roles: RoleCode[]
  permissions: string[]
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateLocale: (locale: LocaleCode) => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: RoleCode) => boolean
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function ensureProfile(user: User): Promise<Profile> {
  const selectResult = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>()

  if (selectResult.error) {
    throw selectResult.error
  }

  if (selectResult.data) {
    return selectResult.data
  }

  const insertResult = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? null,
      locale: 'en',
      timezone: 'Asia/Jakarta',
      is_active: true,
    })
    .select('*')
    .single<Profile>()

  if (insertResult.error) {
    throw insertResult.error
  }

  return insertResult.data
}

async function fetchRoles(userId: string): Promise<Role[]> {
  const rolesResult = await supabase
    .from('user_role_relations')
    .select('role:roles(id, code, name, description)')
    .eq('user_id', userId)

  if (rolesResult.error) {
    throw rolesResult.error
  }

  return (rolesResult.data ?? [])
    .map((row) => {
      const roleData = row.role as Role[] | Role | null
      if (Array.isArray(roleData)) {
        return roleData[0] ?? null
      }
      return roleData
    })
    .filter((role): role is Role => Boolean(role))
}

async function fetchPermissions(roles: Role[]): Promise<Permission[]> {
  if (roles.length === 0) {
    return []
  }

  if (roles.some((role) => role.code === 'super_admin')) {
    const allPermissionsResult = await supabase.from('permissions').select('*')
    if (allPermissionsResult.error) {
      throw allPermissionsResult.error
    }

    return (allPermissionsResult.data ?? []) as Permission[]
  }

  const roleIds = roles.map((role) => role.id)
  const relationResult = await supabase
    .from('role_permission_relations')
    .select('permission:permissions(id, code, module, action)')
    .in('role_id', roleIds)

  if (relationResult.error) {
    throw relationResult.error
  }

  const dedup = new Map<number, Permission>()

  for (const relation of relationResult.data ?? []) {
    const permissionData = relation.permission as Permission[] | Permission | null
    const permission = Array.isArray(permissionData) ? permissionData[0] ?? null : permissionData
    if (permission) {
      dedup.set(permission.id, permission)
    }
  }

  return [...dedup.values()]
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleCode[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadUserData = useCallback(async (targetUser: User | null) => {
    if (!targetUser) {
      setProfile(null)
      setRoles([])
      setPermissions([])
      return
    }

    const profileRow = await ensureProfile(targetUser)
    const roleRows = await fetchRoles(targetUser.id)
    const permissionRows = await fetchPermissions(roleRows)

    setProfile(profileRow)
    setRoles(roleRows.map((role) => role.code))
    setPermissions(permissionRows.map((permission) => permission.code))
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      return
    }

    await loadUserData(user)
  }, [loadUserData, user])

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const sessionResult = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setSession(sessionResult.data.session)
      setUser(sessionResult.data.session?.user ?? null)

      try {
        await loadUserData(sessionResult.data.session?.user ?? null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void init()

    const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        setIsLoading(true)
      } else {
        setIsLoading(false)
      }

      void (async () => {
        try {
          await loadUserData(nextSession?.user ?? null)
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
      })()
    })

    return () => {
      isMounted = false
      authListener.data.subscription.unsubscribe()
    }
  }, [loadUserData])

  const signIn = useCallback(async (email: string, password: string) => {
    const signInResult = await supabase.auth.signInWithPassword({ email, password })

    if (signInResult.error) {
      await recordLogin('failed', email)
      throw signInResult.error
    }

    await recordLogin('success', email)
    await recordOperationLog({
      module: 'auth',
      entityType: 'session',
      entityId: signInResult.data.user?.id,
      action: 'sign_in',
      meta: {
        email,
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    const currentUser = user
    const signOutResult = await supabase.auth.signOut()

    if (signOutResult.error) {
      throw signOutResult.error
    }

    await recordOperationLog({
      module: 'auth',
      entityType: 'session',
      entityId: currentUser?.id,
      action: 'sign_out',
    })
  }, [user])

  const requestPasswordReset = useCallback(async (email: string) => {
    const resetResult = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetResult.error) {
      throw resetResult.error
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const updateResult = await supabase.auth.updateUser({ password })

    if (updateResult.error) {
      throw updateResult.error
    }
  }, [])

  const updateLocale = useCallback(
    async (locale: LocaleCode) => {
      if (!user) {
        return
      }

      const updateResult = await supabase
        .from('profiles')
        .update({
          locale,
        })
        .eq('id', user.id)

      if (updateResult.error) {
        throw updateResult.error
      }

      setProfile((current) => (current ? { ...current, locale } : current))
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      roles,
      permissions,
      isLoading,
      isAuthenticated: Boolean(user),
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateLocale,
      refreshProfile,
      hasRole: (role) => roles.includes(role),
      hasPermission: (permission) => permissions.includes(permission),
    }),
    [
      user,
      session,
      profile,
      roles,
      permissions,
      isLoading,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateLocale,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
