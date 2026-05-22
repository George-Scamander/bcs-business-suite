import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  PieChartOutlined,
  TableOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Progress,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getSalesProductCategoryOptions } from '../../../lib/business-constants'
import { formatDisplayName } from '../../../lib/user-display'
import type { SalesProductCategory } from '../../../types/business'
import {
  getBdKpiTargetSettings,
  queryBdKpiSalesOrderDetails,
  queryBdKpiSummary,
  type BdKpiRow,
  type BdKpiSalesOrderDetail,
} from '../api/kpi'

type DateRange = [Dayjs | null, Dayjs | null] | null
type MetricKey = 'tire' | 'accessory' | 'bcs'
type TrendBucket = 'day' | 'week' | 'month'

interface CalculatedKpiRow extends BdKpiRow {
  tireTarget: number
  accessoryTarget: number
  bcsTarget: number
  tireCompletionRate: number
  accessoryCompletionRate: number
  bcsCompletionRate: number
  overallCompletionRate: number
}

interface CategorySharePoint {
  key: string
  label: string
  value: number
}

interface TrendPoint {
  key: string
  label: string
  totalAmount: number
  categoryAmounts: Record<string, number>
}

interface TrendRowSegment {
  key: string
  label: string
  color: string
  amount: number
  percent: number
}

const { RangePicker } = DatePicker
const CATEGORY_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#13c2c2', '#722ed1', '#f97316', '#06b6d4']

function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function completionRate(actual: number, target: number): number {
  if (target <= 0) {
    return 0
  }
  return actual / target
}

function toProgressPercent(value: number): number {
  const percent = value * 100
  if (!Number.isFinite(percent)) {
    return 0
  }
  return Math.max(0, Math.min(999.9, percent))
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100)}%`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function parseQueryDate(value: string | null): Dayjs | null {
  if (!value) {
    return null
  }
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

function getMetricLabel(metric: MetricKey, t: (key: string, options?: { defaultValue: string }) => string): string {
  if (metric === 'accessory') {
    return t('pages.bdKpi.analysis.metricAccessory', { defaultValue: 'Accessory Sales Amount' })
  }
  if (metric === 'bcs') {
    return t('pages.bdKpi.analysis.metricBcs', { defaultValue: 'BCS Signed Count' })
  }
  return t('pages.bdKpi.analysis.metricTire', { defaultValue: 'Tire Sales Quantity' })
}

function renderMetricValue(metric: MetricKey, value: number): string {
  if (metric === 'accessory') {
    return formatCurrency(value)
  }
  return formatNumber(value)
}

function resolveTrendBucket(range: DateRange): TrendBucket {
  const start = range?.[0]
  const end = range?.[1]
  if (!start || !end) {
    return 'day'
  }
  const days = end.endOf('day').diff(start.startOf('day'), 'day') + 1
  if (days > 120) {
    return 'month'
  }
  if (days > 45) {
    return 'week'
  }
  return 'day'
}

function startOfTrendBucket(date: Dayjs, bucket: TrendBucket): Dayjs {
  if (bucket === 'month') {
    return date.startOf('month')
  }
  if (bucket === 'week') {
    return date.startOf('week')
  }
  return date.startOf('day')
}

function formatTrendLabel(date: Dayjs, bucket: TrendBucket): string {
  if (bucket === 'month') {
    return date.format('YYYY-MM')
  }
  if (bucket === 'week') {
    return `${date.format('MM-DD')}`
  }
  return date.format('MM-DD')
}

export function BdKpiInsightsPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialDateRange = useMemo<DateRange>(() => {
    const from = parseQueryDate(searchParams.get('dateFrom'))
    const to = parseQueryDate(searchParams.get('dateTo'))
    if (from && to) {
      return [from, to]
    }
    return [dayjs().startOf('month'), dayjs().endOf('month')]
  }, [searchParams])

  const initialKeyword = useMemo(() => searchParams.get('keyword')?.trim() ?? '', [searchParams])

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<BdKpiRow[]>([])
  const [salesOrderDetails, setSalesOrderDetails] = useState<BdKpiSalesOrderDetail[]>([])
  const [keywordInput, setKeywordInput] = useState(initialKeyword)
  const [keyword, setKeyword] = useState(initialKeyword)
  const [dateRangeInput, setDateRangeInput] = useState<DateRange>(initialDateRange)
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange)
  const [metric, setMetric] = useState<MetricKey>('tire')
  const [selectedBdUserId, setSelectedBdUserId] = useState<string | null>(null)
  const [defaultPersonalTireTarget, setDefaultPersonalTireTarget] = useState<number>(10)
  const [defaultPersonalAccessoryTarget, setDefaultPersonalAccessoryTarget] = useState<number>(10000)
  const [defaultPersonalBcsTarget, setDefaultPersonalBcsTarget] = useState<number>(5)

  const dashboardPath = location.pathname.startsWith('/app/admin/')
    ? '/app/admin/kpi/dashboard'
    : '/app/pm/kpi/dashboard'

  const categoryLabelByValue = useMemo(() => {
    return new Map(getSalesProductCategoryOptions(t).map((item) => [item.value, item.label]))
  }, [t])

  function syncQuery(nextKeyword: string, nextRange: DateRange) {
    const nextParams = new URLSearchParams()
    if (nextKeyword) {
      nextParams.set('keyword', nextKeyword)
    }
    if (nextRange?.[0]) {
      nextParams.set('dateFrom', nextRange[0].startOf('day').toISOString())
    }
    if (nextRange?.[1]) {
      nextParams.set('dateTo', nextRange[1].endOf('day').toISOString())
    }
    setSearchParams(nextParams, { replace: true })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const queryFilters = {
        keyword: keyword.trim() || undefined,
        dateFrom: dateRange?.[0] ? dateRange[0].startOf('day').toISOString() : undefined,
        dateTo: dateRange?.[1] ? dateRange[1].endOf('day').toISOString() : undefined,
      }

      const result = await queryBdKpiSummary(queryFilters)
      setRows(result.rows)

      const bdUserIds = result.rows.map((row) => row.bdUserId)
      if (bdUserIds.length === 0) {
        setSalesOrderDetails([])
      } else {
        const details = await queryBdKpiSalesOrderDetails({
          ...queryFilters,
          bdUserIds,
        })
        setSalesOrderDetails(details)
      }
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdKpi.analysis.loadFail', { defaultValue: 'Failed to load KPI analytics data' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [dateRange, keyword, t])

  const loadTargetSettings = useCallback(async () => {
    try {
      const settings = await getBdKpiTargetSettings()
      if (settings.defaultPersonalTireTarget !== undefined) {
        setDefaultPersonalTireTarget(settings.defaultPersonalTireTarget)
      }
      if (settings.defaultPersonalAccessoryTarget !== undefined) {
        setDefaultPersonalAccessoryTarget(settings.defaultPersonalAccessoryTarget)
      }
      if (settings.defaultPersonalBcsTarget !== undefined) {
        setDefaultPersonalBcsTarget(settings.defaultPersonalBcsTarget)
      }
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdKpi.loadTargetsFail', { defaultValue: 'Failed to load KPI target settings' })
      message.error(text)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadTargetSettings()
  }, [loadTargetSettings])

  const calculatedRows = useMemo<CalculatedKpiRow[]>(() => {
    return rows.map((row) => {
      const tireTarget = safeNumber(defaultPersonalTireTarget)
      const accessoryTarget = safeNumber(defaultPersonalAccessoryTarget)
      const bcsTarget = safeNumber(defaultPersonalBcsTarget)
      const tireCompletionRate = completionRate(row.tireSalesQuantity, tireTarget)
      const accessoryCompletionRate = completionRate(row.accessorySalesAmount, accessoryTarget)
      const bcsCompletionRate = row.isBcsTargetExempt ? 1 : completionRate(row.bcsSignedCount, bcsTarget)
      return {
        ...row,
        tireTarget,
        accessoryTarget,
        bcsTarget,
        tireCompletionRate,
        accessoryCompletionRate,
        bcsCompletionRate,
        overallCompletionRate: (tireCompletionRate + accessoryCompletionRate + bcsCompletionRate) / 3,
      }
    })
  }, [defaultPersonalAccessoryTarget, defaultPersonalBcsTarget, defaultPersonalTireTarget, rows])

  const rankedRows = useMemo(() => {
    return [...calculatedRows]
      .sort((left, right) => right.overallCompletionRate - left.overallCompletionRate)
      .slice(0, 8)
  }, [calculatedRows])

  useEffect(() => {
    setSelectedBdUserId((current) => {
      if (rankedRows.length === 0) {
        return null
      }
      if (current && rankedRows.some((row) => row.bdUserId === current)) {
        return current
      }
      return rankedRows[0].bdUserId
    })
  }, [rankedRows])

  const selectedBdSummary = useMemo(() => {
    if (!selectedBdUserId) {
      return null
    }
    return rankedRows.find((row) => row.bdUserId === selectedBdUserId) ?? null
  }, [rankedRows, selectedBdUserId])

  const selectedBdName = selectedBdSummary
    ? formatDisplayName(selectedBdSummary.bdName, selectedBdSummary.bdEmail, selectedBdSummary.bdUserId)
    : ''

  const metricRows = useMemo(() => {
    return rankedRows.map((row) => {
      if (metric === 'accessory') {
        return {
          key: row.bdUserId,
          label: formatDisplayName(row.bdName, row.bdEmail, row.bdUserId),
          actual: row.accessorySalesAmount,
          target: row.accessoryTarget,
          completionRate: row.accessoryCompletionRate,
        }
      }

      if (metric === 'bcs') {
        return {
          key: row.bdUserId,
          label: formatDisplayName(row.bdName, row.bdEmail, row.bdUserId),
          actual: row.bcsSignedCount,
          target: row.bcsTarget,
          completionRate: row.bcsCompletionRate,
        }
      }

      return {
        key: row.bdUserId,
        label: formatDisplayName(row.bdName, row.bdEmail, row.bdUserId),
        actual: row.tireSalesQuantity,
        target: row.tireTarget,
        completionRate: row.tireCompletionRate,
      }
    })
  }, [metric, rankedRows])

  const maxMetricValue = useMemo(() => {
    if (metricRows.length === 0) {
      return 1
    }

    return Math.max(
      1,
      ...metricRows.flatMap((row) => [safeNumber(row.actual), safeNumber(row.target)]),
    )
  }, [metricRows])

  const completionMatrixRows = useMemo(() => {
    return rankedRows.map((row, index) => ({
      rank: index + 1,
      key: row.bdUserId,
      label: formatDisplayName(row.bdName, row.bdEmail, row.bdUserId),
      tireCompletionRate: row.tireCompletionRate,
      accessoryCompletionRate: row.accessoryCompletionRate,
      bcsCompletionRate: row.bcsCompletionRate,
      overallCompletionRate: row.overallCompletionRate,
    }))
  }, [rankedRows])

  const selectedBdSalesDetails = useMemo(() => {
    if (!selectedBdUserId) {
      return []
    }
    return salesOrderDetails.filter((row) => row.bdUserId === selectedBdUserId)
  }, [salesOrderDetails, selectedBdUserId])

  const selectedCategoryShare = useMemo(() => {
    const totals = new Map<string, number>()

    for (const order of selectedBdSalesDetails) {
      for (const item of order.items) {
        const amount = safeNumber(item.amount)
        if (amount <= 0) {
          continue
        }
        const category = String(item.category || 'UNKNOWN').trim() || 'UNKNOWN'
        totals.set(category, (totals.get(category) ?? 0) + amount)
      }
    }

    const points: CategorySharePoint[] = [...totals.entries()]
      .map(([category, value]) => ({
        key: category,
        label: categoryLabelByValue.get(category as SalesProductCategory) ?? category,
        value,
      }))
      .sort((left, right) => right.value - left.value)

    return {
      points,
      total: points.reduce((sum, point) => sum + point.value, 0),
    }
  }, [categoryLabelByValue, selectedBdSalesDetails])

  const categoryColorByKey = useMemo(() => {
    const colorByKey = new Map<string, string>()
    selectedCategoryShare.points.forEach((point, index) => {
      colorByKey.set(point.key, CATEGORY_COLORS[index % CATEGORY_COLORS.length])
    })
    colorByKey.set('OTHER', '#94a3b8')
    return colorByKey
  }, [selectedCategoryShare.points])

  const selectedPieGradient = useMemo(() => {
    if (selectedCategoryShare.total <= 0 || selectedCategoryShare.points.length === 0) {
      return '#e5e7eb'
    }

    let accumulated = 0
    const stops = selectedCategoryShare.points.map((point) => {
      const start = (accumulated / selectedCategoryShare.total) * 100
      accumulated += point.value
      const end = (accumulated / selectedCategoryShare.total) * 100
      return `${categoryColorByKey.get(point.key) ?? '#94a3b8'} ${start}% ${end}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [categoryColorByKey, selectedCategoryShare.points, selectedCategoryShare.total])

  const trendBucket = useMemo(() => resolveTrendBucket(dateRange), [dateRange])

  const selectedTrendPoints = useMemo<TrendPoint[]>(() => {
    const byBucket = new Map<string, { bucketDate: Dayjs; totalAmount: number; categoryAmounts: Record<string, number> }>()

    for (const order of selectedBdSalesDetails) {
      const soldAt = dayjs(order.soldAt)
      if (!soldAt.isValid()) {
        continue
      }
      const bucketDate = startOfTrendBucket(soldAt, trendBucket)
      const bucketKey = bucketDate.format('YYYY-MM-DD')
      const current =
        byBucket.get(bucketKey) ??
        {
          bucketDate,
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
      byBucket.set(bucketKey, current)
    }

    return [...byBucket.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([bucketKey, value]) => ({
        key: bucketKey,
        label: formatTrendLabel(value.bucketDate, trendBucket),
        totalAmount: value.totalAmount,
        categoryAmounts: value.categoryAmounts,
      }))
  }, [selectedBdSalesDetails, trendBucket])

  const trendMaxAmount = useMemo(() => {
    return Math.max(1, ...selectedTrendPoints.map((point) => point.totalAmount))
  }, [selectedTrendPoints])

  const trendCategoryKeys = useMemo(() => {
    return selectedCategoryShare.points.slice(0, 4).map((point) => point.key)
  }, [selectedCategoryShare.points])

  const trendRows = useMemo(() => {
    return selectedTrendPoints.map((point) => {
      const total = safeNumber(point.totalAmount)
      let assigned = 0
      const segments: TrendRowSegment[] = trendCategoryKeys
        .map((categoryKey) => {
          const amount = safeNumber(point.categoryAmounts[categoryKey] ?? 0)
          assigned += amount
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
        .filter((segment): segment is TrendRowSegment => segment !== null)

      const otherAmount = Math.max(0, total - assigned)
      if (otherAmount > 0) {
        segments.push({
          key: 'OTHER',
          label: t('pages.bdKpi.analysis.others', { defaultValue: 'Others' }),
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

  const bdSelectorOptions = useMemo(() => {
    return completionMatrixRows.map((row) => ({
      value: row.key,
      label: `#${row.rank} ${row.label}`,
    }))
  }, [completionMatrixRows])

  const totalSalesAmount = useMemo(() => {
    return calculatedRows.reduce((sum, row) => sum + safeNumber(row.salesAmount), 0)
  }, [calculatedRows])

  const averageOverallCompletion = useMemo(() => {
    if (calculatedRows.length === 0) {
      return 0
    }
    const total = calculatedRows.reduce((sum, row) => sum + row.overallCompletionRate, 0)
    return total / calculatedRows.length
  }, [calculatedRows])

  const hasData = calculatedRows.length > 0

  function getCompletionHeatStyle(rate: number): { backgroundColor: string; color: string } {
    const normalized = Math.max(0, Math.min(rate / 1.8, 1))
    const hue = 12 + normalized * 120
    const lightness = 96 - normalized * 28
    return {
      backgroundColor: `hsl(${hue}, 78%, ${lightness}%)`,
      color: normalized > 0.55 ? '#065f46' : '#334155',
    }
  }

  function applyFilters() {
    const nextKeyword = keywordInput.trim()
    setKeyword(nextKeyword)
    setDateRange(dateRangeInput)
    syncQuery(nextKeyword, dateRangeInput)
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.bdKpi.analysis.title', { defaultValue: 'KPI Visual Analysis' })}
        description={t('pages.bdKpi.analysis.description', {
          defaultValue:
            'Combined matrix, bar, and pie views based on configured KPI targets and current completion data.',
        })}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(dashboardPath)}>
              {t('pages.bdKpi.analysis.backToDashboard', { defaultValue: 'Back to KPI Dashboard' })}
            </Button>
          </Space>
        }
      />

      <Card className="mb-3" size="small">
        <Space wrap className="w-full">
          <RangePicker value={dateRangeInput} onChange={(value) => setDateRangeInput(value)} />
          <Input
            allowClear
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder={t('pages.bdKpi.keyword', { defaultValue: 'Search BD name or email' })}
            className="w-[280px]"
          />
          <Button type="primary" onClick={applyFilters}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
          <Button
            onClick={() => {
              const currentRange: [Dayjs, Dayjs] = [dayjs().startOf('month'), dayjs().endOf('month')]
              setDateRangeInput(currentRange)
              setDateRange(currentRange)
              setKeywordInput('')
              setKeyword('')
              syncQuery('', currentRange)
            }}
          >
            {t('pages.bdKpi.currentMonth', { defaultValue: 'Current Month' })}
          </Button>
          <Tag color="blue" bordered={false}>
            {t('pages.bdKpi.analysis.topHint', { defaultValue: 'Charts show top 8 BD by overall completion' })}
          </Tag>
        </Space>
      </Card>

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.analysis.totalBd', { defaultValue: 'BD Count (Filtered)' })}
            value={calculatedRows.length}
            loading={loading}
          />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.analysis.totalSalesAmount', { defaultValue: 'Total Sales Amount (Filtered)' })}
            value={totalSalesAmount}
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            loading={loading}
          />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.analysis.avgOverallCompletion', { defaultValue: 'Average Overall Completion' })}
            valueRender={() => <span>{formatPercent(averageOverallCompletion)}</span>}
            loading={loading}
          />
        </Card>
      </div>

      {!hasData ? (
        <Card size="small">
          <Empty description={t('pages.bdKpi.analysis.empty', { defaultValue: 'No KPI data in current filter' })} />
        </Card>
      ) : (
        <div className="space-y-3">
          <Card
            size="small"
            title={
              <Space size={8}>
                <BarChartOutlined />
                <span>{t('pages.bdKpi.analysis.barTitle', { defaultValue: 'Target vs Actual (Top 8)' })}</span>
              </Space>
            }
            extra={
              <div className="max-w-full overflow-x-auto">
                <Segmented
                  value={metric}
                  onChange={(value) => setMetric(value as MetricKey)}
                  options={[
                    {
                      label: t('pages.bdKpi.analysis.metricTire', { defaultValue: 'Tire Sales Quantity' }),
                      value: 'tire',
                    },
                    {
                      label: t('pages.bdKpi.analysis.metricAccessory', { defaultValue: 'Accessory Sales Amount' }),
                      value: 'accessory',
                    },
                    {
                      label: t('pages.bdKpi.analysis.metricBcs', { defaultValue: 'BCS Signed Count' }),
                      value: 'bcs',
                    },
                  ]}
                />
              </div>
            }
          >
            <div className="mb-2 text-xs text-slate-500">
              {t('pages.bdKpi.analysis.metricNow', { defaultValue: 'Current metric:' })}{' '}
              <span className="font-semibold text-slate-700">{getMetricLabel(metric, t)}</span>
            </div>
            <div className="space-y-4">
              {metricRows.map((row) => {
                const targetPercent = (safeNumber(row.target) / maxMetricValue) * 100
                const actualPercent = (safeNumber(row.actual) / maxMetricValue) * 100
                return (
                  <div key={row.key}>
                    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700" title={row.label}>
                        {row.label}
                      </span>
                      <span className="whitespace-nowrap text-right text-slate-500">
                        {t('pages.bdKpi.analysis.target', { defaultValue: 'Target' })}:{' '}
                        {renderMetricValue(metric, row.target)} |{' '}
                        {t('pages.bdKpi.analysis.actual', { defaultValue: 'Actual' })}:{' '}
                        {renderMetricValue(metric, row.actual)} | {formatPercent(row.completionRate)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded bg-slate-100">
                        <div className="h-full rounded bg-slate-300" style={{ width: `${targetPercent}%` }} />
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-slate-100">
                        <div className="h-full rounded bg-blue-500" style={{ width: `${actualPercent}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card
              size="small"
              title={
                <Space size={8}>
                  <TableOutlined />
                  <span>{t('pages.bdKpi.analysis.matrixTitle', { defaultValue: 'Completion Matrix by BD (Top 8)' })}</span>
                </Space>
              }
            >
              <div className="mb-2 text-xs text-slate-500">
                {t('pages.bdKpi.analysis.matrixHint', {
                  defaultValue: 'Darker color means higher completion rate. Values can exceed 100%.',
                })}
              </div>
              <div className="mb-3">
                <Select
                  value={selectedBdUserId ?? undefined}
                  options={bdSelectorOptions}
                  onChange={(value) => setSelectedBdUserId(String(value))}
                  className="w-full"
                  placeholder={t('pages.bdKpi.analysis.selectBd', { defaultValue: 'Select BD' })}
                />
              </div>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                        BD
                      </th>
                      <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        {t('pages.bdKpi.analysis.tireCompletionRate', { defaultValue: 'Tire Completion' })}
                      </th>
                      <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        {t('pages.bdKpi.analysis.accessoryCompletionRate', { defaultValue: 'Accessory Completion' })}
                      </th>
                      <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        {t('pages.bdKpi.analysis.bcsCompletionRate', { defaultValue: 'BCS Completion' })}
                      </th>
                      <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        {t('pages.bdKpi.columns.overall', { defaultValue: 'Overall Completion' })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {completionMatrixRows.map((row) => {
                      const isSelected = row.key === selectedBdUserId
                      return (
                        <tr
                          key={row.key}
                          className={isSelected ? 'bg-blue-50/60' : undefined}
                        >
                          <td className="border-b border-slate-100 px-3 py-2 align-middle">
                            <button
                              type="button"
                              onClick={() => setSelectedBdUserId(row.key)}
                              className="flex w-full items-center gap-2 text-left"
                            >
                              <Tag color={isSelected ? 'geekblue' : 'blue'} bordered={false}>
                                #{row.rank}
                              </Tag>
                              <span className="truncate text-sm font-medium text-slate-700" title={row.label}>
                                {row.label}
                              </span>
                            </button>
                          </td>
                          {[row.tireCompletionRate, row.accessoryCompletionRate, row.bcsCompletionRate, row.overallCompletionRate].map((value, index) => (
                            <td key={`${row.key}-${index}`} className="border-b border-slate-100 px-2 py-2 align-middle">
                              <div
                                className="rounded-md px-2 py-2 text-center text-xs font-semibold"
                                style={getCompletionHeatStyle(value)}
                              >
                                {formatPercent(value)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              size="small"
              title={
                <Space size={8}>
                  <BarChartOutlined />
                  <span>{t('pages.bdKpi.analysis.personalTitle', { defaultValue: 'Selected BD KPI Snapshot' })}</span>
                </Space>
              }
            >
              {!selectedBdSummary ? (
                <Empty description={t('pages.bdKpi.analysis.selectBdFirst', { defaultValue: 'Please select a BD first' })} />
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{t('pages.bdKpi.analysis.selectedBd', { defaultValue: 'Selected BD' })}</div>
                    <div className="truncate text-sm font-semibold text-slate-800" title={selectedBdName}>
                      {selectedBdName}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-slate-200 p-2">
                      <div className="text-xs text-slate-500">{t('pages.bdKpi.analysis.selectedSalesAmount', { defaultValue: 'Sales Amount' })}</div>
                      <div className="text-base font-semibold text-slate-800">{formatCurrency(selectedBdSummary.salesAmount)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-2">
                      <div className="text-xs text-slate-500">{t('pages.bdKpi.analysis.selectedSalesRecords', { defaultValue: 'Sales Records' })}</div>
                      <div className="text-base font-semibold text-slate-800">{formatNumber(selectedBdSummary.salesRecordCount)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-2">
                      <div className="text-xs text-slate-500">{t('pages.bdKpi.analysis.selectedBcsSigned', { defaultValue: 'BCS Signed' })}</div>
                      <div className="text-base font-semibold text-slate-800">{formatNumber(selectedBdSummary.bcsSignedCount)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-2">
                      <div className="text-xs text-slate-500">{t('pages.bdKpi.analysis.selectedOverallCompletion', { defaultValue: 'Overall Completion' })}</div>
                      <div className="text-base font-semibold text-slate-800">{formatPercent(selectedBdSummary.overallCompletionRate)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        key: 'tire',
                        label: t('pages.bdKpi.analysis.tireCompletionRate', { defaultValue: 'Tire Completion' }),
                        value: selectedBdSummary.tireCompletionRate,
                        color: '#2563eb',
                      },
                      {
                        key: 'accessory',
                        label: t('pages.bdKpi.analysis.accessoryCompletionRate', { defaultValue: 'Accessory Completion' }),
                        value: selectedBdSummary.accessoryCompletionRate,
                        color: '#f97316',
                      },
                      {
                        key: 'bcs',
                        label: t('pages.bdKpi.analysis.bcsCompletionRate', { defaultValue: 'BCS Completion' }),
                        value: selectedBdSummary.bcsCompletionRate,
                        color: '#16a34a',
                      },
                      {
                        key: 'overall',
                        label: t('pages.bdKpi.columns.overall', { defaultValue: 'Overall Completion' }),
                        value: selectedBdSummary.overallCompletionRate,
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
              title={
                <Space size={8}>
                  <TableOutlined />
                  <span>{t('pages.bdKpi.analysis.trendTitle', { defaultValue: 'Sales Trend by Time & Category' })}</span>
                </Space>
              }
              extra={
                <Tag bordered={false} color="cyan">
                  {t(`pages.bdKpi.analysis.trendBucket.${trendBucket}`, {
                    defaultValue: trendBucket === 'month' ? 'Monthly' : trendBucket === 'week' ? 'Weekly' : 'Daily',
                  })}
                </Tag>
              }
            >
              {!selectedBdSummary || trendRows.length === 0 ? (
                <Empty description={t('pages.bdKpi.analysis.noSalesTrend', { defaultValue: 'No sales trend data for selected BD' })} />
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                    {selectedBdName} · {t('pages.bdKpi.analysis.trendHint', {
                      defaultValue: 'Line shows total sales amount per period; stacked bars show category composition.',
                    })}
                  </div>

                  <div className="w-full overflow-x-auto">
                    <svg viewBox={`0 0 ${trendLineChart.viewWidth} ${trendLineChart.viewHeight}`} className="min-w-[680px] w-full">
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
                    {trendRows.map((row) => (
                      <div key={row.key}>
                        <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-xs">
                          <span className="font-medium text-slate-700">{row.label}</span>
                          <span className="text-slate-500">{formatCurrency(row.totalAmount)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-slate-100">
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
              title={
                <Space size={8}>
                  <PieChartOutlined />
                  <span>{t('pages.bdKpi.analysis.categoryShareTitle', { defaultValue: 'Category Share of Selected BD' })}</span>
                </Space>
              }
            >
              {!selectedBdSummary || selectedCategoryShare.total <= 0 ? (
                <Empty description={t('pages.bdKpi.analysis.noCategoryData', { defaultValue: 'No category sales data for selected BD' })} />
              ) : (
                <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start">
                  <div className="relative h-56 w-56 shrink-0 rounded-full border border-slate-200" style={{ background: selectedPieGradient }}>
                    <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white shadow-sm">
                      <div className="text-xs text-slate-500">{t('pages.bdKpi.analysis.total', { defaultValue: 'Total' })}</div>
                      <div className="text-sm font-semibold text-slate-700">{formatCurrency(selectedCategoryShare.total)}</div>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {selectedCategoryShare.points.map((point) => {
                      const percent = selectedCategoryShare.total > 0 ? point.value / selectedCategoryShare.total : 0
                      return (
                        <div key={point.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-sm">
                          <span className="inline-flex min-w-0 items-center gap-2 text-slate-700">
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
        </div>
      )}
    </>
  )
}
