import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Grid,
  Row,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  message,
} from 'antd'
import {
  useTranslation,
} from 'react-i18next'

import {
  getSalesProductCategoryOptions,
  getSalesProductSubcategoryLabel,
} from '../../../lib/business-constants'
import type {
  SalesProductCategory,
  SalesProductSubcategory,
} from '../../../types/business'
import {
  supabase,
} from '../../../lib/supabase/client'
import {
  MetricCard,
} from '../../../components/common/MetricCard'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#1677ff', '#52c41a', '#faad14', '#eb2f96',
  '#13c2c2', '#722ed1', '#f97316', '#06b6d4',
]

const CHART_VIEW_KEYS = ['trend', 'donut', 'accounts', 'stacked', 'products', 'bd'] as const

const CHART_VIEW_DEFAULT_TITLES: Record<typeof CHART_VIEW_KEYS[number], string> = {
  trend: 'Daily Sales Trend',
  donut: 'Category Revenue Share',
  accounts: 'Top 10 Key Accounts',
  stacked: 'Top 6 Customer Category Distribution',
  products: 'Top 10 Product Ranking',
  bd: 'BD Performance Ranking',
}

const CAROUSEL_INTERVAL = 8000 // ms — auto-advance interval

// ── Helper functions ─────────────────────────────────────────────────────────

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

function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  key: string
  label: string
  totalAmount: number
}

interface CategoryTableRow {
  key: string
  label: string
  quantity: number
  amount: number
  share: number
  color: string
  subcategories: Array<{
    key: string
    label: string
    quantity: number
    amount: number
    share: number
  }>
}

// ── Unified order types (replaces RichOrder / API types) ─────────────────────

interface UnifiedOrderItem {
  category: string
  subcategory: string | null
  product_name: string | null
  quantity: number
  unit_price: number
}

interface UnifiedOrder {
  id: string
  sold_at: string
  bd_user_id: string
  company_name: string | null
  // Supabase returns nested one-to-one relations as an array
  bd_profile: Array<{ full_name: string | null }> | null
  items: UnifiedOrderItem[]
}

interface LocalCategoryMetrics {
  category: string
  totalAmount: number
  totalQuantity: number
  subcategories: Array<{ subcategory: string; totalAmount: number; totalQuantity: number }>
}

interface LocalInsightOrder {
  id: string
  bdUserId: string
  bdName: string | null
  soldAt: string
  salesAmount: number
}

interface ProductRow {
  key: string
  productName: string
  category: string
  categoryLabel: string
  quantity: number
  amount: number
  share: number
}

interface BdRankRow {
  key: string
  bdName: string
  totalAmount: number
}

interface KeyAccountCatBreakdown {
  category: string
  categoryLabel: string
  quantity: number
  amount: number
  share: number
}

interface KeyAccountRow {
  key: string
  companyName: string
  orderCount: number
  totalAmount: number
  totalQuantity: number
  aov: number
  topCategoryLabel: string
  categoryBreakdown: KeyAccountCatBreakdown[]
}

// ── Shared SVG horizontal-bar renderer ──────────────────────────────────────
//  Renders a ranked horizontal-bar chart into a 760×260 viewBox.
//  items: array of { label, value }
//  barColor: hex string
//  formatValue: (v: number) => string

interface HBarItem { label: string; value: number }

function HBarChart({
  items,
  barColor,
  formatValue,
  emptyText,
}: {
  items: HBarItem[]
  barColor: string
  formatValue: (v: number) => string
  emptyText?: string
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty description={emptyText ?? 'No data'} />
      </div>
    )
  }

  const VW = 760
  const VH = 260
  const LP = 170   // left padding for labels
  const RP = 150   // right padding for value text
  const TP = 14
  const BP = 14
  const barAreaW = VW - LP - RP
  const n = items.length
  const barH = 16
  const totalBarH = n * barH
  const freeH = VH - TP - BP - totalBarH
  // Clamp gap to ≥2px so bars never overlap even if there are too many items
  const gap = Math.max(2, n > 1 ? freeH / (n + 1) : (VH - TP - BP - barH) / 2)
  const maxVal = Math.max(1, ...items.map((r) => r.value))

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full"
      style={{ height: VH, display: 'block', maxWidth: '100%' }}
      role="img"
      aria-label="Horizontal bar chart"
    >
      {items.map((item, i) => {
        const y = TP + (i + 1) * gap + i * barH
        const bw = Math.max(2, (item.value / maxVal) * barAreaW)
        return (
          <g key={item.label + i}>
            {/* Label */}
            <text
              x={LP - 8}
              y={y + barH / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fill="currentColor"
              fillOpacity={0.75}
            >
              {truncate(item.label, 16)}
            </text>
            {/* Bar */}
            <rect x={LP} y={y} width={bw} height={barH} rx={3} fill={barColor} fillOpacity={0.82}>
              <title>{`${item.label}: ${formatValue(item.value)}`}</title>
            </rect>
            {/* Value */}
            <text
              x={LP + bw + 7}
              y={y + barH / 2 + 4}
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.55}
            >
              {formatValue(item.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function AdminSalesDashboardPage() {
  const { t } = useTranslation()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // ── State ─────────────────────────────────────────────────────────────────

  const [unifiedOrders, setUnifiedOrders] = useState<UnifiedOrder[]>([])
  const [dateRange, setDateRange] = useState<[string, string]>(() => {
    const now = dayjs()
    return [now.startOf('month').format('YYYY-MM-DD'), now.endOf('month').format('YYYY-MM-DD')]
  })
  const [loading, setLoading] = useState(true)

  // Carousel
  const [chartIndex, setChartIndex] = useState(0)
  const [chartAutoPlay, setChartAutoPlay] = useState(true)
  const [chartIsHovered, setChartIsHovered] = useState(false)

  // Tab selection
  const [activeTab, setActiveTab] = useState<string>('category')

  // Product tab filter
  const [productCategoryFilter, setProductCategoryFilter] = useState<string | undefined>(undefined)

  // Key accounts filters
  const [accountCategoryFilter, setAccountCategoryFilter] = useState<string | undefined>(undefined)
  const [accountSortBy, setAccountSortBy] = useState<'amount' | 'quantity' | 'orders' | 'aov'>('amount')
  const [accountTopN, setAccountTopN] = useState<number>(20)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const dateStart = dayjs(dateRange[0]).startOf('day').toISOString()
      const dateEnd = dayjs(dateRange[1]).endOf('day').toISOString()

      // Step 1: fetch orders + items (no profile join to avoid FK ambiguity)
      const ordersResult = await supabase
        .from('sales_orders')
        .select(
          'id, sold_at, bd_user_id, company_name, items:sales_order_items(category, subcategory, product_name, quantity, unit_price)',
        )
        .is('deleted_at', null)
        .gte('sold_at', dateStart)
        .lte('sold_at', dateEnd)
        .limit(5000) // guard against default 1000-row limit for cross-month ranges

      if (ordersResult.error) {
        message.error(ordersResult.error.message)
        return
      }

      // Step 2: resolve BD user names from profiles (separate query)
      const rawOrders = (ordersResult.data ?? []) as Array<Omit<UnifiedOrder, 'bd_profile'>>
      const bdIds = [...new Set(rawOrders.map((o) => o.bd_user_id).filter(Boolean))]

      const profileMap = new Map<string, string | null>()
      if (bdIds.length > 0) {
        const profilesResult = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bdIds)
        if (!profilesResult.error) {
          for (const p of (profilesResult.data ?? []) as Array<{ id: string; full_name: string | null }>) {
            profileMap.set(p.id, p.full_name)
          }
        }
      }

      // Merge into UnifiedOrder shape
      const unified: UnifiedOrder[] = rawOrders.map((o) => ({
        ...o,
        bd_profile: [{ full_name: profileMap.get(o.bd_user_id) ?? null }],
      }))
      setUnifiedOrders(unified)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminSalesDashboard.loadFail', { defaultValue: 'Failed to load sales data' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [dateRange, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // ── Carousel timer ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!chartAutoPlay || chartIsHovered) {
      return
    }
    const timer = setInterval(() => {
      setChartIndex((i) => (i + 1) % CHART_VIEW_KEYS.length)
    }, CAROUSEL_INTERVAL)
    return () => clearInterval(timer)
  }, [chartAutoPlay, chartIsHovered, chartIndex])

  // ── Carousel navigation ───────────────────────────────────────────────────

  function goPrev() {
    setChartIndex((i) => (i - 1 + CHART_VIEW_KEYS.length) % CHART_VIEW_KEYS.length)
  }

  function goNext() {
    setChartIndex((i) => (i + 1) % CHART_VIEW_KEYS.length)
  }

  function goTo(i: number) {
    setChartIndex(i)
  }

  // ── Derived data from unified orders ─────────────────────────────────────

  // Replaces the old getAdminSalesCategoryMetrics API — aggregates per category/subcategory
  const salesCategoryMetrics = useMemo<LocalCategoryMetrics[]>(() => {
    const catMap = new Map<string, {
      totalAmount: number
      totalQuantity: number
      subcatMap: Map<string, { totalAmount: number; totalQuantity: number }>
    }>()
    for (const order of unifiedOrders) {
      for (const item of order.items) {
        const amt = safeNumber(item.quantity) * safeNumber(item.unit_price)
        const qty = safeNumber(item.quantity)
        if (!catMap.has(item.category)) {
          catMap.set(item.category, { totalAmount: 0, totalQuantity: 0, subcatMap: new Map() })
        }
        const cat = catMap.get(item.category)!
        cat.totalAmount += amt
        cat.totalQuantity += qty
        if (item.subcategory) {
          const sub = cat.subcatMap.get(item.subcategory) ?? { totalAmount: 0, totalQuantity: 0 }
          sub.totalAmount += amt
          sub.totalQuantity += qty
          cat.subcatMap.set(item.subcategory, sub)
        }
      }
    }
    return [...catMap.entries()].map(([category, d]) => ({
      category,
      totalAmount: d.totalAmount,
      totalQuantity: d.totalQuantity,
      subcategories: [...d.subcatMap.entries()].map(([subcategory, sv]) => ({
        subcategory,
        totalAmount: sv.totalAmount,
        totalQuantity: sv.totalQuantity,
      })),
    }))
  }, [unifiedOrders])

  // Replaces the old getAdminSalesInsightOrders API — order-level with BD info
  const salesInsightOrders = useMemo<LocalInsightOrder[]>(() => {
    return unifiedOrders.map((order) => ({
      id: order.id,
      bdUserId: order.bd_user_id,
      bdName: order.bd_profile?.[0]?.full_name ?? null,
      soldAt: order.sold_at,
      salesAmount: order.items.reduce(
        (s, i) => s + safeNumber(i.quantity) * safeNumber(i.unit_price),
        0,
      ),
    }))
  }, [unifiedOrders])

  // ── Memos ─────────────────────────────────────────────────────────────────

  const chartViews = useMemo(
    () => CHART_VIEW_KEYS.map((key) => ({
      key,
      title: t(`pages.adminSalesDashboard.chartViews.${key}`, { defaultValue: CHART_VIEW_DEFAULT_TITLES[key] }),
    })),
    [t],
  )

  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])

  const categoryLabelByValue = useMemo(
    () => new Map<string, string>(categoryOptions.map((item) => [item.value, item.label])),
    [categoryOptions],
  )

  const categoryColorByValue = useMemo(
    () => new Map<string, string>(categoryOptions.map((item, i) => [item.value, CATEGORY_COLORS[i % CATEGORY_COLORS.length]])),
    [categoryOptions],
  )

  // KPI totals
  const totalAmount = useMemo(
    () => salesCategoryMetrics.reduce((sum, item) => sum + safeNumber(item.totalAmount), 0),
    [salesCategoryMetrics],
  )
  const totalOrderCount = useMemo(() => salesInsightOrders.length, [salesInsightOrders])
  const activeBdCount = useMemo(
    () => new Set(salesInsightOrders.map((o) => o.bdUserId)).size,
    [salesInsightOrders],
  )
  const aov = useMemo(
    () => (totalOrderCount > 0 ? totalAmount / totalOrderCount : 0),
    [totalAmount, totalOrderCount],
  )

  // Daily trend
  const trendPoints = useMemo<TrendPoint[]>(() => {
    const aggregate = new Map<string, TrendPoint>()
    for (const order of salesInsightOrders) {
      const soldAt = dayjs(order.soldAt)
      if (!soldAt.isValid()) continue
      const key = soldAt.format('YYYY-MM-DD')
      const current = aggregate.get(key) ?? { key, label: soldAt.format('MM/DD'), totalAmount: 0 }
      current.totalAmount += safeNumber(order.salesAmount)
      aggregate.set(key, current)
    }
    return [...aggregate.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [salesInsightOrders])

  const trendMax = useMemo(
    () => Math.max(1, ...trendPoints.map((p) => safeNumber(p.totalAmount))),
    [trendPoints],
  )

  const trendSvgData = useMemo(() => {
    const VW = 760
    const VH = 200
    const PX = 32
    const PY = 20
    const W = VW - PX * 2
    const H = VH - PY * 2
    if (trendPoints.length === 0) {
      return { VW, VH, path: '', points: [] as Array<{ x: number; y: number; value: number; label: string; key: string }>, gridLines: [] as Array<{ y: number; value: number }> }
    }
    const points = trendPoints.map((pt, idx) => {
      const x = trendPoints.length === 1 ? VW / 2 : PX + (idx / (trendPoints.length - 1)) * W
      const y = VH - PY - (safeNumber(pt.totalAmount) / trendMax) * H
      return { key: pt.key, label: pt.label, value: pt.totalAmount, x, y }
    })
    const path = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ')
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((r) => ({ y: VH - PY - r * H, value: trendMax * r }))
    return { VW, VH, path, points, gridLines }
  }, [trendPoints, trendMax])

  // Category breakdown (donut)
  const categoryBreakdown = useMemo(() => {
    if (totalAmount === 0) return []
    return [...salesCategoryMetrics]
      .filter((item) => safeNumber(item.totalAmount) > 0)
      .sort((a, b) => safeNumber(b.totalAmount) - safeNumber(a.totalAmount))
      .map((item, i) => ({
        key: item.category,
        label: categoryLabelByValue.get(item.category) ?? item.category,
        amount: safeNumber(item.totalAmount),
        quantity: safeNumber(item.totalQuantity),
        percent: totalAmount > 0 ? safeNumber(item.totalAmount) / totalAmount : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
  }, [categoryLabelByValue, salesCategoryMetrics, totalAmount])

  const donutGradient = useMemo(() => {
    if (categoryBreakdown.length === 0) return '#e5e7eb'
    let acc = 0
    const stops = categoryBreakdown.map((item) => {
      const start = (acc / totalAmount) * 100
      acc += item.amount
      const end = (acc / totalAmount) * 100
      return `${item.color} ${start}% ${end}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [categoryBreakdown, totalAmount])

  // Category × subcategory table rows (Tab 1)
  const categoryTableRows = useMemo<CategoryTableRow[]>(() => {
    return [...salesCategoryMetrics]
      .filter((item) => safeNumber(item.totalQuantity) > 0 || safeNumber(item.totalAmount) > 0)
      .sort((a, b) => safeNumber(b.totalAmount) - safeNumber(a.totalAmount))
      .map((item, i) => ({
        key: item.category,
        label: categoryLabelByValue.get(item.category) ?? item.category,
        quantity: safeNumber(item.totalQuantity),
        amount: safeNumber(item.totalAmount),
        share: totalAmount > 0 ? safeNumber(item.totalAmount) / totalAmount : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        subcategories: item.subcategories
          .filter((s) => safeNumber(s.totalQuantity) > 0 || safeNumber(s.totalAmount) > 0)
          .sort((a, b) => safeNumber(b.totalAmount) - safeNumber(a.totalAmount))
          .map((sub) => ({
            key: `${item.category}-${sub.subcategory}`,
            label: getSalesProductSubcategoryLabel(item.category as SalesProductCategory, sub.subcategory as SalesProductSubcategory | null, t) ?? sub.subcategory,
            quantity: safeNumber(sub.totalQuantity),
            amount: safeNumber(sub.totalAmount),
            share: totalAmount > 0 ? safeNumber(sub.totalAmount) / totalAmount : 0,
          })),
      }))
  }, [categoryLabelByValue, salesCategoryMetrics, t, totalAmount])

  // Product ranking rows (Tab 2)
  const productRows = useMemo<ProductRow[]>(() => {
    const byKey = new Map<string, ProductRow>()
    const grandTotal = unifiedOrders.reduce(
      (s, o) => s + o.items.reduce((ss, i) => ss + safeNumber(i.quantity) * safeNumber(i.unit_price), 0),
      0,
    )
    for (const order of unifiedOrders) {
      for (const item of order.items) {
        const name = item.product_name ?? ''
        const key = `${item.category}::${name}`
        const amt = safeNumber(item.quantity) * safeNumber(item.unit_price)
        const row = byKey.get(key)
        if (row) {
          row.quantity += safeNumber(item.quantity)
          row.amount += amt
        } else {
          byKey.set(key, {
            key,
            productName: name || `(${categoryLabelByValue.get(item.category) ?? item.category})`,
            category: item.category,
            categoryLabel: categoryLabelByValue.get(item.category) ?? item.category,
            quantity: safeNumber(item.quantity),
            amount: amt,
            share: 0,
          })
        }
      }
    }
    const rows = [...byKey.values()].sort((a, b) => b.amount - a.amount)
    rows.forEach((r) => { r.share = grandTotal > 0 ? r.amount / grandTotal : 0 })
    return rows
  }, [unifiedOrders, categoryLabelByValue])

  // Key account rows (Tab 3) — now with totalQuantity + categoryBreakdown
  const keyAccountRows = useMemo<KeyAccountRow[]>(() => {
    const byCompany = new Map<string, {
      orderCount: number
      totalAmount: number
      totalQuantity: number
      catAmounts: Map<string, number>
      catQuantities: Map<string, number>
    }>()

    for (const order of unifiedOrders) {
      const company = order.company_name || '—'
      const orderAmt = order.items.reduce((s, i) => s + safeNumber(i.quantity) * safeNumber(i.unit_price), 0)
      const orderQty = order.items.reduce((s, i) => s + safeNumber(i.quantity), 0)
      const existing = byCompany.get(company)

      if (existing) {
        existing.orderCount += 1
        existing.totalAmount += orderAmt
        existing.totalQuantity += orderQty
        order.items.forEach((i) => {
          const amt = safeNumber(i.quantity) * safeNumber(i.unit_price)
          const qty = safeNumber(i.quantity)
          existing.catAmounts.set(i.category, (existing.catAmounts.get(i.category) ?? 0) + amt)
          existing.catQuantities.set(i.category, (existing.catQuantities.get(i.category) ?? 0) + qty)
        })
      } else {
        const catAmtMap = new Map<string, number>()
        const catQtyMap = new Map<string, number>()
        order.items.forEach((i) => {
          const amt = safeNumber(i.quantity) * safeNumber(i.unit_price)
          const qty = safeNumber(i.quantity)
          catAmtMap.set(i.category, (catAmtMap.get(i.category) ?? 0) + amt)
          catQtyMap.set(i.category, (catQtyMap.get(i.category) ?? 0) + qty)
        })
        byCompany.set(company, {
          orderCount: 1, totalAmount: orderAmt, totalQuantity: orderQty,
          catAmounts: catAmtMap, catQuantities: catQtyMap,
        })
      }
    }

    return [...byCompany.entries()]
      .map(([companyName, d]) => {
        const topCat = [...d.catAmounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
        const categoryBreakdown: KeyAccountCatBreakdown[] = [...d.catAmounts.entries()]
          .map(([cat, amt]) => ({
            category: cat,
            categoryLabel: categoryLabelByValue.get(cat) ?? cat,
            quantity: d.catQuantities.get(cat) ?? 0,
            amount: amt,
            share: d.totalAmount > 0 ? amt / d.totalAmount : 0,
          }))
          .sort((a, b) => b.amount - a.amount)
        return {
          key: companyName, companyName,
          orderCount: d.orderCount,
          totalAmount: d.totalAmount,
          totalQuantity: d.totalQuantity,
          aov: d.orderCount > 0 ? d.totalAmount / d.orderCount : 0,
          topCategoryLabel: categoryLabelByValue.get(topCat) ?? topCat,
          categoryBreakdown,
        }
      })
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }, [unifiedOrders, categoryLabelByValue])

  // Filtered / sorted / limited key account rows
  const filteredAccountRows = useMemo(() => {
    let rows = [...keyAccountRows]
    if (accountCategoryFilter) {
      rows = rows.filter((r) =>
        r.categoryBreakdown.some((c) => c.category === accountCategoryFilter),
      )
    }
    rows.sort((a, b) => {
      if (accountSortBy === 'amount') return b.totalAmount - a.totalAmount
      if (accountSortBy === 'quantity') return b.totalQuantity - a.totalQuantity
      if (accountSortBy === 'orders') return b.orderCount - a.orderCount
      return b.aov - a.aov
    })
    return accountTopN === 9999 ? rows : rows.slice(0, accountTopN)
  }, [keyAccountRows, accountCategoryFilter, accountSortBy, accountTopN])

  // BD rank rows (for carousel view 5)
  const bdRankRows = useMemo<BdRankRow[]>(() => {
    const byBd = new Map<string, { name: string; totalAmount: number }>()
    for (const order of salesInsightOrders) {
      const key = order.bdUserId
      const existing = byBd.get(key)
      const name = order.bdName ?? key.substring(0, 8)
      if (existing) {
        existing.totalAmount += safeNumber(order.salesAmount)
      } else {
        byBd.set(key, { name: name as string, totalAmount: safeNumber(order.salesAmount) })
      }
    }
    return [...byBd.entries()]
      .map(([k, v]) => ({ key: k, bdName: v.name, totalAmount: v.totalAmount }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }, [salesInsightOrders])

  // Stacked bar categories — all unique categories in top 6 accounts
  const stackedCategories = useMemo(() => {
    const seen = new Set<string>()
    const cats: Array<{ category: string; categoryLabel: string; color: string }> = []
    for (const row of keyAccountRows.slice(0, 6)) {
      for (const cat of row.categoryBreakdown) {
        if (!seen.has(cat.category)) {
          seen.add(cat.category)
          cats.push({
            category: cat.category,
            categoryLabel: cat.categoryLabel,
            color: categoryColorByValue.get(cat.category) ?? '#888',
          })
        }
      }
    }
    return cats
  }, [keyAccountRows, categoryColorByValue])

  // ── Carousel chart renderers ──────────────────────────────────────────────

  function renderCarouselChart(index: number) {
    switch (index) {
      case 0: // Trend line
        return trendPoints.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Empty description="No data" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${trendSvgData.VW} ${trendSvgData.VH}`}
              className="w-full"
              style={{ height: trendSvgData.VH, minWidth: 320, display: 'block' }}
              role="img"
              aria-label="Daily sales trend"
            >
              {trendSvgData.gridLines.map((gl) => (
                <g key={gl.y}>
                  <line x1={32} y1={gl.y} x2={trendSvgData.VW - 32} y2={gl.y} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
                  {gl.value > 0 && (
                    <text x={28} y={gl.y - 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.45}>
                      {formatNumber(gl.value / 1000)}K
                    </text>
                  )}
                </g>
              ))}
              {trendSvgData.points.length > 1 && (
                <path
                  d={`${trendSvgData.path} L ${trendSvgData.points[trendSvgData.points.length - 1].x.toFixed(2)} ${trendSvgData.VH - 20} L ${trendSvgData.points[0].x.toFixed(2)} ${trendSvgData.VH - 20} Z`}
                  fill="#1677ff"
                  fillOpacity={0.08}
                />
              )}
              <path d={trendSvgData.path} fill="none" stroke="#1677ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {trendSvgData.points.map((pt) => (
                <circle key={pt.key} cx={pt.x} cy={pt.y} r={3} fill="#1677ff">
                  <title>{`${pt.label}: IDR ${formatCurrency(pt.value)}`}</title>
                </circle>
              ))}
              {trendSvgData.points
                .filter((_, i) => {
                  const step = trendSvgData.points.length > 20 ? 5 : trendSvgData.points.length > 10 ? 3 : 1
                  return i % step === 0
                })
                .map((pt) => (
                  <text key={pt.key} x={pt.x} y={trendSvgData.VH - 4} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.45}>
                    {pt.label}
                  </text>
                ))}
            </svg>
          </div>
        )

      case 1: // Category donut
        return categoryBreakdown.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Empty description="No data" />
          </div>
        ) : isMobile ? (
          // Mobile: stack donut above legend to avoid cramped side-by-side layout
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className="shrink-0 rounded-full"
              style={{
                width: 120, height: 120,
                background: donutGradient,
                WebkitMask: 'radial-gradient(circle, transparent 46px, #000 47px)',
                mask: 'radial-gradient(circle, transparent 46px, #000 47px)',
              }}
              role="img"
              aria-label="Category distribution"
            />
            <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 px-2">
              {categoryBreakdown.map((item) => (
                <div key={item.key} className="flex min-w-0 items-center gap-1.5 text-xs">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate app-text-soft">{item.label}</span>
                  <span className="shrink-0 font-semibold app-text">{Math.round(item.percent * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Desktop: side-by-side donut + legend
          <div className="flex h-full items-center gap-8 px-4">
            {/* Donut */}
            <div
              className="shrink-0 rounded-full"
              style={{
                width: 160, height: 160,
                background: donutGradient,
                WebkitMask: 'radial-gradient(circle, transparent 62px, #000 63px)',
                mask: 'radial-gradient(circle, transparent 62px, #000 63px)',
              }}
              role="img"
              aria-label="Category distribution"
            />
            {/* Legend grid */}
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-2">
              {categoryBreakdown.map((item) => (
                <div key={item.key} className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate app-text-soft">{item.label}</span>
                  <span className="shrink-0 font-semibold app-text">{Math.round(item.percent * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )

      case 2: // Key accounts bar
        return (
          <HBarChart
            items={keyAccountRows.slice(0, 10).map((r) => ({ label: r.companyName, value: r.totalAmount }))}
            barColor="#c10e0e"
            formatValue={(v) => `IDR ${formatCurrency(v)}`}
            emptyText="No customer data"
          />
        )

      case 3: { // Stacked bar (top 6 × categories)
        const top6 = keyAccountRows.slice(0, 6)
        if (top6.length === 0) {
          return (
            <div className="flex h-full items-center justify-center">
              <Empty description="No data" />
            </div>
          )
        }
        const VW = 760
        const VH = 260
        const LEGEND_H = 36
        const LP = 170
        const RP = 12
        const TP = 14
        const BP = 14 + LEGEND_H
        const barAreaW = VW - LP - RP
        const n = top6.length
        const barH = 22
        const totalBarH = n * barH
        const freeH = VH - TP - BP - totalBarH
        const gap = Math.max(2, freeH / (n + 1))
        return (
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: VH, display: 'block', maxWidth: '100%' }} role="img" aria-label="Stacked customer category chart">
            {top6.map((row, ri) => {
              const y = TP + (ri + 1) * gap + ri * barH
              let xOffset = LP
              return (
                <g key={row.key}>
                  <text x={LP - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.75}>
                    {truncate(row.companyName, 16)}
                  </text>
                  {row.categoryBreakdown.map((cat) => {
                    const segW = row.totalAmount > 0 ? (cat.amount / row.totalAmount) * barAreaW : 0
                    const segX = xOffset
                    xOffset += segW
                    const color = categoryColorByValue.get(cat.category) ?? '#888'
                    return (
                      <rect key={cat.category} x={segX} y={y} width={Math.max(0, segW)} height={barH} fill={color} fillOpacity={0.85}>
                        <title>{`${row.companyName} • ${cat.categoryLabel}: IDR ${formatCurrency(cat.amount)} (${Math.round(cat.share * 100)}%)`}</title>
                      </rect>
                    )
                  })}
                </g>
              )
            })}
            {/* Legend */}
            {stackedCategories.map((cat, ci) => {
              const legendX = 12 + ci * 110
              return legendX < VW - 10 ? (
                <g key={cat.category}>
                  <rect x={legendX} y={VH - LEGEND_H + 10} width={10} height={10} rx={2} fill={cat.color} />
                  <text x={legendX + 14} y={VH - LEGEND_H + 19} fontSize={10} fill="currentColor" fillOpacity={0.65}>
                    {truncate(cat.categoryLabel, 8)}
                  </text>
                </g>
              ) : null
            })}
          </svg>
        )
      }

      case 4: // Product bar
        return (
          <HBarChart
            items={productRows.slice(0, 10).map((r) => ({ label: r.productName, value: r.amount }))}
            barColor="#1677ff"
            formatValue={(v) => `IDR ${formatCurrency(v)}`}
            emptyText="No product data"
          />
        )

      case 5: // BD bar
        return (
          <HBarChart
            items={bdRankRows.slice(0, 10).map((r) => ({ label: r.bdName, value: r.totalAmount }))}
            barColor="#52c41a"
            formatValue={(v) => `IDR ${formatCurrency(v)}`}
            emptyText="No BD data"
          />
        )

      default:
        return null
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageTitleBar
        title={t('pages.adminSalesDashboard.title', { defaultValue: 'Sales Analytics' })}
        description={t('pages.adminSalesDashboard.description', {
          defaultValue: 'Team-wide product sales — amounts, category trends, subcategory breakdown.',
        })}
        extra={
          <Space wrap>
            <DatePicker.RangePicker
              value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
              format="YYYY-MM-DD"
              allowClear={false}
              presets={[
                { label: t('pages.adminSalesDashboard.dateRange.thisMonth', { defaultValue: 'This Month' }), value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                { label: t('pages.adminSalesDashboard.dateRange.lastMonth', { defaultValue: 'Last Month' }), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                { label: t('pages.adminSalesDashboard.dateRange.last7Days', { defaultValue: 'Last 7 Days' }), value: [dayjs().subtract(6, 'day'), dayjs()] },
                { label: t('pages.adminSalesDashboard.dateRange.last30Days', { defaultValue: 'Last 30 Days' }), value: [dayjs().subtract(29, 'day'), dayjs()] },
                { label: t('pages.adminSalesDashboard.dateRange.last90Days', { defaultValue: 'Last 90 Days' }), value: [dayjs().subtract(89, 'day'), dayjs()] },
                { label: t('pages.adminSalesDashboard.dateRange.thisYear', { defaultValue: 'This Year' }), value: [dayjs().startOf('year'), dayjs().endOf('year')] },
              ]}
              onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) {
                  setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                }
              }}
            />
            <Button onClick={() => void loadData()} loading={loading}>
              {t('labels.refresh', { defaultValue: 'Refresh' })}
            </Button>
          </Space>
        }
      />

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={12} md={6}>
          <MetricCard
            title={t('pages.adminSalesDashboard.kpi.totalAmount', { defaultValue: 'Total Sales (IDR)' })}
            value={loading ? '—' : formatCurrency(totalAmount)}
          />
        </Col>
        <Col xs={12} md={6}>
          <MetricCard
            title={t('pages.adminSalesDashboard.kpi.orderCount', { defaultValue: 'Orders' })}
            value={loading ? 0 : totalOrderCount}
          />
        </Col>
        <Col xs={12} md={6}>
          <MetricCard
            title={t('pages.adminSalesDashboard.kpi.activeBd', { defaultValue: 'Active BD' })}
            value={loading ? 0 : activeBdCount}
          />
        </Col>
        <Col xs={12} md={6}>
          <MetricCard
            title={t('pages.adminSalesDashboard.kpi.aov', { defaultValue: 'Avg Order Value (IDR)' })}
            value={loading ? '—' : formatCurrency(aov)}
          />
        </Col>
      </Row>

      {/* ── Chart Carousel ─────────────────────────────────────────────────── */}
      <Card
        size="small"
        className="mb-4 carousel-card"
        onMouseEnter={() => setChartIsHovered(true)}
        onMouseLeave={() => setChartIsHovered(false)}
      >
        {/* Header: title + controls */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold app-text">{chartViews[chartIndex].title}</span>
            <span className="text-xs app-text-soft">{chartIndex + 1} / {chartViews.length}</span>
          </div>
          <Space size={4}>
            <Button
              size="small"
              icon={<LeftOutlined />}
              onClick={goPrev}
              title={t('pages.adminSalesDashboard.carousel.prev', { defaultValue: 'Previous' })}
            />
            <Button
              size="small"
              onClick={() => setChartAutoPlay((p) => !p)}
              title={
                chartAutoPlay
                  ? t('pages.adminSalesDashboard.carousel.pause', { defaultValue: 'Pause' })
                  : t('pages.adminSalesDashboard.carousel.play', { defaultValue: 'Play' })
              }
            >
              {chartAutoPlay ? '⏸' : '▶'}
            </Button>
            <Button
              size="small"
              icon={<RightOutlined />}
              onClick={goNext}
              title={t('pages.adminSalesDashboard.carousel.next', { defaultValue: 'Next' })}
            />
          </Space>
        </div>

        {/* Chart area */}
        <div style={{ minHeight: 210 }} className="overflow-x-auto">
          {renderCarouselChart(chartIndex)}
        </div>

        {/* Navigation dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {chartViews.map((view, i) => (
            <button
              key={view.key}
              type="button"
              title={view.title}
              onClick={() => goTo(i)}
              className={[
                'rounded-full transition-all duration-200',
                i === chartIndex
                  ? 'w-5 h-1.5 bg-blue-500'
                  : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400',
              ].join(' ')}
            />
          ))}
        </div>
      </Card>

      {/* ── Analysis Tabs ──────────────────────────────────────────────────── */}
      <Card size="small">
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="small">

          {/* ── Tab 1: Category & Subcategory Detail ──────────────────────── */}
          <Tabs.TabPane
            key="category"
            tab={t('pages.adminSalesDashboard.tabs.category', { defaultValue: 'Category Detail' })}
          >
            <Table
              loading={loading}
              rowKey="key"
              dataSource={categoryTableRows}
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record: CategoryTableRow) => {
                  if (record.subcategories.length === 0) {
                    return (
                      <div className="py-2 pl-8 text-xs app-text-soft">
                        {t('pages.adminSalesDashboard.table.noSubcategory', { defaultValue: 'No subcategory data' })}
                      </div>
                    )
                  }
                  return (
                    <div className="py-1 pl-4">
                      <table className="w-full border-collapse text-xs">
                        <tbody>
                          {record.subcategories.map((sub) => (
                            <tr key={sub.key} className="border-b app-border last:border-0">
                              <td className="py-1.5 pl-6 pr-3 app-text">
                                <span className="inline-flex items-center gap-2">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-500" />
                                  {sub.label}
                                </span>
                              </td>
                              <td className="py-1.5 pr-3 text-right app-text-soft">{formatNumber(sub.quantity)}</td>
                              <td className="py-1.5 pr-3 text-right font-medium app-text">{formatCurrency(sub.amount)}</td>
                              <td className="py-1.5 text-right app-text-soft">{Math.round(sub.share * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                },
                rowExpandable: (record: CategoryTableRow) => record.subcategories.length > 0,
              }}
              columns={[
                {
                  title: t('pages.adminSalesDashboard.table.category', { defaultValue: 'Category' }),
                  dataIndex: 'label',
                  render: (label: string, record: CategoryTableRow) => (
                    <span className="flex items-center gap-2 font-medium app-text">
                      <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: record.color }} />
                      {label}
                    </span>
                  ),
                },
                {
                  title: t('pages.adminSalesDashboard.table.quantity', { defaultValue: 'Qty' }),
                  dataIndex: 'quantity',
                  width: isMobile ? 60 : 100,
                  align: 'right' as const,
                  render: (v: number) => formatNumber(v),
                },
                {
                  title: t('pages.adminSalesDashboard.table.amount', { defaultValue: 'Sales (IDR)' }),
                  dataIndex: 'amount',
                  width: isMobile ? 120 : 200,
                  align: 'right' as const,
                  render: (v: number) => <span className="font-medium">{formatCurrency(v)}</span>,
                },
                {
                  title: t('pages.adminSalesDashboard.table.share', { defaultValue: 'Share' }),
                  dataIndex: 'share',
                  width: isMobile ? 60 : 80,
                  align: 'right' as const,
                  render: (v: number) => <span className="app-text-soft">{Math.round(v * 100)}%</span>,
                },
              ]}
              locale={{ emptyText: <Empty description={t('pages.adminSalesDashboard.table.empty', { defaultValue: 'No category data' })} /> }}
            />
          </Tabs.TabPane>

          {/* ── Tab 2: Product Ranking ────────────────────────────────────── */}
          <Tabs.TabPane
            key="product"
            tab={t('pages.adminSalesDashboard.tabs.product', { defaultValue: 'Product Ranking' })}
          >
            <div className="mb-3">
              <Select
                allowClear
                placeholder={t('pages.adminSalesDashboard.product.filterPlaceholder', { defaultValue: 'All Categories' })}
                style={{ width: 180 }}
                value={productCategoryFilter}
                onChange={setProductCategoryFilter}
                options={categoryOptions}
              />
            </div>
            <Table
              rowKey="key"
              loading={loading}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              dataSource={
                productCategoryFilter
                  ? productRows.filter((r) => r.category === productCategoryFilter)
                  : productRows
              }
              columns={[
                { title: '#', render: (_: unknown, __: unknown, i: number) => i + 1, width: 48, align: 'right' as const },
                {
                  title: t('pages.adminSalesDashboard.product.name', { defaultValue: 'Product Name' }),
                  dataIndex: 'productName',
                },
                {
                  title: t('pages.adminSalesDashboard.table.category', { defaultValue: 'Category' }),
                  dataIndex: 'categoryLabel',
                  width: isMobile ? 90 : 130,
                  render: (label: string) => <Tag>{label}</Tag>,
                },
                {
                  title: t('pages.adminSalesDashboard.table.quantity', { defaultValue: 'Qty' }),
                  dataIndex: 'quantity',
                  align: 'right' as const,
                  width: isMobile ? 60 : 80,
                  render: (v: number) => formatNumber(v),
                },
                {
                  title: t('pages.adminSalesDashboard.table.amount', { defaultValue: 'Sales (IDR)' }),
                  dataIndex: 'amount',
                  align: 'right' as const,
                  width: isMobile ? 120 : 180,
                  render: (v: number) => <span className="font-medium">{formatCurrency(v)}</span>,
                },
                {
                  title: t('pages.adminSalesDashboard.table.share', { defaultValue: 'Share' }),
                  dataIndex: 'share',
                  align: 'right' as const,
                  width: isMobile ? 55 : 70,
                  render: (v: number) => <span className="app-text-soft">{Math.round(v * 100)}%</span>,
                },
              ]}
              locale={{ emptyText: <Empty description={t('pages.adminSalesDashboard.product.empty', { defaultValue: 'No product data' })} /> }}
            />
          </Tabs.TabPane>

          {/* ── Tab 3: Key Accounts (multi-dimensional) ───────────────────── */}
          <Tabs.TabPane
            key="account"
            tab={t('pages.adminSalesDashboard.tabs.account', { defaultValue: 'Key Accounts' })}
          >
            {/* Filter controls */}
            <Space wrap className="mb-3">
              <Select
                allowClear
                placeholder={t('pages.adminSalesDashboard.account.filterCategory', { defaultValue: 'Filter Category' })}
                style={{ width: 190 }}
                value={accountCategoryFilter}
                onChange={setAccountCategoryFilter}
                options={categoryOptions}
              />
              <Segmented
                size={isMobile ? 'small' : 'middle'}
                value={accountSortBy}
                onChange={(v) => setAccountSortBy(v as typeof accountSortBy)}
                options={[
                  { label: t('pages.adminSalesDashboard.account.sortAmount', { defaultValue: 'By Amount' }), value: 'amount' },
                  { label: t('pages.adminSalesDashboard.account.sortQuantity', { defaultValue: 'By Quantity' }), value: 'quantity' },
                  { label: t('pages.adminSalesDashboard.account.sortOrders', { defaultValue: 'By Orders' }), value: 'orders' },
                  { label: t('pages.adminSalesDashboard.account.sortAov', { defaultValue: 'By AOV' }), value: 'aov' },
                ]}
              />
              <Segmented
                size={isMobile ? 'small' : 'middle'}
                value={accountTopN}
                onChange={(v) => setAccountTopN(Number(v))}
                options={[
                  { label: 'Top 10', value: 10 },
                  { label: 'Top 20', value: 20 },
                  { label: t('pages.adminSalesDashboard.account.topAll', { defaultValue: 'All' }), value: 9999 },
                ]}
              />
            </Space>

            {/* Table */}
            <Table
              rowKey="key"
              loading={loading}
              size="small"
              pagination={false}
              dataSource={filteredAccountRows}
              expandable={{
                expandedRowRender: (record: KeyAccountRow) => {
                  if (record.categoryBreakdown.length === 0) {
                    return (
                      <div className="py-2 pl-8 text-xs app-text-soft">No category data</div>
                    )
                  }
                  return (
                    <div className="py-2 pl-4">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-b app-border">
                            <th className="pb-1 pl-6 pr-3 text-left font-medium app-text-soft">{t('pages.adminSalesDashboard.table.category', { defaultValue: 'Category' })}</th>
                            <th className="pb-1 pr-3 text-right font-medium app-text-soft">{t('pages.adminSalesDashboard.table.quantity', { defaultValue: 'Qty' })}</th>
                            <th className="pb-1 pr-3 text-right font-medium app-text-soft">{t('pages.adminSalesDashboard.account.categoryAmount', { defaultValue: 'Amount (IDR)' })}</th>
                            <th className="pb-1 text-right font-medium app-text-soft">{t('pages.adminSalesDashboard.table.share', { defaultValue: 'Share' })}</th>
                            <th className="pb-1 pl-3 app-text-soft" style={{ minWidth: 100 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {record.categoryBreakdown.map((cat) => {
                            const color = categoryColorByValue.get(cat.category) ?? '#888'
                            return (
                              <tr key={cat.category} className="border-b app-border last:border-0">
                                <td className="py-1.5 pl-6 pr-3 app-text">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                                    {cat.categoryLabel}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3 text-right app-text-soft">{formatNumber(cat.quantity)}</td>
                                <td className="py-1.5 pr-3 text-right font-medium app-text">{formatCurrency(cat.amount)}</td>
                                <td className="py-1.5 text-right app-text-soft">{Math.round(cat.share * 100)}%</td>
                                <td className="py-1.5 pl-3">
                                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" style={{ minWidth: 80 }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${Math.round(cat.share * 100)}%`, background: color }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                },
                rowExpandable: (record: KeyAccountRow) => record.categoryBreakdown.length > 0,
              }}
              columns={[
                { title: '#', render: (_: unknown, __: unknown, i: number) => i + 1, width: 48, align: 'right' as const },
                {
                  title: t('pages.adminSalesDashboard.account.company', { defaultValue: 'Company Name' }),
                  dataIndex: 'companyName',
                },
                {
                  title: t('pages.adminSalesDashboard.account.orders', { defaultValue: 'Orders' }),
                  dataIndex: 'orderCount',
                  align: 'right' as const,
                  width: isMobile ? 60 : 80,
                },
                {
                  title: t('pages.adminSalesDashboard.account.totalQuantity', { defaultValue: 'Total Qty' }),
                  dataIndex: 'totalQuantity',
                  align: 'right' as const,
                  width: isMobile ? 70 : 90,
                  render: (v: number) => formatNumber(v),
                },
                {
                  title: t('pages.adminSalesDashboard.account.totalAmount', { defaultValue: 'Total Spend (IDR)' }),
                  dataIndex: 'totalAmount',
                  align: 'right' as const,
                  width: isMobile ? 120 : 200,
                  render: (v: number) => <span className="font-medium">{formatCurrency(v)}</span>,
                },
                {
                  title: t('pages.adminSalesDashboard.account.aov', { defaultValue: 'Avg Order Value' }),
                  dataIndex: 'aov',
                  align: 'right' as const,
                  width: isMobile ? 100 : 160,
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: t('pages.adminSalesDashboard.account.topCategory', { defaultValue: 'Top Category' }),
                  dataIndex: 'topCategoryLabel',
                  width: isMobile ? 90 : 130,
                  render: (label: string) =>
                    label ? <Tag>{label}</Tag> : <span className="app-text-soft">—</span>,
                },
              ]}
              locale={{ emptyText: <Empty description={t('pages.adminSalesDashboard.account.empty', { defaultValue: 'No customer data' })} /> }}
            />
          </Tabs.TabPane>

        </Tabs>
      </Card>
    </>
  )
}
