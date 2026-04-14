import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Progress, Select, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { PROJECT_STATUS_OPTIONS } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listProjects, markDelayedProjects, type ProjectFilters } from '../api'
import type { Project } from '../../../types/business'

export function PmProjectsListPage() {
  const navigate = useNavigate()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [keyword, setKeyword] = useState('')

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      await markDelayedProjects()
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
        pmOwnerId: roles.includes('super_admin') ? filters.pmOwnerId : user.id,
      })
      setRows(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load projects'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, roles, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title="Projects"
        description="Manage execution portfolio with real-time progress, delay signaling, and closure discipline."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 220 }}
            options={PROJECT_STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input.Search
            allowClear
            placeholder="Project code/name"
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            Apply
          </Button>
        </Space>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'Project Code', dataIndex: 'project_code', width: 170 },
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Progress',
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: 'Target End',
            dataIndex: 'target_end_date',
            width: 150,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: 'Actions',
            width: 320,
            render: (_: unknown, row: Project) => (
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}`)}>
                  Detail
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/progress`)}>
                  Progress
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/tasks`)}>
                  Tasks
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/members`)}>
                  Members
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/risks`)}>
                  Risks
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/closure`)}>
                  Closure
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
