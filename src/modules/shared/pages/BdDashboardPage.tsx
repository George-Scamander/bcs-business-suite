import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  BranchesOutlined,
  ContainerOutlined,
  DeleteOutlined,
  PlusSquareOutlined,
  ShoppingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  Button,
  Col,
  Grid,
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
  getBdDashboardMetrics,
} from '../../dashboard/api'
import {
  listLeads,
} from '../../leads/api'
import {
  useAuth,
} from '../../auth/auth-context'

interface FollowupRow {
  id: string
  lead_code: string
  company_name: string
  status: string
  next_followup_at: string | null
}

export function BdDashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const [metrics, setMetrics] = useState({
    myLeads: 0,
    dueFollowups: 0,
    signedThisMonth: 0,
    myOnboardingCases: 0,
    activeProjectsLinked: 0,
  })
  const [rows, setRows] = useState<FollowupRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const [metricData, leads] = await Promise.all([
        getBdDashboardMetrics(user.id),
        listLeads({ assignedBdId: user.id }),
      ])

      setMetrics(metricData)

      const dueRows = leads
        .filter((item) => item.next_followup_at !== null)
        .sort((a, b) => new Date(a.next_followup_at ?? '').getTime() - new Date(b.next_followup_at ?? '').getTime())
        .slice(0, 8)

      setRows(dueRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdDashboard.loadFail', { defaultValue: 'Failed to load BD dashboard' })
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
      { icon: <UnorderedListOutlined />, label: t('nav.bd-leads', { defaultValue: 'My Leads' }), path: '/app/bd/leads', color: '#c10e0e' },
      { icon: <PlusSquareOutlined />, label: t('nav.bd-new-lead', { defaultValue: 'New Lead' }), path: '/app/bd/leads/new', color: '#16a34a' },
      { icon: <ContainerOutlined />, label: t('nav.bd-onboarding', { defaultValue: 'Onboarding' }), path: '/app/bd/onboarding', color: '#0284c7' },
      { icon: <BranchesOutlined />, label: t('nav.bd-projects', { defaultValue: 'Projects' }), path: '/app/bd/projects', color: '#7c3aed' },
      { icon: <TeamOutlined />, label: t('nav.bd-department-leads', { defaultValue: 'Dept. Leads' }), path: '/app/bd/leads/department', color: '#d97706' },
      { icon: <ShoppingOutlined />, label: t('nav.bd-sales-new', { defaultValue: 'New Sales' }), path: '/app/bd/sales/new', color: '#0891b2' },
      { icon: <SolutionOutlined />, label: t('pages.bdDashboard.metrics.myOnboardingCases', { defaultValue: 'Cases' }), path: '/app/bd/onboarding/cases', color: '#9333ea' },
      { icon: <DeleteOutlined />, label: t('nav.recently-deleted', { defaultValue: 'Trash' }), path: '/app/recently-deleted', color: '#64748b' },
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
            onClick={() => navigate('/app/bd/leads')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/bd/leads') }}
          >
            <div className="mobile-home-stat-label">{t('pages.bdDashboard.metrics.myLeads', { defaultValue: 'My Leads' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.myLeads}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/bd/leads?followup=due')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/bd/leads?followup=due') }}
          >
            <div className="mobile-home-stat-label">{t('pages.bdDashboard.metrics.followupDue', { defaultValue: 'Follow-up Due' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.dueFollowups}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/bd/leads?signed=mtd')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/bd/leads?signed=mtd') }}
          >
            <div className="mobile-home-stat-label">{t('pages.bdDashboard.metrics.signedMtd', { defaultValue: 'Signed (MTD)' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.signedThisMonth}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/bd/projects?activeOnly=1')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/bd/projects?activeOnly=1') }}
          >
            <div className="mobile-home-stat-label">{t('pages.bdDashboard.metrics.linkedActiveProjects', { defaultValue: 'Active Projects' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metrics.activeProjectsLinked}</div>
          </div>
        </div>

        {/* 功能宮格 */}
        <div className="mobile-home-section-title">{t('pages.bdDashboard.quickActions', { defaultValue: 'Quick Access' })}</div>
        <div className="mobile-quick-grid">
          {quickItems.map((item) => (
            <button
              key={item.path}
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

        {/* 近期待跟進 */}
        <div className="mobile-home-recent">
          <div className="mobile-home-recent-header">
            <span className="mobile-home-recent-title">
              {t('pages.bdDashboard.followupsTitle', { defaultValue: 'Upcoming Follow-ups' })}
            </span>
            <button
              type="button"
              className="mobile-home-recent-more"
              onClick={() => navigate('/app/bd/leads')}
            >
              {t('labels.viewAll', { defaultValue: 'View all' })} →
            </button>
          </div>
          {recentRows.length === 0 ? (
            <div className="mobile-home-empty">
              {loading ? t('labels.loading', { defaultValue: 'Loading…' }) : t('pages.bdDashboard.noFollowups', { defaultValue: 'No follow-ups due' })}
            </div>
          ) : (
            recentRows.map((row) => (
              <div
                key={row.id}
                className="mobile-home-recent-item"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/app/bd/leads/${row.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/app/bd/leads/${row.id}`) }}
              >
                <div className="mobile-home-recent-item-left">
                  <div className="mobile-home-recent-item-code">{row.lead_code}</div>
                  <div className="mobile-home-recent-item-name">{row.company_name}</div>
                </div>
                <div className="mobile-home-recent-item-date">
                  {row.next_followup_at ? new Date(row.next_followup_at).toLocaleDateString() : '—'}
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
        title={t('pages.bdDashboard.title', { defaultValue: 'BD Dashboard' })}
        description={t('pages.bdDashboard.description', {
          defaultValue: 'Track lead conversion, onboarding throughput, and follow-up commitments.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.bdDashboard.metrics.myLeads', { defaultValue: 'My Leads' })}
            value={metrics.myLeads}
            onClick={() => navigate('/app/bd/leads')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.bdDashboard.metrics.followupDue', { defaultValue: 'Follow-up Due' })}
            value={metrics.dueFollowups}
            onClick={() => navigate('/app/bd/leads?followup=due')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.bdDashboard.metrics.signedMtd', { defaultValue: 'Signed (MTD)' })}
            value={metrics.signedThisMonth}
            onClick={() => navigate('/app/bd/leads?signed=mtd')}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.bdDashboard.metrics.myOnboardingCases', { defaultValue: 'My Onboarding Cases' })}
            value={metrics.myOnboardingCases}
            onClick={() => navigate('/app/bd/onboarding/cases')}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.bdDashboard.metrics.linkedActiveProjects', { defaultValue: 'Linked Active Projects' })}
            value={metrics.activeProjectsLinked}
            onClick={() => navigate('/app/bd/projects?activeOnly=1')}
          />
        </Col>
      </Row>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        title={() => t('pages.bdDashboard.followupsTitle', { defaultValue: 'Upcoming Follow-ups' })}
        dataSource={rows}
        pagination={false}
        onRow={(record) => ({
          onClick: () => navigate(`/app/bd/leads/${record.id}`),
        })}
        columns={[
          { title: t('pages.bdDashboard.columns.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code' },
          { title: t('pages.bdDashboard.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          {
            title: t('pages.bdDashboard.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.bdDashboard.columns.nextFollowup', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
