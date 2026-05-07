import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Popconfirm, Select, Space, Table, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { LEAD_STATUS_OPTIONS } from '../../../lib/business-constants'
import { PERMISSIONS } from '../../../lib/permissions'
import { createLead, listLeads, softDeleteLead, softDeleteLeads, assignLead as assignLeadApi, type LeadFilters } from '../api'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import type { Lead } from '../../../types/business'

interface ImportLeadRow {
  company_name: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  industry?: string
  region?: string
  city?: string
  source?: string
  intent_level?: number
  estimated_value?: number
}

function parseCsv(content: string): ImportLeadRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length <= 1) {
    return []
  }

  const headers = lines[0].split(',').map((item) => item.trim())

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim())
    const row: Record<string, string> = {}

    headers.forEach((key, index) => {
      row[key] = values[index] ?? ''
    })

    return {
      company_name: row.company_name,
      contact_person: row.contact_person || undefined,
      contact_phone: row.contact_phone || undefined,
      contact_email: row.contact_email || undefined,
      industry: row.industry || undefined,
      region: row.region || undefined,
      city: row.city || undefined,
      source: row.source || undefined,
      intent_level: row.intent_level ? Number(row.intent_level) : undefined,
      estimated_value: row.estimated_value ? Number(row.estimated_value) : undefined,
    }
  })
}

export function BdLeadsListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, roles, hasPermission } = useAuth()

  const [rows, setRows] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LeadFilters>({})
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importFileList, setImportFileList] = useState<UploadFile[]>([])

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>()
  const [userOptions, setUserOptions] = useState<UserOption[]>([])

  const canAssign = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_ASSIGN)
  const canImport = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_IMPORT)
  const canCreateLead = roles.includes('bd_user')

  const loadRows = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const result = await listLeads({
        ...filters,
        keyword: keyword.trim() || undefined,
        assignedBdId: roles.includes('super_admin') ? filters.assignedBdId : user.id,
      })

      setRows(result)
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.loadFail', { defaultValue: 'Failed to load leads' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, roles, t, user])

  const loadUsers = useCallback(async () => {
    if (!canAssign) {
      return
    }

    try {
      const result = await listActiveUsers()
      setUserOptions(result)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdLeads.loadAssigneeFail', { defaultValue: 'Failed to load users for assignment' })
      message.error(text)
    }
  }, [canAssign, t])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function handleDeleteLead(leadId: string) {
    try {
      await softDeleteLead(leadId)
      message.success(t('pages.bdLeads.deleteSuccess', { defaultValue: 'Lead moved to Recently Deleted' }))
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.deleteFail', { defaultValue: 'Failed to delete lead' })
      message.error(text)
    }
  }

  async function handleBatchDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.bdLeads.bulkDeleteSelectWarning', { defaultValue: 'Please select at least one lead' }))
      return
    }

    try {
      await softDeleteLeads(ids)
      message.success(
        t('pages.bdLeads.bulkDeleteSuccess', {
          defaultValue: 'Deleted {{count}} lead(s)',
          count: ids.length,
        }),
      )
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.bulkDeleteFail', { defaultValue: 'Failed to delete selected leads' })
      message.error(text)
    }
  }

  function openAssignModal(lead: Lead) {
    setSelectedLead(lead)
    setAssignTargetUserId(lead.assigned_bd_id ?? undefined)
    setAssignModalOpen(true)
  }

  async function handleAssignLead() {
    if (!selectedLead || !assignTargetUserId) {
      message.warning(t('pages.bdLeads.assignSelectWarning', { defaultValue: 'Select a target BD user' }))
      return
    }

    try {
      await assignLeadApi(selectedLead.id, assignTargetUserId, 'manual_reassign')
      message.success(t('pages.bdLeads.assignSuccess', { defaultValue: 'Lead assigned successfully' }))
      setAssignModalOpen(false)
      setSelectedLead(null)
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.assignFail', { defaultValue: 'Failed to assign lead' })
      message.error(text)
    }
  }

  async function handleImport() {
    if (!user) {
      return
    }

    const file = importFileList[0]?.originFileObj

    if (!file) {
      message.warning(t('pages.bdLeads.importSelectCsvWarning', { defaultValue: 'Please select a CSV file first' }))
      return
    }

    setImporting(true)

    try {
      const content = await file.text()
      const rowsToImport = parseCsv(content).filter((item) => item.company_name)

      if (rowsToImport.length === 0) {
        message.warning(
          t('pages.bdLeads.importNoRowsWarning', {
            defaultValue: 'No valid rows found. Please include a header with company_name.',
          }),
        )
        return
      }

      for (const row of rowsToImport) {
        await createLead({
          ...row,
          assigned_bd_id: roles.includes('super_admin') ? undefined : user.id,
        })
      }

      message.success(
        t('pages.bdLeads.importSuccess', {
          defaultValue: `Imported ${rowsToImport.length} leads`,
          count: rowsToImport.length,
        }),
      )
      setImportFileList([])
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.importFail', { defaultValue: 'Bulk import failed' })
      message.error(text)
    } finally {
      setImporting(false)
    }
  }

  const assignSelectOptions = useMemo(() => {
    return userOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [userOptions])

  return (
    <>
      <PageTitleBar
        title={t('pages.bdLeads.title', { defaultValue: 'Lead List' })}
        description={t('pages.bdLeads.description', {
          defaultValue: 'Manage BD opportunities, keep follow-up discipline, and move leads through the conversion pipeline.',
        })}
        extra={
          <Space>
            <Button onClick={() => void loadRows()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button onClick={() => navigate('/app/recently-deleted')}>
              {t('pages.bdLeads.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
            </Button>
            <Popconfirm
              title={t('pages.bdLeads.bulkDeleteConfirmTitle', { defaultValue: 'Delete selected leads?' })}
              description={t('pages.bdLeads.bulkDeleteConfirmDesc', {
                defaultValue: 'Selected leads will be moved to Recently Deleted.',
              })}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(selectedIds)}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('pages.bdLeads.deleteSelected', { defaultValue: 'Delete Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.bdLeads.bulkDeleteAllConfirmTitle', { defaultValue: 'Delete all filtered leads?' })}
              description={t('pages.bdLeads.bulkDeleteAllConfirmDesc', {
                defaultValue: 'All currently filtered leads will be moved to Recently Deleted.',
              })}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                {t('pages.bdLeads.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
              </Button>
            </Popconfirm>
            {canImport ? (
              <Button icon={<UploadOutlined />} loading={importing} onClick={() => void handleImport()}>
                {t('pages.bdLeads.importCsv', { defaultValue: 'Import CSV' })}
              </Button>
            ) : null}
            {canCreateLead ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/bd/leads/new')}>
                {t('pages.bdLeads.newLead', { defaultValue: 'New Lead' })}
              </Button>
            ) : null}
          </Space>
        }
      />

      {canImport ? (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
          <Space direction="vertical" size={8} className="w-full">
            <Upload
              maxCount={1}
              accept=".csv"
              beforeUpload={() => false}
              fileList={importFileList}
              onChange={(info) => setImportFileList(info.fileList)}
              onRemove={(file) => {
                setImportFileList((current) => current.filter((item) => item.uid !== file.uid))
              }}
            >
              <Button icon={<UploadOutlined />}>{t('pages.bdLeads.selectCsv', { defaultValue: 'Select CSV' })}</Button>
            </Upload>
            <p className="mb-0 text-xs text-slate-500">
              {t('pages.bdLeads.csvHeaderHint', {
                defaultValue:
                  'CSV header example: company_name,contact_person,contact_phone,contact_email,industry,region,city,source,intent_level,estimated_value',
              })}
            </p>
          </Space>
        </div>
      ) : null}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('pages.bdLeads.statusPlaceholder', { defaultValue: 'Status' })}
            style={{ width: 180 }}
            options={LEAD_STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder={t('pages.bdLeads.regionPlaceholder', { defaultValue: 'Region' })}
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Input
            placeholder={t('pages.bdLeads.industryPlaceholder', { defaultValue: 'Industry' })}
            style={{ width: 180 }}
            value={filters.industry}
            onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value || undefined }))}
          />
          <Input.Search
            allowClear
            placeholder={t('pages.bdLeads.keywordPlaceholder', { defaultValue: 'Keyword (lead code/company/contact)' })}
            style={{ width: 280 }}
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
          { title: t('pages.bdLeads.columns.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code', width: 170 },
          { title: t('pages.bdLeads.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          { title: t('pages.bdLeads.columns.industry', { defaultValue: 'Industry' }), dataIndex: 'industry', width: 160 },
          { title: t('pages.bdLeads.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          {
            title: t('pages.bdLeads.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.bdLeads.nextFollowup', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.bdLeads.actions', { defaultValue: 'Actions' }),
            key: 'actions',
            width: 380,
            render: (_: unknown, row: Lead) => (
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}`)}>
                  {t('pages.bdLeads.actionDetail', { defaultValue: 'Detail' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/edit`)}>
                  {t('pages.bdLeads.actionEdit', { defaultValue: 'Edit' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/followups`)}>
                  {t('pages.bdLeads.actionTimeline', { defaultValue: 'Timeline' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/status`)}>
                  {t('pages.bdLeads.actionStatus', { defaultValue: 'Status' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/sign`)}>
                  {t('pages.bdLeads.actionSign', { defaultValue: 'Sign' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/onboarding`)}>
                  {t('pages.bdLeads.actionOnboard', { defaultValue: 'Onboard' })}
                </Button>
                {canAssign ? (
                  <Button size="small" onClick={() => openAssignModal(row)}>
                    {t('pages.bdLeads.actionAssign', { defaultValue: 'Assign' })}
                  </Button>
                ) : null}
                <Popconfirm
                  title={t('pages.bdLeads.deleteConfirmTitle', { defaultValue: 'Delete this lead?' })}
                  description={t('pages.bdLeads.deleteConfirmDesc', { defaultValue: 'The lead will be moved to Recently Deleted.' })}
                  okText={t('labels.delete', { defaultValue: 'Delete' })}
                  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handleDeleteLead(row.id)}
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

      <Modal
        title={t('pages.bdLeads.assignModalTitle', { defaultValue: 'Assign Lead' })}
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedLead(null)
        }}
        onOk={() => void handleAssignLead()}
        okText={t('pages.bdLeads.actionAssign', { defaultValue: 'Assign' })}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">
            {t('pages.bdLeads.assignLeadLabel', { defaultValue: 'Lead' })}: {selectedLead?.lead_code}
          </p>
          <Select
            showSearch
            placeholder={t('pages.bdLeads.assignTargetPlaceholder', { defaultValue: 'Select target user' })}
            options={assignSelectOptions}
            value={assignTargetUserId}
            onChange={(value) => setAssignTargetUserId(value)}
            className="w-full"
            optionFilterProp="label"
          />
        </Space>
      </Modal>
    </>
  )
}
