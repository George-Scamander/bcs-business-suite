import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  DatePicker,
  Popconfirm,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useTranslation,
} from 'react-i18next'
import {
  useSearchParams,
} from 'react-router-dom'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  ROLE_LABELS,
} from '../../../lib/constants'
import {
  recordOperationLog,
} from '../../../lib/supabase/logs'
import {
  supabase,
} from '../../../lib/supabase/client'
import type {
  Role,
  RoleCode,
} from '../../../types/rbac'

interface UserWithRoles {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  user_role_relations: Array<{
    id: string
    role_id: number
    role: Role | null
  }>
}

interface UserRoleFilters {
  createdFrom?: string
  createdTo?: string
}

function parseUserRoleFiltersFromSearch(searchParams: URLSearchParams): UserRoleFilters {
  const createdFrom = searchParams.get('createdFrom') ?? undefined
  const createdTo = searchParams.get('createdTo') ?? undefined
  return {
    createdFrom: createdFrom || undefined,
    createdTo: createdTo || undefined,
  }
}

export function UserRoleManagementPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, number>>({})
  const [filters, setFilters] = useState<UserRoleFilters>(() => parseUserRoleFiltersFromSearch(searchParams))
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    let profilesQuery = supabase
      .from('profiles')
      .select(
        'id, email, full_name, is_active, user_role_relations:user_role_relations!user_role_relations_user_id_fkey(id, role_id, role:roles(id, code, name, description))',
      )
      .order('created_at', { ascending: false })

    if (filters.createdFrom) {
      profilesQuery = profilesQuery.gte('created_at', filters.createdFrom)
    }

    if (filters.createdTo) {
      profilesQuery = profilesQuery.lte('created_at', filters.createdTo)
    }

    const [profilesResult, rolesResult] = await Promise.all([
      profilesQuery,
      supabase.from('roles').select('*').order('id', { ascending: true }),
    ])

    setLoading(false)

    if (profilesResult.error) {
      message.error(profilesResult.error.message)
      return
    }

    if (rolesResult.error) {
      message.error(rolesResult.error.message)
      return
    }

    const normalizedRows = (profilesResult.data ?? []).map((row) => ({
      ...row,
      user_role_relations: (row.user_role_relations ?? []).map((relation) => {
        const roleData = relation.role as Role[] | Role | null
        return {
          id: relation.id,
          role_id: relation.role_id,
          role: Array.isArray(roleData) ? roleData[0] ?? null : roleData,
        }
      }),
    }))

    setRows(normalizedRows as UserWithRoles[])
    setRoles((rolesResult.data ?? []) as Role[])
  }, [filters.createdFrom, filters.createdTo])

  async function assignRole(userId: string) {
    const roleId = selectedRoleByUser[userId]

    if (!roleId) {
      message.warning(t('pages.userRoles.selectRoleFirst', { defaultValue: 'Please select a role first.' }))
      return
    }

    const insertResult = await supabase.from('user_role_relations').insert({ user_id: userId, role_id: roleId })

    if (insertResult.error) {
      message.error(insertResult.error.message)
      return
    }

    const role = roles.find((item) => item.id === roleId)

    await recordOperationLog({
      module: 'rbac',
      entityType: 'user_role_relations',
      entityId: userId,
      action: 'assign_role',
      afterData: {
        role_id: roleId,
        role_code: role?.code,
      },
    })

    message.success(t('pages.userRoles.roleAssigned', { defaultValue: 'Role assigned' }))
    await loadData()
  }

  async function revokeRole(userId: string, roleId: number, roleCode: RoleCode) {
    const deleteResult = await supabase
      .from('user_role_relations')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)

    if (deleteResult.error) {
      message.error(deleteResult.error.message)
      return
    }

    await recordOperationLog({
      module: 'rbac',
      entityType: 'user_role_relations',
      entityId: userId,
      action: 'revoke_role',
      beforeData: {
        role_id: roleId,
        role_code: roleCode,
      },
    })

    message.success(t('pages.userRoles.roleRevoked', { defaultValue: 'Role revoked' }))
    await loadData()
  }

  const roleOptions = useMemo(() => {
    return roles.map((role) => ({
      value: role.id,
      label: t(`role.${role.code}`, { defaultValue: role.name }),
    }))
  }, [roles, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const parsed = parseUserRoleFiltersFromSearch(searchParams)
    setFilters((current) => (JSON.stringify(current) === JSON.stringify(parsed) ? current : parsed))
  }, [searchParams])

  return (
    <>
      <PageTitleBar
        title={t('pages.userRoles.title', { defaultValue: 'User & Role Management' })}
        description={t('pages.userRoles.description', {
          defaultValue: 'Assign or revoke role access for internal users with full audit logging.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.userRoles.createdFrom', { defaultValue: 'Created From' })}
            value={filters.createdFrom ? dayjs(filters.createdFrom) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdFrom: value ? value.startOf('day').toISOString() : undefined,
              }))
            }
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.userRoles.createdTo', { defaultValue: 'Created To' })}
            value={filters.createdTo ? dayjs(filters.createdTo) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdTo: value ? value.endOf('day').toISOString() : undefined,
              }))
            }
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: t('pages.userRoles.columns.user', { defaultValue: 'User' }),
            key: 'user',
            render: (_: unknown, row: UserWithRoles) => row.full_name ?? row.email,
          },
          {
            title: t('pages.userRoles.columns.email', { defaultValue: 'Email' }),
            dataIndex: 'email',
          },
          {
            title: t('pages.userRoles.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'is_active',
            render: (value: boolean) => (
              <Tag color={value ? 'green' : 'red'}>
                {value
                  ? t('pages.userRoles.active', { defaultValue: 'Active' })
                  : t('pages.userRoles.disabled', { defaultValue: 'Disabled' })}
              </Tag>
            ),
          },
          {
            title: t('pages.userRoles.columns.currentRoles', { defaultValue: 'Current Roles' }),
            dataIndex: 'user_role_relations',
            render: (relations: UserWithRoles['user_role_relations'], row: UserWithRoles) => (
              <Space wrap>
                {relations.length === 0 ? <Tag>{t('pages.userRoles.none', { defaultValue: 'None' })}</Tag> : null}
                {relations.map((relation) => {
                  const roleCode = relation.role?.code ?? 'bd_user'
                  return (
                    <Popconfirm
                      key={relation.id}
                      title={t('pages.userRoles.revokeRoleConfirm', { defaultValue: 'Revoke this role?' })}
                      okText={t('pages.userRoles.revoke', { defaultValue: 'Revoke' })}
                      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                      onConfirm={() => void revokeRole(row.id, relation.role_id, roleCode)}
                    >
                      <Tag color="blue" className="cursor-pointer hover:opacity-80">
                        {t(`role.${roleCode}`, { defaultValue: ROLE_LABELS[roleCode] })} ×
                      </Tag>
                    </Popconfirm>
                  )
                })}
              </Space>
            ),
          },
          {
            title: t('pages.userRoles.columns.assignRole', { defaultValue: 'Assign Role' }),
            key: 'assign',
            width: 320,
            render: (_: unknown, row: UserWithRoles) => (
              <Space>
                <Select
                  placeholder={t('pages.userRoles.selectRole', { defaultValue: 'Select role' })}
                  style={{ width: 180 }}
                  options={roleOptions}
                  value={selectedRoleByUser[row.id]}
                  onChange={(value) =>
                    setSelectedRoleByUser((current) => ({
                      ...current,
                      [row.id]: value,
                    }))
                  }
                />
                <Button type="primary" onClick={() => void assignRole(row.id)}>
                  {t('pages.userRoles.assign', { defaultValue: 'Assign' })}
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
