import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useTranslation,
} from 'react-i18next'
import {
  useNavigate,
} from 'react-router-dom'

import {
  getSalesProductCategoryOptions,
} from '../../../lib/business-constants'
import {
  MetricCard,
} from '../../../components/common/MetricCard'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getAdminSalesCategoryMetrics,
  getAdminLeadBoardMetrics,
  getAdminDashboardMetrics,
} from '../../dashboard/api'
import {
  listOnboardingCases,
} from '../../onboarding/api'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import type {
  SalesProductCategory,
} from '../../../types/business'
import type {
  AdminSalesCategoryMetrics,
  AdminLeadBoardMetrics,
  AdminDashboardMetrics,
  AdminDashboardPeriod,
} from '../../dashboard/api'

interface PendingCaseRow {
  id: string
  case_no: string
  status: string
  sla_due_at: string | null
}

type MetricKey = keyof AdminDashboardMetrics
type DashboardFilterValue = 'all' | AdminDashboardPeriod

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildPeriodQuery(period: AdminDashboardPeriod): URLSearchParams {
  const today = dayjs()
  const startOfToday = today.startOf('day')

  const start = period === 'yesterday' ? startOfToday.subtract(1, 'day') : startOfToday.subtract(6, 'day')
  const end = period === 'yesterday' ? startOfToday.subtract(1, 'millisecond') : today.endOf('day')

  const params = new URLSearchParams()
  params.set('createdFrom', start.toISOString())
  params.set('createdTo', end.toISOString())
  return params
}

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [metricsDefault, setMetricsDefault] = useState<AdminDashboardMetrics>({
    totalLeads: 0,
    signedLeads: 0,
    activeOnboardingCases: 0,
    totalProjects: 0,
    delayedProjects: 0,
    activeUsers: 0,
  })
  const [leadBoardMetrics, setLeadBoardMetrics] = useState<AdminLeadBoardMetrics>({
    totalLeads: 0,
    todayNewLeads: 0,
    bcsLeads: 0,
    nonBcsLeads: 0,
    highIntentLeads: 0,
    bcsSignedLeads: 0,
  })
  const [metricsByPeriod, setMetricsByPeriod] = useState<Record<AdminDashboardPeriod, AdminDashboardMetrics>>({
    yesterday: {
      totalLeads: 0,
      signedLeads: 0,
      activeOnboardingCases: 0,
      totalProjects: 0,
      delayedProjects: 0,
      activeUsers: 0,
    },
    last7Days: {
      totalLeads: 0,
      signedLeads: 0,
      activeOnboardingCases: 0,
      totalProjects: 0,
      delayedProjects: 0,
      activeUsers: 0,
    },
  })
  const [globalPeriodFilter, setGlobalPeriodFilter] = useState<DashboardFilterValue>('all')
  const [pendingCases, setPendingCases] = useState<PendingCaseRow[]>([])
  const [salesCategoryMetrics, setSalesCategoryMetrics] = useState<AdminSalesCategoryMetrics[]>([])
  const [selectedCategory, setSelectedCategory] = useState<SalesProductCategory>('TIRE')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [leadBoard, metricDefault, metricYesterday, metricLast7Days, onboardingCases, salesMetrics] = await Promise.all([
        getAdminLeadBoardMetrics(),
        getAdminDashboardMetrics(),
        getAdminDashboardMetrics('yesterday'),
        getAdminDashboardMetrics('last7Days'),
        listOnboardingCases(),
        getAdminSalesCategoryMetrics(),
      ])

      setLeadBoardMetrics(leadBoard)
      setMetricsDefault(metricDefault)
      setMetricsByPeriod({
        yesterday: metricYesterday,
        last7Days: metricLast7Days,
      })
      setSalesCategoryMetrics(salesMetrics)
      setPendingCases(
        onboardingCases
          .filter((item) => item.status !== 'COMPLETED' && item.status !== 'REJECTED')
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            case_no: item.case_no,
            status: item.status,
            sla_due_at: item.sla_due_at,
          })),
      )
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminDashboard.loadFail', { defaultValue: 'Failed to load admin dashboard' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])
  const selectedSalesMetrics = useMemo(
    () =>
      salesCategoryMetrics.find((item) => item.category === selectedCategory) ?? {
        category: selectedCategory,
        totalQuantity: 0,
        totalAmount: 0,
      },
    [salesCategoryMetrics, selectedCategory],
  )

  function openModuleList(path: string, period?: AdminDashboardPeriod, extraQuery?: Record<string, string>) {
    const params = period ? buildPeriodQuery(period) : new URLSearchParams()

    if (extraQuery) {
      Object.entries(extraQuery).forEach(([key, value]) => {
        params.set(key, value)
      })
    }

    const queryString = params.toString()
    navigate(queryString ? `${path}?${queryString}` : path)
  }

  const selectedMetrics = useMemo(() => {
    if (globalPeriodFilter === 'all') {
      return metricsDefault
    }
    return metricsByPeriod[globalPeriodFilter]
  }, [globalPeriodFilter, metricsByPeriod, metricsDefault])

  function renderMetricCard(key: MetricKey, title: string, path: string, extraQuery?: Record<string, string>) {
    const periodForJump = globalPeriodFilter === 'all' ? undefined : globalPeriodFilter
    return <MetricCard title={title} value={selectedMetrics[key]} onClick={() => openModuleList(path, periodForJump, extraQuery)} />
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.adminDashboard.title', { defaultValue: 'Admin Overview' })}
        description={t('pages.adminDashboard.description', {
          defaultValue: 'Global operational view across leads, onboarding, and projects.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Card
        className="mb-5"
        title={t('pages.adminDashboard.unifiedBoardTitle', { defaultValue: 'Operational Dashboard Overview' })}
        extra={
          <Space size={8} align="center">
            <span className="text-sm text-slate-500">{t('labels.filter', { defaultValue: 'Filter' })}</span>
            <Select
              size="small"
              value={globalPeriodFilter}
              style={{ width: 154 }}
              options={[
                { value: 'all', label: t('labels.defaultPeriod', { defaultValue: 'Default' }) },
                { value: 'last7Days', label: t('labels.last7Days', { defaultValue: 'Last 7 Days' }) },
                { value: 'yesterday', label: t('labels.yesterday', { defaultValue: 'Yesterday' }) },
              ]}
              onChange={(value: DashboardFilterValue) => setGlobalPeriodFilter(value)}
            />
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={4}>
            <MetricCard
              title={t('pages.adminDashboard.metrics.totalLeads', { defaultValue: 'Total Leads' })}
              value={leadBoardMetrics.totalLeads}
              onClick={() => openModuleList('/app/admin/leads/pool/overview', undefined, { excludeSigned: '1' })}
            />
          </Col>
          <Col xs={24} md={12} xl={4}>
            <MetricCard
              title={t('pages.adminDashboard.metrics.todayNewLeads', { defaultValue: 'Today New Leads' })}
              value={leadBoardMetrics.todayNewLeads}
              onClick={() => {
                const todayStart = dayjs().startOf('day').toISOString()
                const todayEnd = dayjs().endOf('day').toISOString()
                openModuleList('/app/admin/leads/pool/today-new', undefined, {
                  createdFrom: todayStart,
                  createdTo: todayEnd,
                })
              }}
            />
          </Col>
          <Col xs={24} md={12} xl={4}>
            <MetricCard
              title={t('pages.adminDashboard.metrics.bcsLeads', { defaultValue: 'BCS Leads' })}
              value={leadBoardMetrics.bcsLeads}
              onClick={() => openModuleList('/app/admin/leads/pool/bcs', undefined, { intentPackageGroup: 'BCS_RELATED' })}
            />
          </Col>
          <Col xs={24} md={12} xl={4}>
            <MetricCard
              title={t('pages.adminDashboard.metrics.nonBcsLeads', { defaultValue: 'Non-BCS Leads' })}
              value={leadBoardMetrics.nonBcsLeads}
              onClick={() => openModuleList('/app/admin/leads/pool/non-bcs', undefined, { intentPackageGroup: 'NON_BCS' })}
            />
          </Col>
          <Col xs={24} md={12} xl={4}>
            <MetricCard
              title={`${t('pages.adminDashboard.metrics.highIntentLeads', { defaultValue: 'High Intent Leads' })} ${t(
                'pages.adminDashboard.metrics.highIntentLeadsNote',
                { defaultValue: '*H4+' },
              )}`}
              value={leadBoardMetrics.highIntentLeads}
              onClick={() =>
                openModuleList('/app/admin/leads/pool/high-intent', undefined, {
                  intentLevelMin: '4',
                  intentPackageGroup: 'BCS_RELATED',
                  excludeSigned: '1',
                })
              }
            />
          </Col>
          <Col xs={24} md={12} xl={4}>
            <MetricCard
              title={t('pages.adminDashboard.metrics.bcsSignedLeads', { defaultValue: 'BCS Signed Leads' })}
              value={leadBoardMetrics.bcsSignedLeads}
              onClick={() =>
                openModuleList('/app/admin/leads/pool/bcs-signed', undefined, {
                  status: 'SIGNED',
                  signedContractPackageGroup: 'BCS_RELATED',
                })
              }
            />
          </Col>
          <Col xs={24} md={12} xl={4}>
          {renderMetricCard('signedLeads', t('pages.adminDashboard.metrics.signedLeads', { defaultValue: 'Signed Leads' }), '/app/admin/leads/pool/signed', { status: 'SIGNED' })}
          </Col>
          <Col xs={24} md={12} xl={4}>
          {renderMetricCard(
            'activeOnboardingCases',
            t('pages.adminDashboard.metrics.onboardingActive', { defaultValue: 'Onboarding Active' }),
            '/app/admin/onboarding/review-center',
            { activeOnly: '1' },
          )}
          </Col>
          <Col xs={24} md={12} xl={4}>
          {renderMetricCard(
            'totalProjects',
            t('pages.adminDashboard.metrics.totalProjects', { defaultValue: 'Total Projects' }),
            '/app/admin/projects/overview',
          )}
          </Col>
          <Col xs={24} md={12} xl={4}>
          {renderMetricCard(
            'delayedProjects',
            t('pages.adminDashboard.metrics.delayedProjects', { defaultValue: 'Delayed Projects' }),
            '/app/admin/projects/overview',
            { status: 'DELAYED' },
          )}
          </Col>
          <Col xs={24} md={12} xl={4}>
          {renderMetricCard(
            'activeUsers',
            t('pages.adminDashboard.metrics.activeUsers', { defaultValue: 'Active Users' }),
            '/app/admin/users-roles',
          )}
          </Col>
        </Row>
      </Card>

      <Card
        className="mb-5"
        title={t('pages.adminDashboard.salesCategoryTitle', { defaultValue: 'Sales Category Overview' })}
      >
        <Row gutter={[16, 16]} align="middle" className="mb-4">
          <Col xs={24} md={8} xl={6}>
            <Select
              className="w-full"
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={categoryOptions}
              placeholder={t('pages.adminDashboard.salesCategorySelect', { defaultValue: 'Select sales category' })}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card bordered={false} className="bg-slate-50">
              <Statistic
                title={t('pages.adminDashboard.salesCategoryQuantity', { defaultValue: 'Sales Quantity' })}
                value={selectedSalesMetrics.totalQuantity}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card bordered={false} className="bg-slate-50">
              <Statistic
                title={t('pages.adminDashboard.salesCategoryAmount', { defaultValue: 'Total Sales Amount' })}
                value={selectedSalesMetrics.totalAmount}
                formatter={(value) => formatCurrency(Number(value ?? 0))}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={pendingCases}
        pagination={false}
        title={() => t('pages.adminDashboard.pendingQueueTitle', { defaultValue: 'Pending Onboarding Queue' })}
        columns={[
          { title: t('pages.adminDashboard.columns.caseNo', { defaultValue: 'Case No' }), dataIndex: 'case_no' },
          {
            title: t('pages.adminDashboard.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.adminDashboard.columns.slaDue', { defaultValue: 'SLA Due' }),
            dataIndex: 'sla_due_at',
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
