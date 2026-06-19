import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  BranchesOutlined,
  CloudUploadOutlined,
  ContainerOutlined,
  FileTextOutlined,
  LineChartOutlined,
  PlusSquareOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  Button,
  Col,
  Grid,
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
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
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

  // ── 手機版：支付寶式主頁 ──────────────────────────────────────────────
  if (isMobile) {
    const quickItems = [
      { icon: <BranchesOutlined />, label: t('nav.pm-projects', { defaultValue: 'Projects' }), path: '/app/pm/projects', color: '#7c3aed' },
      { icon: <PlusSquareOutlined />, label: t('nav.pm-new-project', { defaultValue: 'New Project' }), path: '/app/pm/projects/new', color: '#16a34a' },
      { icon: <UnorderedListOutlined />, label: t('nav.pm-lead-pool', { defaultValue: 'Lead Pool' }), path: '/app/admin/leads/pool', color: '#c10e0e' },
      { icon: <ContainerOutlined />, label: t('nav.pm-onboard-merchants', { defaultValue: 'Merchants' }), path: '/app/pm/onboarding/merchants', color: '#0284c7' },
      { icon: <LineChartOutlined />, label: t('nav.sales-supervision', { defaultValue: 'Sales' }), path: '/app/pm/sales/supervision', color: '#0891b2' },
      { icon: <LineChartOutlined />, label: t('nav.bd-kpi-dashboard', { defaultValue: 'KPI' }), path: '/app/pm/kpi/dashboard', color: '#d97706' },
      { icon: <FileTextOutlined />, label: t('nav.report-export', { defaultValue: 'Reports' }), path: '/app/pm/reports/export', color: '#64748b' },
      { icon: <CloudUploadOutlined />, label: t('nav.pm-leads-import', { defaultValue: 'Import' }), path: '/app/pm/leads/import', color: '#9333ea' },
    ]

    const recentRows = rows.slice(0, 3)

    return (
      <div className="pb-2">
        {/* 關鍵數字 2×2 */}
        <div className="mobile-home-stats">
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/pm/projects')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/pm/projects') }}
          >
            <div className="mobile-home-stat-label">{t('pages.pmDashboard.metrics.myProjects', { defaultValue: 'My Projects' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.myProjects}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/pm/projects?status=DELAYED')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/pm/projects?status=DELAYED') }}
          >
            <div className="mobile-home-stat-label">{t('pages.pmDashboard.metrics.delayedProjects', { defaultValue: 'Delayed' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.delayedProjects}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/pm/projects?task_due=week')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/pm/projects?task_due=week') }}
          >
            <div className="mobile-home-stat-label">{t('pages.pmDashboard.metrics.tasksDueThisWeek', { defaultValue: 'Tasks Due' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.tasksDueThisWeek}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/pm/projects?sort=completion_desc')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/pm/projects?sort=completion_desc') }}
          >
            <div className="mobile-home-stat-label">{t('pages.pmDashboard.metrics.avgCompletion', { defaultValue: 'Avg Progress' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : `${metrics.avgCompletionRate.toFixed(0)}%`}</div>
          </div>
        </div>

        {/* 功能宮格 */}
        <div className="mobile-home-section-title">{t('pages.pmDashboard.quickActions', { defaultValue: 'Quick Access' })}</div>
        <div className="mobile-quick-grid">
          {quickItems.map((item) => (
            <button
              key={item.path + item.label}
              type="button"
              className="mobile-quick-item"
              onClick={() => navigate(item.path)}
            >
              <div className="mobile-quick-icon" style={{ color: item.color }}>
                {item.icon}
              </div>
              <span className="mobile-quick-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* 近期項目 */}
        <div className="mobile-home-recent">
          <div className="mobile-home-recent-header">
            <span className="mobile-home-recent-title">
              {t('pages.pmDashboard.snapshotTitle', { defaultValue: 'My Projects' })}
            </span>
            <button
              type="button"
              className="mobile-home-recent-more"
              onClick={() => navigate('/app/pm/projects')}
            >
              {t('labels.viewAll', { defaultValue: 'View all' })} →
            </button>
          </div>
          {recentRows.length === 0 ? (
            <div className="mobile-home-empty">
              {loading ? t('labels.loading', { defaultValue: 'Loading…' }) : t('pages.pmDashboard.noProjects', { defaultValue: 'No projects' })}
            </div>
          ) : (
            recentRows.map((row) => (
              <div
                key={row.id}
                className="mobile-home-recent-item"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/app/pm/projects/${row.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/app/pm/projects/${row.id}`) }}
              >
                <div className="mobile-home-recent-item-left">
                  <div className="mobile-home-recent-item-code">{row.project_code}</div>
                  <div className="mobile-home-recent-item-name">{row.name}</div>
                </div>
                <div className="mobile-home-recent-item-date">
                  {row.completion_rate.toFixed(0)}%
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── 桌面版：原有代碼完全不動 ──────────────────────────────────────────
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
