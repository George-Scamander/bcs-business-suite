import { useCallback, useEffect, useState } from 'react'
import { Button, Col, Progress, Row, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { MetricCard } from '../../../components/common/MetricCard'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { getPmDashboardMetrics } from '../../dashboard/api'
import { listProjects, markDelayedProjects } from '../../projects/api'
import { useAuth } from '../../auth/auth-context'

interface ProjectRow {
  id: string
  project_code: string
  name: string
  status: string
  completion_rate: number
}

export function PmDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [metrics, setMetrics] = useState({
    myProjects: 0,
    delayedProjects: 0,
    tasksDueThisWeek: 0,
    avgCompletionRate: 0,
  })
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      await markDelayedProjects()
      const [metricData, projects] = await Promise.all([
        getPmDashboardMetrics(user.id),
        listProjects({ pmOwnerId: user.id }),
      ])

      setMetrics(metricData)
      setRows(projects.slice(0, 8))
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load project dashboard'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={t('page.pm.dashboardTitle', { defaultValue: 'Project Dashboard' })}
        description={t('page.pm.dashboardDesc', {
          defaultValue: 'Monitor execution progress, overdue risk, and closure readiness.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={6}>
          <MetricCard title={t('page.pm.myProjects', { defaultValue: 'My Projects' })} value={metrics.myProjects} />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('page.pm.delayedProjects', { defaultValue: 'Delayed Projects' })}
            value={metrics.delayedProjects}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('page.pm.tasksDueThisWeek', { defaultValue: 'Tasks Due This Week' })}
            value={metrics.tasksDueThisWeek}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard title={t('page.pm.avgCompletion', { defaultValue: 'Avg Completion' })} value={metrics.avgCompletionRate} suffix="%" />
        </Col>
      </Row>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        title={() => t('page.pm.projectExecutionSnapshot', { defaultValue: 'Project Execution Snapshot' })}
        dataSource={rows}
        pagination={false}
        onRow={(record) => ({
          onClick: () => navigate(`/app/pm/projects/${record.id}`),
        })}
        columns={[
          { title: t('page.pm.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code' },
          { title: t('page.pm.projectName', { defaultValue: 'Project Name' }), dataIndex: 'name' },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.pm.progress', { defaultValue: 'Progress' }),
            dataIndex: 'completion_rate',
            render: (value: number) => <Progress percent={Number(value.toFixed(1))} size="small" />,
          },
        ]}
      />
    </>
  )
}
