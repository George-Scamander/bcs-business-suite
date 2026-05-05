import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Popconfirm, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { hardDeleteLead, hardDeleteLeads, listDeletedLeads, restoreLead, restoreLeads } from '../api'
import { useAuth } from '../../auth/auth-context'
import type { Lead } from '../../../types/business'

export function BdDeletedLeadsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const loadRows = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const result = await listDeletedLeads({
        keyword: keyword.trim() || undefined,
        assignedBdId: roles.includes('super_admin') ? undefined : user.id,
      })
      setRows(result)
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdDeletedLeads.loadFail', { defaultValue: 'Failed to load deleted leads' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [keyword, roles, t, user])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  async function handlePermanentDelete(leadId: string) {
    try {
      await hardDeleteLead(leadId)
      message.success(t('pages.bdDeletedLeads.permanentDeleteSuccess', { defaultValue: 'Lead permanently deleted' }))
      await loadRows()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdDeletedLeads.permanentDeleteFail', { defaultValue: 'Failed to permanently delete lead' })
      message.error(text)
    }
  }

  async function handleRestoreLead(leadId: string) {
    try {
      await restoreLead(leadId)
      message.success(t('pages.bdDeletedLeads.restoreSuccess', { defaultValue: 'Lead restored' }))
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdDeletedLeads.restoreFail', { defaultValue: 'Failed to restore lead' })
      message.error(text)
    }
  }

  async function handleBatchRestore(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.bdDeletedLeads.selectWarning', { defaultValue: 'Please select at least one lead' }))
      return
    }

    try {
      await restoreLeads(ids)
      message.success(
        t('pages.bdDeletedLeads.batchRestoreSuccess', {
          defaultValue: 'Restored {{count}} lead(s)',
          count: ids.length,
        }),
      )
      await loadRows()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdDeletedLeads.batchRestoreFail', { defaultValue: 'Failed to restore selected leads' })
      message.error(text)
    }
  }

  async function handleBatchPermanentDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.bdDeletedLeads.selectWarning', { defaultValue: 'Please select at least one lead' }))
      return
    }

    try {
      await hardDeleteLeads(ids)
      message.success(
        t('pages.bdDeletedLeads.batchPermanentDeleteSuccess', {
          defaultValue: 'Permanently deleted {{count}} lead(s)',
          count: ids.length,
        }),
      )
      await loadRows()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdDeletedLeads.batchPermanentDeleteFail', { defaultValue: 'Failed to permanently delete selected leads' })
      message.error(text)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.bdDeletedLeads.title', { defaultValue: 'Recently Deleted Leads' })}
        description={t('pages.bdDeletedLeads.description', {
          defaultValue: 'Review soft-deleted leads and permanently delete records when confirmed.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate('/app/bd/leads')}>
              {t('pages.bdDeletedLeads.backToList', { defaultValue: 'Back to Lead List' })}
            </Button>
            <Popconfirm
              title={t('pages.bdDeletedLeads.batchRestoreConfirmTitle', { defaultValue: 'Restore selected leads?' })}
              description={t('pages.bdDeletedLeads.batchRestoreConfirmDesc', {
                defaultValue: 'Selected leads will be moved back to the active lead list.',
              })}
              okText={t('labels.restore', { defaultValue: 'Restore' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchRestore(selectedIds)}
            >
              <Button disabled={selectedIds.length === 0}>
                {t('pages.bdDeletedLeads.restoreSelected', { defaultValue: 'Restore Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.bdDeletedLeads.batchPermanentDeleteConfirmTitle', { defaultValue: 'Permanently delete selected leads?' })}
              description={t('pages.bdDeletedLeads.batchPermanentDeleteConfirmDesc', {
                defaultValue: 'This action cannot be undone.',
              })}
              okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchPermanentDelete(selectedIds)}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('pages.bdDeletedLeads.deleteSelected', { defaultValue: 'Delete Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.bdDeletedLeads.batchPermanentDeleteAllConfirmTitle', { defaultValue: 'Permanently delete all filtered leads?' })}
              description={t('pages.bdDeletedLeads.batchPermanentDeleteAllConfirmDesc', {
                defaultValue: 'All currently filtered leads will be permanently deleted.',
              })}
              okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchPermanentDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                {t('pages.bdDeletedLeads.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
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
            placeholder={t('pages.bdDeletedLeads.keywordPlaceholder', { defaultValue: 'Keyword (lead code/company/contact)' })}
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
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('pages.bdDeletedLeads.columns.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code', width: 170 },
          { title: t('pages.bdDeletedLeads.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          { title: t('pages.bdDeletedLeads.columns.industry', { defaultValue: 'Industry' }), dataIndex: 'industry', width: 160 },
          { title: t('pages.bdDeletedLeads.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          {
            title: t('pages.bdDeletedLeads.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.bdDeletedLeads.columns.deletedAt', { defaultValue: 'Deleted At' }),
            dataIndex: 'deleted_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.bdDeletedLeads.columns.actions', { defaultValue: 'Actions' }),
            width: 280,
            render: (_: unknown, row: Lead) => (
              <Space wrap>
                <Popconfirm
                  title={t('pages.bdDeletedLeads.restoreConfirmTitle', { defaultValue: 'Restore this lead?' })}
                  description={t('pages.bdDeletedLeads.restoreConfirmDesc', {
                    defaultValue: 'The lead will be moved back to the active lead list.',
                  })}
                  okText={t('labels.restore', { defaultValue: 'Restore' })}
                  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handleRestoreLead(row.id)}
                >
                  <Button size="small">
                    {t('labels.restore', { defaultValue: 'Restore' })}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title={t('pages.bdDeletedLeads.permanentDeleteConfirmTitle', { defaultValue: 'Permanently delete this lead?' })}
                  description={t('pages.bdDeletedLeads.permanentDeleteConfirmDesc', { defaultValue: 'This action cannot be undone.' })}
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
