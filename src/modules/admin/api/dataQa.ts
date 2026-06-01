import dayjs from 'dayjs'

import { supabase } from '../../../lib/supabase/client'
import type { SalesProductCategory } from '../../../types/business'
import { getSalesProductCategoryGroup } from '../../../lib/business-constants'
import {
  listAdminSalesProductInsightDataset,
  type AdminInsightBusinessScope,
  type AdminInsightSalesOrderRow,
} from './salesProductInsight'

export type DataQaIntent =
  | 'purchase_summary'
  | 'buyer_count'
  | 'top_customer'
  | 'top_customers'
  | 'quantity_total'
  | 'amount_total'
  | 'order_count'
  | 'category_ranking'
  | 'business_scope_breakdown'
  | 'trend_analysis'
  | 'deep_analysis'
  | 'unsupported'

export type DataQaCategoryGroup = 'ACCESSORY'
export type DataQaDatePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month' | 'this_year'
export type DataQaTrendGranularity = 'day' | 'week' | 'month'

export interface DataQaFilters {
  category?: SalesProductCategory
  categoryGroup?: DataQaCategoryGroup
  businessScope?: AdminInsightBusinessScope
  dateFrom?: string
  dateTo?: string
  datePreset?: DataQaDatePreset
  trendGranularity?: DataQaTrendGranularity
  limit: number
}

export interface DataQaCustomerResult {
  customerKey: string
  companyName: string
  businessScope: AdminInsightBusinessScope
  quantity: number
  amount: number
  orderCount: number
  lastSoldAt: string | null
}

export interface DataQaBreakdownResult {
  key: string
  label: string
  buyerCount: number
  quantity: number
  amount: number
  orderCount: number
}

export interface DataQaTrendRow {
  period: string
  buyerCount: number
  quantity: number
  amount: number
  orderCount: number
}

export interface DataQaInsight {
  type: 'positive' | 'warning' | 'info'
  title: string
  detail: string
}

export interface DataQaDataQuality {
  generatedAt: string
  sourceTables: string[]
  matchedItemCount: number
  matchedOrderCount: number
  matchedCustomerCount: number
  calculationOwner: 'system'
}

export interface DataQaAnswer {
  intent: DataQaIntent
  question: string
  filters: DataQaFilters
  buyerCount: number
  totalQuantity: number
  totalAmount: number
  totalOrderCount: number
  topCustomer: DataQaCustomerResult | null
  rows: DataQaCustomerResult[]
  breakdownRows: DataQaBreakdownResult[]
  trendRows: DataQaTrendRow[]
  insights: DataQaInsight[]
  dataQuality: DataQaDataQuality
  assumptions: string[]
  aiAnswer?: string
  aiEnabled?: boolean
}

export interface DataQaConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface PurchaseItemFact {
  customerKey: string
  companyName: string
  businessScope: AdminInsightBusinessScope
  orderId: string
  soldAt: string
  category: SalesProductCategory
  quantity: number
  amount: number
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}_]+/gu, '').trim()
}

function isAccessoryCategory(category: SalesProductCategory): boolean {
  return getSalesProductCategoryGroup(category) === 'BOSCH_ACCESSORY'
}

function detectCategory(question: string): Pick<DataQaFilters, 'category' | 'categoryGroup'> {
  const normalized = normalizeText(question)
  const compact = normalizeKey(question)
  const categoryMatchers: Array<{ category: SalesProductCategory; words: string[] }> = [
    { category: 'TIRE', words: ['轮胎', '輪胎', 'tire', 'tires', 'tyre', 'tyres', 'ban'] },
    { category: 'BATTERY', words: ['电池', '電池', 'battery', 'batteries', 'aki', 'baterai'] },
    { category: 'ENGINE_OIL', words: ['机油', '機油', 'engine oil', 'oli', 'oli mesin'] },
    { category: 'CHEMICAL', words: ['化学品', '化學品', 'chemical', 'chemicals', 'cairan'] },
    { category: 'WIPER', words: ['雨刮', '雨刷', 'wiper'] },
    { category: 'THREE_FILTERS', words: ['三滤', '三濾', 'three filters', 'filter'] },
    { category: 'X_OWL', words: ['x-owl', 'x owl', 'x_owl'] },
    { category: 'BRAKE_PAD', words: ['刹车片', '煞車片', 'brake pad', 'brake pads', 'kampas rem'] },
    { category: 'CAR_BEAUTY', words: ['美容', 'car beauty', 'detailing'] },
    { category: 'WINDOW_FILM', words: ['窗膜', 'window film', 'kaca film'] },
    { category: 'BOSCH_ACCESSORY', words: ['博世配件', 'bosch accessory', 'bosch accessories'] },
  ]

  const category = categoryMatchers.find((item) =>
    item.words.some((word) => {
      const normalizedWord = normalizeText(word)
      return normalized.includes(normalizedWord) || compact.includes(normalizeKey(normalizedWord))
    }),
  )?.category

  if (category) {
    return { category }
  }

  if (compact.includes('配件') || compact.includes('accessory') || compact.includes('accessories') || compact.includes('aksesori')) {
    return { categoryGroup: 'ACCESSORY' }
  }

  return {}
}

function detectBusinessScope(question: string): AdminInsightBusinessScope | undefined {
  const compact = normalizeKey(question)
  if (compact.includes('both')) {
    return 'BOTH'
  }
  if (compact.includes('非bcs') || compact.includes('nonbcs')) {
    return 'NON_BCS'
  }
  if (compact.includes('bcs')) {
    return 'BCS'
  }
  return undefined
}

function detectDateFilters(question: string): Pick<DataQaFilters, 'dateFrom' | 'dateTo' | 'datePreset'> {
  const compact = normalizeKey(question)
  const now = dayjs()

  if (compact.includes('今天') || compact.includes('今日') || compact.includes('today') || compact.includes('hariini')) {
    return { datePreset: 'today', dateFrom: now.startOf('day').toISOString(), dateTo: now.endOf('day').toISOString() }
  }

  if (compact.includes('昨天') || compact.includes('昨日') || compact.includes('yesterday') || compact.includes('kemarin')) {
    const target = now.subtract(1, 'day')
    return { datePreset: 'yesterday', dateFrom: target.startOf('day').toISOString(), dateTo: target.endOf('day').toISOString() }
  }

  if (compact.includes('最近7天') || compact.includes('近7天') || compact.includes('last7days') || compact.includes('7hari')) {
    return { datePreset: 'last_7_days', dateFrom: now.subtract(6, 'day').startOf('day').toISOString(), dateTo: now.endOf('day').toISOString() }
  }

  if (compact.includes('最近30天') || compact.includes('近30天') || compact.includes('last30days') || compact.includes('30hari')) {
    return { datePreset: 'last_30_days', dateFrom: now.subtract(29, 'day').startOf('day').toISOString(), dateTo: now.endOf('day').toISOString() }
  }

  if (compact.includes('最近90天') || compact.includes('近90天') || compact.includes('last90days') || compact.includes('90hari')) {
    return { datePreset: 'last_90_days', dateFrom: now.subtract(89, 'day').startOf('day').toISOString(), dateTo: now.endOf('day').toISOString() }
  }

  if (compact.includes('本月') || compact.includes('这个月') || compact.includes('這個月') || compact.includes('thismonth') || compact.includes('bulanini')) {
    return { datePreset: 'this_month', dateFrom: now.startOf('month').toISOString(), dateTo: now.endOf('month').toISOString() }
  }

  if (compact.includes('上月') || compact.includes('上个月') || compact.includes('上個月') || compact.includes('lastmonth')) {
    const target = now.subtract(1, 'month')
    return { datePreset: 'last_month', dateFrom: target.startOf('month').toISOString(), dateTo: target.endOf('month').toISOString() }
  }

  if (compact.includes('今年') || compact.includes('本年') || compact.includes('thisyear')) {
    return { datePreset: 'this_year', dateFrom: now.startOf('year').toISOString(), dateTo: now.endOf('year').toISOString() }
  }

  return {}
}

function detectLimit(question: string): number {
  const compact = normalizeKey(question)
  const topMatch = compact.match(/top(\d{1,2})/i)
  if (topMatch?.[1]) {
    return Math.min(20, Math.max(1, Number(topMatch[1])))
  }

  const chineseMatch = question.match(/前\s*([0-9一二三四五六七八九十]{1,2})\s*(名|个|個|家)?/)
  if (chineseMatch?.[1]) {
    const raw = chineseMatch[1]
    const numberMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
    const value = /^\d+$/.test(raw) ? Number(raw) : numberMap[raw]
    if (value) {
      return Math.min(20, Math.max(1, value))
    }
  }

  return 5
}

function detectIntent(question: string): DataQaIntent {
  const compact = normalizeKey(question)
  const hasPurchaseSignal = /(采购|採購|购买|購買|买了|買了|销售|銷售|订单|訂單|金额|金額|purchase|buy|buyer|sold|sales|order|amount|revenue|penjualan|membeli)/i.test(question)

  if (!hasPurchaseSignal) {
    return 'unsupported'
  }
  if (/(深度分析|经营分析|經營分析|复盘|復盤|销售成果|銷售成果|建议|建議|analysis|insight|review)/i.test(question)) {
    return 'deep_analysis'
  }
  if (/(趋势|趨勢|走势|走勢|环比|環比|trend|growth|decline)/i.test(question)) {
    return 'trend_analysis'
  }
  if (/(业务类型|業務類型|bcs.*非bcs|非bcs.*bcs|business.*type|jenis.*bisnis|对比|對比|分布|占比|breakdown|compare)/i.test(question)) {
    return 'business_scope_breakdown'
  }
  if (/(品类|品類|类别|類別|category|kategori).*(排行|排名|最多|最高|top)|排行.*(品类|品類|类别|類別|category|kategori)/i.test(question)) {
    return 'category_ranking'
  }
  if (/(金额|金額|销售额|銷售額|营收|營收|amount|revenue|nilai)/i.test(question)) {
    return 'amount_total'
  }
  if (/(订单|訂單|单数|單數|order)/i.test(question)) {
    return 'order_count'
  }
  if (/(最多|最高|最大|第一|top|terbanyak|tertinggi)/i.test(question)) {
    return compact.includes('top') || /前\s*[0-9一二三四五六七八九十]/.test(question) ? 'top_customers' : 'top_customer'
  }
  if (compact.includes('多少客户') || compact.includes('多少家') || compact.includes('幾家') || compact.includes('几家') || compact.includes('howmanycustomers')) {
    return 'buyer_count'
  }
  if (compact.includes('数量') || compact.includes('數量') || compact.includes('多少个') || compact.includes('多少件') || compact.includes('quantity') || compact.includes('qty')) {
    return 'quantity_total'
  }
  return 'purchase_summary'
}

function scopeFromOrder(order: AdminInsightSalesOrderRow): AdminInsightBusinessScope {
  if (order.lead?.intent_package === 'BCS') {
    return 'BCS'
  }
  if (order.lead?.intent_package === 'BOTH') {
    return 'BOTH'
  }
  if (order.onboard_merchant?.onboarding_type === 'BCS_FRANCHISE') {
    return 'BCS'
  }
  return 'NON_BCS'
}

function resolveCustomerKey(order: AdminInsightSalesOrderRow): string {
  if (order.lead_id || order.lead?.id) {
    return `lead:${order.lead_id ?? order.lead?.id}`
  }
  if (order.onboard_merchant_id || order.onboard_merchant?.id) {
    return `merchant:${order.onboard_merchant_id ?? order.onboard_merchant?.id}`
  }
  return `company:${normalizeKey(order.company_name)}`
}

function isInDateRange(value: string, from?: string, to?: string): boolean {
  const timestamp = dayjs(value).valueOf()
  if (from && timestamp < dayjs(from).valueOf()) {
    return false
  }
  if (to && timestamp > dayjs(to).valueOf()) {
    return false
  }
  return true
}

function buildFacts(orders: AdminInsightSalesOrderRow[]): PurchaseItemFact[] {
  const facts: PurchaseItemFact[] = []

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const category = item.category
      const quantity = Math.max(0, Number(item.quantity ?? 0))
      const unitPrice = item.unit_price === null || item.unit_price === undefined ? 0 : Number(item.unit_price)
      facts.push({
        customerKey: resolveCustomerKey(order),
        companyName: order.company_name,
        businessScope: scopeFromOrder(order),
        orderId: order.id,
        soldAt: order.sold_at,
        category,
        quantity,
        amount: quantity * unitPrice,
      })
    }
  }

  return facts
}

function buildBreakdownRows(facts: PurchaseItemFact[], mode: 'category' | 'businessScope'): DataQaBreakdownResult[] {
  const aggregate = new Map<string, DataQaBreakdownResult & { customerKeys: Set<string>; orderIds: Set<string> }>()

  for (const fact of facts) {
    const key = mode === 'category' ? getSalesProductCategoryGroup(fact.category) : fact.businessScope
    const row =
      aggregate.get(key) ??
      {
        key,
        label: key,
        buyerCount: 0,
        quantity: 0,
        amount: 0,
        orderCount: 0,
        customerKeys: new Set<string>(),
        orderIds: new Set<string>(),
      }

    row.customerKeys.add(fact.customerKey)
    row.orderIds.add(fact.orderId)
    row.buyerCount = row.customerKeys.size
    row.orderCount = row.orderIds.size
    row.quantity += fact.quantity
    row.amount += fact.amount
    aggregate.set(key, row)
  }

  return [...aggregate.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      buyerCount: row.buyerCount,
      quantity: row.quantity,
      amount: row.amount,
      orderCount: row.orderCount,
    }))
    .sort((left, right) => right.quantity - left.quantity || right.amount - left.amount || right.buyerCount - left.buyerCount)
}

function getTrendPeriod(value: string): string {
  return dayjs(value).format('YYYY-MM-DD')
}

function buildTrendRows(facts: PurchaseItemFact[]): DataQaTrendRow[] {
  const aggregate = new Map<string, DataQaTrendRow & { customerKeys: Set<string>; orderIds: Set<string> }>()

  for (const fact of facts) {
    const period = getTrendPeriod(fact.soldAt)
    const row =
      aggregate.get(period) ??
      {
        period,
        buyerCount: 0,
        quantity: 0,
        amount: 0,
        orderCount: 0,
        customerKeys: new Set<string>(),
        orderIds: new Set<string>(),
      }

    row.customerKeys.add(fact.customerKey)
    row.orderIds.add(fact.orderId)
    row.buyerCount = row.customerKeys.size
    row.orderCount = row.orderIds.size
    row.quantity += fact.quantity
    row.amount += fact.amount
    aggregate.set(period, row)
  }

  return [...aggregate.values()]
    .map((row) => ({
      period: row.period,
      buyerCount: row.buyerCount,
      quantity: row.quantity,
      amount: row.amount,
      orderCount: row.orderCount,
    }))
    .sort((left, right) => left.period.localeCompare(right.period))
}

function buildLocalInsights(rows: DataQaCustomerResult[], trendRows: DataQaTrendRow[], categoryRows: DataQaBreakdownResult[]): DataQaInsight[] {
  const insights: DataQaInsight[] = []
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0)

  if (totalQuantity === 0) {
    return [{ type: 'info', title: 'No matching sales data', detail: 'No matching sales item was found under the current filters.' }]
  }

  if (rows[0]) {
    const share = (rows[0].quantity / totalQuantity) * 100
    insights.push({
      type: share >= 50 ? 'warning' : 'info',
      title: 'Top customer concentration',
      detail: `${rows[0].companyName} contributes ${share.toFixed(2)}% of matched quantity.`,
    })
  }

  if (trendRows.length >= 2) {
    const previous = trendRows[trendRows.length - 2]
    const current = trendRows[trendRows.length - 1]
    insights.push({
      type: current.quantity >= previous.quantity ? 'positive' : 'warning',
      title: 'Latest period trend',
      detail: `Latest period ${current.period} quantity is ${current.quantity}, previous period ${previous.period} quantity is ${previous.quantity}.`,
    })
  }

  if (categoryRows[0]) {
    insights.push({
      type: 'info',
      title: 'Leading category',
      detail: `${categoryRows[0].label} ranks first by quantity with ${categoryRows[0].quantity} units.`,
    })
  }

  return insights
}

export async function answerBusinessDataQuestion(question: string): Promise<DataQaAnswer> {
  const intent = detectIntent(question)
  const filters: DataQaFilters = {
    ...detectCategory(question),
    businessScope: detectBusinessScope(question),
    ...detectDateFilters(question),
    limit: detectLimit(question),
  }
  const assumptions: string[] = []

  if (!filters.category && !filters.categoryGroup) {
    assumptions.push('CATEGORY_ALL')
  }
  if ((intent === 'trend_analysis' || intent === 'deep_analysis') && !filters.dateFrom && !filters.dateTo) {
    const now = dayjs()
    filters.datePreset = 'last_90_days'
    filters.dateFrom = now.subtract(89, 'day').startOf('day').toISOString()
    filters.dateTo = now.endOf('day').toISOString()
    assumptions.push('DATE_DEFAULT_LAST_90_DAYS')
  }
  if (!filters.dateFrom && !filters.dateTo) {
    assumptions.push('DATE_ALL')
  }

  const dataset = await listAdminSalesProductInsightDataset()
  const facts = buildFacts(dataset.salesOrders).filter((fact) => {
    if (filters.category && fact.category !== filters.category) {
      return false
    }
    if (filters.categoryGroup === 'ACCESSORY' && !isAccessoryCategory(fact.category)) {
      return false
    }
    if (filters.businessScope && fact.businessScope !== filters.businessScope) {
      return false
    }
    return isInDateRange(fact.soldAt, filters.dateFrom, filters.dateTo)
  })

  const aggregate = new Map<string, DataQaCustomerResult & { orderIds: Set<string> }>()
  for (const fact of facts) {
    const row =
      aggregate.get(fact.customerKey) ??
      {
        customerKey: fact.customerKey,
        companyName: fact.companyName,
        businessScope: fact.businessScope,
        quantity: 0,
        amount: 0,
        orderCount: 0,
        lastSoldAt: null,
        orderIds: new Set<string>(),
      }

    row.quantity += fact.quantity
    row.amount += fact.amount
    row.orderIds.add(fact.orderId)
    row.orderCount = row.orderIds.size
    if (!row.lastSoldAt || dayjs(fact.soldAt).isAfter(dayjs(row.lastSoldAt))) {
      row.lastSoldAt = fact.soldAt
    }
    aggregate.set(fact.customerKey, row)
  }

  const rows = [...aggregate.values()]
    .map((row) => ({
      customerKey: row.customerKey,
      companyName: row.companyName,
      businessScope: row.businessScope,
      quantity: row.quantity,
      amount: row.amount,
      orderCount: row.orderCount,
      lastSoldAt: row.lastSoldAt,
    }))
    .sort((left, right) => right.quantity - left.quantity || right.amount - left.amount || left.companyName.localeCompare(right.companyName))

  const orderIds = new Set(facts.map((fact) => fact.orderId))
  const categoryRows = buildBreakdownRows(facts, 'category')
  const businessRows = buildBreakdownRows(facts, 'businessScope')
  const breakdownRows = intent === 'category_ranking' || intent === 'deep_analysis' ? categoryRows : intent === 'business_scope_breakdown' ? businessRows : []
  const trendRows = buildTrendRows(facts)
  const insights = buildLocalInsights(rows, trendRows, categoryRows)

  return {
    intent,
    question,
    filters,
    buyerCount: rows.length,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    totalOrderCount: orderIds.size,
    topCustomer: rows[0] ?? null,
    rows,
    breakdownRows,
    trendRows,
    insights,
    dataQuality: {
      generatedAt: new Date().toISOString(),
      sourceTables: ['sales_orders', 'sales_order_items', 'leads', 'onboard_merchants'],
      matchedItemCount: facts.length,
      matchedOrderCount: orderIds.size,
      matchedCustomerCount: rows.length,
      calculationOwner: 'system',
    },
    assumptions,
    aiEnabled: false,
  }
}

export async function answerBusinessDataQuestionWithAi(
  question: string,
  options?: {
    conversation?: DataQaConversationMessage[]
    sessionId?: string
  },
): Promise<DataQaAnswer> {
  const sessionResult = await supabase.auth.getSession()
  if (sessionResult.error) {
    throw new Error(sessionResult.error.message || 'Failed to read current session')
  }

  const accessToken = sessionResult.data.session?.access_token
  if (!accessToken) {
    throw new Error('Not authenticated. Please sign in again and retry.')
  }

  const result = await supabase.functions.invoke<DataQaAnswer>('ai-data-assistant', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      question,
      conversation: options?.conversation ?? [],
      sessionId: options?.sessionId ?? null,
    },
  })

  if (result.error) {
    const context = result.error.context
    if (context instanceof Response) {
      const payload = await context
        .clone()
        .json()
        .catch(() => null) as { error?: string } | null
      if (payload?.error) {
        throw new Error(payload.error)
      }
    }
    throw new Error(result.error.message || 'AI data assistant request failed')
  }

  if (!result.data) {
    throw new Error('AI data assistant returned an empty response')
  }

  return result.data
}
