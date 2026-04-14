import { supabase } from '../../../lib/supabase/client'

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

async function count(table: string, filters?: Array<{ column: string; value: string | number | boolean; op?: 'eq' | 'neq' }>): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })

  for (const filter of filters ?? []) {
    if (filter.op === 'neq') {
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
    count('leads'),
    count('leads', [{ column: 'status', value: 'SIGNED' }]),
    count('onboarding_cases', [{ column: 'status', value: 'COMPLETED', op: 'neq' }]),
    count('projects'),
    count('projects', [{ column: 'status', value: 'DELAYED' }]),
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

  const [myLeadsResult, dueFollowupsResult, signedResult, onboardingResult, linkedProjectsResult] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_bd_id', userId),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_bd_id', userId)
      .not('next_followup_at', 'is', null)
      .lt('next_followup_at', new Date().toISOString()),
    supabase
      .from('signed_records')
      .select('id, leads!inner(assigned_bd_id)', { count: 'exact', head: true })
      .eq('leads.assigned_bd_id', userId)
      .gte('created_at', startOfMonth.toISOString()),
    supabase.from('onboarding_cases').select('*', { count: 'exact', head: true }).eq('owner_user_id', userId),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('bd_owner_id', userId),
  ])

  for (const result of [myLeadsResult, dueFollowupsResult, signedResult, onboardingResult, linkedProjectsResult]) {
    if (result.error) {
      throw result.error
    }
  }

  return {
    myLeads: myLeadsResult.count ?? 0,
    dueFollowups: dueFollowupsResult.count ?? 0,
    signedThisMonth: signedResult.count ?? 0,
    myOnboardingCases: onboardingResult.count ?? 0,
    activeProjectsLinked: linkedProjectsResult.count ?? 0,
  }
}

export async function getPmDashboardMetrics(userId: string): Promise<PmDashboardMetrics> {
  const endOfWeek = new Date()
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const [projectsResult, delayedResult, dueTasksResult, completionResult] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('pm_owner_id', userId),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('pm_owner_id', userId)
      .eq('status', 'DELAYED'),
    supabase
      .from('project_tasks')
      .select('id, projects!inner(pm_owner_id)', { count: 'exact', head: true })
      .eq('projects.pm_owner_id', userId)
      .not('due_date', 'is', null)
      .lte('due_date', endOfWeek.toISOString().slice(0, 10))
      .neq('status', 'DONE'),
    supabase.from('projects').select('completion_rate').eq('pm_owner_id', userId),
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
