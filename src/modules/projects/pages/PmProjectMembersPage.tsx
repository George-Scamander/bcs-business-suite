import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getProjectById, listProjectMembers, addProjectMember, deactivateProjectMember } from '../api'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import type { Project, ProjectMember } from '../../../types/business'

interface MemberFormValues {
  user_id: string
  role_in_project: string
}

export function PmProjectMembersPage() {
  const [form] = Form.useForm<MemberFormValues>()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      const [projectRow, memberRows, userRows] = await Promise.all([
        getProjectById(projectId),
        listProjectMembers(projectId),
        listActiveUsers(),
      ])
      setProject(projectRow)
      setMembers(memberRows)
      setUsers(userRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load project members'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAddMember(values: MemberFormValues) {
    if (!projectId) {
      return
    }

    setSaving(true)

    try {
      await addProjectMember(projectId, values.user_id, values.role_in_project)
      message.success('Member added')
      form.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to add member'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivateMember(userId: string) {
    if (!projectId) {
      return
    }

    try {
      await deactivateProjectMember(projectId, userId)
      message.success('Member deactivated')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to deactivate member'
      message.error(text)
    }
  }

  const userOptions = useMemo(() => {
    return users.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [users])

  return (
    <>
      <PageTitleBar
        title={project ? `Member Assignment · ${project.project_code}` : 'Member Assignment'}
        description="Assign accountable resources and maintain active project ownership."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        <Form<MemberFormValues> form={form} layout="vertical" onFinish={handleAddMember} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Form.Item name="user_id" label="User" rules={[{ required: true, message: 'Select a user' }]}>
              <Select options={userOptions} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="role_in_project" label="Role in Project" rules={[{ required: true, message: 'Role is required' }]}>
              <Input placeholder="Site Engineer / Ops Trainer / Procurement" />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={saving}>
            Add Member
          </Button>
        </Form>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={members}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'User ID', dataIndex: 'user_id', width: 280 },
          { title: 'Role', dataIndex: 'role_in_project' },
          {
            title: 'Status',
            dataIndex: 'is_active',
            width: 120,
            render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Active' : 'Inactive'}</Tag>,
          },
          {
            title: 'Joined',
            dataIndex: 'joined_at',
            width: 180,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: 'Action',
            width: 130,
            render: (_: unknown, row: ProjectMember) =>
              row.is_active ? (
                <Popconfirm title="Deactivate this member?" onConfirm={() => void handleDeactivateMember(row.user_id)}>
                  <Button size="small" danger>
                    Deactivate
                  </Button>
                </Popconfirm>
              ) : (
                '-'
              ),
          },
        ]}
      />
    </>
  )
}
