import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Select, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { PROJECT_STATUS_OPTIONS } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listProjects, type ProjectFilters } from '../api'
import type { Project } from '../../../types/business'

export function BdRelatedProjectsPage() {
  const navigate = useNavigate()
  const { user, roles } = useAuth()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Project[]>([])
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [keyword, setKeyword] = useState('')

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
        bdOwnerId: roles.includes('super_admin') ? filters.bdOwnerId : user.id,
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
        title="Linked Projects"
        description="Read execution progress for projects handed over from your signed leads."
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
          { title: 'Project Code', dataIndex: 'project_code', width: 180 },
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 160,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Completion',
            dataIndex: 'completion_rate',
            width: 130,
            render: (value: number) => `${Number(value ?? 0).toFixed(1)}%`,
          },
          {
            title: 'Target End',
            dataIndex: 'target_end_date',
            width: 150,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: 'Action',
            width: 120,
            render: (_: unknown, row: Project) => (
              <Button size="small" onClick={() => navigate(`/app/bd/projects/${row.id}`)}>
                View
              </Button>
            ),
          },
        ]}
      />
    </>
  )
}
