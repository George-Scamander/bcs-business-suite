import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Button,
  Col,
  Progress,
  Row,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useNavigate,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  MetricCard,
} from '../../../components/common/MetricCard'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  getPmDashboardMetrics,
} from '../../dashboard/api'
import {
  listProjects,
  markDelayedProjects,
} from '../../projects/api'
import {
  useAuth,
} from '../../auth/auth-context'

interface ProjectRow {
  id: string
  project_code: string
  name: string
  status: string
  completion_rate: number
}

export function PmDashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmDashboard.loadFail', { defaultValue: 'Failed to load project dashboard' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={t('pages.pmDashboard.title', { defaultValue: 'Project Dashboard' })}
        description={t('pages.pmDashboard.description', {
          defaultValue: 'Monitor execution progress, overdue risk, and closure readiness.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.pmDashboard.metrics.myProjects', { defaultValue: 'My Projects' })}
            value={metrics.myProjects}
            onClick={() => navigate('/app/pm/projects')}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.pmDashboard.metrics.delayedProjects', { defaultValue: 'Delayed Projects' })}
            value={metrics.delayedProjects}
            onClick={() => navigate('/app/pm/projects?status=DELAYED')}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.pmDashboard.metrics.tasksDueThisWeek', { defaultValue: 'Tasks Due This Week' })}
            value={metrics.tasksDueThisWeek}
            onClick={() => navigate('/app/pm/projects?task_due=week')}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.pmDashboard.metrics.avgCompletion', { defaultValue: 'Avg Completion' })}
            value={metrics.avgCompletionRate}
            suffix="%"
            onClick={() => navigate('/app/pm/projects?sort=completion_desc')}
          />
        </Col>
      </Row>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        title={() => t('pages.pmDashboard.snapshotTitle', { defaultValue: 'Project Execution Snapshot' })}
        dataSource={rows}
        pagination={false}
        onRow={(record) => ({
          onClick: () => navigate(`/app/pm/projects/${record.id}`),
        })}
        columns={[
          { title: t('pages.pmDashboard.columns.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code' },
          { title: t('pages.pmDashboard.columns.projectName', { defaultValue: 'Project Name' }), dataIndex: 'name' },
          {
            title: t('pages.pmDashboard.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.pmDashboard.columns.progress', { defaultValue: 'Progress' }),
            dataIndex: 'completion_rate',
            render: (value: number) => <Progress percent={Number(value.toFixed(1))} size="small" />,
          },
        ]}
      />
    </>
  )
}
