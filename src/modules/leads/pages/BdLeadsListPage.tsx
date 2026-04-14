import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Popconfirm, Select, Space, Table, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getIndustryOptions, getLeadStatusOptions } from '../../../lib/business-constants'
import { PERMISSIONS } from '../../../lib/permissions'
import { checkDuplicateLeadByCompanyName, createLead, listLeads, softDeleteLead, assignLead as assignLeadApi, type LeadFilters } from '../api'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import type { Lead } from '../../../types/business'
import { exportRowsToCsv } from '../../reports/api'

interface ImportLeadRow {
  company_name: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  industry?: string
  region?: string
  city?: string
  source?: string
  intent_package?: 'BCS' | 'PRODUCTS_SALES'
  intent_level?: number
  bd_notes?: string
  team_attention_note?: string
  duplicate_note?: string
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
      intent_package:
        row.intent_package === 'BCS' || row.intent_package === 'PRODUCTS_SALES'
          ? row.intent_package
          : undefined,
      intent_level: row.intent_level ? Number(row.intent_level) : undefined,
      bd_notes: row.bd_notes || undefined,
      team_attention_note: row.team_attention_note || undefined,
      duplicate_note: row.duplicate_note || undefined,
    }
  })
}

function normalizeImportRow(raw: Record<string, unknown>): ImportLeadRow {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = raw[key]
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim()
      }
    }

    return ''
  }

  const packageRaw = get('intent_package', 'potential_package', 'contract_package')
  const normalizedPackage = packageRaw.toUpperCase().replaceAll(' ', '_')

  return {
    company_name: get('company_name', 'company', 'workshop_name'),
    contact_person: get('contact_person', 'contact') || undefined,
    contact_phone: get('contact_phone', 'phone') || undefined,
    contact_email: get('contact_email', 'email') || undefined,
    industry: get('industry') || undefined,
    region: get('region') || undefined,
    city: get('city') || undefined,
    source: get('source') || undefined,
    intent_package:
      normalizedPackage === 'BCS' || normalizedPackage === 'PRODUCTS_SALES'
        ? (normalizedPackage as 'BCS' | 'PRODUCTS_SALES')
        : undefined,
    intent_level: get('intent_level') ? Number(get('intent_level')) : undefined,
    bd_notes: get('bd_notes', 'remark') || undefined,
    team_attention_note: get('team_attention_note', 'team_note', 'special_note') || undefined,
    duplicate_note: get('duplicate_note') || undefined,
  }
}

function parseExcel(file: File): Promise<ImportLeadRow[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      return []
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
    return rawRows.map((row) => normalizeImportRow(row)).filter((row) => row.company_name)
  })
}

export function BdLeadsListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, roles, hasPermission } = useAuth()

  const [rows, setRows] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LeadFilters>({})
  const [keyword, setKeyword] = useState('')
  const [importing, setImporting] = useState(false)
  const [importFileList, setImportFileList] = useState<UploadFile[]>([])

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>()
  const [userOptions, setUserOptions] = useState<UserOption[]>([])

  const canAssign = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_ASSIGN)
  const canImport = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_IMPORT)

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
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load leads'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, roles, user])

  const loadUsers = useCallback(async () => {
    if (!canAssign) {
      return
    }

    try {
      const result = await listActiveUsers()
      setUserOptions(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load users for assignment'
      message.error(text)
    }
  }, [canAssign])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function handleDeleteLead(leadId: string) {
    try {
      await softDeleteLead(leadId)
      message.success(t('page.leads.archiveSuccess', { defaultValue: 'Lead archived' }))
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to archive lead'
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
      message.warning(t('page.leads.selectTargetUser', { defaultValue: 'Select target user' }))
      return
    }

    try {
      await assignLeadApi(selectedLead.id, assignTargetUserId, 'manual_reassign')
      message.success(t('page.leads.assignSuccess', { defaultValue: 'Lead assigned successfully' }))
      setAssignModalOpen(false)
      setSelectedLead(null)
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to assign lead'
      message.error(text)
    }
  }

  async function handleImport() {
    if (!user) {
      return
    }

    const file = importFileList[0]?.originFileObj

    if (!file) {
      message.warning('Please select a CSV file first')
      return
    }

    setImporting(true)

    try {
      let rowsToImport: ImportLeadRow[] = []
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')

      if (isExcel) {
        rowsToImport = await parseExcel(file)
      } else {
        const content = await file.text()
        rowsToImport = parseCsv(content).filter((item) => item.company_name)
      }

      if (rowsToImport.length === 0) {
        message.warning(t('page.leads.noValidImportRows', { defaultValue: 'No valid rows found. Please include company_name.' }))
        return
      }

      for (const row of rowsToImport) {
        const duplicates = await checkDuplicateLeadByCompanyName(row.company_name)
        const duplicateNote =
          row.duplicate_note ??
          (duplicates.length > 0 ? `Duplicate with ${duplicates.map((item) => item.lead_code).join(', ')}` : undefined)

        await createLead({
          ...row,
          duplicate_note: duplicateNote,
          assigned_bd_id: roles.includes('super_admin') ? undefined : user.id,
        })
      }

      message.success(t('page.leads.importedCount', { defaultValue: `Imported ${rowsToImport.length} leads`, count: rowsToImport.length }))
      setImportFileList([])
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Bulk import failed'
      message.error(text)
    } finally {
      setImporting(false)
    }
  }

  function handleExportLeads() {
    const exportRows = rows.map((item) => ({
      lead_code: item.lead_code,
      company_name: item.company_name,
      contact_person: item.contact_person,
      contact_phone: item.contact_phone,
      contact_email: item.contact_email,
      industry: item.industry,
      region: item.region,
      city: item.city,
      source: item.source,
      intent_package: item.intent_package,
      intent_level: item.intent_level,
      status: item.status,
      next_followup_at: item.next_followup_at,
      bd_notes: item.bd_notes,
      team_attention_note: item.team_attention_note,
      duplicate_note: item.duplicate_note,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }))

    exportRowsToCsv(`bcs-leads-export-${new Date().toISOString().slice(0, 10)}.csv`, exportRows)
    message.success(t('page.leads.exportSuccess', { defaultValue: 'Lead data exported' }))
  }

  const assignSelectOptions = useMemo(() => {
    return userOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [userOptions])

  const localizedIndustryOptions = useMemo(() => getIndustryOptions(t), [t])
  const industryLabelMap = useMemo<Record<string, string>>(
    () =>
      localizedIndustryOptions.reduce<Record<string, string>>((acc, item) => {
        acc[item.value] = item.label
        return acc
      }, {}),
    [localizedIndustryOptions],
  )

  return (
    <>
      <PageTitleBar
        title={t('page.leads.listTitle', { defaultValue: 'Lead List' })}
        description={t('page.leads.listDesc', {
          defaultValue: 'Manage opportunities, maintain follow-up discipline, and sync team notes.',
        })}
        extra={
          <Space>
            <Button onClick={() => void loadRows()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button onClick={() => handleExportLeads()}>{t('page.leads.exportData', { defaultValue: 'Export Data' })}</Button>
            {canImport ? (
              <Button icon={<UploadOutlined />} loading={importing} onClick={() => void handleImport()}>
                {t('page.leads.importData', { defaultValue: 'Import CSV/Excel' })}
              </Button>
            ) : null}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/bd/leads/new')}>
              {t('page.leads.newLead', { defaultValue: 'New Lead' })}
            </Button>
          </Space>
        }
      />

      {canImport ? (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
          <Space direction="vertical" size={8} className="w-full">
            <Upload
              maxCount={1}
              accept=".csv,.xlsx,.xls"
              beforeUpload={() => false}
              fileList={importFileList}
              onChange={(info) => setImportFileList(info.fileList)}
              onRemove={(file) => {
                setImportFileList((current) => current.filter((item) => item.uid !== file.uid))
              }}
            >
              <Button icon={<UploadOutlined />}>{t('page.leads.selectImportFile', { defaultValue: 'Select CSV/Excel' })}</Button>
            </Upload>
            <p className="mb-0 text-xs text-slate-500">
              {t('page.leads.importHint', {
                defaultValue:
                  'Headers example: company_name,contact_person,contact_phone,contact_email,industry,region,city,source,intent_package,intent_level,bd_notes,team_attention_note,duplicate_note',
              })}
            </p>
          </Space>
        </div>
      ) : null}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('page.common.status', { defaultValue: 'Status' })}
            style={{ width: 180 }}
            options={getLeadStatusOptions(t)}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder={t('page.common.region', { defaultValue: 'Region' })}
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Select
            allowClear
            options={localizedIndustryOptions}
            placeholder={t('page.common.industry', { defaultValue: 'Industry' })}
            style={{ width: 180 }}
            value={filters.industry}
            onChange={(value) => setFilters((current) => ({ ...current, industry: value ?? undefined }))}
          />
          <Input.Search
            allowClear
            placeholder={t('page.leads.keywordPlaceholder', { defaultValue: 'Keyword (lead code/company/contact)' })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadRows()}
          />
          <Button type="primary" onClick={() => void loadRows()}>
            {t('page.common.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('page.admin.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code', width: 170 },
          { title: t('page.common.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          {
            title: t('page.common.industry', { defaultValue: 'Industry' }),
            dataIndex: 'industry',
            width: 160,
            render: (value: string | null) => (value ? industryLabelMap[value] ?? value : '-'),
          },
          { title: t('page.common.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.leads.nextFollowup', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('page.leads.teamAttentionNote', { defaultValue: 'Team Attention Note' }),
            dataIndex: 'team_attention_note',
            width: 280,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            key: 'actions',
            width: 380,
            render: (_: unknown, row: Lead) => (
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}`)}>
                  {t('page.common.view', { defaultValue: 'View' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/edit`)}>
                  {t('page.leads.edit', { defaultValue: 'Edit' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/followups`)}>
                  {t('page.leads.timeline', { defaultValue: 'Timeline' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/status`)}>
                  {t('page.common.status', { defaultValue: 'Status' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/sign`)}>
                  {t('page.leads.sign', { defaultValue: 'Sign' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/onboarding`)}>
                  {t('page.leads.onboard', { defaultValue: 'Onboard' })}
                </Button>
                {canAssign ? (
                  <Button size="small" onClick={() => openAssignModal(row)}>
                    {t('page.common.assign', { defaultValue: 'Assign' })}
                  </Button>
                ) : null}
                <Popconfirm
                  title={t('page.leads.archiveConfirmTitle', { defaultValue: 'Archive this lead?' })}
                  description={t('page.leads.archiveConfirmDesc', {
                    defaultValue: 'The lead will be soft deleted and hidden from active list.',
                  })}
                  okText={t('page.leads.archive', { defaultValue: 'Archive' })}
                  cancelText={t('page.usersRoles.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handleDeleteLead(row.id)}
                >
                  <Button size="small" danger>
                    {t('page.leads.archive', { defaultValue: 'Archive' })}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={t('page.leads.assignLead', { defaultValue: 'Assign Lead' })}
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedLead(null)
        }}
        onOk={() => void handleAssignLead()}
        okText={t('page.common.assign', { defaultValue: 'Assign' })}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">
            {t('page.admin.leadLabel', { defaultValue: 'Lead' })}: {selectedLead?.lead_code}
          </p>
          <Select
            showSearch
            placeholder={t('page.leads.selectTargetUser', { defaultValue: 'Select target user' })}
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
