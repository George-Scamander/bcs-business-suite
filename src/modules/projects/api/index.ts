import type {
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
    progress: input.progress ?? 0,
    completed_at: input.status === 'DONE' ? new Date().toISOString() : null,
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
