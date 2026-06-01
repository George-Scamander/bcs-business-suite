import { supabase } from '../../../lib/supabase/client'
import { SALES_PRODUCT_ENTRY_CATEGORY_OPTIONS, getSalesProductCategoryGroup, getSalesProductSubcategory } from '../../../lib/business-constants'
import type { SalesProductCategory, SalesProductSubcategory } from '../../../types/business'

export interface AdminDashboardMetrics {
  totalLeads: number
  signedLeads: number
  activeOnboardingCases: number
  totalProjects: number
  delayedProjects: number
  activeUsers: number
}

export interface AdminLeadBoardMetrics {
  totalLeads: number
  todayNewLeads: number
  bcsLeads: number
  nonBcsLeads: number
  highIntentLeads: number
  bcsSignedLeads: number
}

export interface BdDashboardMetrics {
  myLeads: number
  dueFollowups: number
  signedThisMonth: number
  myOnboardingCases: number
  activeProjectsLinked: number
}

export interface PmDashboardMetrics {
  myProjects: number
  delayedProjects: number
  tasksDueThisWeek: number
  avgCompletionRate: number
}

export interface AdminSalesCategoryMetrics {
  category: SalesProductCategory
  totalQuantity: number
  totalAmount: number
  subcategories: AdminSalesSubcategoryMetrics[]
}

export interface AdminSalesSubcategoryMetrics {
  subcategory: SalesProductSubcategory
  totalQuantity: number
  totalAmount: number
}

export interface AdminSalesInsightOrderItem {
  category: SalesProductCategory | string
  quantity: number
  amount: number
}

export interface AdminSalesInsightOrder {
  orderId: string
  bdUserId: string
  bdName: string
  bdEmail: string
  soldAt: string
  salesAmount: number
  items: AdminSalesInsightOrderItem[]
}

export type AdminDashboardPeriod = 'yesterday' | 'last7Days'

interface DateRangeFilter {
  column: string
  from?: string
  to?: string
}

interface AdminSalesInsightRawOrderRow {
  id: string
  sold_at: string | null
  bd_user_id: string | null
  bd_owner:
    | {
      id: string
      email: string
      full_name: string | null
    }
    | Array<{
    id: string
    email: string
    full_name: string | null
    }>
    | null
  items: Array<{
    category: string | null
    quantity: number | null
    unit_price: number | null
  }> | null
}

interface AdminSalesCategoryRawRow {
  category: string | null
  subcategory?: string | null
  quantity: number | null
  unit_price: number | null
}

function isMissingSubcategoryColumnError(error: unknown): boolean {
  const payload = (typeof error === 'object' && error !== null ? error : {}) as { code?: string; message?: string; details?: string | null; hint?: string | null }
  const code = String(payload.code ?? '').trim().toUpperCase()
  const text = `${payload.message ?? ''} ${payload.details ?? ''} ${payload.hint ?? ''}`.toLowerCase()
  return text.includes('subcategory') && (
    ['PGRST200', 'PGRST204', '42703'].includes(code)
    || text.includes('does not exist')
    || text.includes('schema cache')
  )
}

function getNaturalMonthDateRange(month?: string): { from: string; toExclusive: string } {
  const now = new Date()
  const monthMatch = month?.match(/^(\d{4})-(\d{2})$/)
  const requestedMonthIndex = monthMatch ? Number(monthMatch[2]) - 1 : -1
  const hasValidRequestedMonth = Boolean(monthMatch) && requestedMonthIndex >= 0 && requestedMonthIndex <= 11
  const year = hasValidRequestedMonth && monthMatch ? Number(monthMatch[1]) : now.getFullYear()
  const monthIndex = hasValidRequestedMonth ? requestedMonthIndex : now.getMonth()
  const startOfMonth = new Date(year, monthIndex, 1, 0, 0, 0, 0)
  const startOfNextMonth = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0)

  return {
    from: startOfMonth.toISOString(),
    toExclusive: startOfNextMonth.toISOString(),
  }
}

function getTodayDateRange(): { from: string; to: string } {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  return {
    from: startOfToday.toISOString(),
    to: endOfToday.toISOString(),
  }
}

function getAdminPeriodDateRange(period: AdminDashboardPeriod): { from: string; to: string } {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const from = new Date(startOfToday)
  if (period === 'yesterday') {
    from.setDate(from.getDate() - 1)
  } else {
    from.setDate(from.getDate() - 6)
  }

  const to = period === 'yesterday' ? new Date(startOfToday.getTime() - 1) : now
  return { from: from.toISOString(), to: to.toISOString() }
}

async function count(
  table: string,
  filters?: Array<{ column: string; value: string | number | boolean | null; op?: 'eq' | 'neq' | 'is' }>,
  dateRange?: DateRangeFilter,
): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })

  for (const filter of filters ?? []) {
    if (filter.op === 'is') {
      query = query.is(filter.column, filter.value)
    } else if (filter.op === 'neq') {
      query = query.neq(filter.column, filter.value)
    } else {
      query = query.eq(filter.column, filter.value)
    }
  }

  if (dateRange?.from) {
    query = query.gte(dateRange.column, dateRange.from)
  }

  if (dateRange?.to) {
    query = query.lte(dateRange.column, dateRange.to)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return result.count ?? 0
}

export async function getAdminDashboardMetrics(period?: AdminDashboardPeriod): Promise<AdminDashboardMetrics> {
  const periodRange = period ? getAdminPeriodDateRange(period) : null
  const [
    totalLeads,
    signedLeads,
    activeOnboardingCases,
    totalProjects,
    delayedProjects,
    activeUsers,
  ] = await Promise.all([
    count('leads', [
      { column: 'deleted_at', value: null, op: 'is' },
      { column: 'status', value: 'SIGNED', op: 'neq' },
    ], periodRange ? { column: 'created_at', ...periodRange } : undefined),
    (async () => {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'SIGNED')
        .or('intent_package.eq.PRODUCTS_SALES,intent_package.is.null')

      if (periodRange) {
        query = query.gte('created_at', periodRange.from).lte('created_at', periodRange.to)
      }

      const result = await query
      if (result.error) {
        throw result.error
      }
      return result.count ?? 0
    })(),
    count('onboarding_cases', [
      { column: 'status', value: 'COMPLETED', op: 'neq' },
      { column: 'status', value: 'REJECTED', op: 'neq' },
    ], periodRange ? { column: 'created_at', ...periodRange } : undefined),
    count('projects', [{ column: 'deleted_at', value: null, op: 'is' }], periodRange ? { column: 'created_at', ...periodRange } : undefined),
    count('projects', [
      { column: 'deleted_at', value: null, op: 'is' },
      { column: 'status', value: 'DELAYED' },
    ], periodRange ? { column: 'created_at', ...periodRange } : undefined),
    count(
      'profiles',
      [
        { column: 'is_active', value: true },
        { column: 'deleted_at', value: null, op: 'is' },
      ],
      periodRange ? { column: 'created_at', ...periodRange } : undefined,
    ),
  ])

  return {
    totalLeads,
    signedLeads,
    activeOnboardingCases,
    totalProjects,
    delayedProjects,
    activeUsers,
  }
}

export async function getAdminLeadBoardMetrics(): Promise<AdminLeadBoardMetrics> {
  const todayRange = getTodayDateRange()

  const [totalLeadsResult, todayNewLeadsResult, bcsLeadsResult, nonBcsLeadsResult, highIntentLeadsResult, bcsSignedRowsResult] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).neq('status', 'SIGNED'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', todayRange.from)
      .lte('created_at', todayRange.to),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .or('intent_package.eq.BCS,intent_package.eq.BOTH'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .or('intent_package.eq.PRODUCTS_SALES,intent_package.is.null'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .neq('status', 'SIGNED')
      .gte('intent_level', 4)
      .or('intent_package.eq.BCS,intent_package.eq.BOTH'),
    supabase
      .from('signed_records')
      .select('lead_id, leads!inner(id, deleted_at)')
      .or('contract_package.eq.BCS,contract_package.eq.BOTH')
      .is('leads.deleted_at', null),
  ])

  for (const result of [totalLeadsResult, todayNewLeadsResult, bcsLeadsResult, nonBcsLeadsResult, highIntentLeadsResult, bcsSignedRowsResult]) {
    if (result.error) {
      throw result.error
    }
  }

  const bcsSignedLeadIds = new Set((bcsSignedRowsResult.data ?? []).map((row) => row.lead_id).filter(Boolean))

  return {
    totalLeads: totalLeadsResult.count ?? 0,
    todayNewLeads: todayNewLeadsResult.count ?? 0,
    bcsLeads: bcsLeadsResult.count ?? 0,
    nonBcsLeads: nonBcsLeadsResult.count ?? 0,
    highIntentLeads: highIntentLeadsResult.count ?? 0,
    bcsSignedLeads: bcsSignedLeadIds.size,
  }
}

export async function getBdDashboardMetrics(userId: string): Promise<BdDashboardMetrics> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [myLeadsResult, dueFollowupsResult, signedRowsResult, onboardingResult, linkedProjectsResult] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_bd_id', userId).is('deleted_at', null),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_bd_id', userId)
      .is('deleted_at', null)
      .not('next_followup_at', 'is', null)
      .lt('next_followup_at', new Date().toISOString()),
    supabase
      .from('signed_records')
      .select('lead_id, leads!inner(assigned_bd_id)')
      .eq('leads.assigned_bd_id', userId)
      .is('leads.deleted_at', null)
      .gte('created_at', startOfMonth.toISOString()),
    supabase.from('onboarding_cases').select('*', { count: 'exact', head: true }).eq('owner_user_id', userId),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('bd_owner_id', userId)
      .is('deleted_at', null)
      .neq('status', 'COMPLETED')
      .neq('status', 'CLOSED'),
  ])

  for (const result of [myLeadsResult, dueFollowupsResult, signedRowsResult, onboardingResult, linkedProjectsResult]) {
    if (result.error) {
      throw result.error
    }
  }

  const signedLeadCount = new Set((signedRowsResult.data ?? []).map((item) => item.lead_id).filter(Boolean)).size

  return {
    myLeads: myLeadsResult.count ?? 0,
    dueFollowups: dueFollowupsResult.count ?? 0,
    signedThisMonth: signedLeadCount,
    myOnboardingCases: onboardingResult.count ?? 0,
    activeProjectsLinked: linkedProjectsResult.count ?? 0,
  }
}

export async function getPmDashboardMetrics(userId: string): Promise<PmDashboardMetrics> {
  const endOfWeek = new Date()
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const [projectsResult, delayedResult, dueTasksResult, completionResult] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('pm_owner_id', userId).is('deleted_at', null),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('pm_owner_id', userId)
      .is('deleted_at', null)
      .eq('status', 'DELAYED'),
    supabase
      .from('project_tasks')
      .select('id, projects!inner(pm_owner_id)', { count: 'exact', head: true })
      .eq('projects.pm_owner_id', userId)
      .is('projects.deleted_at', null)
      .is('deleted_at', null)
      .not('due_date', 'is', null)
      .lte('due_date', endOfWeek.toISOString().slice(0, 10))
      .neq('status', 'DONE'),
    supabase.from('projects').select('completion_rate').eq('pm_owner_id', userId).is('deleted_at', null),
  ])

  for (const result of [projectsResult, delayedResult, dueTasksResult]) {
    if (result.error) {
      throw result.error
    }
  }

  if (completionResult.error) {
    throw completionResult.error
  }

  const rows = completionResult.data ?? []
  const avgCompletionRate =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + Number(row.completion_rate ?? 0), 0) / Math.max(rows.length, 1)

  return {
    myProjects: projectsResult.count ?? 0,
    delayedProjects: delayedResult.count ?? 0,
    tasksDueThisWeek: dueTasksResult.count ?? 0,
    avgCompletionRate: Number(avgCompletionRate.toFixed(1)),
  }
}

export async function getAdminSalesCategoryMetrics(month?: string): Promise<AdminSalesCategoryMetrics[]> {
  const naturalMonthRange = getNaturalMonthDateRange(month)
  const result = await supabase
    .from('sales_order_items')
    .select('category, subcategory, quantity, unit_price, sales_order:sales_orders!inner(id, deleted_at, sold_at)')
    .is('sales_order.deleted_at', null)
    .gte('sales_order.sold_at', naturalMonthRange.from)
    .lt('sales_order.sold_at', naturalMonthRange.toExclusive)

  let rows: AdminSalesCategoryRawRow[]
  if (result.error && isMissingSubcategoryColumnError(result.error)) {
    const fallbackResult = await supabase
      .from('sales_order_items')
      .select('category, quantity, unit_price, sales_order:sales_orders!inner(id, deleted_at, sold_at)')
      .is('sales_order.deleted_at', null)
      .gte('sales_order.sold_at', naturalMonthRange.from)
      .lt('sales_order.sold_at', naturalMonthRange.toExclusive)
    if (fallbackResult.error) {
      throw fallbackResult.error
    }
    rows = fallbackResult.data ?? []
  } else {
    if (result.error) {
      throw result.error
    }
    rows = result.data ?? []
  }

  const categories: SalesProductCategory[] = SALES_PRODUCT_ENTRY_CATEGORY_OPTIONS.map((item) => item.value)
  const aggregate = new Map<SalesProductCategory, AdminSalesCategoryMetrics>(
    categories.map((category) => [
      category,
      {
        category,
        totalQuantity: 0,
        totalAmount: 0,
        subcategories: [],
      },
    ]),
  )

  for (const row of rows) {
    const category = getSalesProductCategoryGroup(row.category as SalesProductCategory)
    const current = aggregate.get(category)
    if (!current) {
      continue
    }

    const quantity = Math.max(0, Number(row.quantity ?? 0))
    const unitPrice = Math.max(0, Number(row.unit_price ?? 0))
    current.totalQuantity += quantity
    current.totalAmount += quantity * unitPrice
    const subcategory = getSalesProductSubcategory(row.category as SalesProductCategory, row.subcategory as SalesProductSubcategory | null)
    if (subcategory) {
      const currentSubcategory = current.subcategories.find((item) => item.subcategory === subcategory)
      if (currentSubcategory) {
        currentSubcategory.totalQuantity += quantity
        currentSubcategory.totalAmount += quantity * unitPrice
      } else {
        current.subcategories.push({ subcategory, totalQuantity: quantity, totalAmount: quantity * unitPrice })
      }
    }
  }

  return categories.map((category) => aggregate.get(category) as AdminSalesCategoryMetrics)
}

export async function getAdminSalesInsightOrders(month?: string): Promise<AdminSalesInsightOrder[]> {
  const naturalMonthRange = getNaturalMonthDateRange(month)
  const result = await supabase
    .from('sales_orders')
    .select(
      'id, sold_at, bd_user_id, bd_owner:profiles!sales_orders_bd_user_id_fkey(id, email, full_name), items:sales_order_items(category, quantity, unit_price)',
    )
    .is('deleted_at', null)
    .gte('sold_at', naturalMonthRange.from)
    .lt('sold_at', naturalMonthRange.toExclusive)

  if (result.error) {
    throw result.error
  }

  return ((result.data ?? []) as AdminSalesInsightRawOrderRow[])
    .filter((row) => row.bd_user_id && row.sold_at)
    .map((row) => {
      const bdOwner = Array.isArray(row.bd_owner) ? row.bd_owner[0] : row.bd_owner
      const mappedItems: AdminSalesInsightOrderItem[] = (row.items ?? []).map((item) => {
        const quantity = Math.max(0, Number(item.quantity ?? 0))
        const unitPrice = Math.max(0, Number(item.unit_price ?? 0))
        return {
          category: item.category ? getSalesProductCategoryGroup(item.category as SalesProductCategory) : 'UNKNOWN',
          quantity,
          amount: quantity * unitPrice,
        }
      })

      return {
        orderId: row.id,
        bdUserId: row.bd_user_id as string,
        bdName: bdOwner?.full_name ?? bdOwner?.email ?? String(row.bd_user_id),
        bdEmail: bdOwner?.email ?? '',
        soldAt: row.sold_at as string,
        salesAmount: mappedItems.reduce((sum, item) => sum + item.amount, 0),
        items: mappedItems,
      }
    })
}
