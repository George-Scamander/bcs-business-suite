import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Col, Input, Progress, Row, Select, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'

import { MetricCard } from '../../../components/common/MetricCard'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { PROJECT_STATUS_OPTIONS } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { listProjects, markDelayedProjects, type ProjectFilters } from '../../projects/api'
import type { Project } from '../../../types/business'

export function AdminProjectOverviewPage() {
  const navigate = useNavigate()

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [keyword, setKeyword] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      await markDelayedProjects()
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
      })
      setRows(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load project overview'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const metrics = useMemo(() => {
    const total = rows.length
    const delayed = rows.filter((item) => item.status === 'DELAYED').length
    const inProgress = rows.filter((item) => item.status === 'IN_PROGRESS').length
    const completed = rows.filter((item) => item.status === 'COMPLETED' || item.status === 'CLOSED').length
    const avgCompletion =
      rows.length === 0 ? 0 : Number((rows.reduce((sum, item) => sum + Number(item.completion_rate ?? 0), 0) / rows.length).toFixed(1))

    return {
      total,
      delayed,
      inProgress,
      completed,
      avgCompletion,
    }
  }, [rows])

  return (
    <>
      <PageTitleBar
        title="Project Overview"
        description="Global execution visibility across all active and closed implementation projects."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Total Projects" value={metrics.total} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="In Progress" value={metrics.inProgress} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Delayed" value={metrics.delayed} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Completed/Closed" value={metrics.completed} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Avg Completion" value={metrics.avgCompletion} suffix="%" />
        </Col>
      </Row>

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
            placeholder="Project keyword"
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
        rowKey="id"
        loading={loading}
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
            title: 'Completion',
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: 'Target End',
            dataIndex: 'target_end_date',
            width: 130,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: 'Action',
            width: 120,
            render: (_: unknown, row: Project) => (
              <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}`)}>
                Open
              </Button>
            ),
          },
        ]}
      />
    </>
  )
}
