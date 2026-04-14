import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Popconfirm, Select, Space, Table, Tag, message } from 'antd'

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
  const [rows, setRows] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [profilesResult, rolesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, is_active, user_role_relations(id, role_id, role:roles(id, code, name, description))')
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
      message.warning('Please select a role first.')
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

    message.success('Role assigned')
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

    message.success('Role revoked')
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
        title="User & Role Management"
        description="Assign or revoke role access for internal users with full audit logging."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: 'User',
            key: 'user',
            render: (_: unknown, row: UserWithRoles) => row.full_name ?? row.email,
          },
          {
            title: 'Email',
            dataIndex: 'email',
          },
          {
            title: 'Status',
            dataIndex: 'is_active',
            render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? 'Active' : 'Disabled'}</Tag>,
          },
          {
            title: 'Current Roles',
            dataIndex: 'user_role_relations',
            render: (relations: UserWithRoles['user_role_relations'], row: UserWithRoles) => (
              <Space wrap>
                {relations.length === 0 ? <Tag>None</Tag> : null}
                {relations.map((relation) => {
                  const roleCode = relation.role?.code ?? 'bd_user'
                  return (
                    <Popconfirm
                      key={relation.id}
                      title="Revoke this role?"
                      okText="Revoke"
                      cancelText="Cancel"
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
            title: 'Assign Role',
            key: 'assign',
            width: 320,
            render: (_: unknown, row: UserWithRoles) => (
              <Space>
                <Select
                  placeholder="Select role"
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
                  Assign
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
