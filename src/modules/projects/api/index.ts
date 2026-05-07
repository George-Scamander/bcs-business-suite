import type {
  OnboardingCase,
  Project,
  ProjectMember,
  ProjectMilestone,
  ProjectStatus,
  ProjectStatusLog,
  ProjectTask,
  ProjectUpdate,
  TaskPriority,
  TaskStatus,
} from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'
import { recordOperationLog } from '../../../lib/supabase/logs'

export interface ProjectFilters {
  status?: ProjectStatus
  pmOwnerId?: string
  bdOwnerId?: string
  keyword?: string
}

export interface CreateProjectInput {
  id?: string
  onboarding_case_id?: string
  name: string
  description?: string
  pm_owner_id: string
  bd_owner_id?: string
  start_date?: string
  target_end_date?: string
}

export async function listOnboardingCasesWithoutProject(): Promise<OnboardingCase[]> {
  const [caseResult, projectResult] = await Promise.all([
    supabase.from('onboarding_cases').select('*').order('updated_at', { ascending: false }),
    supabase.from('projects').select('onboarding_case_id').is('deleted_at', null),
  ])

  if (caseResult.error) {
    throw caseResult.error
  }

  if (projectResult.error) {
    throw projectResult.error
  }

  const linkedCaseIds = new Set((projectResult.data ?? []).map((item) => item.onboarding_case_id))
  return ((caseResult.data ?? []) as OnboardingCase[]).filter((item) => !linkedCaseIds.has(item.id))
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const projectId = input.id ?? crypto.randomUUID()
  const result = await supabase
    .from('projects')
    .insert({
      id: projectId,
      onboarding_case_id: input.onboarding_case_id ?? null,
      name: input.name,
      description: input.description ?? null,
      pm_owner_id: input.pm_owner_id,
      bd_owner_id: input.bd_owner_id ?? null,
      start_date: input.start_date ?? null,
      target_end_date: input.target_end_date ?? null,
      status: 'NOT_STARTED',
      completion_rate: 0,
    })

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    entityId: projectId,
    action: 'create_project',
    afterData: {
      id: projectId,
      onboarding_case_id: input.onboarding_case_id ?? null,
      name: input.name,
      description: input.description ?? null,
      pm_owner_id: input.pm_owner_id,
      bd_owner_id: input.bd_owner_id ?? null,
      start_date: input.start_date ?? null,
      target_end_date: input.target_end_date ?? null,
      status: 'NOT_STARTED',
      completion_rate: 0,
    },
  })

  return { id: projectId } as Project
}

export async function listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  let query = supabase.from('projects').select('*').is('deleted_at', null).order('updated_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.pmOwnerId) {
    query = query.eq('pm_owner_id', filters.pmOwnerId)
  }

  if (filters.bdOwnerId) {
    query = query.eq('bd_owner_id', filters.bdOwnerId)
  }

  if (filters.keyword) {
    query = query.or(`name.ilike.%${filters.keyword}%,project_code.ilike.%${filters.keyword}%`)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as Project[]
}

export async function listDeletedProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  let query = supabase.from('projects').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.pmOwnerId) {
    query = query.eq('pm_owner_id', filters.pmOwnerId)
  }

  if (filters.bdOwnerId) {
    query = query.eq('bd_owner_id', filters.bdOwnerId)
  }

  if (filters.keyword) {
    query = query.or(`name.ilike.%${filters.keyword}%,project_code.ilike.%${filters.keyword}%`)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as Project[]
}

export async function getProjectById(projectId: string): Promise<Project> {
  const result = await supabase.from('projects').select('*').eq('id', projectId).single<Project>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function updateProject(input: Partial<Project> & { id: string }): Promise<Project> {
  const { id, ...payload } = input

  const result = await supabase.from('projects').update(payload).eq('id', id).select('*').single<Project>()

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    entityId: id,
    action: 'update_project',
    afterData: payload,
  })

  return result.data
}

export async function softDeleteProject(projectId: string): Promise<void> {
  const result = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId)

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    entityId: projectId,
    action: 'soft_delete_project',
  })
}

export async function softDeleteProjects(projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) {
    return
  }

  const result = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).in('id', projectIds)

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    action: 'soft_delete_projects_bulk',
    afterData: { project_ids: projectIds },
  })
}

export async function hardDeleteProject(projectId: string): Promise<void> {
  const result = await supabase.from('projects').delete().eq('id', projectId)

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    entityId: projectId,
    action: 'hard_delete_project',
  })
}

export async function hardDeleteProjects(projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) {
    return
  }

  const result = await supabase.from('projects').delete().in('id', projectIds)

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    action: 'hard_delete_projects_bulk',
    afterData: { project_ids: projectIds },
  })
}

export async function restoreProject(projectId: string): Promise<void> {
  const result = await supabase.rpc('restore_deleted_project', {
    p_project_id: projectId,
  })

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    entityId: projectId,
    action: 'restore_project',
  })
}

export async function restoreProjects(projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) {
    return
  }

  const result = await supabase.rpc('restore_deleted_projects_bulk', {
    p_project_ids: projectIds,
  })

  if (result.error) {
    throw result.error
  }

  const restoredCount = Number(result.data ?? 0)
  if (restoredCount !== projectIds.length) {
    throw new Error(`Restore partially failed: restored ${restoredCount}/${projectIds.length} project(s).`)
  }

  await recordOperationLog({
    module: 'projects',
    entityType: 'projects',
    action: 'restore_projects_bulk',
    afterData: { project_ids: projectIds },
  })
}

export async function changeProjectStatus(projectId: string, toStatus: ProjectStatus, reason?: string): Promise<void> {
  const result = await supabase.rpc('change_project_status', {
    p_project_id: projectId,
    p_to_status: toStatus,
    p_reason: reason ?? null,
  })

  if (result.error) {
    throw result.error
  }
}

export async function refreshProjectProgress(projectId: string): Promise<number> {
  const result = await supabase.rpc('refresh_project_progress', {
    p_project_id: projectId,
  })

  if (result.error) {
    throw result.error
  }

  return (result.data as number) ?? 0
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const result = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('joined_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as ProjectMember[]
}

export async function addProjectMember(projectId: string, userId: string, roleInProject: string): Promise<void> {
  const result = await supabase.from('project_members').insert({
    project_id: projectId,
    user_id: userId,
    role_in_project: roleInProject,
    is_active: true,
  })

  if (result.error) {
    throw result.error
  }
}

export async function deactivateProjectMember(projectId: string, userId: string): Promise<void> {
  const result = await supabase
    .from('project_members')
    .update({
      is_active: false,
      left_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (result.error) {
    throw result.error
  }
}

export async function listProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  const result = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as ProjectMilestone[]
}

export async function upsertProjectMilestone(input: {
  id?: string
  projectId: string
  title: string
  description?: string
  plannedDate?: string
  ownerId?: string
  progress?: number
  status?: TaskStatus
  sortOrder?: number
}): Promise<ProjectMilestone> {
  if (input.id) {
    const result = await supabase
      .from('project_milestones')
      .update({
        title: input.title,
        description: input.description ?? null,
        planned_date: input.plannedDate ?? null,
        owner_id: input.ownerId ?? null,
        progress: input.progress ?? 0,
        status: input.status ?? 'TODO',
        sort_order: input.sortOrder ?? 0,
      })
      .eq('id', input.id)
      .select('*')
      .single<ProjectMilestone>()

    if (result.error) {
      throw result.error
    }

    return result.data
  }

  const result = await supabase
    .from('project_milestones')
    .insert({
      project_id: input.projectId,
      title: input.title,
      description: input.description ?? null,
      planned_date: input.plannedDate ?? null,
      owner_id: input.ownerId ?? null,
      progress: input.progress ?? 0,
      status: input.status ?? 'TODO',
      sort_order: input.sortOrder ?? 0,
    })
    .select('*')
    .single<ProjectMilestone>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function listProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const result = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as ProjectTask[]
}

export async function upsertProjectTask(input: {
  id?: string
  projectId: string
  milestoneId?: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  startDate?: string
  dueDate?: string
  progress?: number
}): Promise<ProjectTask> {
  const normalizedProgressBase = Math.max(0, Math.min(100, Number(input.progress ?? 0)))
  const normalizedProgress =
    (input.status ?? 'TODO') === 'DONE'
      ? 100
      : normalizedProgressBase >= 100
        ? 99
        : normalizedProgressBase

  const payload = {
    project_id: input.projectId,
    milestone_id: input.milestoneId ?? null,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? 'TODO',
    priority: input.priority ?? 'MEDIUM',
    assignee_id: input.assigneeId ?? null,
    start_date: input.startDate ?? null,
    due_date: input.dueDate ?? null,
    progress: normalizedProgress,
    completed_at: (input.status ?? 'TODO') === 'DONE' ? new Date().toISOString() : null,
  }

  if (input.id) {
    const result = await supabase.from('project_tasks').update(payload).eq('id', input.id).select('*').single<ProjectTask>()

    if (result.error) {
      throw result.error
    }

    await refreshProjectProgress(input.projectId)
    return result.data
  }

  const result = await supabase.from('project_tasks').insert(payload).select('*').single<ProjectTask>()

  if (result.error) {
    throw result.error
  }

  await refreshProjectProgress(input.projectId)
  return result.data
}

export async function softDeleteProjectTask(taskId: string, projectId: string): Promise<void> {
  const result = await supabase
    .from('project_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)

  if (result.error) {
    throw result.error
  }

  await refreshProjectProgress(projectId)
}

export async function listProjectStatusLogs(projectId: string): Promise<ProjectStatusLog[]> {
  const result = await supabase
    .from('project_status_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('changed_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as ProjectStatusLog[]
}

export async function listProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const result = await supabase
    .from('project_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as ProjectUpdate[]
}

export async function addProjectUpdate(projectId: string, summary: string, detail?: Record<string, unknown>): Promise<void> {
  const result = await supabase.from('project_updates').insert({
    project_id: projectId,
    summary,
    detail: detail ?? null,
    shared_with_bd: true,
  })

  if (result.error) {
    throw result.error
  }
}

export async function markDelayedProjects(): Promise<number> {
  const result = await supabase.rpc('mark_delayed_projects')

  if (result.error) {
    throw result.error
  }

  return (result.data as number) ?? 0
}
