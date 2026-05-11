import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Button,
  Input,
  Popconfirm,
  Progress,
  Space,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useNavigate,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  hardDeleteProject,
  hardDeleteProjects,
  listDeletedProjects,
  restoreProject,
  restoreProjects,
} from '../api'
import {
  useAuth,
} from '../../auth/auth-context'
import type {
  Project,
} from '../../../types/business'

export function PmDeletedProjectsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, roles } = useAuth()
  const backPath = roles.includes('super_admin') ? '/app/admin/projects/overview' : '/app/pm/projects'

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const loadRows = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const result = await listDeletedProjects({
        keyword: keyword.trim() || undefined,
        pmOwnerId: roles.includes('super_admin') ? undefined : user.id,
      })
      setRows(result)
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmDeletedProjects.loadFail', { defaultValue: 'Failed to load deleted projects' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [keyword, roles, t, user])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  async function handlePermanentDelete(projectId: string) {
    try {
      await hardDeleteProject(projectId)
      message.success(t('pages.pmDeletedProjects.permanentDeleteSuccess', { defaultValue: 'Project permanently deleted' }))
      await loadRows()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmDeletedProjects.permanentDeleteFail', { defaultValue: 'Failed to permanently delete project' })
      message.error(text)
    }
  }

  async function handleRestoreProject(projectId: string) {
    try {
      await restoreProject(projectId)
      message.success(t('pages.pmDeletedProjects.restoreSuccess', { defaultValue: 'Project restored' }))
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmDeletedProjects.restoreFail', { defaultValue: 'Failed to restore project' })
      message.error(text)
    }
  }

  async function handleBatchRestore(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.pmDeletedProjects.selectWarning', { defaultValue: 'Please select at least one project' }))
      return
    }

    try {
      await restoreProjects(ids)
      message.success(
        t('pages.pmDeletedProjects.batchRestoreSuccess', {
          defaultValue: 'Restored {{count}} project(s)',
          count: ids.length,
        }),
      )
      await loadRows()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmDeletedProjects.batchRestoreFail', { defaultValue: 'Failed to restore selected projects' })
      message.error(text)
    }
  }

  async function handleBatchPermanentDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.pmDeletedProjects.selectWarning', { defaultValue: 'Please select at least one project' }))
      return
    }

    try {
      await hardDeleteProjects(ids)
      message.success(
        t('pages.pmDeletedProjects.batchPermanentDeleteSuccess', {
          defaultValue: 'Permanently deleted {{count}} project(s)',
          count: ids.length,
        }),
      )
      await loadRows()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmDeletedProjects.batchPermanentDeleteFail', {
              defaultValue: 'Failed to permanently delete selected projects',
            })
      message.error(text)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.pmDeletedProjects.title', { defaultValue: 'Recently Deleted Projects' })}
        description={t('pages.pmDeletedProjects.description', {
          defaultValue: 'Review soft-deleted projects and permanently delete records when confirmed.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate(backPath)}>
              {t('pages.pmDeletedProjects.backToList', { defaultValue: 'Back to Project List' })}
            </Button>
            <Popconfirm
              title={t('pages.pmDeletedProjects.batchRestoreConfirmTitle', { defaultValue: 'Restore selected projects?' })}
              description={t('pages.pmDeletedProjects.batchRestoreConfirmDesc', {
                defaultValue: 'Selected projects will be moved back to the active project list.',
              })}
              okText={t('labels.restore', { defaultValue: 'Restore' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchRestore(selectedIds)}
            >
              <Button disabled={selectedIds.length === 0}>
                {t('pages.pmDeletedProjects.restoreSelected', { defaultValue: 'Restore Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.pmDeletedProjects.batchPermanentDeleteConfirmTitle', {
                defaultValue: 'Permanently delete selected projects?',
              })}
              description={t('pages.pmDeletedProjects.batchPermanentDeleteConfirmDesc', {
                defaultValue: 'This action cannot be undone.',
              })}
              okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchPermanentDelete(selectedIds)}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('pages.pmDeletedProjects.deleteSelected', { defaultValue: 'Delete Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.pmDeletedProjects.batchPermanentDeleteAllConfirmTitle', {
                defaultValue: 'Permanently delete all filtered projects?',
              })}
              description={t('pages.pmDeletedProjects.batchPermanentDeleteAllConfirmDesc', {
                defaultValue: 'All currently filtered projects will be permanently deleted.',
              })}
              okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchPermanentDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                {t('pages.pmDeletedProjects.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
              </Button>
            </Popconfirm>
            <Button onClick={() => void loadRows()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Input.Search
            allowClear
            placeholder={t('pages.pmDeletedProjects.keywordPlaceholder', { defaultValue: 'Project code/name' })}
            style={{ width: 320 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadRows()}
          />
          <Button type="primary" onClick={() => void loadRows()}>
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
          { title: t('pages.pmDeletedProjects.columns.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code', width: 170 },
          { title: t('pages.pmDeletedProjects.columns.name', { defaultValue: 'Name' }), dataIndex: 'name' },
          {
            title: t('pages.pmDeletedProjects.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.pmDeletedProjects.columns.progress', { defaultValue: 'Progress' }),
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: t('pages.pmDeletedProjects.columns.deletedAt', { defaultValue: 'Deleted At' }),
            dataIndex: 'deleted_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.pmDeletedProjects.columns.actions', { defaultValue: 'Actions' }),
            width: 280,
            render: (_: unknown, row: Project) => (
              <Space wrap>
                <Popconfirm
                  title={t('pages.pmDeletedProjects.restoreConfirmTitle', { defaultValue: 'Restore this project?' })}
                  description={t('pages.pmDeletedProjects.restoreConfirmDesc', {
                    defaultValue: 'The project will be moved back to the active project list.',
                  })}
                  okText={t('labels.restore', { defaultValue: 'Restore' })}
                  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handleRestoreProject(row.id)}
                >
                  <Button size="small">
                    {t('labels.restore', { defaultValue: 'Restore' })}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title={t('pages.pmDeletedProjects.permanentDeleteConfirmTitle', { defaultValue: 'Permanently delete this project?' })}
                  description={t('pages.pmDeletedProjects.permanentDeleteConfirmDesc', { defaultValue: 'This action cannot be undone.' })}
                  okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
                  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handlePermanentDelete(row.id)}
                >
                  <Button size="small" danger>
                    {t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
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
