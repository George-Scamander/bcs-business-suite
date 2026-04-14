import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Col, Input, Progress, Row, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { MetricCard } from '../../../components/common/MetricCard'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getProjectStatusOptions } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { listProjects, markDelayedProjects, type ProjectFilters } from '../../projects/api'
import type { Project } from '../../../types/business'

export function AdminProjectOverviewPage() {
  const { t } = useTranslation()
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
        title={t('page.projectOverview.title', { defaultValue: 'Project Overview' })}
        description={t('page.projectOverview.desc', {
          defaultValue: 'Global execution visibility across all active and closed implementation projects.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.admin.totalProjects', { defaultValue: 'Total Projects' })} value={metrics.total} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('status.IN_PROGRESS', { defaultValue: 'In Progress' })} value={metrics.inProgress} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('status.DELAYED', { defaultValue: 'Delayed' })} value={metrics.delayed} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.projectOverview.completedClosed', { defaultValue: 'Completed/Closed' })} value={metrics.completed} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.pm.avgCompletion', { defaultValue: 'Avg Completion' })} value={metrics.avgCompletion} suffix="%" />
        </Col>
      </Row>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('page.common.status', { defaultValue: 'Status' })}
            style={{ width: 220 }}
            options={getProjectStatusOptions(t)}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input.Search
            allowClear
            placeholder={t('page.projectOverview.keywordPlaceholder', { defaultValue: 'Project keyword' })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('page.common.apply', { defaultValue: 'Apply' })}
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
          { title: t('page.pm.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code', width: 170 },
          { title: t('page.pm.projectName', { defaultValue: 'Name' }), dataIndex: 'name' },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.projectOverview.completion', { defaultValue: 'Completion' }),
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: t('page.projectOverview.targetEnd', { defaultValue: 'Target End' }),
            dataIndex: 'target_end_date',
            width: 130,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            width: 120,
            render: (_: unknown, row: Project) => (
              <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}`)}>
                {t('page.projectOverview.open', { defaultValue: 'Open' })}
              </Button>
            ),
          },
        ]}
      />
    </>
  )
}
