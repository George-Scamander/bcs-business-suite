import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Button,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getProjectStatusOptions,
} from '../../../lib/business-constants'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  changeProjectStatus,
  listProjectIdsWithDueTasks,
  listProjects,
  markDelayedProjects,
  softDeleteProject,
  softDeleteProjects,
  type ProjectFilters,
} from '../api'
import type {
  Project,
  ProjectStatus,
} from '../../../types/business'

const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'ON_HOLD', 'DELAYED'],
  IN_PROGRESS: ['ON_HOLD', 'DELAYED', 'COMPLETED'],
  ON_HOLD: ['IN_PROGRESS', 'DELAYED'],
  DELAYED: ['IN_PROGRESS', 'ON_HOLD', 'COMPLETED'],
  COMPLETED: [],
  CLOSED: [],
}

const PROJECT_STATUS_VALUES: ProjectStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CLOSED']

function parseProjectFiltersFromSearch(searchParams: URLSearchParams): {
  filters: ProjectFilters
  keyword: string
  taskDueThisWeekOnly: boolean
  sortByCompletionDesc: boolean
} {
  const statusParam = searchParams.get('status')
  const status = statusParam && PROJECT_STATUS_VALUES.includes(statusParam as ProjectStatus) ? (statusParam as ProjectStatus) : undefined
  const keyword = searchParams.get('q') ?? ''
  const taskDueThisWeekOnly = searchParams.get('task_due') === 'week'
  const sortByCompletionDesc = searchParams.get('sort') === 'completion_desc'

  return {
    filters: status ? { status } : {},
    keyword,
    taskDueThisWeekOnly,
    sortByCompletionDesc,
  }
}

export function PmProjectsListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>(() => parseProjectFiltersFromSearch(searchParams).filters)
  const [keyword, setKeyword] = useState(() => parseProjectFiltersFromSearch(searchParams).keyword)
  const [taskDueThisWeekOnly, setTaskDueThisWeekOnly] = useState(() => parseProjectFiltersFromSearch(searchParams).taskDueThisWeekOnly)
  const [sortByCompletionDesc, setSortByCompletionDesc] = useState(() => parseProjectFiltersFromSearch(searchParams).sortByCompletionDesc)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      await markDelayedProjects()
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
        pmOwnerId: roles.includes('super_admin') ? filters.pmOwnerId : user.id,
      })

      let normalizedRows = result

      if (taskDueThisWeekOnly) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 7)
        const dueTaskProjectIds = await listProjectIdsWithDueTasks(user.id, dueDate.toISOString().slice(0, 10))
        const dueTaskProjectSet = new Set(dueTaskProjectIds)
        normalizedRows = normalizedRows.filter((item) => dueTaskProjectSet.has(item.id))
      }

      if (sortByCompletionDesc) {
        normalizedRows = [...normalizedRows].sort((a, b) => Number(b.completion_rate ?? 0) - Number(a.completion_rate ?? 0))
      }

      setRows(normalizedRows)
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjects.loadFail', { defaultValue: 'Failed to load projects' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, roles, sortByCompletionDesc, t, taskDueThisWeekOnly, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const parsed = parseProjectFiltersFromSearch(searchParams)
    setFilters((current) => (JSON.stringify(current) === JSON.stringify(parsed.filters) ? current : parsed.filters))
    setKeyword((current) => (current === parsed.keyword ? current : parsed.keyword))
    setTaskDueThisWeekOnly((current) => (current === parsed.taskDueThisWeekOnly ? current : parsed.taskDueThisWeekOnly))
    setSortByCompletionDesc((current) => (current === parsed.sortByCompletionDesc ? current : parsed.sortByCompletionDesc))
  }, [searchParams])

  async function handleDeleteProject(projectId: string) {
    try {
      await softDeleteProject(projectId)
      message.success(t('pages.pmProjects.deleteSuccess', { defaultValue: 'Project moved to Recently Deleted' }))
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjects.deleteFail', { defaultValue: 'Failed to delete project' })
      message.error(text)
    }
  }

  async function handleBatchDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.pmProjects.bulkDeleteSelectWarning', { defaultValue: 'Please select at least one project' }))
      return
    }

    try {
      await softDeleteProjects(ids)
      message.success(
        t('pages.pmProjects.bulkDeleteSuccess', {
          defaultValue: 'Deleted {{count}} project(s)',
          count: ids.length,
        }),
      )
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmProjects.bulkDeleteFail', { defaultValue: 'Failed to delete selected projects' })
      message.error(text)
    }
  }

  async function handleStatusChange(row: Project, nextStatus: ProjectStatus) {
    if (nextStatus === row.status) {
      return
    }

    let reason: string | undefined
    if (nextStatus === 'DELAYED') {
      const input = window.prompt(
        t('pages.pmProjects.delayReasonPrompt', { defaultValue: 'Please enter delay reason' }),
        row.delay_reason ?? '',
      )
      if (input === null) {
        return
      }

      reason = input.trim()
      if (!reason) {
        message.warning(t('pages.pmProjects.delayReasonRequired', { defaultValue: 'Delay reason is required' }))
        return
      }
    }

    try {
      await changeProjectStatus(row.id, nextStatus, reason)
      message.success(t('pages.pmProjects.statusUpdateSuccess', { defaultValue: 'Project status updated' }))
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjects.statusUpdateFail', { defaultValue: 'Failed to update status' })
      message.error(text)
    }
  }

  function getStatusOptionsForRow(status: ProjectStatus) {
    const transitionTargets = STATUS_TRANSITIONS[status] ?? []
    const values = [status, ...transitionTargets].filter((item, index, current) => current.indexOf(item) === index)
    return values
      .filter((value) => value !== 'COMPLETED')
      .map((value) => ({
        value,
        label: t(`status.${value}`, { defaultValue: value }),
      }))
  }

  const projectFilterStatusOptions = useMemo(
    () => getProjectStatusOptions(t).filter((item) => item.value !== 'COMPLETED' && item.value !== 'CLOSED'),
    [t],
  )
  const deleteRetentionHint = t('labels.autoDelete30DaysHint', {
    defaultValue: 'Moved to Recently Deleted and auto-permanently deleted after 30 days.',
  })

  return (
    <>
      <PageTitleBar
        title={t('pages.pmProjects.title', { defaultValue: 'Projects' })}
        description={t('pages.pmProjects.description', {
          defaultValue: 'Manage execution portfolio with real-time progress, delay signaling, and closure discipline.',
        })}
        extra={
          <Space>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button onClick={() => navigate('/app/recently-deleted')}>
              {t('pages.pmProjects.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
            </Button>
            <Popconfirm
              title={t('pages.pmProjects.bulkDeleteConfirmTitle', { defaultValue: 'Delete selected projects?' })}
              description={`${t('pages.pmProjects.bulkDeleteConfirmDesc', {
                defaultValue: 'Selected projects will be moved to Recently Deleted.',
              })} ${deleteRetentionHint}`}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(selectedIds)}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('pages.pmProjects.deleteSelected', { defaultValue: 'Delete Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.pmProjects.bulkDeleteAllConfirmTitle', { defaultValue: 'Delete all filtered projects?' })}
              description={`${t('pages.pmProjects.bulkDeleteAllConfirmDesc', {
                defaultValue: 'All currently filtered projects will be moved to Recently Deleted.',
              })} ${deleteRetentionHint}`}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                {t('pages.pmProjects.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
              </Button>
            </Popconfirm>
            <Button type="primary" onClick={() => navigate('/app/pm/projects/new')}>
              {t('pages.pmProjects.createProject', { defaultValue: 'Create Project' })}
            </Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('pages.pmProjects.statusPlaceholder', { defaultValue: 'Status' })}
            style={{ width: 220 }}
            options={projectFilterStatusOptions}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input.Search
            allowClear
            placeholder={t('pages.pmProjects.keywordPlaceholder', { defaultValue: 'Project code/name' })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('pages.pmProjects.columns.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code', width: 170 },
          { title: t('pages.pmProjects.columns.name', { defaultValue: 'Name' }), dataIndex: 'name' },
          {
            title: t('pages.pmProjects.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: ProjectStatus, row: Project) => {
              if (value === 'COMPLETED' || value === 'CLOSED') {
                return <StatusTag value={value} />
              }

              return (
                <Select
                  size="small"
                  value={value}
                  options={getStatusOptionsForRow(value)}
                  onChange={(nextValue) => void handleStatusChange(row, nextValue as ProjectStatus)}
                  style={{ width: '100%' }}
                />
              )
            },
          },
          {
            title: t('pages.pmProjects.columns.progress', { defaultValue: 'Progress' }),
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: t('pages.pmProjects.targetEnd', { defaultValue: 'Target End' }),
            dataIndex: 'target_end_date',
            width: 150,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('pages.pmProjects.actions', { defaultValue: 'Actions' }),
            width: 360,
            render: (_: unknown, row: Project) => (
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}`)}>
                  {t('pages.pmProjects.actionDetail', { defaultValue: 'Detail' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/progress`)}>
                  {t('pages.pmProjects.actionProgress', { defaultValue: 'Progress' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/tasks`)}>
                  {t('pages.pmProjects.actionTasks', { defaultValue: 'Tasks' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/members`)}>
                  {t('pages.pmProjects.actionMembers', { defaultValue: 'Members' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/closure`)}>
                  {t('pages.pmProjects.actionClosure', { defaultValue: 'Closure' })}
                </Button>
                <Popconfirm
                  title={t('pages.pmProjects.deleteConfirmTitle', { defaultValue: 'Delete this project?' })}
                  description={`${t('pages.pmProjects.deleteConfirmDesc', {
                    defaultValue: 'The project will be moved to Recently Deleted.',
                  })} ${deleteRetentionHint}`}
                  okText={t('labels.delete', { defaultValue: 'Delete' })}
                  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handleDeleteProject(row.id)}
                >
                  <Button size="small" danger>
                    {t('labels.delete', { defaultValue: 'Delete' })}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
