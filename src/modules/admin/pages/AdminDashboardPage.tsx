import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Button,
  Card,
  Col,
  Row,
  Select,
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
  MetricCard,
} from '../../../components/common/MetricCard'
import {
  getSalesProductCategoryOptions,
} from '../../../lib/business-constants'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getAdminSalesCategoryMetrics,
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
} from '../../dashboard/api'

interface PendingCaseRow {
  id: string
  case_no: string
  status: string
  sla_due_at: string | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    signedLeads: 0,
    activeOnboardingCases: 0,
    totalProjects: 0,
    delayedProjects: 0,
    activeUsers: 0,
  })
  const [pendingCases, setPendingCases] = useState<PendingCaseRow[]>([])
  const [salesCategoryMetrics, setSalesCategoryMetrics] = useState<AdminSalesCategoryMetrics[]>([])
  const [selectedCategory, setSelectedCategory] = useState<SalesProductCategory>('TIRE')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [metricData, onboardingCases, salesMetrics] = await Promise.all([
        getAdminDashboardMetrics(),
        listOnboardingCases(),
        getAdminSalesCategoryMetrics(),
      ])

      setMetrics(metricData)
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

  return (
    <>
      <PageTitleBar
        title={t('pages.adminDashboard.title', { defaultValue: 'Admin Overview' })}
        description={t('pages.adminDashboard.description', {
          defaultValue: 'Global operational view across leads, onboarding, and projects.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.adminDashboard.metrics.totalLeads', { defaultValue: 'Total Leads' })}
            value={metrics.totalLeads}
            onClick={() => navigate('/app/admin/leads/pool')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.adminDashboard.metrics.signedLeads', { defaultValue: 'Signed Leads' })}
            value={metrics.signedLeads}
            onClick={() => navigate('/app/admin/leads/pool?status=SIGNED')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.adminDashboard.metrics.onboardingActive', { defaultValue: 'Onboarding Active' })}
            value={metrics.activeOnboardingCases}
            onClick={() => navigate('/app/admin/onboarding/review-center?activeOnly=1')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.adminDashboard.metrics.totalProjects', { defaultValue: 'Total Projects' })}
            value={metrics.totalProjects}
            onClick={() => navigate('/app/admin/projects/overview')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.adminDashboard.metrics.delayedProjects', { defaultValue: 'Delayed Projects' })}
            value={metrics.delayedProjects}
            onClick={() => navigate('/app/admin/projects/overview?status=DELAYED')}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('pages.adminDashboard.metrics.activeUsers', { defaultValue: 'Active Users' })}
            value={metrics.activeUsers}
            onClick={() => navigate('/app/admin/users-roles')}
          />
        </Col>
      </Row>

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
