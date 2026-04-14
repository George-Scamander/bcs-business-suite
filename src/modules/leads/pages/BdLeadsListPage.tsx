import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Popconfirm, Select, Space, Table, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { LEAD_STATUS_OPTIONS } from '../../../lib/business-constants'
import { PERMISSIONS } from '../../../lib/permissions'
import { createLead, listLeads, softDeleteLead, assignLead as assignLeadApi, type LeadFilters } from '../api'
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
      message.success('Lead archived')
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
      message.warning('Select a target BD user')
      return
    }

    try {
      await assignLeadApi(selectedLead.id, assignTargetUserId, 'manual_reassign')
      message.success('Lead assigned successfully')
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
      const content = await file.text()
      const rowsToImport = parseCsv(content).filter((item) => item.company_name)

      if (rowsToImport.length === 0) {
        message.warning('No valid rows found. Please include a header with company_name.')
        return
      }

      for (const row of rowsToImport) {
        await createLead({
          ...row,
          assigned_bd_id: roles.includes('super_admin') ? undefined : user.id,
        })
      }

      message.success(`Imported ${rowsToImport.length} leads`)
      setImportFileList([])
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Bulk import failed'
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
        title="Lead List"
        description="Manage BD opportunities, keep follow-up discipline, and move leads through the conversion pipeline."
        extra={
          <Space>
            <Button onClick={() => void loadRows()}>Refresh</Button>
            {canImport ? (
              <Button icon={<UploadOutlined />} loading={importing} onClick={() => void handleImport()}>
                Import CSV
              </Button>
            ) : null}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/bd/leads/new')}>
              New Lead
            </Button>
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
              <Button icon={<UploadOutlined />}>Select CSV</Button>
            </Upload>
            <p className="mb-0 text-xs text-slate-500">
              CSV header example: company_name,contact_person,contact_phone,contact_email,industry,region,city,source,intent_level,estimated_value
            </p>
          </Space>
        </div>
      ) : null}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 180 }}
            options={LEAD_STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder="Region"
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Input
            placeholder="Industry"
            style={{ width: 180 }}
            value={filters.industry}
            onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value || undefined }))}
          />
          <Input.Search
            allowClear
            placeholder="Keyword (lead code/company/contact)"
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadRows()}
          />
          <Button type="primary" onClick={() => void loadRows()}>
            Apply
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
          { title: 'Lead Code', dataIndex: 'lead_code', width: 170 },
          { title: 'Company', dataIndex: 'company_name' },
          { title: 'Industry', dataIndex: 'industry', width: 160 },
          { title: 'Region', dataIndex: 'region', width: 140 },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Next Follow-up',
            dataIndex: 'next_followup_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: 'Actions',
            key: 'actions',
            width: 380,
            render: (_: unknown, row: Lead) => (
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}`)}>
                  Detail
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/edit`)}>
                  Edit
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/followups`)}>
                  Timeline
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/status`)}>
                  Status
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/sign`)}>
                  Sign
                </Button>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}/onboarding`)}>
                  Onboard
                </Button>
                {canAssign ? (
                  <Button size="small" onClick={() => openAssignModal(row)}>
                    Assign
                  </Button>
                ) : null}
                <Popconfirm
                  title="Archive this lead?"
                  description="The lead will be soft deleted and hidden from active list."
                  okText="Archive"
                  cancelText="Cancel"
                  onConfirm={() => void handleDeleteLead(row.id)}
                >
                  <Button size="small" danger>
                    Archive
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Assign Lead"
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedLead(null)
        }}
        onOk={() => void handleAssignLead()}
        okText="Assign"
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">Lead: {selectedLead?.lead_code}</p>
          <Select
            showSearch
            placeholder="Select target user"
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
