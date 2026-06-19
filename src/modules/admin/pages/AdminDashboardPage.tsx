import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  AppstoreOutlined,
  ContainerOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  LineChartOutlined,
  ReconciliationOutlined,
  RobotOutlined,
  SettingFilled,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Grid,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
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
  getSalesProductSubcategoryLabel,
} from '../../../lib/business-constants'
import {
  MetricCard,
} from '../../../components/common/MetricCard'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getAdminSalesCategoryMetrics,
  getAdminSalesInsightOrders,
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
  AdminSalesInsightOrder,
  AdminSalesSubcategoryMetrics,
  AdminSalesCategoryMetrics,
  AdminLeadBoardMetrics,
  AdminDashboardMetrics,
  AdminDashboardPeriod,
} from '../../dashboard/api'
import { formatDisplayName } from '../../../lib/user-display'

interface PendingCaseRow {
  id: string
  case_no: string
  status: string
  sla_due_at: string | null
}

type MetricKey = keyof AdminDashboardMetrics
type DashboardFilterValue = 'all' | AdminDashboardPeriod

interface SalesInsightBdRow {
  bdUserId: string
  bdName: string
  bdEmail: string
  salesAmount: number
  salesRecordCount: number
  totalQuantity: number
  categoryAmounts: Record<string, number>
  categoryQuantities: Record<string, number>
}

interface SalesTrendPoint {
  key: string
  label: string
  totalAmount: number
  categoryAmounts: Record<string, number>
}

interface SalesTrendSegment {
  key: string
  label: string
  color: string
  amount: number
  percent: number
}

interface SalesCategoryOverviewRow extends AdminSalesCategoryMetrics {
  categoryLabel: string
  share: number
}

interface SalesSubcategoryOverviewRow extends AdminSalesSubcategoryMetrics {
  label: string
  share: number
}

const CATEGORY_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#13c2c2', '#722ed1', '#f97316', '#06b6d4']

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100)}%`
}

function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function toProgressPercent(value: number): number {
  const percent = value * 100
  if (!Number.isFinite(percent)) {
    return 0
  }
  return Math.max(0, Math.min(999.9, percent))
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
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
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
  const [salesInsightOrders, setSalesInsightOrders] = useState<AdminSalesInsightOrder[]>([])
  const [salesMonth, setSalesMonth] = useState(() => dayjs().format('YYYY-MM'))
  const [selectedCategory, setSelectedCategory] = useState<SalesProductCategory>('TIRE')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [selectedInsightBdId, setSelectedInsightBdId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [salesLoading, setSalesLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [leadBoard, metricDefault, metricYesterday, metricLast7Days, onboardingCases] = await Promise.all([
        getAdminLeadBoardMetrics(),
        getAdminDashboardMetrics(),
        getAdminDashboardMetrics('yesterday'),
        getAdminDashboardMetrics('last7Days'),
        listOnboardingCases(),
      ])

      setLeadBoardMetrics(leadBoard)
      setMetricsDefault(metricDefault)
      setMetricsByPeriod({
        yesterday: metricYesterday,
        last7Days: metricLast7Days,
      })
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

  const loadSalesData = useCallback(async () => {
    setSalesLoading(true)

    try {
      const [salesMetrics, salesInsightRaw] = await Promise.all([
        getAdminSalesCategoryMetrics(salesMonth),
        getAdminSalesInsightOrders(salesMonth),
      ])
      setSalesCategoryMetrics(salesMetrics)
      setSalesInsightOrders(salesInsightRaw)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminDashboard.loadFail', { defaultValue: 'Failed to load admin dashboard' })
      message.error(text)
    } finally {
      setSalesLoading(false)
    }
  }, [salesMonth, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadSalesData()
  }, [loadSalesData])

  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])
  const selectedSalesMetrics = useMemo(
    () =>
      salesCategoryMetrics.find((item) => item.category === selectedCategory) ?? {
        category: selectedCategory,
        totalQuantity: 0,
        totalAmount: 0,
        subcategories: [],
      },
    [salesCategoryMetrics, selectedCategory],
  )

  const categoryLabelByValue = useMemo(() => {
    return new Map(categoryOptions.map((item) => [item.value, item.label]))
  }, [categoryOptions])

  const salesMonthTotalAmount = useMemo(() => {
    return salesCategoryMetrics.reduce((sum, item) => sum + safeNumber(item.totalAmount), 0)
  }, [salesCategoryMetrics])

  const salesMonthTotalQuantity = useMemo(() => {
    return salesCategoryMetrics.reduce((sum, item) => sum + safeNumber(item.totalQuantity), 0)
  }, [salesCategoryMetrics])

  const salesMonthActiveCategoryCount = useMemo(() => {
    return salesCategoryMetrics.filter((item) => safeNumber(item.totalQuantity) > 0 || safeNumber(item.totalAmount) > 0).length
  }, [salesCategoryMetrics])

  const salesCategoryOverviewRows = useMemo<SalesCategoryOverviewRow[]>(() => {
    return salesCategoryMetrics.map((item) => ({
      ...item,
      categoryLabel: categoryLabelByValue.get(item.category) ?? item.category,
      share: salesMonthTotalAmount > 0 ? safeNumber(item.totalAmount) / salesMonthTotalAmount : 0,
    }))
  }, [categoryLabelByValue, salesCategoryMetrics, salesMonthTotalAmount])

  const salesInsightRows = useMemo<SalesInsightBdRow[]>(() => {
    const aggregate = new Map<string, SalesInsightBdRow>()

    for (const order of salesInsightOrders) {
      const current =
        aggregate.get(order.bdUserId) ??
        {
          bdUserId: order.bdUserId,
          bdName: order.bdName,
          bdEmail: order.bdEmail,
          salesAmount: 0,
          salesRecordCount: 0,
          totalQuantity: 0,
          categoryAmounts: {},
          categoryQuantities: {},
        }

      current.salesRecordCount += 1
      current.salesAmount += safeNumber(order.salesAmount)

      for (const item of order.items) {
        const categoryKey = String(item.category || 'UNKNOWN').trim() || 'UNKNOWN'
        const quantity = safeNumber(item.quantity)
        const amount = safeNumber(item.amount)
        current.totalQuantity += quantity
        current.categoryQuantities[categoryKey] = (current.categoryQuantities[categoryKey] ?? 0) + quantity
        current.categoryAmounts[categoryKey] = (current.categoryAmounts[categoryKey] ?? 0) + amount
      }

      aggregate.set(order.bdUserId, current)
    }

    return [...aggregate.values()].sort((left, right) => right.salesAmount - left.salesAmount)
  }, [salesInsightOrders])

  useEffect(() => {
    setSelectedInsightBdId((current) => {
      if (salesInsightRows.length === 0) {
        return null
      }
      if (current && salesInsightRows.some((item) => item.bdUserId === current)) {
        return current
      }
      return salesInsightRows[0].bdUserId
    })
  }, [salesInsightRows])

  const selectedInsightBd = useMemo(() => {
    if (!selectedInsightBdId) {
      return null
    }
    return salesInsightRows.find((item) => item.bdUserId === selectedInsightBdId) ?? null
  }, [salesInsightRows, selectedInsightBdId])

  const selectedInsightBdName = selectedInsightBd
    ? formatDisplayName(selectedInsightBd.bdName, selectedInsightBd.bdEmail, selectedInsightBd.bdUserId)
    : ''

  const teamSalesAmountTotal = useMemo(() => {
    return salesInsightRows.reduce((sum, item) => sum + safeNumber(item.salesAmount), 0)
  }, [salesInsightRows])

  const bdWithSalesCount = salesInsightRows.length
  const selectedCategoryTeamAmount = safeNumber(selectedSalesMetrics.totalAmount)
  const selectedCategoryTeamQuantity = safeNumber(selectedSalesMetrics.totalQuantity)

  const selectedBdCategoryAmount = selectedInsightBd
    ? safeNumber(selectedInsightBd.categoryAmounts[selectedCategory] ?? 0)
    : 0
  const selectedBdCategoryQuantity = selectedInsightBd
    ? safeNumber(selectedInsightBd.categoryQuantities[selectedCategory] ?? 0)
    : 0

  const avgCategoryAmountPerBd = bdWithSalesCount > 0 ? selectedCategoryTeamAmount / bdWithSalesCount : 0
  const avgCategoryQuantityPerBd = bdWithSalesCount > 0 ? selectedCategoryTeamQuantity / bdWithSalesCount : 0

  const selectedBdAmountCompletion = avgCategoryAmountPerBd > 0 ? selectedBdCategoryAmount / avgCategoryAmountPerBd : 0
  const selectedBdQuantityCompletion = avgCategoryQuantityPerBd > 0 ? selectedBdCategoryQuantity / avgCategoryQuantityPerBd : 0
  const selectedBdTeamAmountShare = teamSalesAmountTotal > 0 && selectedInsightBd ? selectedInsightBd.salesAmount / teamSalesAmountTotal : 0
  const selectedBdCategoryAmountShare = selectedCategoryTeamAmount > 0 ? selectedBdCategoryAmount / selectedCategoryTeamAmount : 0

  const salesInsightMatrixRows = useMemo(() => {
    const rows = salesInsightRows
      .map((row) => {
        const categoryAmount = safeNumber(row.categoryAmounts[selectedCategory] ?? 0)
        const categoryQuantity = safeNumber(row.categoryQuantities[selectedCategory] ?? 0)
        const amountCompletion = avgCategoryAmountPerBd > 0 ? categoryAmount / avgCategoryAmountPerBd : 0
        return {
          ...row,
          categoryAmount,
          categoryQuantity,
          amountCompletion,
        }
      })
      .sort((left, right) => right.categoryAmount - left.categoryAmount)

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
  }, [avgCategoryAmountPerBd, salesInsightRows, selectedCategory])

  const selectedBdOrders = useMemo(() => {
    if (!selectedInsightBdId) {
      return []
    }
    return salesInsightOrders.filter((item) => item.bdUserId === selectedInsightBdId)
  }, [salesInsightOrders, selectedInsightBdId])

  const selectedBdCategoryShare = useMemo(() => {
    if (!selectedInsightBd) {
      return {
        points: [] as Array<{ key: string; label: string; value: number }>,
        total: 0,
      }
    }

    const points = Object.entries(selectedInsightBd.categoryAmounts)
      .map(([category, value]) => ({
        key: category,
        label: categoryLabelByValue.get(category as SalesProductCategory) ?? category,
        value: safeNumber(value),
      }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value)

    return {
      points,
      total: points.reduce((sum, item) => sum + item.value, 0),
    }
  }, [categoryLabelByValue, selectedInsightBd])

  const categoryColorByKey = useMemo(() => {
    const colorByKey = new Map<string, string>()
    selectedBdCategoryShare.points.forEach((item, index) => {
      colorByKey.set(item.key, CATEGORY_COLORS[index % CATEGORY_COLORS.length])
    })
    colorByKey.set('OTHER', '#94a3b8')
    return colorByKey
  }, [selectedBdCategoryShare.points])

  const selectedBdPieGradient = useMemo(() => {
    if (selectedBdCategoryShare.total <= 0 || selectedBdCategoryShare.points.length === 0) {
      return '#e5e7eb'
    }
    let accumulated = 0
    const stops = selectedBdCategoryShare.points.map((point) => {
      const start = (accumulated / selectedBdCategoryShare.total) * 100
      accumulated += point.value
      const end = (accumulated / selectedBdCategoryShare.total) * 100
      return `${categoryColorByKey.get(point.key) ?? '#94a3b8'} ${start}% ${end}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [categoryColorByKey, selectedBdCategoryShare.points, selectedBdCategoryShare.total])

  const selectedTrendPoints = useMemo<SalesTrendPoint[]>(() => {
    const aggregate = new Map<string, SalesTrendPoint>()

    for (const order of selectedBdOrders) {
      const soldAt = dayjs(order.soldAt)
      if (!soldAt.isValid()) {
        continue
      }
      const key = soldAt.format('YYYY-MM-DD')
      const current =
        aggregate.get(key) ??
        {
          key,
          label: soldAt.format('MM-DD'),
          totalAmount: 0,
          categoryAmounts: {},
        }

      current.totalAmount += safeNumber(order.salesAmount)
      for (const item of order.items) {
        const category = String(item.category || 'UNKNOWN').trim() || 'UNKNOWN'
        const amount = safeNumber(item.amount)
        if (amount <= 0) {
          continue
        }
        current.categoryAmounts[category] = (current.categoryAmounts[category] ?? 0) + amount
      }
      aggregate.set(key, current)
    }

    return [...aggregate.values()].sort((left, right) => left.key.localeCompare(right.key))
  }, [selectedBdOrders])

  const trendMaxAmount = useMemo(() => {
    return Math.max(1, ...selectedTrendPoints.map((item) => safeNumber(item.totalAmount)))
  }, [selectedTrendPoints])

  const trendCategoryKeys = useMemo(() => {
    return selectedBdCategoryShare.points.slice(0, 4).map((item) => item.key)
  }, [selectedBdCategoryShare.points])

  const selectedTrendRows = useMemo(() => {
    return selectedTrendPoints.map((point) => {
      const total = safeNumber(point.totalAmount)
      let assignedAmount = 0
      const segments: SalesTrendSegment[] = trendCategoryKeys
        .map((categoryKey) => {
          const amount = safeNumber(point.categoryAmounts[categoryKey] ?? 0)
          assignedAmount += amount
          if (amount <= 0) {
            return null
          }
          return {
            key: categoryKey,
            label: categoryLabelByValue.get(categoryKey as SalesProductCategory) ?? categoryKey,
            color: categoryColorByKey.get(categoryKey) ?? '#94a3b8',
            amount,
            percent: total > 0 ? amount / total : 0,
          }
        })
        .filter((item): item is SalesTrendSegment => item !== null)

      const otherAmount = Math.max(0, total - assignedAmount)
      if (otherAmount > 0) {
        segments.push({
          key: 'OTHER',
          label: t('pages.adminDashboard.analysis.others', { defaultValue: 'Others' }),
          color: categoryColorByKey.get('OTHER') ?? '#94a3b8',
          amount: otherAmount,
          percent: total > 0 ? otherAmount / total : 0,
        })
      }

      return {
        ...point,
        segments,
      }
    })
  }, [categoryColorByKey, categoryLabelByValue, selectedTrendPoints, t, trendCategoryKeys])

  const trendLineChart = useMemo(() => {
    const viewWidth = 760
    const viewHeight = 220
    const paddingX = 28
    const paddingY = 20
    const width = viewWidth - paddingX * 2
    const height = viewHeight - paddingY * 2

    if (selectedTrendPoints.length === 0) {
      return {
        viewWidth,
        viewHeight,
        path: '',
        points: [] as Array<{ x: number; y: number; value: number; label: string; key: string }>,
        gridLines: [] as Array<{ y: number; value: number }>,
      }
    }

    const points = selectedTrendPoints.map((point, index) => {
      const x =
        selectedTrendPoints.length === 1
          ? viewWidth / 2
          : paddingX + (index / (selectedTrendPoints.length - 1)) * width
      const y = viewHeight - paddingY - (safeNumber(point.totalAmount) / trendMaxAmount) * height
      return {
        key: point.key,
        label: point.label,
        value: point.totalAmount,
        x,
        y,
      }
    })

    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ')

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: viewHeight - paddingY - ratio * height,
      value: trendMaxAmount * ratio,
    }))

    return {
      viewWidth,
      viewHeight,
      path,
      points,
      gridLines,
    }
  }, [selectedTrendPoints, trendMaxAmount])

  const bdInsightOptions = useMemo(() => {
    return salesInsightMatrixRows.map((row) => ({
      value: row.bdUserId,
      label: `#${row.rank} ${formatDisplayName(row.bdName, row.bdEmail, row.bdUserId)}`,
    }))
  }, [salesInsightMatrixRows])

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

  // ── 手機版：支付寶式主頁 ──────────────────────────────────────────────
  if (isMobile) {
    const quickItems = [
      { icon: <UnorderedListOutlined />, label: t('nav.lead-pool', { defaultValue: 'Lead Pool' }), path: '/app/admin/leads/pool', color: '#c10e0e' },
      { icon: <TeamOutlined />, label: t('nav.users-roles', { defaultValue: 'Users' }), path: '/app/admin/users-roles', color: '#7c3aed' },
      { icon: <ContainerOutlined />, label: t('nav.admin-onboard-merchants', { defaultValue: 'Merchants' }), path: '/app/admin/onboarding/merchants', color: '#0284c7' },
      { icon: <ReconciliationOutlined />, label: t('nav.onboarding-review', { defaultValue: 'Review' }), path: '/app/admin/onboarding/review-center', color: '#16a34a' },
      { icon: <DeploymentUnitOutlined />, label: t('nav.project-overview', { defaultValue: 'Projects' }), path: '/app/admin/projects/overview', color: '#9333ea' },
      { icon: <LineChartOutlined />, label: t('nav.sales-supervision', { defaultValue: 'Sales' }), path: '/app/admin/sales/supervision', color: '#0891b2' },
      { icon: <LineChartOutlined />, label: t('nav.bd-kpi-dashboard', { defaultValue: 'KPI' }), path: '/app/admin/kpi/dashboard', color: '#d97706' },
      { icon: <RobotOutlined />, label: t('nav.admin-ai-data-assistant', { defaultValue: 'AI' }), path: '/app/admin/ai/data-assistant', color: '#0ea5e9' },
      { icon: <FileTextOutlined />, label: t('nav.report-export', { defaultValue: 'Reports' }), path: '/app/admin/reports/export', color: '#64748b' },
      { icon: <SettingFilled />, label: t('nav.system-config', { defaultValue: 'Settings' }), path: '/app/admin/system-config', color: '#475569' },
      { icon: <FileTextOutlined />, label: t('nav.logs', { defaultValue: 'Logs' }), path: '/app/admin/logs', color: '#78716c' },
      { icon: <AppstoreOutlined />, label: t('nav.uploads', { defaultValue: 'Files' }), path: '/app/files', color: '#0d9488' },
    ]

    const recentCases = pendingCases.slice(0, 3)

    return (
      <div className="pb-2">
        {/* 關鍵數字 2×2 */}
        <div className="mobile-home-stats">
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/admin/leads/pool')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/admin/leads/pool') }}
          >
            <div className="mobile-home-stat-label">{t('pages.adminDashboard.metrics.totalLeads', { defaultValue: 'Total Leads' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metricsDefault.totalLeads}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/admin/onboarding/review-center')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/admin/onboarding/review-center') }}
          >
            <div className="mobile-home-stat-label">{t('pages.adminDashboard.metrics.activeOnboarding', { defaultValue: 'Active Cases' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metricsDefault.activeOnboardingCases}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/admin/projects/overview')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/admin/projects/overview') }}
          >
            <div className="mobile-home-stat-label">{t('pages.adminDashboard.metrics.totalProjects', { defaultValue: 'Projects' })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : metricsDefault.totalProjects}</div>
          </div>
          <div
            className="mobile-home-stat-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/app/admin/leads/pool/today-new')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/admin/leads/pool/today-new') }}
          >
            <div className="mobile-home-stat-label">{t('pages.adminDashboard.metrics.todayNew', { defaultValue: "Today's New" })}</div>
            <div className="mobile-home-stat-value">{loading ? '—' : leadBoardMetrics.todayNewLeads}</div>
          </div>
        </div>

        {/* 功能宮格 */}
        <div className="mobile-home-section-title">{t('pages.adminDashboard.quickActions', { defaultValue: 'Quick Access' })}</div>
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

        {/* 待審核進件 */}
        <div className="mobile-home-recent">
          <div className="mobile-home-recent-header">
            <span className="mobile-home-recent-title">
              {t('pages.adminDashboard.pendingCases', { defaultValue: 'Pending Review' })}
            </span>
            <button
              type="button"
              className="mobile-home-recent-more"
              onClick={() => navigate('/app/admin/onboarding/review-center')}
            >
              {t('labels.viewAll', { defaultValue: 'View all' })} →
            </button>
          </div>
          {recentCases.length === 0 ? (
            <div className="mobile-home-empty">
              {loading ? t('labels.loading', { defaultValue: 'Loading…' }) : t('pages.adminDashboard.noPendingCases', { defaultValue: 'No pending cases' })}
            </div>
          ) : (
            recentCases.map((row) => (
              <div
                key={row.id}
                className="mobile-home-recent-item"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/app/admin/onboarding/review-center')}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/app/admin/onboarding/review-center') }}
              >
                <div className="mobile-home-recent-item-left">
                  <div className="mobile-home-recent-item-code">{row.case_no}</div>
                  <div className="mobile-home-recent-item-name">
                    <StatusTag value={row.status} />
                  </div>
                </div>
                <div className="mobile-home-recent-item-date">
                  {row.sla_due_at ? new Date(row.sla_due_at).toLocaleDateString() : '—'}
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
        title={t('pages.adminDashboard.title', { defaultValue: 'Admin Overview' })}
        description={t('pages.adminDashboard.description', {
          defaultValue: 'Global operational view across leads, onboarding, and projects.',
        })}
        extra={
          <Space wrap>
            <Button onClick={() => setAnalysisOpen(true)}>
              {t('pages.adminDashboard.analysis.entry', { defaultValue: 'View Analysis' })}
            </Button>
            <Button onClick={() => void Promise.all([loadData(), loadSalesData()])}>
              {t('labels.refresh', { defaultValue: 'Refresh' })}
            </Button>
          </Space>
        }
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
          {renderMetricCard(
            'signedLeads',
            t('pages.adminDashboard.metrics.signedLeads', { defaultValue: 'Non-BCS Signed Total' }),
            '/app/admin/leads/pool/signed',
            { status: 'SIGNED', signedContractPackageGroup: 'NON_BCS' },
          )}
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
            <DatePicker
              className="w-full"
              picker="month"
              allowClear={false}
              value={dayjs(salesMonth)}
              onChange={(value) => {
                if (value) {
                  setSalesMonth(value.format('YYYY-MM'))
                }
              }}
              placeholder={t('pages.adminDashboard.salesMonthSelect', { defaultValue: 'Select month' })}
            />
          </Col>
        </Row>
        <div className="mb-4 text-xs text-slate-500">
          {t('pages.adminDashboard.salesCategoryNaturalMonthNote', {
            defaultValue: 'Natural month {{month}} (filter by Sold Time).',
            month: salesMonth,
          })}
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={8}>
            <Card bordered={false}>
              <Statistic
                title={t('pages.adminDashboard.salesMonthTotalAmount', { defaultValue: 'Selected Month Total Sales Amount' })}
                value={salesMonthTotalAmount}
                formatter={(value) => formatCurrency(Number(value ?? 0))}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card bordered={false}>
              <Statistic
                title={t('pages.adminDashboard.salesMonthTotalQuantity', { defaultValue: 'Selected Month Total Sales Quantity' })}
                value={salesMonthTotalQuantity}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card bordered={false}>
              <Statistic
                title={t('pages.adminDashboard.salesMonthActiveCategories', { defaultValue: 'Categories with Sales' })}
                value={salesMonthActiveCategoryCount}
              />
            </Card>
          </Col>
        </Row>

        <div className="mb-3 mt-5 text-sm font-semibold app-text-soft">
          {t('pages.adminDashboard.salesCategoryBreakdownTitle', { defaultValue: 'Sales Breakdown by Category' })}
        </div>
        <Table<SalesCategoryOverviewRow>
          loading={salesLoading}
          rowKey="category"
          bordered
          pagination={false}
          dataSource={salesCategoryOverviewRows}
          mobileCardTitleKey="categoryLabel"
          onRow={(record) => ({
            onClick: () => setSelectedCategory(record.category),
            className: record.category === selectedCategory ? 'cursor-pointer bg-blue-50/60 dark:bg-blue-900/30' : 'cursor-pointer',
          })}
          expandable={{
            rowExpandable: (record) => record.subcategories.length > 0,
            expandedRowRender: (record) => {
              const rows: SalesSubcategoryOverviewRow[] = record.subcategories.map((item) => ({
                ...item,
                label: getSalesProductSubcategoryLabel(record.category, item.subcategory, t) ?? item.subcategory,
                share: record.totalAmount > 0 ? item.totalAmount / record.totalAmount : 0,
              }))
              return (
                <Table<SalesSubcategoryOverviewRow>
                  rowKey="subcategory"
                  pagination={false}
                  dataSource={rows}
                  mobileCardTitleKey="label"
                  columns={[
                    { title: t('pages.adminDashboard.salesSubcategoryColumn', { defaultValue: 'Subcategory' }), dataIndex: 'label' },
                    { title: t('pages.adminDashboard.salesCategoryQuantity', { defaultValue: 'Sales Quantity' }), dataIndex: 'totalQuantity', align: 'right', render: (value: number) => formatNumber(value) },
                    { title: t('pages.adminDashboard.salesCategoryAmount', { defaultValue: 'Total Sales Amount' }), dataIndex: 'totalAmount', align: 'right', render: (value: number) => formatCurrency(value) },
                    { title: t('pages.adminDashboard.salesCategoryShare', { defaultValue: 'Amount Share' }), dataIndex: 'share', align: 'right', render: (value: number) => formatPercent(value) },
                  ]}
                />
              )
            },
          }}
          columns={[
            {
              title: t('pages.adminDashboard.salesCategoryColumn', { defaultValue: 'Sales Category' }),
              dataIndex: 'categoryLabel',
            },
            {
              title: t('pages.adminDashboard.salesCategoryQuantity', { defaultValue: 'Sales Quantity' }),
              dataIndex: 'totalQuantity',
              align: 'right',
              render: (value: number) => formatNumber(value),
            },
            {
              title: t('pages.adminDashboard.salesCategoryAmount', { defaultValue: 'Total Sales Amount' }),
              dataIndex: 'totalAmount',
              align: 'right',
              render: (value: number) => formatCurrency(value),
            },
            {
              title: t('pages.adminDashboard.salesCategoryShare', { defaultValue: 'Amount Share' }),
              dataIndex: 'share',
              align: 'right',
              render: (value: number) => formatPercent(value),
            },
          ]}
        />
      </Card>

      <Drawer
        title={t('pages.adminDashboard.analysis.title', { defaultValue: 'Admin Sales Analysis View' })}
        width={isMobile ? '100vw' : 1200}
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        styles={{ body: { overflowX: 'hidden' } }}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag bordered={false} color="blue">
              {t('pages.adminDashboard.analysis.naturalMonthHint', {
                defaultValue: 'Natural month {{month}} based on Sold Time',
                month: salesMonth,
              })}
            </Tag>
            <Tag bordered={false} color="cyan">
              {t('pages.adminDashboard.analysis.bdWithSales', {
                defaultValue: 'BD with Sales: {{count}}',
                count: bdWithSalesCount,
              })}
            </Tag>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card size="small">
              <Statistic
                title={t('pages.adminDashboard.analysis.selectedCategoryAmount', { defaultValue: 'Selected Category Amount' })}
                value={selectedCategoryTeamAmount}
                formatter={(value) => formatCurrency(Number(value ?? 0))}
              />
            </Card>
            <Card size="small">
              <Statistic
                title={t('pages.adminDashboard.analysis.selectedCategoryQuantity', { defaultValue: 'Selected Category Quantity' })}
                value={selectedCategoryTeamQuantity}
                formatter={(value) => formatNumber(Number(value ?? 0))}
              />
            </Card>
            <Card size="small">
              <Select
                className="w-full"
                value={selectedCategory}
                onChange={(value) => setSelectedCategory(value)}
                options={categoryOptions}
                placeholder={t('pages.adminDashboard.salesCategorySelect', { defaultValue: 'Select sales category' })}
              />
            </Card>
          </div>

          {salesInsightRows.length === 0 ? (
            <Card size="small">
              <Empty description={t('pages.adminDashboard.analysis.empty', { defaultValue: 'No sales data in current natural month' })} />
            </Card>
          ) : (
            <>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <Card
                  size="small"
                  title={t('pages.adminDashboard.analysis.matrixTitle', { defaultValue: 'BD Sales Matrix by Category' })}
                >
                  <div className="mb-2 text-xs text-slate-500">
                    {t('pages.adminDashboard.analysis.matrixHint', {
                      defaultValue: 'Completion is compared against average amount per BD in selected category.',
                    })}
                  </div>
                  <div className="mb-3">
                    <Select
                      className="w-full"
                      value={selectedInsightBdId ?? undefined}
                      options={bdInsightOptions}
                      onChange={(value) => setSelectedInsightBdId(String(value))}
                      placeholder={t('pages.adminDashboard.analysis.selectBd', { defaultValue: 'Select BD' })}
                    />
                  </div>
                  {isMobile ? (
                    <div className="space-y-2">
                      {salesInsightMatrixRows.map((row) => {
                        const isSelected = row.bdUserId === selectedInsightBdId
                        return (
                          <button
                            key={row.bdUserId}
                            type="button"
                            onClick={() => setSelectedInsightBdId(row.bdUserId)}
                            className={`w-full rounded-lg border p-3 text-left ${isSelected ? 'border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-900/30' : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800'}`}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <Tag color={isSelected ? 'geekblue' : 'blue'} bordered={false}>
                                #{row.rank}
                              </Tag>
                              <span className="truncate text-sm font-medium app-text">
                                {formatDisplayName(row.bdName, row.bdEmail, row.bdUserId)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs app-text-soft">
                              <div>
                                <div className="app-text-soft">{t('pages.adminDashboard.analysis.salesAmount', { defaultValue: 'Sales Amount' })}</div>
                                <div className="font-semibold app-text">{formatCurrency(row.salesAmount)}</div>
                              </div>
                              <div>
                                <div className="app-text-soft">{t('pages.adminDashboard.analysis.salesRecords', { defaultValue: 'Sales Records' })}</div>
                                <div className="font-semibold app-text">{formatNumber(row.salesRecordCount)}</div>
                              </div>
                              <div>
                                <div className="app-text-soft">{t('pages.adminDashboard.analysis.categoryAmount', { defaultValue: 'Category Amount' })}</div>
                                <div className="font-semibold app-text">{formatCurrency(row.categoryAmount)}</div>
                              </div>
                              <div>
                                <div className="app-text-soft">{t('pages.adminDashboard.analysis.amountCompletion', { defaultValue: 'Amount Completion' })}</div>
                                <div className="font-semibold app-text">{formatPercent(row.amountCompletion)}</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse">
                        <thead>
                          <tr>
                            <th className="border-b app-border px-3 py-2 text-left text-xs font-semibold app-text-soft">BD</th>
                            <th className="border-b app-border px-3 py-2 text-right text-xs font-semibold app-text-soft">
                              {t('pages.adminDashboard.analysis.salesAmount', { defaultValue: 'Sales Amount' })}
                            </th>
                            <th className="border-b app-border px-3 py-2 text-right text-xs font-semibold app-text-soft">
                              {t('pages.adminDashboard.analysis.salesRecords', { defaultValue: 'Sales Records' })}
                            </th>
                            <th className="border-b app-border px-3 py-2 text-right text-xs font-semibold app-text-soft">
                              {t('pages.adminDashboard.analysis.categoryAmount', { defaultValue: 'Category Amount' })}
                            </th>
                            <th className="border-b app-border px-3 py-2 text-right text-xs font-semibold app-text-soft">
                              {t('pages.adminDashboard.analysis.amountCompletion', { defaultValue: 'Amount Completion' })}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesInsightMatrixRows.map((row) => {
                            const isSelected = row.bdUserId === selectedInsightBdId
                            return (
                              <tr key={row.bdUserId} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-900/30' : undefined}>
                                <td className="border-b app-border px-3 py-2 align-middle">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInsightBdId(row.bdUserId)}
                                    className="flex w-full items-center gap-2 text-left"
                                  >
                                    <Tag color={isSelected ? 'geekblue' : 'blue'} bordered={false}>
                                      #{row.rank}
                                    </Tag>
                                    <span className="truncate text-sm font-medium app-text">
                                      {formatDisplayName(row.bdName, row.bdEmail, row.bdUserId)}
                                    </span>
                                  </button>
                                </td>
                                <td className="border-b app-border px-3 py-2 text-right text-sm app-text">
                                  {formatCurrency(row.salesAmount)}
                                </td>
                                <td className="border-b app-border px-3 py-2 text-right text-sm app-text">
                                  {formatNumber(row.salesRecordCount)}
                                </td>
                                <td className="border-b app-border px-3 py-2 text-right text-sm app-text">
                                  {formatCurrency(row.categoryAmount)}
                                </td>
                                <td className="border-b app-border px-3 py-2 text-right text-sm app-text">
                                  {formatPercent(row.amountCompletion)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card
                  size="small"
                  title={t('pages.adminDashboard.analysis.snapshotTitle', { defaultValue: 'Selected BD Snapshot' })}
                >
                  {!selectedInsightBd ? (
                    <Empty description={t('pages.adminDashboard.analysis.selectBdFirst', { defaultValue: 'Please select a BD first' })} />
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-md border app-border app-surface-muted px-3 py-2">
                        <div className="text-xs app-text-soft">{t('pages.adminDashboard.analysis.selectedBd', { defaultValue: 'Selected BD' })}</div>
                        <div className="truncate text-sm font-semibold app-text" title={selectedInsightBdName}>
                          {selectedInsightBdName}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border app-border p-2">
                          <div className="text-xs app-text-soft">{t('pages.adminDashboard.analysis.salesAmount', { defaultValue: 'Sales Amount' })}</div>
                          <div className="text-base font-semibold app-text">{formatCurrency(selectedInsightBd.salesAmount)}</div>
                        </div>
                        <div className="rounded-md border app-border p-2">
                          <div className="text-xs app-text-soft">{t('pages.adminDashboard.analysis.salesRecords', { defaultValue: 'Sales Records' })}</div>
                          <div className="text-base font-semibold app-text">{formatNumber(selectedInsightBd.salesRecordCount)}</div>
                        </div>
                        <div className="rounded-md border app-border p-2">
                          <div className="text-xs app-text-soft">{t('pages.adminDashboard.analysis.categoryAmount', { defaultValue: 'Category Amount' })}</div>
                          <div className="text-base font-semibold app-text">{formatCurrency(selectedBdCategoryAmount)}</div>
                        </div>
                        <div className="rounded-md border app-border p-2">
                          <div className="text-xs app-text-soft">{t('pages.adminDashboard.analysis.categoryQuantity', { defaultValue: 'Category Quantity' })}</div>
                          <div className="text-base font-semibold app-text">{formatNumber(selectedBdCategoryQuantity)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          {
                            key: 'amountCompletion',
                            label: t('pages.adminDashboard.analysis.amountCompletion', { defaultValue: 'Amount Completion' }),
                            value: selectedBdAmountCompletion,
                            color: '#2563eb',
                          },
                          {
                            key: 'quantityCompletion',
                            label: t('pages.adminDashboard.analysis.quantityCompletion', { defaultValue: 'Quantity Completion' }),
                            value: selectedBdQuantityCompletion,
                            color: '#f97316',
                          },
                          {
                            key: 'overallShare',
                            label: t('pages.adminDashboard.analysis.overallShare', { defaultValue: 'Team Sales Share' }),
                            value: selectedBdTeamAmountShare,
                            color: '#16a34a',
                          },
                          {
                            key: 'categoryShare',
                            label: t('pages.adminDashboard.analysis.categoryShareRate', { defaultValue: 'Category Share' }),
                            value: selectedBdCategoryAmountShare,
                            color: '#0f766e',
                          },
                        ].map((metricPoint) => (
                          <div key={metricPoint.key}>
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                              <span>{metricPoint.label}</span>
                              <span className="font-medium text-slate-700">{formatPercent(metricPoint.value)}</span>
                            </div>
                            <Progress percent={toProgressPercent(metricPoint.value)} showInfo={false} size="small" strokeColor={metricPoint.color} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                <Card
                  size="small"
                  title={t('pages.adminDashboard.analysis.trendTitle', { defaultValue: 'Sales Trend by Day & Category' })}
                >
                  {!selectedInsightBd || selectedTrendRows.length === 0 ? (
                    <Empty description={t('pages.adminDashboard.analysis.noTrend', { defaultValue: 'No trend data for selected BD' })} />
                  ) : (
                    <div className="space-y-4">
                      <div className="text-xs text-slate-500">
                        {selectedInsightBdName} · {t('pages.adminDashboard.analysis.trendHint', {
                          defaultValue: 'Line shows daily total amount; stacked bars show category composition.',
                        })}
                      </div>
                      <div className={isMobile ? 'w-full overflow-x-hidden' : 'w-full overflow-x-auto'}>
                        <svg viewBox={`0 0 ${trendLineChart.viewWidth} ${trendLineChart.viewHeight}`} className="w-full">
                          {trendLineChart.gridLines.map((line) => (
                            <g key={line.y}>
                              <line x1={22} y1={line.y} x2={trendLineChart.viewWidth - 22} y2={line.y} stroke="#e2e8f0" strokeWidth={1} />
                              <text x={8} y={line.y + 4} fontSize={10} fill="#94a3b8">
                                {formatCurrency(line.value)}
                              </text>
                            </g>
                          ))}
                          {trendLineChart.path ? (
                            <path d={trendLineChart.path} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />
                          ) : null}
                          {trendLineChart.points.map((point) => (
                            <g key={point.key}>
                              <circle cx={point.x} cy={point.y} r={3.5} fill="#2563eb" />
                              <text x={point.x} y={trendLineChart.viewHeight - 4} textAnchor="middle" fontSize={10} fill="#64748b">
                                {point.label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                      <div className="space-y-3">
                        {selectedTrendRows.map((row) => (
                          <div key={row.key}>
                            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-xs">
                              <span className="font-medium app-text">{row.label}</span>
                              <span className="app-text-soft">{formatCurrency(row.totalAmount)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded app-surface-muted">
                              <div className="flex h-full" style={{ width: `${(safeNumber(row.totalAmount) / trendMaxAmount) * 100}%` }}>
                                {row.segments.map((segment) => (
                                  <div
                                    key={`${row.key}-${segment.key}`}
                                    className="h-full"
                                    style={{
                                      width: `${segment.percent * 100}%`,
                                      backgroundColor: segment.color,
                                    }}
                                    title={`${segment.label}: ${formatCurrency(segment.amount)} (${formatPercent(segment.percent)})`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <Card
                  size="small"
                  title={t('pages.adminDashboard.analysis.categoryPieTitle', { defaultValue: 'Category Share of Selected BD' })}
                >
                  {!selectedInsightBd || selectedBdCategoryShare.total <= 0 ? (
                    <Empty description={t('pages.adminDashboard.analysis.noCategoryData', { defaultValue: 'No category data for selected BD' })} />
                  ) : (
                    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start">
                      <div className="relative h-44 w-44 shrink-0 rounded-full border app-border sm:h-56 sm:w-56" style={{ background: selectedBdPieGradient }}>
                        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full app-surface shadow-sm">
                          <div className="text-xs app-text-soft">{t('pages.adminDashboard.analysis.total', { defaultValue: 'Total' })}</div>
                          <div className="text-sm font-semibold app-text">{formatCurrency(selectedBdCategoryShare.total)}</div>
                        </div>
                      </div>
                      <div className="w-full space-y-2">
                        {selectedBdCategoryShare.points.map((point) => {
                          const percent = selectedBdCategoryShare.total > 0 ? point.value / selectedBdCategoryShare.total : 0
                          return (
                            <div key={point.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-sm">
                              <span className="inline-flex min-w-0 items-center gap-2 app-text">
                                <span
                                  className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm"
                                  style={{ backgroundColor: categoryColorByKey.get(point.key) ?? '#94a3b8' }}
                                />
                                <span className="truncate" title={point.label}>
                                  {point.label}
                                </span>
                              </span>
                              <span className="whitespace-nowrap text-right text-xs text-slate-500">
                                {formatCurrency(point.value)} ({formatPercent(percent)})
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </Drawer>

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
