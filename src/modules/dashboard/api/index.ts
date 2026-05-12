import { supabase } from '../../../lib/supabase/client'
import type { SalesProductCategory } from '../../../types/business'

export interface AdminDashboardMetrics {
  totalLeads: number
  signedLeads: number
  activeOnboardingCases: number
  totalProjects: number
  delayedProjects: number
  activeUsers: number
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
}

async function count(
  table: string,
  filters?: Array<{ column: string; value: string | number | boolean | null; op?: 'eq' | 'neq' | 'is' }>,
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

  const result = await query

  if (result.error) {
    throw result.error
  }

  return result.count ?? 0
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [
    totalLeads,
    signedLeads,
    activeOnboardingCases,
    totalProjects,
    delayedProjects,
    activeUsers,
  ] = await Promise.all([
    count('leads', [{ column: 'deleted_at', value: null, op: 'is' }]),
    count('leads', [
      { column: 'deleted_at', value: null, op: 'is' },
      { column: 'status', value: 'SIGNED' },
    ]),
    count('onboarding_cases', [
      { column: 'status', value: 'COMPLETED', op: 'neq' },
      { column: 'status', value: 'REJECTED', op: 'neq' },
    ]),
    count('projects', [{ column: 'deleted_at', value: null, op: 'is' }]),
    count('projects', [
      { column: 'deleted_at', value: null, op: 'is' },
      { column: 'status', value: 'DELAYED' },
    ]),
    count('profiles', [{ column: 'is_active', value: true }]),
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

export async function getAdminSalesCategoryMetrics(): Promise<AdminSalesCategoryMetrics[]> {
  const result = await supabase
    .from('sales_order_items')
    .select('category, quantity, unit_price, sales_order:sales_orders!inner(id, deleted_at)')
    .is('sales_order.deleted_at', null)

  if (result.error) {
    throw result.error
  }

  const categories: SalesProductCategory[] = ['TIRE', 'ENGINE_OIL', 'WINDOW_FILM', 'BOSCH_ACCESSORY']
  const aggregate = new Map<SalesProductCategory, AdminSalesCategoryMetrics>(
    categories.map((category) => [
      category,
      {
        category,
        totalQuantity: 0,
        totalAmount: 0,
      },
    ]),
  )

  for (const row of result.data ?? []) {
    const category = row.category as SalesProductCategory
    const current = aggregate.get(category)
    if (!current) {
      continue
    }

    const quantity = Math.max(0, Number(row.quantity ?? 0))
    const unitPrice = Math.max(0, Number(row.unit_price ?? 0))
    current.totalQuantity += quantity
    current.totalAmount += quantity * unitPrice
  }

  return categories.map((category) => aggregate.get(category) as AdminSalesCategoryMetrics)
}
