import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'

type BusinessScope = 'BCS' | 'BOTH' | 'NON_BCS'
type SalesProductCategory =
  | 'ENGINE_OIL'
  | 'CHEMICAL'
  | 'TIRE'
  | 'WIPER'
  | 'THREE_FILTERS'
  | 'BATTERY'
  | 'BRAKE_PAD'
  | 'CAR_BEAUTY'
  | 'WINDOW_FILM'
  | 'BOSCH_ACCESSORY'
  | 'X_OWL'
type DataQaIntent =
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
type DataQaCategoryGroup = 'ACCESSORY'
type DataQaDatePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month' | 'this_year'
type TrendGranularity = 'day' | 'week' | 'month'

interface SalesOrderRow {
  id: string
  order_no: string
  company_name: string
  lead_id: string | null
  onboard_merchant_id: string | null
  bd_user_id: string
  sold_at: string
  payment_method: string | null
  payment_top_term: string | null
  note: string | null
  created_at: string
  lead: {
    id: string
    lead_code: string
    company_name: string
    status: string
    intent_package: string | null
    assigned_bd_id: string | null
    created_at: string
  } | null
  onboard_merchant: {
    id: string
    merchant_no: string
    company_name: string
    onboarding_type: string
    lead_id: string | null
    bd_owner_id: string | null
  } | null
  items: Array<{
    id: string
    sales_order_id: string
    category: SalesProductCategory
    product_name: string | null
    quantity: number
    unit_price: number | null
    created_at: string
  }>
}

interface LeadDetailRow {
  id: string
  lead_code: string
  company_name: string
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  industry: string | null
  region: string | null
  city: string | null
  address: string | null
  source: string | null
  intent_package: string | null
  bd_notes: string | null
  team_attention_note: string | null
  intent_level: number | null
  estimated_value: number | null
  status: string
  assigned_bd_id: string | null
  next_followup_at: string | null
  last_followup_at: string | null
  created_at: string
  updated_at: string
}

interface LeadFollowupRow {
  id: string
  lead_id: string
  followup_type: string
  summary: string
  followup_at: string
  next_followup_at: string | null
  bd_notes: string | null
  team_attention_note: string | null
  status_snapshot: string | null
  created_by: string | null
  created_at: string
}

interface OnboardMerchantActivityRow {
  id: string
  merchant_id: string
  activity_type: string
  status: string
  title: string
  detail: string | null
  activity_at: string
  scheduled_at: string | null
  assignee_id: string | null
  related_sales_order_id: string | null
  created_at: string
}

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  locale?: string | null
  timezone?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

interface RoleRow {
  id: number
  code: string
  name: string
}

interface UserRoleRelationRow {
  user_id: string
  role_id: number
  role: RoleRow | RoleRow[] | null
}

interface OnboardMerchantRow {
  id: string
  merchant_no: string
  lead_id: string | null
  company_name: string
  onboarding_type: string
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  region: string | null
  city: string | null
  address: string | null
  bd_owner_id: string | null
  remarks: string | null
  onboarded_at: string
  created_at: string
  updated_at: string
}

interface SignedRecordRow {
  id: string
  lead_id: string
  contract_no: string
  contract_date: string | null
  contract_value: number | null
  contract_currency: string
  contract_package?: string | null
  signed_by: string | null
  signed_at: string
  created_at: string
}

interface OnboardingCaseRow {
  id: string
  case_no: string
  signed_record_id: string
  status: string
  owner_user_id: string | null
  reviewer_user_id: string | null
  sla_due_at: string | null
  started_at: string
  completed_at: string | null
  rejected_at: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

interface ProjectRow {
  id: string
  project_code: string
  onboarding_case_id: string
  signed_record_id: string | null
  lead_id: string | null
  name: string
  description: string | null
  status: string
  pm_owner_id: string | null
  bd_owner_id: string | null
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  completion_rate: number
  is_delayed: boolean
  delay_reason: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

interface ProjectTaskRow {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  priority: string
  assignee_id: string | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  progress: number
  created_at: string
  updated_at: string
}

interface TirePriceCatalogRow {
  sap_code: string | null
  size: string
  description: string
  load_index: string | null
  speed_symbol: string | null
  category: string | null
  price_incl_vat: number
  model_label: string
}

interface ParsedQuestion {
  intent: DataQaIntent
  category?: SalesProductCategory
  categoryGroup?: DataQaCategoryGroup
  businessScope?: BusinessScope
  datePreset?: DataQaDatePreset
  trendGranularity?: TrendGranularity
  customerKeyword?: string
  productKeyword?: string
  keywords?: string[]
  limit?: number
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DataQaFilters {
  category?: SalesProductCategory
  categoryGroup?: DataQaCategoryGroup
  businessScope?: BusinessScope
  dateFrom?: string
  dateTo?: string
  datePreset?: DataQaDatePreset
  trendGranularity?: TrendGranularity
  limit: number
}

interface DataQaCustomerResult {
  customerKey: string
  companyName: string
  businessScope: BusinessScope
  quantity: number
  amount: number
  orderCount: number
  lastSoldAt: string | null
}

interface DataQaBreakdownResult {
  key: string
  label: string
  buyerCount: number
  quantity: number
  amount: number
  orderCount: number
}

interface DataQaTrendRow {
  period: string
  buyerCount: number
  quantity: number
  amount: number
  orderCount: number
}

interface DataQaInsight {
  type: 'positive' | 'warning' | 'info'
  title: string
  detail: string
}

interface DataQaDataQuality {
  generatedAt: string
  sourceTables: string[]
  matchedItemCount: number
  matchedOrderCount: number
  matchedCustomerCount: number
  calculationOwner: 'system'
}

interface DataQaAnswer {
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

interface PurchaseItemFact {
  customerKey: string
  companyName: string
  businessScope: BusinessScope
  orderId: string
  orderNo: string
  soldAt: string
  category: SalesProductCategory
  productName: string | null
  quantity: number
  unitPrice: number
  amount: number
  paymentMethod: string | null
  paymentTopTerm: string | null
  salesNote: string | null
  leadId: string | null
  onboardMerchantId: string | null
  bdUserId: string
}

interface AiConfig {
  provider: 'openai' | 'deepseek'
  apiKey: string
  endpoint: string
  model: string
}

type SupabaseClientInstance = SupabaseClient

interface OptionalTableConfig {
  table: string
  sourceTable?: string
  select: string
  orderBy?: string
  ascending?: boolean
  limit?: number
  notNullColumn?: string
}

interface OptionalTableRead {
  table: string
  rows: Record<string, unknown>[]
  error?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedIntents: DataQaIntent[] = [
  'purchase_summary',
  'buyer_count',
  'top_customer',
  'top_customers',
  'quantity_total',
  'amount_total',
  'order_count',
  'category_ranking',
  'business_scope_breakdown',
  'trend_analysis',
  'deep_analysis',
  'unsupported',
]
const allowedCategories: SalesProductCategory[] = [
  'ENGINE_OIL',
  'CHEMICAL',
  'TIRE',
  'WIPER',
  'THREE_FILTERS',
  'BATTERY',
  'BRAKE_PAD',
  'CAR_BEAUTY',
  'WINDOW_FILM',
  'BOSCH_ACCESSORY',
  'X_OWL',
]
const allowedScopes: BusinessScope[] = ['BCS', 'BOTH', 'NON_BCS']
const allowedDatePresets: DataQaDatePreset[] = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'last_month', 'this_year']
const allowedTrendGranularities: TrendGranularity[] = ['day', 'week', 'month']
const MAX_CONTEXT_MESSAGES = 32
const MAX_CONTEXT_MESSAGE_CHARS = 3200
const MAX_QUESTION_CHARS = 2000
const CORE_READABLE_TABLES = [
  'sales_orders',
  'sales_order_items',
  'leads',
  'lead_followups',
  'onboard_merchants',
  'onboard_merchant_activities',
  'signed_records',
  'onboarding_cases',
  'projects',
  'project_tasks',
  'user_role_relations',
  'roles',
  'notifications',
  'profiles',
  'tire_price_catalog',
]
const SYSTEM_WIDE_READABLE_TABLES = [
  'permissions',
  'role_permission_relations',
  'operation_logs',
  'login_logs',
  'app_uploaded_files',
  'dictionary_items',
  'lead_attachments',
  'lead_assignment_logs',
  'lead_status_logs',
  'onboarding_steps',
  'onboarding_documents',
  'onboarding_reviews',
  'onboarding_status_logs',
  'project_members',
  'project_milestones',
  'project_status_logs',
  'project_updates',
  'report_exports',
]
const AI_READABLE_TABLES = [...CORE_READABLE_TABLES, ...SYSTEM_WIDE_READABLE_TABLES]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function resolveSupabaseClientKey(): string | null {
  const legacyAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyAnonKey) return legacyAnonKey

  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (!publishableKeys) return null

  try {
    const parsed = JSON.parse(publishableKeys) as Record<string, string> | string[]
    if (Array.isArray(parsed)) return parsed[0] ?? null
    return Object.values(parsed)[0] ?? null
  } catch {
    return null
  }
}

function resolveChatCompletionsEndpoint(rawEndpoint: string, provider: AiConfig['provider']): string {
  const endpoint = rawEndpoint.replace(/\/+$/, '')
  if (endpoint.endsWith('/chat/completions')) return endpoint
  if (endpoint.endsWith('/v1')) return `${endpoint}/chat/completions`
  return provider === 'deepseek' ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`
}

function resolveAiConfig(): AiConfig {
  const configuredProvider = (Deno.env.get('AI_PROVIDER') ?? '').trim().toLowerCase()
  const provider: AiConfig['provider'] =
    configuredProvider === 'deepseek' || (!configuredProvider && Deno.env.get('DEEPSEEK_API_KEY')) ? 'deepseek' : 'openai'

  if (provider === 'deepseek') {
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured')
    return {
      provider,
      apiKey,
      endpoint: resolveChatCompletionsEndpoint(Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com', provider),
      model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-v4-flash',
    }
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return {
    provider,
    apiKey,
    endpoint: resolveChatCompletionsEndpoint(Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com', provider),
    model: Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini',
  }
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}_]+/gu, '').trim()
}

function isAccessoryCategory(category: SalesProductCategory): boolean {
  return ['WIPER', 'THREE_FILTERS', 'BATTERY', 'BRAKE_PAD', 'BOSCH_ACCESSORY'].includes(category)
}

function getCategoryGroup(category: SalesProductCategory): SalesProductCategory {
  return isAccessoryCategory(category) ? 'BOSCH_ACCESSORY' : category
}

function nowDate(): Date {
  return new Date()
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0)
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
}

function resolveDateRange(datePreset?: ParsedQuestion['datePreset']): Pick<DataQaFilters, 'dateFrom' | 'dateTo' | 'datePreset'> {
  const now = nowDate()
  if (datePreset === 'today') {
    return { datePreset, dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() }
  }
  if (datePreset === 'yesterday') {
    const target = new Date(now)
    target.setDate(target.getDate() - 1)
    return { datePreset, dateFrom: startOfDay(target).toISOString(), dateTo: endOfDay(target).toISOString() }
  }
  if (datePreset === 'last_7_days') {
    const target = addDays(now, -6)
    return { datePreset, dateFrom: startOfDay(target).toISOString(), dateTo: endOfDay(now).toISOString() }
  }
  if (datePreset === 'last_30_days') {
    const target = addDays(now, -29)
    return { datePreset, dateFrom: startOfDay(target).toISOString(), dateTo: endOfDay(now).toISOString() }
  }
  if (datePreset === 'last_90_days') {
    const target = addDays(now, -89)
    return { datePreset, dateFrom: startOfDay(target).toISOString(), dateTo: endOfDay(now).toISOString() }
  }
  if (datePreset === 'this_month') {
    return { datePreset, dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() }
  }
  if (datePreset === 'last_month') {
    const target = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { datePreset, dateFrom: startOfMonth(target).toISOString(), dateTo: endOfMonth(target).toISOString() }
  }
  if (datePreset === 'this_year') {
    return { datePreset, dateFrom: startOfYear(now).toISOString(), dateTo: endOfYear(now).toISOString() }
  }
  return {}
}

function sanitizeSearchKeyword(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text) return undefined
  return text.slice(0, maxLength)
}

function sanitizeConversation(raw: unknown): ConversationMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const payload = item as Record<string, unknown>
      const role = payload.role === 'assistant' ? 'assistant' : payload.role === 'user' ? 'user' : null
      const content = sanitizeSearchKeyword(payload.content, MAX_CONTEXT_MESSAGE_CHARS)
      if (!role || !content) return null
      return { role, content } satisfies ConversationMessage
    })
    .filter((item): item is ConversationMessage => Boolean(item))
    .slice(-MAX_CONTEXT_MESSAGES)
}

function toConversationPrompt(conversation: ConversationMessage[]): string {
  if (conversation.length === 0) return ''
  return conversation
    .map((item, index) => `${index + 1}. ${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`)
    .join('\n')
}

function normalizeComparable(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeCompact(value: string | null | undefined): string {
  return normalizeKey(normalizeComparable(value))
}

function includesLoose(haystack: string | null | undefined, needle: string | undefined): boolean {
  if (!needle) return true
  const left = normalizeComparable(haystack)
  const right = normalizeComparable(needle)
  if (!left || !right) return false
  return left.includes(right) || normalizeKey(left).includes(normalizeKey(right))
}

function computeTextMatchScore(haystack: string | null | undefined, keyword: string | undefined): number {
  if (!keyword) return 0
  const left = normalizeComparable(haystack)
  const right = normalizeComparable(keyword)
  if (!left || !right) return 0
  if (left === right) return 120
  if (normalizeCompact(left) === normalizeCompact(right)) return 110
  if (left.startsWith(right)) return 90
  if (left.includes(right)) return 70
  if (normalizeCompact(left).includes(normalizeCompact(right))) return 50
  return 0
}

function extractSearchHints(question: string): { customerKeyword?: string; productKeyword?: string; keywords: string[] } {
  const keywords: string[] = []
  const quoted = [...question.matchAll(/["'“”‘’]([^"'“”‘’]{2,40})["'“”‘’]/g)].map((match) => match[1]?.trim()).filter(Boolean) as string[]
  keywords.push(...quoted)

  const tireSpec = question.match(/\b\d{3}\/\d{2}(?:R|ZR)\d{2}\b/i)?.[0]
  if (tireSpec) {
    keywords.push(tireSpec)
  }

  const customerKeyword =
    question.match(/(?:客户|客戶|公司|门店|門店|shop|customer|company)\s*[:：]?\s*([^\s,，。;；]{2,40})/i)?.[1]?.trim() || undefined
  const productKeyword =
    question.match(/(?:型号|型號|model|sku|size|规格|規格)\s*[:：]?\s*([^\s,，。;；]{2,40})/i)?.[1]?.trim() || undefined

  if (customerKeyword) keywords.push(customerKeyword)
  if (productKeyword) keywords.push(productKeyword)

  return {
    customerKeyword,
    productKeyword,
    keywords: Array.from(new Set(keywords.map((item) => item.trim()).filter(Boolean))).slice(0, 8),
  }
}

function hasBroadBusinessSignal(question: string, conversation: ConversationMessage[]): boolean {
  const contextText = `${question}\n${conversation.map((item) => item.content).join('\n')}`
  return /(客户|客戶|公司|门店|門店|线索|線索|拜访|拜訪|跟进|跟進|回访|回訪|提醒|业务员|銷售|销售员|负责人|負責人|BD|项目|項目|任务|任務|入驻|入駐|签约|簽約|visit|followup|reminder|lead|merchant|customer|sales|product|sku|model|size|spec|price|quote|onboarding|project|task|owner|assignee|role|profile|报价|報價|型号|型號|规格|規格|轮胎|輪胎|电池|電池|配件)/i.test(
    contextText,
  )
}

function sanitizeParsedQuestion(parsed: Partial<ParsedQuestion>): ParsedQuestion {
  const intent = allowedIntents.includes(parsed.intent as DataQaIntent) ? (parsed.intent as DataQaIntent) : 'purchase_summary'
  const category = allowedCategories.includes(parsed.category as SalesProductCategory) ? (parsed.category as SalesProductCategory) : undefined
  const categoryGroup = parsed.categoryGroup === 'ACCESSORY' && !category ? 'ACCESSORY' : undefined
  const businessScope = allowedScopes.includes(parsed.businessScope as BusinessScope) ? (parsed.businessScope as BusinessScope) : undefined
  const datePreset = allowedDatePresets.includes(parsed.datePreset as DataQaDatePreset) ? (parsed.datePreset as DataQaDatePreset) : undefined
  const trendGranularity = allowedTrendGranularities.includes(parsed.trendGranularity as TrendGranularity)
    ? (parsed.trendGranularity as TrendGranularity)
    : undefined
  const customerKeyword = sanitizeSearchKeyword((parsed as Record<string, unknown>).customerKeyword)
  const productKeyword = sanitizeSearchKeyword((parsed as Record<string, unknown>).productKeyword)
  const keywords = Array.isArray((parsed as Record<string, unknown>).keywords)
    ? Array.from(
        new Set(
          ((parsed as Record<string, unknown>).keywords as unknown[])
            .map((item) => sanitizeSearchKeyword(item, 60))
            .filter((item): item is string => Boolean(item)),
        ),
      ).slice(0, 8)
    : undefined
  const limit = Math.min(20, Math.max(1, Number(parsed.limit || 5)))
  return {
    intent,
    category,
    categoryGroup,
    businessScope,
    datePreset,
    trendGranularity,
    customerKeyword,
    productKeyword,
    keywords,
    limit,
  }
}

function scopeFromOrder(order: SalesOrderRow): BusinessScope {
  if (order.lead?.intent_package === 'BCS') return 'BCS'
  if (order.lead?.intent_package === 'BOTH') return 'BOTH'
  if (order.onboard_merchant?.onboarding_type === 'BCS_FRANCHISE') return 'BCS'
  return 'NON_BCS'
}

function resolveCustomerKey(order: SalesOrderRow): string {
  if (order.lead_id || order.lead?.id) return `lead:${order.lead_id ?? order.lead?.id}`
  if (order.onboard_merchant_id || order.onboard_merchant?.id) return `merchant:${order.onboard_merchant_id ?? order.onboard_merchant?.id}`
  return `company:${normalizeKey(order.company_name)}`
}

function isInDateRange(value: string, from?: string, to?: string): boolean {
  const timestamp = new Date(value).getTime()
  if (from && timestamp < new Date(from).getTime()) return false
  if (to && timestamp > new Date(to).getTime()) return false
  return true
}

function toPeriodKey(value: string, granularity: TrendGranularity): string {
  const date = new Date(value)
  if (granularity === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  if (granularity === 'week') {
    const target = startOfDay(date)
    const day = target.getDay() || 7
    const monday = addDays(target, 1 - day)
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function resolveTrendGranularity(filters: DataQaFilters): TrendGranularity {
  if (filters.trendGranularity) return filters.trendGranularity
  if (filters.datePreset === 'today' || filters.datePreset === 'yesterday' || filters.datePreset === 'last_7_days') return 'day'
  if (filters.datePreset === 'last_90_days' || filters.datePreset === 'this_year') return 'month'
  return 'week'
}

function buildFacts(orders: SalesOrderRow[]): PurchaseItemFact[] {
  const facts: PurchaseItemFact[] = []
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const quantity = Math.max(0, Number(item.quantity ?? 0))
      const unitPrice = item.unit_price === null || item.unit_price === undefined ? 0 : Number(item.unit_price)
      facts.push({
        customerKey: resolveCustomerKey(order),
        companyName: order.company_name,
        businessScope: scopeFromOrder(order),
        orderId: order.id,
        orderNo: order.order_no,
        soldAt: order.sold_at,
        category: item.category,
        productName: item.product_name,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        paymentMethod: order.payment_method,
        paymentTopTerm: order.payment_top_term,
        salesNote: order.note,
        leadId: order.lead_id ?? order.lead?.id ?? null,
        onboardMerchantId: order.onboard_merchant_id ?? order.onboard_merchant?.id ?? null,
        bdUserId: order.bd_user_id,
      })
    }
  }
  return facts
}

function matchesFactByKeywords(
  fact: PurchaseItemFact,
  params: { customerKeyword?: string; productKeyword?: string; keywords: string[] },
): boolean {
  if (!params.customerKeyword && !params.productKeyword && params.keywords.length === 0) return true
  return computeFactMatchScore(fact, params) > 0
}

function computeFactMatchScore(
  fact: PurchaseItemFact,
  params: { customerKeyword?: string; productKeyword?: string; keywords: string[] },
): number {
  let score = 0

  if (params.customerKeyword) {
    const customerScore = computeTextMatchScore(fact.companyName, params.customerKeyword)
    if (customerScore === 0) return 0
    score += customerScore * 2
  }

  if (params.productKeyword) {
    const productScore = Math.max(
      computeTextMatchScore(fact.productName ?? '', params.productKeyword),
      computeTextMatchScore(fact.orderNo, params.productKeyword),
    )
    if (productScore === 0) return 0
    score += productScore * 2
  }

  if (params.keywords.length > 0) {
    let bestKeywordScore = 0
    for (const keyword of params.keywords) {
      const keywordScore = Math.max(
        computeTextMatchScore(fact.companyName, keyword),
        computeTextMatchScore(fact.productName ?? '', keyword),
        computeTextMatchScore(fact.orderNo, keyword),
        computeTextMatchScore(fact.salesNote ?? '', keyword),
      )
      if (keywordScore > bestKeywordScore) {
        bestKeywordScore = keywordScore
      }
    }
    if (bestKeywordScore === 0) return 0
    score += bestKeywordScore
  }

  return score
}

function buildTrendRows(facts: PurchaseItemFact[], granularity: TrendGranularity): DataQaTrendRow[] {
  const aggregate = new Map<string, DataQaTrendRow & { customerKeys: Set<string>; orderIds: Set<string> }>()
  for (const fact of facts) {
    const period = toPeriodKey(fact.soldAt, granularity)
    const row = aggregate.get(period) ?? {
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

function buildBreakdownRows(facts: PurchaseItemFact[], mode: 'category' | 'businessScope'): DataQaBreakdownResult[] {
  const aggregate = new Map<string, DataQaBreakdownResult & { customerKeys: Set<string>; orderIds: Set<string> }>()
  for (const fact of facts) {
    const key = mode === 'category' ? getCategoryGroup(fact.category) : fact.businessScope
    const row = aggregate.get(key) ?? {
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

function percentChange(previous: number, current: number): number | null {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function formatPercentForInsight(value: number | null): string {
  if (value === null) return 'new activity'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function buildSystemInsights(
  rows: DataQaCustomerResult[],
  trendRows: DataQaTrendRow[],
  categoryRows: DataQaBreakdownResult[],
  businessRows: DataQaBreakdownResult[],
  totals: Pick<DataQaAnswer, 'buyerCount' | 'totalQuantity' | 'totalAmount' | 'totalOrderCount'>,
): DataQaInsight[] {
  const insights: DataQaInsight[] = []

  if (totals.totalQuantity === 0 || rows.length === 0) {
    return [
      {
        type: 'info',
        title: 'No matching sales data',
        detail: 'No sales order items matched the current category, business type, and date filters.',
      },
    ]
  }

  const topCustomer = rows[0]
  if (topCustomer) {
    const share = totals.totalQuantity > 0 ? (topCustomer.quantity / totals.totalQuantity) * 100 : 0
    insights.push({
      type: share >= 50 ? 'warning' : 'info',
      title: 'Top customer concentration',
      detail: `${topCustomer.companyName} contributes ${share.toFixed(2)}% of matched quantity (${topCustomer.quantity} units).`,
    })
  }

  if (trendRows.length >= 2) {
    const previous = trendRows[trendRows.length - 2]
    const current = trendRows[trendRows.length - 1]
    const quantityChange = percentChange(previous.quantity, current.quantity)
    const amountChange = percentChange(previous.amount, current.amount)
    insights.push({
      type: quantityChange !== null && quantityChange < 0 ? 'warning' : 'positive',
      title: 'Latest period trend',
      detail: `Latest period ${current.period}: quantity ${current.quantity}, amount ${current.amount.toFixed(2)}. Compared with ${previous.period}, quantity change is ${formatPercentForInsight(quantityChange)} and amount change is ${formatPercentForInsight(amountChange)}.`,
    })
  }

  const topCategory = categoryRows[0]
  if (topCategory) {
    insights.push({
      type: 'info',
      title: 'Leading category',
      detail: `${topCategory.label} ranks first by quantity with ${topCategory.quantity} units across ${topCategory.buyerCount} customers.`,
    })
  }

  const topBusinessScope = businessRows[0]
  if (topBusinessScope) {
    insights.push({
      type: 'info',
      title: 'Business type contribution',
      detail: `${topBusinessScope.label} contributes the largest matched quantity: ${topBusinessScope.quantity} units from ${topBusinessScope.buyerCount} customers.`,
    })
  }

  return insights.slice(0, 6)
}

function compactText(value: string | null | undefined, maxLength = 220): string | null {
  const text = value?.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function profileName(userId: string | null | undefined, profiles: Map<string, ProfileRow>): string | null {
  if (!userId) return null
  const profile = profiles.get(userId)
  return profile?.full_name || profile?.email || userId
}

function normalizeRole(row: UserRoleRelationRow): RoleRow | null {
  if (Array.isArray(row.role)) return row.role[0] ?? null
  return row.role ?? null
}

async function readOptionalTable(supabase: SupabaseClientInstance, config: OptionalTableConfig): Promise<OptionalTableRead> {
  const tableName = config.sourceTable ?? config.table
  try {
    let query = supabase.from(tableName).select(config.select)
    if (config.notNullColumn) {
      query = query.not(config.notNullColumn, 'is', null)
    }
    if (config.orderBy) {
      query = query.order(config.orderBy, { ascending: config.ascending ?? false })
    }
    if (config.limit) {
      query = query.limit(config.limit)
    }
    const result = await query
    if (result.error) {
      return { table: config.table, rows: [], error: result.error.message }
    }
    return { table: config.table, rows: (((result.data ?? []) as unknown) as Record<string, unknown>[]).filter(Boolean) }
  } catch (error) {
    return { table: config.table, rows: [], error: error instanceof Error ? error.message : 'Unknown read error' }
  }
}

function compactUnknownValue(value: unknown, maxLength = 260): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return compactText(value, maxLength)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactUnknownValue(item, Math.floor(maxLength / 2)))
  if (typeof value === 'object') {
    try {
      return compactText(JSON.stringify(value), maxLength)
    } catch {
      return '[unserializable object]'
    }
  }
  return compactText(String(value), maxLength)
}

function compactRow(row: Record<string, unknown>, maxLength = 260): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, compactUnknownValue(value, maxLength)]))
}

function optionalRows(reads: OptionalTableRead[], table: string, limit = 160): Record<string, unknown>[] {
  return (reads.find((item) => item.table === table)?.rows ?? []).slice(0, limit).map((row) => compactRow(row))
}

async function readOptionalSystemTables(supabase: SupabaseClientInstance): Promise<OptionalTableRead[]> {
  const configs: OptionalTableConfig[] = [
    { table: 'permissions', select: 'id, code, module, action, description, created_at, updated_at', orderBy: 'module', ascending: true, limit: 2000 },
    { table: 'role_permission_relations', select: 'role_id, permission_id, created_at', orderBy: 'created_at', limit: 5000 },
    { table: 'operation_logs', select: 'id, actor_id, module, entity_type, entity_id, action, before_data, after_data, meta, created_at', orderBy: 'created_at', limit: 500 },
    { table: 'login_logs', select: 'id, user_id, email, result, ip, user_agent, created_at', orderBy: 'created_at', limit: 500 },
    { table: 'app_uploaded_files', select: 'id, owner_id, bucket_id, object_path, file_name, mime_type, size_bytes, created_at', orderBy: 'created_at', limit: 1000 },
    { table: 'dictionary_items', select: 'id, dictionary_type, code, label, sort_order, is_active, created_at, updated_at', orderBy: 'dictionary_type', ascending: true, limit: 3000 },
    { table: 'lead_attachments', select: 'id, lead_id, file_record_id, file_name, object_path, uploaded_by, uploaded_at', orderBy: 'uploaded_at', limit: 1000 },
    { table: 'lead_assignment_logs', select: 'id, lead_id, from_user_id, to_user_id, action, reason, assigned_by, assigned_at', orderBy: 'assigned_at', limit: 1500 },
    { table: 'lead_status_logs', select: 'id, lead_id, from_status, to_status, reason, lost_reason_code, changed_by, changed_at', orderBy: 'changed_at', limit: 1500 },
    { table: 'onboarding_steps', select: 'id, onboarding_case_id, step_code, step_name, step_order, status, assignee_id, due_at, completed_at, remarks, created_at, updated_at', orderBy: 'updated_at', limit: 2000 },
    { table: 'onboarding_documents', select: 'id, onboarding_case_id, doc_type, file_record_id, file_name, object_path, version_no, is_latest, submitted_by, submitted_at, review_status, reviewed_by, reviewed_at, review_comment', orderBy: 'submitted_at', limit: 1500 },
    { table: 'onboarding_reviews', select: 'id, onboarding_case_id, document_id, decision, comment, reviewer_id, reviewed_at, created_at', orderBy: 'reviewed_at', limit: 1500 },
    { table: 'onboarding_status_logs', select: 'id, onboarding_case_id, from_status, to_status, reason, changed_by, changed_at', orderBy: 'changed_at', limit: 1500 },
    { table: 'project_members', select: 'id, project_id, user_id, role_in_project, is_active, joined_at, left_at', orderBy: 'joined_at', limit: 2000 },
    { table: 'project_milestones', select: 'id, project_id, title, description, planned_date, actual_date, owner_id, status, progress, sort_order, created_at, updated_at', orderBy: 'updated_at', limit: 2000 },
    { table: 'project_status_logs', select: 'id, project_id, from_status, to_status, reason, changed_by, changed_at', orderBy: 'changed_at', limit: 1500 },
    { table: 'project_updates', select: 'id, project_id, summary, detail, shared_with_bd, created_by, created_at', orderBy: 'created_at', limit: 1500 },
    { table: 'report_exports', select: 'id, module, filters, status, requested_by, file_record_id, requested_at, completed_at', orderBy: 'requested_at', limit: 500 },
    {
      table: 'deleted_leads',
      sourceTable: 'leads',
      select:
        'id, lead_code, company_name, contact_person, contact_phone, contact_email, industry, region, city, source, intent_package, intent_level, estimated_value, status, assigned_bd_id, next_followup_at, last_followup_at, deleted_at, deleted_by, created_at, updated_at',
      notNullColumn: 'deleted_at',
      orderBy: 'deleted_at',
      limit: 500,
    },
    {
      table: 'deleted_sales_orders',
      sourceTable: 'sales_orders',
      select:
        'id, order_no, company_name, lead_id, onboard_merchant_id, bd_user_id, sold_at, payment_method, payment_top_term, note, deleted_at, deleted_by, created_at, updated_at, items:sales_order_items(id, category, product_name, quantity, unit_price, created_at)',
      notNullColumn: 'deleted_at',
      orderBy: 'deleted_at',
      limit: 500,
    },
    {
      table: 'deleted_projects',
      sourceTable: 'projects',
      select:
        'id, project_code, onboarding_case_id, signed_record_id, lead_id, name, description, status, pm_owner_id, bd_owner_id, start_date, target_end_date, actual_end_date, completion_rate, is_delayed, delay_reason, deleted_at, deleted_by, created_at, updated_at',
      notNullColumn: 'deleted_at',
      orderBy: 'deleted_at',
      limit: 500,
    },
    {
      table: 'deleted_onboard_merchants',
      sourceTable: 'onboard_merchants',
      select:
        'id, merchant_no, lead_id, company_name, onboarding_type, contact_person, contact_phone, contact_email, region, city, address, bd_owner_id, remarks, onboarded_at, deleted_at, deleted_by, created_at, updated_at',
      notNullColumn: 'deleted_at',
      orderBy: 'deleted_at',
      limit: 500,
    },
  ]

  return Promise.all(configs.map((config) => readOptionalTable(supabase, config)))
}

function buildSystemWideContext(reads: OptionalTableRead[]) {
  const readErrors = reads
    .filter((item) => item.error)
    .map((item) => ({
      table: item.table,
      error: item.error,
    }))
  const rowCounts = Object.fromEntries(reads.map((item) => [item.table, item.rows.length]))

  return {
    accessAndConfiguration: {
      permissions: optionalRows(reads, 'permissions', 400),
      rolePermissionRelations: optionalRows(reads, 'role_permission_relations', 800),
      dictionaryItems: optionalRows(reads, 'dictionary_items', 800),
    },
    auditAndFiles: {
      operationLogs: optionalRows(reads, 'operation_logs', 180),
      loginLogs: optionalRows(reads, 'login_logs', 180),
      uploadedFiles: optionalRows(reads, 'app_uploaded_files', 240),
      reportExports: optionalRows(reads, 'report_exports', 160),
    },
    leadLifecycle: {
      attachments: optionalRows(reads, 'lead_attachments', 240),
      assignmentLogs: optionalRows(reads, 'lead_assignment_logs', 300),
      statusLogs: optionalRows(reads, 'lead_status_logs', 300),
    },
    onboardingWorkflow: {
      steps: optionalRows(reads, 'onboarding_steps', 320),
      documents: optionalRows(reads, 'onboarding_documents', 260),
      reviews: optionalRows(reads, 'onboarding_reviews', 220),
      statusLogs: optionalRows(reads, 'onboarding_status_logs', 260),
    },
    projectExecution: {
      members: optionalRows(reads, 'project_members', 320),
      milestones: optionalRows(reads, 'project_milestones', 320),
      statusLogs: optionalRows(reads, 'project_status_logs', 260),
      updates: optionalRows(reads, 'project_updates', 260),
    },
    recentlyDeleted: {
      leads: optionalRows(reads, 'deleted_leads', 160),
      salesOrders: optionalRows(reads, 'deleted_sales_orders', 160),
      projects: optionalRows(reads, 'deleted_projects', 160),
      onboardMerchants: optionalRows(reads, 'deleted_onboard_merchants', 160),
    },
    coverage: {
      requestedTables: SYSTEM_WIDE_READABLE_TABLES,
      readableTables: reads.filter((item) => !item.error).map((item) => item.table),
      inaccessibleTables: readErrors,
      rowCounts,
    },
  }
}

function buildProductDetailRows(
  facts: PurchaseItemFact[],
  limit: number,
  params?: { customerKeyword?: string; productKeyword?: string; keywords: string[] },
) {
  return facts
    .slice()
    .sort((left, right) => {
      const leftScore = params ? computeFactMatchScore(left, params) : 0
      const rightScore = params ? computeFactMatchScore(right, params) : 0
      if (rightScore !== leftScore) return rightScore - leftScore
      return new Date(right.soldAt).getTime() - new Date(left.soldAt).getTime() || right.amount - left.amount || right.quantity - left.quantity
    })
    .slice(0, Math.max(80, limit * 20))
    .map((fact) => ({
      orderNo: fact.orderNo,
      customer: fact.companyName,
      soldAt: fact.soldAt,
      category: fact.category,
      productModel: fact.productName,
      quantity: fact.quantity,
      unitPrice: fact.unitPrice,
      amount: fact.amount,
      paymentMethod: fact.paymentMethod,
      paymentTopTerm: fact.paymentTopTerm,
      salesNote: compactText(fact.salesNote, 160),
    }))
}

function buildFactScoreMap(
  facts: PurchaseItemFact[],
  params: { customerKeyword?: string; productKeyword?: string; keywords: string[] },
): Map<string, number> {
  const scores = new Map<string, number>()
  for (const fact of facts) {
    const score = computeFactMatchScore(fact, params)
    if (score <= 0) continue
    const prev = scores.get(fact.customerKey) ?? 0
    if (score > prev) scores.set(fact.customerKey, score)
  }
  return scores
}

function buildCustomerContextRows(
  rows: DataQaCustomerResult[],
  leadsById: Map<string, LeadDetailRow>,
  followupsByLeadId: Map<string, LeadFollowupRow[]>,
  merchantActivitiesByMerchantId: Map<string, OnboardMerchantActivityRow[]>,
  profiles: Map<string, ProfileRow>,
  limit: number,
) {
  return rows.slice(0, Math.max(80, limit * 12)).map((row) => {
    const [source, rawId] = row.customerKey.split(':')
    const id = rawId ?? ''
    const lead = source === 'lead' ? leadsById.get(id) ?? null : null
    const followups = lead ? followupsByLeadId.get(lead.id) ?? [] : []
    return {
      customerKey: row.customerKey,
      companyName: row.companyName,
      businessScope: row.businessScope,
      contactPerson: lead?.contact_person ?? null,
      contactPhone: lead?.contact_phone ?? null,
      contactEmail: lead?.contact_email ?? null,
      industry: lead?.industry ?? null,
      region: lead?.region ?? null,
      city: lead?.city ?? null,
      address: lead?.address ?? null,
      source: lead?.source ?? null,
      leadStatus: lead?.status ?? null,
      intentLevel: lead?.intent_level ?? null,
      estimatedValue: lead?.estimated_value ?? null,
      assignedBd: profileName(lead?.assigned_bd_id, profiles),
      nextFollowupAt: lead?.next_followup_at ?? null,
      lastFollowupAt: lead?.last_followup_at ?? null,
      bdNotes: compactText(lead?.bd_notes),
      teamAttentionNote: compactText(lead?.team_attention_note),
      salesQuantity: row.quantity,
      salesAmount: row.amount,
      orderCount: row.orderCount,
      recentFollowups: followups.slice(0, 8).map((item) => ({
        type: item.followup_type,
        summary: compactText(item.summary),
        followupAt: item.followup_at,
        nextFollowupAt: item.next_followup_at,
        bdNotes: compactText(item.bd_notes, 160),
        teamAttentionNote: compactText(item.team_attention_note, 160),
        statusSnapshot: item.status_snapshot,
        createdBy: profileName(item.created_by, profiles),
      })),
      recentMerchantActivities:
        source === 'merchant'
          ? (merchantActivitiesByMerchantId.get(id) ?? []).slice(0, 8).map((item) => ({
              type: item.activity_type,
              status: item.status,
              title: item.title,
              detail: compactText(item.detail),
              activityAt: item.activity_at,
              scheduledAt: item.scheduled_at,
              assignee: profileName(item.assignee_id, profiles),
            }))
          : [],
    }
  })
}

function buildLeadContextRows(
  leads: LeadDetailRow[],
  followupsByLeadId: Map<string, LeadFollowupRow[]>,
  profiles: Map<string, ProfileRow>,
  limit: number,
  hints: { customerKeyword?: string; keywords: string[] },
) {
  return leads
    .filter((lead) => {
      const anchor = hints.customerKeyword ?? hints.keywords[0]
      if (!anchor) return true
      const searchable = `${lead.company_name} ${lead.contact_person ?? ''} ${lead.lead_code} ${lead.contact_phone ?? ''} ${lead.contact_email ?? ''}`
      if (includesLoose(searchable, anchor)) return true
      return hints.keywords.length === 0 || hints.keywords.some((item) => includesLoose(searchable, item))
    })
    .slice(0, Math.max(80, limit * 12))
    .map((lead) => ({
      customerKey: `lead:${lead.id}`,
      companyName: lead.company_name,
      businessScope: lead.intent_package === 'BCS' ? 'BCS' : lead.intent_package === 'BOTH' ? 'BOTH' : 'NON_BCS',
      contactPerson: lead.contact_person ?? null,
      contactPhone: lead.contact_phone ?? null,
      contactEmail: lead.contact_email ?? null,
      industry: lead.industry ?? null,
      region: lead.region ?? null,
      city: lead.city ?? null,
      address: lead.address ?? null,
      source: lead.source ?? null,
      leadStatus: lead.status ?? null,
      intentLevel: lead.intent_level ?? null,
      estimatedValue: lead.estimated_value ?? null,
      assignedBd: profileName(lead.assigned_bd_id, profiles),
      nextFollowupAt: lead.next_followup_at ?? null,
      lastFollowupAt: lead.last_followup_at ?? null,
      bdNotes: compactText(lead.bd_notes),
      teamAttentionNote: compactText(lead.team_attention_note),
      salesQuantity: 0,
      salesAmount: 0,
      orderCount: 0,
      recentFollowups: (followupsByLeadId.get(lead.id) ?? []).slice(0, 8).map((item) => ({
        type: item.followup_type,
        summary: compactText(item.summary),
        followupAt: item.followup_at,
        nextFollowupAt: item.next_followup_at,
        bdNotes: compactText(item.bd_notes, 160),
        teamAttentionNote: compactText(item.team_attention_note, 160),
        statusSnapshot: item.status_snapshot,
        createdBy: profileName(item.created_by, profiles),
      })),
      recentMerchantActivities: [],
    }))
}

function buildReminderRows(
  leads: LeadDetailRow[],
  followups: LeadFollowupRow[],
  notifications: NotificationRow[],
  profiles: Map<string, ProfileRow>,
) {
  const now = Date.now()
  const followupReminders = leads
    .filter((lead) => lead.next_followup_at)
    .sort((left, right) => new Date(left.next_followup_at ?? 0).getTime() - new Date(right.next_followup_at ?? 0).getTime())
    .slice(0, 40)
    .map((lead) => ({
      source: 'lead_next_followup',
      leadCode: lead.lead_code,
      companyName: lead.company_name,
      dueAt: lead.next_followup_at,
      isOverdue: lead.next_followup_at ? new Date(lead.next_followup_at).getTime() < now : false,
      assignedBd: profileName(lead.assigned_bd_id, profiles),
      status: lead.status,
    }))

  const arrangedFromFollowups = followups
    .filter((item) => item.next_followup_at)
    .sort((left, right) => new Date(left.next_followup_at ?? 0).getTime() - new Date(right.next_followup_at ?? 0).getTime())
    .slice(0, 40)
    .map((item) => ({
      source: 'followup_next_followup',
      leadId: item.lead_id,
      dueAt: item.next_followup_at,
      isOverdue: item.next_followup_at ? new Date(item.next_followup_at).getTime() < now : false,
      previousFollowupAt: item.followup_at,
      summary: compactText(item.summary, 160),
      createdBy: profileName(item.created_by, profiles),
    }))

  const notificationReminders = notifications.slice(0, 40).map((item) => ({
    source: 'notification',
    type: item.type,
    title: item.title,
    body: compactText(item.body, 180),
    entityType: item.entity_type,
    entityId: item.entity_id,
    isRead: item.is_read,
    createdAt: item.created_at,
    owner: profileName(item.user_id, profiles),
  }))

  return [...followupReminders, ...arrangedFromFollowups, ...notificationReminders].slice(0, 90)
}

async function callAiChat(messages: Array<{ role: 'system' | 'user'; content: string }>, ai: AiConfig, jsonMode = false): Promise<string> {
  const response = await fetch(ai.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ai.model,
      messages,
      max_tokens: jsonMode ? 900 : 2200,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${ai.provider} request failed: ${response.status} ${text}`)
  }

  const payload = await response.json()
  return String(payload.choices?.[0]?.message?.content ?? '').trim()
}

async function parseQuestionWithAi(question: string, conversation: ConversationMessage[], ai: AiConfig): Promise<ParsedQuestion> {
  const conversationPrompt = toConversationPrompt(conversation)
  const content = await callAiChat(
    [
      {
        role: 'system',
        content:
          'You convert business-data questions into strict JSON only. The only hard restriction is no database write action: never request create, edit, update, delete, assign, reassign, import, restore, or archive operations. For all read-only questions, be permissive and analytical. Supported intents: purchase_summary, buyer_count, top_customer, top_customers, quantity_total, amount_total, order_count, category_ranking, business_scope_breakdown, trend_analysis, deep_analysis, unsupported. Use trend_analysis for trend/走势/趋势/环比 questions. Use deep_analysis for any broad or ambiguous business question including customer profiles, leads, BD/sales owner, visit/follow-up records, reminders, onboarding, signed records, projects/tasks, user/role ownership, permissions, system configuration/dictionaries, audit/login/operation logs, files, report exports, recently deleted records, and product model/SKU/size/price lookups. Supported categories: ENGINE_OIL, CHEMICAL, TIRE, WIPER, THREE_FILTERS, BATTERY, BRAKE_PAD, CAR_BEAUTY, WINDOW_FILM, BOSCH_ACCESSORY, X_OWL. If the user says accessories/配件/aksesori without a precise category, set categoryGroup to ACCESSORY. Supported businessScope: BCS, BOTH, NON_BCS. Supported datePreset: today, yesterday, last_7_days, last_30_days, last_90_days, this_month, last_month, this_year. Supported trendGranularity: day, week, month. Extract customerKeyword and productKeyword when present, and keywords as an array for company/model/SKU/size/person/lead/project/BD/user/permission/file/report/log/deleted tokens. If the current user question is short/ambiguous follow-up, resolve missing filters and entities from conversation context. When business relevance is plausible, prefer deep_analysis instead of unsupported. Only use unsupported for requests clearly unrelated to business operations/data. Return JSON with keys: intent, category, categoryGroup, businessScope, datePreset, trendGranularity, customerKeyword, productKeyword, keywords, limit.',
      },
      {
        role: 'user',
        content:
          `${conversationPrompt ? `Conversation context:\n${conversationPrompt}\n\n` : ''}Current question:\n${question.slice(0, MAX_QUESTION_CHARS)}`,
      },
    ],
    ai,
    true,
  )

  try {
    return sanitizeParsedQuestion(JSON.parse(content))
  } catch {
    return sanitizeParsedQuestion({ intent: 'purchase_summary', limit: 5 })
  }
}

async function generateFinalAnswer(
  question: string,
  answer: DataQaAnswer,
  ai: AiConfig,
  conversation: ConversationMessage[],
  retrievalContext: {
    productDetails: unknown[]
    customerContexts: unknown[]
    reminders: unknown[]
    tireCatalog: unknown[]
    organizationUsers: unknown[]
    onboardMerchants: unknown[]
    onboardingCases: unknown[]
    projects: unknown[]
    signedContracts: unknown[]
    systemWideContext: unknown
    datasetOverview: unknown
  },
): Promise<string> {
  const conversationPrompt = toConversationPrompt(conversation)
  const safeResult = {
    question,
    intent: answer.intent,
    filters: answer.filters,
    buyerCount: answer.buyerCount,
    totalQuantity: answer.totalQuantity,
    totalAmount: answer.totalAmount,
    totalOrderCount: answer.totalOrderCount,
    topCustomer: answer.topCustomer,
    rows: answer.rows.slice(0, answer.filters.limit),
    breakdownRows: answer.breakdownRows.slice(0, answer.filters.limit),
    trendRows: answer.trendRows.slice(-12),
    insights: answer.insights,
    dataQuality: answer.dataQuality,
    assumptions: answer.assumptions,
    conversationContextUsed: conversation.length > 0,
    retrievalContext,
  }

  return callAiChat(
    [
      {
        role: 'system',
        content:
          'You answer questions using only the provided JSON result and retrievalContext. Think through the user intent internally before answering, connect related entities across tables, and provide a concise reasoning summary without exposing hidden chain-of-thought. The only hard restriction is read-only safety: never modify, create, delete, assign, reassign, update, import, restore, or archive any lead/customer/follow-up/sales/project/user data, and tell the user you cannot edit data if asked. Everything else that is read-only is allowed: lookup, compare, summarize, segment, rank, calculate, infer likely scope from context, identify risks, and propose human next actions. Use productDetails for product model/SKU, unit price, amount, payment, and order-note analysis. Use customerContexts for customer contact/profile, BD owner, lead status, notes, visit/follow-up history, and merchant activity analysis. Use reminders for visit/follow-up/payment reminder analysis. Use tireCatalog for standard tire model and quoted price references. Use organizationUsers for BD/salesperson ownership and role analysis. Use onboardMerchants, onboardingCases, signedContracts, and projects for full-funnel lifecycle analysis from lead -> signed -> onboarding -> project delivery. Use systemWideContext for every other system corner: RBAC permissions, dictionary/config items, operation/login audit logs, uploaded-file metadata, report exports, lead attachments/assignment/status logs, onboarding steps/documents/reviews/status logs, project members/milestones/status logs/updates, and recently-deleted leads/sales/projects/merchants. For analytical questions, explain trend direction, key drivers, risks, anomalies, opportunities, and recommended next steps, but every factual claim must be grounded in provided data. If a question is ambiguous, answer using the best supported interpretation from conversation/data and mention important alternatives or missing filters. Mention filter scope and caveats when assumptions exist. If retrievalContext.datasetOverview or systemWideContext.coverage reports inaccessible tables, mention that those specific tables were not readable under the current user permission instead of pretending they were analyzed. Keep the answer in the same language as the user question when possible. Respect conversation context to maintain continuity when relevant, but never invent facts outside the provided JSON. If the question is purchase-metric specific and matched sales rows are zero, state that clearly; otherwise continue answering from the broader system contexts. Format output in clean Markdown: short headings, bullet points, and concise tables where useful.',
      },
      {
        role: 'user',
        content: `${conversationPrompt ? `Conversation context:\n${conversationPrompt}\n\n` : ''}Question: ${question}\nSafe result JSON: ${JSON.stringify(safeResult)}`,
      },
    ],
    ai,
    false,
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseClientKey = resolveSupabaseClientKey()
    const ai = resolveAiConfig()
    if (!supabaseUrl || !supabaseClientKey) {
      return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    }

    const authorization = request.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Not authenticated' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseClientKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const userResult = await supabase.auth.getUser()
    if (userResult.error || !userResult.data.user) {
      return jsonResponse({ error: 'Not authenticated' }, 401)
    }

    // Access is relaxed to any authenticated user.
    // Data visibility is still protected by RLS and explicit read-only query paths below.

    const body = await request.json().catch(() => ({}))
    const question = String(body.question ?? '').trim()
    const conversation = sanitizeConversation((body as Record<string, unknown>).conversation)
    if (!question) {
      return jsonResponse({ error: 'Question is required' }, 400)
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return jsonResponse({ error: 'Question is too long' }, 400)
    }

    const parsed = await parseQuestionWithAi(question, conversation, ai)
    if (parsed.intent === 'unsupported' && hasBroadBusinessSignal(question, conversation)) {
      parsed.intent = 'deep_analysis'
    }
    const extractedHints = extractSearchHints(question)
    const customerKeyword = parsed.customerKeyword ?? extractedHints.customerKeyword
    const productKeyword = parsed.productKeyword ?? extractedHints.productKeyword
    const keywords = Array.from(new Set([...(parsed.keywords ?? []), ...extractedHints.keywords])).slice(0, 8)
    const filters: DataQaFilters = {
      category: parsed.category,
      categoryGroup: parsed.categoryGroup,
      businessScope: parsed.businessScope,
      ...resolveDateRange(parsed.datePreset),
      trendGranularity: parsed.trendGranularity,
      limit: parsed.limit ?? 5,
    }
    const assumptions: string[] = []
    // Keep full-range analysis unless user explicitly specifies date scope.
    if (!filters.category && !filters.categoryGroup) assumptions.push('CATEGORY_ALL')
    if (!filters.dateFrom && !filters.dateTo) assumptions.push('DATE_ALL')
    if (customerKeyword || productKeyword || keywords.length > 0) assumptions.push('SEARCH_KEYWORD_FILTER_ENABLED')
    if (conversation.length > 0) assumptions.push('CONVERSATION_CONTEXT_USED')
    if (parsed.intent === 'deep_analysis' && hasBroadBusinessSignal(question, conversation)) assumptions.push('WIDE_CONTEXT_UNDERSTANDING_ENABLED')

    const [
      ordersResult,
      leadsResult,
      followupsResult,
      merchantActivitiesResult,
      notificationsResult,
      profilesResult,
      tireCatalogResult,
      merchantsResult,
      signedRecordsResult,
      onboardingCasesResult,
      projectsResult,
      projectTasksResult,
      userRolesResult,
      optionalSystemReads,
    ] = await Promise.all([
      supabase
        .from('sales_orders')
        .select(
          [
            'id, order_no, company_name, lead_id, onboard_merchant_id, bd_user_id, sold_at, payment_method, payment_top_term, note, created_at',
            'lead:leads(id, lead_code, company_name, status, intent_package, assigned_bd_id, created_at)',
            'onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type, lead_id, bd_owner_id)',
            'items:sales_order_items(id, sales_order_id, category, product_name, quantity, unit_price, created_at)',
          ].join(', '),
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('leads')
        .select(
          'id, lead_code, company_name, contact_person, contact_phone, contact_email, industry, region, city, address, source, intent_package, bd_notes, team_attention_note, intent_level, estimated_value, status, assigned_bd_id, next_followup_at, last_followup_at, created_at, updated_at',
        )
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(3000),
      supabase
        .from('lead_followups')
        .select('id, lead_id, followup_type, summary, followup_at, next_followup_at, bd_notes, team_attention_note, status_snapshot, created_by, created_at')
        .order('followup_at', { ascending: false })
        .limit(3000),
      supabase
        .from('onboard_merchant_activities')
        .select('id, merchant_id, activity_type, status, title, detail, activity_at, scheduled_at, assignee_id, related_sales_order_id, created_at')
        .is('deleted_at', null)
        .order('activity_at', { ascending: false })
        .limit(3000),
      supabase
        .from('notifications')
        .select('id, user_id, type, title, body, entity_type, entity_id, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('profiles').select('id, email, full_name, locale, timezone, is_active, created_at, updated_at').is('deleted_at', null).limit(3000),
      supabase
        .from('tire_price_catalog')
        .select('sap_code, size, description, load_index, speed_symbol, category, price_incl_vat, model_label')
        .eq('is_active', true)
        .order('model_label', { ascending: true })
        .limit(600),
      supabase
        .from('onboard_merchants')
        .select('id, merchant_no, lead_id, company_name, onboarding_type, contact_person, contact_phone, contact_email, region, city, address, bd_owner_id, remarks, onboarded_at, created_at, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(3000),
      supabase
        .from('signed_records')
        .select('id, lead_id, contract_no, contract_date, contract_value, contract_currency, contract_package, signed_by, signed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(3000),
      supabase
        .from('onboarding_cases')
        .select('id, case_no, signed_record_id, status, owner_user_id, reviewer_user_id, sla_due_at, started_at, completed_at, rejected_at, remarks, created_at, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(3000),
      supabase
        .from('projects')
        .select('id, project_code, onboarding_case_id, signed_record_id, lead_id, name, description, status, pm_owner_id, bd_owner_id, start_date, target_end_date, actual_end_date, completion_rate, is_delayed, delay_reason, closed_at, created_at, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(3000),
      supabase
        .from('project_tasks')
        .select('id, project_id, title, description, status, priority, assignee_id, start_date, due_date, completed_at, progress, created_at, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5000),
      supabase
        .from('user_role_relations')
        .select('user_id, role_id, role:roles(id, code, name)')
        .limit(5000),
      readOptionalSystemTables(supabase),
    ])

    if (ordersResult.error) throw ordersResult.error
    if (leadsResult.error) throw leadsResult.error
    if (followupsResult.error) throw followupsResult.error
    if (merchantActivitiesResult.error) throw merchantActivitiesResult.error
    if (notificationsResult.error) throw notificationsResult.error
    if (profilesResult.error) throw profilesResult.error
    if (tireCatalogResult.error) throw tireCatalogResult.error
    if (merchantsResult.error) throw merchantsResult.error
    if (signedRecordsResult.error) throw signedRecordsResult.error
    if (onboardingCasesResult.error) throw onboardingCasesResult.error
    if (projectsResult.error) throw projectsResult.error
    if (projectTasksResult.error) throw projectTasksResult.error
    if (userRolesResult.error) throw userRolesResult.error

    const allFacts = buildFacts((ordersResult.data ?? []) as unknown as SalesOrderRow[])
    const shouldApplyKeywordFilter = customerKeyword || productKeyword || keywords.length > 0
    const facts = allFacts.filter((fact) => {
      if (filters.category && fact.category !== filters.category) return false
      if (filters.categoryGroup === 'ACCESSORY' && !isAccessoryCategory(fact.category)) return false
      if (filters.businessScope && fact.businessScope !== filters.businessScope) return false
      if (!isInDateRange(fact.soldAt, filters.dateFrom, filters.dateTo)) return false
      if (!shouldApplyKeywordFilter) return true
      return matchesFactByKeywords(fact, { customerKeyword, productKeyword, keywords })
    })
    const factScoreByCustomerKey = buildFactScoreMap(facts, { customerKeyword, productKeyword, keywords })

    const aggregate = new Map<string, DataQaCustomerResult & { orderIds: Set<string> }>()
    for (const fact of facts) {
      const row = aggregate.get(fact.customerKey) ?? {
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
      if (!row.lastSoldAt || new Date(fact.soldAt).getTime() > new Date(row.lastSoldAt).getTime()) row.lastSoldAt = fact.soldAt
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
      .sort((left, right) => {
        const scoreGap = (factScoreByCustomerKey.get(right.customerKey) ?? 0) - (factScoreByCustomerKey.get(left.customerKey) ?? 0)
        if (scoreGap !== 0) return scoreGap
        return right.quantity - left.quantity || right.amount - left.amount || left.companyName.localeCompare(right.companyName)
      })
    const orderIds = new Set(facts.map((fact) => fact.orderId))
    const totals = {
      buyerCount: rows.length,
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      totalOrderCount: orderIds.size,
    }
    const trendRows = buildTrendRows(facts, resolveTrendGranularity(filters))
    const categoryRows = buildBreakdownRows(facts, 'category')
    const businessRows = buildBreakdownRows(facts, 'businessScope')
    const breakdownRows =
      parsed.intent === 'category_ranking'
        ? categoryRows
        : parsed.intent === 'business_scope_breakdown'
          ? businessRows
          : parsed.intent === 'deep_analysis'
            ? categoryRows
          : []
    const insights = buildSystemInsights(rows, trendRows, categoryRows, businessRows, totals)
    const leads = (leadsResult.data ?? []) as LeadDetailRow[]
    const followups = (followupsResult.data ?? []) as LeadFollowupRow[]
    const merchantActivities = (merchantActivitiesResult.data ?? []) as OnboardMerchantActivityRow[]
    const notifications = (notificationsResult.data ?? []) as NotificationRow[]
    const merchants = (merchantsResult.data ?? []) as OnboardMerchantRow[]
    const signedRecords = (signedRecordsResult.data ?? []) as SignedRecordRow[]
    const onboardingCases = (onboardingCasesResult.data ?? []) as OnboardingCaseRow[]
    const projects = (projectsResult.data ?? []) as ProjectRow[]
    const projectTasks = (projectTasksResult.data ?? []) as ProjectTaskRow[]
    const userRoles = (userRolesResult.data ?? []) as UserRoleRelationRow[]
    const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
    const tireCatalog = (tireCatalogResult.data ?? []) as TirePriceCatalogRow[]
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
    const signedRecordsById = new Map(signedRecords.map((item) => [item.id, item]))
    const onboardingCasesById = new Map(onboardingCases.map((item) => [item.id, item]))
    const followupsByLeadId = new Map<string, LeadFollowupRow[]>()
    for (const followup of followups) {
      const group = followupsByLeadId.get(followup.lead_id) ?? []
      group.push(followup)
      followupsByLeadId.set(followup.lead_id, group)
    }
    const merchantActivitiesByMerchantId = new Map<string, OnboardMerchantActivityRow[]>()
    for (const activity of merchantActivities) {
      const group = merchantActivitiesByMerchantId.get(activity.merchant_id) ?? []
      group.push(activity)
      merchantActivitiesByMerchantId.set(activity.merchant_id, group)
    }
    const projectTasksByProjectId = new Map<string, ProjectTaskRow[]>()
    for (const task of projectTasks) {
      const group = projectTasksByProjectId.get(task.project_id) ?? []
      group.push(task)
      projectTasksByProjectId.set(task.project_id, group)
    }
    const rolesByUserId = new Map<string, string[]>()
    for (const relation of userRoles) {
      const role = normalizeRole(relation)
      if (!role) continue
      const group = rolesByUserId.get(relation.user_id) ?? []
      group.push(role.code)
      rolesByUserId.set(relation.user_id, Array.from(new Set(group)))
    }
    const leadCountByUserId = new Map<string, number>()
    for (const lead of leads) {
      if (!lead.assigned_bd_id) continue
      leadCountByUserId.set(lead.assigned_bd_id, (leadCountByUserId.get(lead.assigned_bd_id) ?? 0) + 1)
    }
    const salesOrderCountByUserId = new Map<string, number>()
    for (const fact of allFacts) {
      salesOrderCountByUserId.set(fact.bdUserId, (salesOrderCountByUserId.get(fact.bdUserId) ?? 0) + 1)
    }
    const merchantCountByUserId = new Map<string, number>()
    for (const merchant of merchants) {
      if (!merchant.bd_owner_id) continue
      merchantCountByUserId.set(merchant.bd_owner_id, (merchantCountByUserId.get(merchant.bd_owner_id) ?? 0) + 1)
    }
    const pmProjectCountByUserId = new Map<string, number>()
    for (const project of projects) {
      if (project.pm_owner_id) pmProjectCountByUserId.set(project.pm_owner_id, (pmProjectCountByUserId.get(project.pm_owner_id) ?? 0) + 1)
      if (project.bd_owner_id) pmProjectCountByUserId.set(project.bd_owner_id, (pmProjectCountByUserId.get(project.bd_owner_id) ?? 0) + 1)
    }
    const matchedLeadIds = new Set(facts.map((fact) => fact.leadId).filter((id): id is string => Boolean(id)))
    const matchedMerchantIds = new Set(facts.map((fact) => fact.onboardMerchantId).filter((id): id is string => Boolean(id)))
    const enrichedCustomerContexts =
      rows.length > 0
        ? buildCustomerContextRows(rows, leadsById, followupsByLeadId, merchantActivitiesByMerchantId, profiles, filters.limit)
        : buildLeadContextRows(leads, followupsByLeadId, profiles, filters.limit, { customerKeyword, keywords })

    const organizationUsers = [...profiles.values()]
      .filter((profile) => {
        if (!customerKeyword && keywords.length === 0) return true
        const searchable = `${profile.full_name ?? ''} ${profile.email}`
        if (customerKeyword && includesLoose(searchable, customerKeyword)) return true
        return keywords.some((item) => includesLoose(searchable, item))
      })
      .slice(0, 200)
      .map((profile) => ({
        userId: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        locale: profile.locale ?? null,
        timezone: profile.timezone ?? null,
        isActive: profile.is_active ?? null,
        roles: rolesByUserId.get(profile.id) ?? [],
        assignedLeadCount: leadCountByUserId.get(profile.id) ?? 0,
        salesOrderCount: salesOrderCountByUserId.get(profile.id) ?? 0,
        onboardMerchantCount: merchantCountByUserId.get(profile.id) ?? 0,
        projectCount: pmProjectCountByUserId.get(profile.id) ?? 0,
      }))
      .sort((left, right) => right.salesOrderCount - left.salesOrderCount || right.assignedLeadCount - left.assignedLeadCount)

    const onboardMerchantContexts = merchants
      .filter((merchant) => {
        if (!customerKeyword && keywords.length === 0) return true
        const searchable = `${merchant.company_name} ${merchant.merchant_no} ${merchant.contact_person ?? ''}`
        if (customerKeyword && includesLoose(searchable, customerKeyword)) return true
        return keywords.some((item) => includesLoose(searchable, item))
      })
      .slice(0, 200)
      .map((merchant) => ({
        merchantNo: merchant.merchant_no,
        companyName: merchant.company_name,
        onboardingType: merchant.onboarding_type,
        leadCode: merchant.lead_id ? leadsById.get(merchant.lead_id)?.lead_code ?? null : null,
        bdOwner: profileName(merchant.bd_owner_id, profiles),
        contactPerson: merchant.contact_person,
        contactPhone: merchant.contact_phone,
        contactEmail: merchant.contact_email,
        region: merchant.region,
        city: merchant.city,
        address: merchant.address,
        remarks: compactText(merchant.remarks),
        onboardedAt: merchant.onboarded_at,
      }))

    const signedContractContexts = signedRecords
      .filter((record) => {
        if (!customerKeyword && keywords.length === 0) return true
        const lead = leadsById.get(record.lead_id)
        const searchable = `${record.contract_no} ${lead?.company_name ?? ''} ${lead?.lead_code ?? ''}`
        if (customerKeyword && includesLoose(searchable, customerKeyword)) return true
        return keywords.some((item) => includesLoose(searchable, item))
      })
      .slice(0, 200)
      .map((record) => {
        const lead = leadsById.get(record.lead_id)
        return {
          contractNo: record.contract_no,
          contractDate: record.contract_date,
          contractValue: record.contract_value,
          contractCurrency: record.contract_currency,
          contractPackage: record.contract_package ?? null,
          signedAt: record.signed_at,
          leadCode: lead?.lead_code ?? null,
          companyName: lead?.company_name ?? null,
          signedBy: profileName(record.signed_by, profiles),
        }
      })

    const systemWideContext = buildSystemWideContext(optionalSystemReads)

    const onboardingCaseContexts = onboardingCases
      .filter((item) => {
        if (!customerKeyword && keywords.length === 0) return true
        const signed = signedRecordsById.get(item.signed_record_id)
        const lead = signed ? leadsById.get(signed.lead_id) : null
        const searchable = `${item.case_no} ${lead?.company_name ?? ''} ${lead?.lead_code ?? ''} ${signed?.contract_no ?? ''}`
        if (customerKeyword && includesLoose(searchable, customerKeyword)) return true
        return keywords.some((keyword) => includesLoose(searchable, keyword))
      })
      .slice(0, 200)
      .map((item) => {
        const signed = signedRecordsById.get(item.signed_record_id)
        const lead = signed ? leadsById.get(signed.lead_id) : null
        return {
          caseNo: item.case_no,
          status: item.status,
          companyName: lead?.company_name ?? null,
          leadCode: lead?.lead_code ?? null,
          contractNo: signed?.contract_no ?? null,
          owner: profileName(item.owner_user_id, profiles),
          reviewer: profileName(item.reviewer_user_id, profiles),
          slaDueAt: item.sla_due_at,
          startedAt: item.started_at,
          completedAt: item.completed_at,
          rejectedAt: item.rejected_at,
          remarks: compactText(item.remarks),
        }
      })

    const projectContexts = projects
      .filter((project) => {
        if (!customerKeyword && keywords.length === 0) return true
        const onboarding = onboardingCasesById.get(project.onboarding_case_id)
        const signed = onboarding ? signedRecordsById.get(onboarding.signed_record_id) : null
        const lead = signed ? leadsById.get(signed.lead_id) : project.lead_id ? leadsById.get(project.lead_id) ?? null : null
        const searchable = `${project.project_code} ${project.name} ${lead?.company_name ?? ''} ${lead?.lead_code ?? ''}`
        if (customerKeyword && includesLoose(searchable, customerKeyword)) return true
        return keywords.some((keyword) => includesLoose(searchable, keyword))
      })
      .slice(0, 240)
      .map((project) => {
        const tasks = projectTasksByProjectId.get(project.id) ?? []
        const openTasks = tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED').length
        const overdueTasks = tasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < Date.now() && task.status !== 'DONE').length
        const onboarding = onboardingCasesById.get(project.onboarding_case_id)
        const signed = onboarding ? signedRecordsById.get(onboarding.signed_record_id) : null
        const lead = signed ? leadsById.get(signed.lead_id) : project.lead_id ? leadsById.get(project.lead_id) ?? null : null
        return {
          projectCode: project.project_code,
          projectName: project.name,
          status: project.status,
          completionRate: project.completion_rate,
          isDelayed: project.is_delayed,
          delayReason: compactText(project.delay_reason, 120),
          companyName: lead?.company_name ?? null,
          leadCode: lead?.lead_code ?? null,
          pmOwner: profileName(project.pm_owner_id, profiles),
          bdOwner: profileName(project.bd_owner_id, profiles),
          targetEndDate: project.target_end_date,
          actualEndDate: project.actual_end_date,
          openTaskCount: openTasks,
          overdueTaskCount: overdueTasks,
          taskCount: tasks.length,
        }
      })

    const retrievalContext = {
      productDetails: buildProductDetailRows(facts, filters.limit, { customerKeyword, productKeyword, keywords }),
      customerContexts: enrichedCustomerContexts,
      reminders: buildReminderRows(leads, followups, notifications, profiles),
      tireCatalog: tireCatalog
        .filter((row) => {
          if (keywords.length === 0 && !customerKeyword && !productKeyword) return true
          const combined = `${row.model_label} ${row.size} ${row.description} ${row.sap_code ?? ''}`
          const anchor = productKeyword ?? keywords[0]
          if (anchor && !includesLoose(combined, anchor)) return false
          return keywords.length === 0 || keywords.some((keyword) => includesLoose(combined, keyword))
        })
        .sort((left, right) => {
          const anchor = productKeyword ?? keywords[0]
          const leftScore = Math.max(
            computeTextMatchScore(left.model_label, anchor),
            computeTextMatchScore(left.size, anchor),
            computeTextMatchScore(left.description, anchor),
          )
          const rightScore = Math.max(
            computeTextMatchScore(right.model_label, anchor),
            computeTextMatchScore(right.size, anchor),
            computeTextMatchScore(right.description, anchor),
          )
          return rightScore - leftScore || Number(left.price_incl_vat) - Number(right.price_incl_vat)
        })
        .slice(0, 400)
        .map((row) => ({
          modelLabel: row.model_label,
          sapCode: row.sap_code,
          size: row.size,
          description: row.description,
          loadIndex: row.load_index,
          speedSymbol: row.speed_symbol,
          category: row.category,
          priceInclVat: row.price_incl_vat,
        })),
      organizationUsers,
      onboardMerchants: onboardMerchantContexts,
      onboardingCases: onboardingCaseContexts,
      projects: projectContexts,
      signedContracts: signedContractContexts,
      systemWideContext,
      datasetOverview: {
        readableTables: AI_READABLE_TABLES,
        readOnlyGuarantee: 'Edge Function only performs authenticated select queries and AI chat calls; it has no code path for insert, update, delete, upsert, or write RPC.',
        leadCount: leads.length,
        followupCount: followups.length,
        salesOrderCount: (ordersResult.data ?? []).length,
        onboardMerchantCount: merchants.length,
        signedRecordCount: signedRecords.length,
        onboardingCaseCount: onboardingCases.length,
        projectCount: projects.length,
        projectTaskCount: projectTasks.length,
        userCount: profiles.size,
        userRoleRelationCount: userRoles.length,
        merchantActivityCount: merchantActivities.length,
        reminderNotificationCount: notifications.length,
        tireCatalogCount: tireCatalog.length,
        systemWideRowCounts: systemWideContext.coverage.rowCounts,
        inaccessibleSystemWideTables: systemWideContext.coverage.inaccessibleTables,
        customerKeyword: customerKeyword ?? null,
        productKeyword: productKeyword ?? null,
        queryKeywords: keywords,
        matchedLeadCount: matchedLeadIds.size,
        matchedMerchantCount: matchedMerchantIds.size,
      },
    }

    const answer: DataQaAnswer = {
      intent: parsed.intent,
      question,
      filters,
      buyerCount: totals.buyerCount,
      totalQuantity: totals.totalQuantity,
      totalAmount: totals.totalAmount,
      totalOrderCount: totals.totalOrderCount,
      topCustomer: rows[0] ?? null,
      rows,
      breakdownRows,
      trendRows,
      insights,
      dataQuality: {
        generatedAt: new Date().toISOString(),
        sourceTables: AI_READABLE_TABLES,
        matchedItemCount: facts.length,
        matchedOrderCount: orderIds.size,
        matchedCustomerCount: rows.length,
        calculationOwner: 'system',
      },
      assumptions,
      aiEnabled: true,
    }

    answer.aiAnswer = await generateFinalAnswer(question, answer, ai, conversation, retrievalContext)
    return jsonResponse(answer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('ai-data-assistant error', message)
    return jsonResponse({ error: message }, 500)
  }
})
