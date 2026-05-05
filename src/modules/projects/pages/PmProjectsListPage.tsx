import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Popconfirm, Progress, Select, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { PROJECT_STATUS_OPTIONS } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listProjects, markDelayedProjects, softDeleteProject, softDeleteProjects, type ProjectFilters } from '../api'
import type { Project } from '../../../types/business'

export function PmProjectsListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [keyword, setKeyword] = useState('')
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
      setRows(result)
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjects.loadFail', { defaultValue: 'Failed to load projects' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, roles, t, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

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
            <Button onClick={() => navigate('/app/pm/projects/deleted')}>
              {t('pages.pmProjects.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
            </Button>
            <Popconfirm
              title={t('pages.pmProjects.bulkDeleteConfirmTitle', { defaultValue: 'Delete selected projects?' })}
              description={t('pages.pmProjects.bulkDeleteConfirmDesc', {
                defaultValue: 'Selected projects will be moved to Recently Deleted.',
              })}
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
              description={t('pages.pmProjects.bulkDeleteAllConfirmDesc', {
                defaultValue: 'All currently filtered projects will be moved to Recently Deleted.',
              })}
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
            options={PROJECT_STATUS_OPTIONS}
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
            render: (value: string) => <StatusTag value={value} />,
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
            width: 420,
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
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/risks`)}>
                  {t('pages.pmProjects.actionRisks', { defaultValue: 'Risks' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/closure`)}>
                  {t('pages.pmProjects.actionClosure', { defaultValue: 'Closure' })}
                </Button>
                <Popconfirm
                  title={t('pages.pmProjects.deleteConfirmTitle', { defaultValue: 'Delete this project?' })}
                  description={t('pages.pmProjects.deleteConfirmDesc', { defaultValue: 'The project will be moved to Recently Deleted.' })}
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
