import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { ROLE_LABELS } from '../../../lib/constants'
import { recordOperationLog } from '../../../lib/supabase/logs'
import { supabase } from '../../../lib/supabase/client'
import type { Role, RoleCode } from '../../../types/rbac'

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

export function UserRoleManagementPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [profilesResult, rolesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, email, full_name, is_active, user_role_relations:user_role_relations!user_role_relations_user_id_fkey(id, role_id, role:roles(id, code, name, description))',
        )
        .order('created_at', { ascending: false }),
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
  }, [])

  async function assignRole(userId: string) {
    const roleId = selectedRoleByUser[userId]

    if (!roleId) {
      message.warning(t('page.common.selectRoleFirst', { defaultValue: 'Please select a role first.' }))
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

    message.success(t('page.common.roleAssigned', { defaultValue: 'Role assigned' }))
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

    message.success(t('page.common.roleRevoked', { defaultValue: 'Role revoked' }))
    await loadData()
  }

  const roleOptions = useMemo(() => {
    return roles.map((role) => ({ value: role.id, label: role.name }))
  }, [roles])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={t('page.usersRoles.title', { defaultValue: 'User & Role Management' })}
        description={t('page.usersRoles.desc', {
          defaultValue: 'Assign or revoke role access for internal users with full audit logging.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: t('page.common.user', { defaultValue: 'User' }),
            key: 'user',
            render: (_: unknown, row: UserWithRoles) => row.full_name ?? row.email,
          },
          {
            title: t('page.common.email', { defaultValue: 'Email' }),
            dataIndex: 'email',
          },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'is_active',
            render: (value: boolean) => (
              <Tag color={value ? 'green' : 'red'}>
                {value
                  ? t('page.common.active', { defaultValue: 'Active' })
                  : t('page.common.disabled', { defaultValue: 'Disabled' })}
              </Tag>
            ),
          },
          {
            title: t('page.usersRoles.currentRoles', { defaultValue: 'Current Roles' }),
            dataIndex: 'user_role_relations',
            render: (relations: UserWithRoles['user_role_relations'], row: UserWithRoles) => (
              <Space wrap>
                {relations.length === 0 ? <Tag>{t('page.common.none', { defaultValue: 'None' })}</Tag> : null}
                {relations.map((relation) => {
                  const roleCode = relation.role?.code ?? 'bd_user'
                  return (
                    <Popconfirm
                      key={relation.id}
                      title={t('page.common.revokeRoleConfirm', { defaultValue: 'Revoke this role?' })}
                      okText={t('page.usersRoles.revoke', { defaultValue: 'Revoke' })}
                      cancelText={t('page.usersRoles.cancel', { defaultValue: 'Cancel' })}
                      onConfirm={() => void revokeRole(row.id, relation.role_id, roleCode)}
                    >
                      <Tag color="blue" className="cursor-pointer hover:opacity-80">
                        {ROLE_LABELS[roleCode]} ×
                      </Tag>
                    </Popconfirm>
                  )
                })}
              </Space>
            ),
          },
          {
            title: t('page.common.assignRole', { defaultValue: 'Assign Role' }),
            key: 'assign',
            width: 320,
            render: (_: unknown, row: UserWithRoles) => (
              <Space>
                <Select
                  placeholder={t('page.usersRoles.selectRole', { defaultValue: 'Select role' })}
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
                  {t('page.common.assign', { defaultValue: 'Assign' })}
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
