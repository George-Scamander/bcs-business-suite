import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  DatePicker,
  Input,
  Modal,
  Popconfirm,
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
  supabase,
} from '../../../lib/supabase/client'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getIntentPackageOptions,
  getLeadStatusOptions,
} from '../../../lib/business-constants'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  assignLead,
  listLeads,
  softDeleteLeads,
  type LeadFilters,
} from '../../leads/api'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import type {
  IntentPackage,
  Lead,
  LeadStatus,
} from '../../../types/business'

interface RoleMappingRow {
  user_id: string
  role: { code: string } | Array<{ code: string }> | null
}

function extractRoleCode(role: RoleMappingRow['role']): string | null {
  if (!role) {
    return null
  }

  if (Array.isArray(role)) {
    return role[0]?.code ?? null
  }

  return role.code
}

const LEAD_STATUS_VALUES: LeadStatus[] = ['NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING', 'ON_HOLD', 'LOST', 'SIGNED', 'REJECTED']
const INTENT_PACKAGE_VALUES: IntentPackage[] = ['BCS', 'PRODUCTS_SALES']

function parseLeadFiltersFromSearch(searchParams: URLSearchParams): { filters: LeadFilters; keyword: string } {
  const statusParam = searchParams.get('status')
  const intentPackageParam = searchParams.get('intentPackage')

  const status = statusParam && LEAD_STATUS_VALUES.includes(statusParam as LeadStatus) ? (statusParam as LeadStatus) : undefined
  const intentPackage =
    intentPackageParam && INTENT_PACKAGE_VALUES.includes(intentPackageParam as IntentPackage)
      ? (intentPackageParam as IntentPackage)
      : undefined

  const region = searchParams.get('region') ?? undefined
  const assignedBdId = searchParams.get('assignedBdId') ?? undefined
  const createdFrom = searchParams.get('createdFrom') ?? undefined
  const createdTo = searchParams.get('createdTo') ?? undefined
  const keyword = searchParams.get('q') ?? ''

  return {
    filters: {
      status,
      intentPackage,
      region: region || undefined,
      assignedBdId: assignedBdId || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    },
    keyword,
  }
}

export function AdminLeadPoolPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [bdUsers, setBdUsers] = useState<UserOption[]>([])
  const [filters, setFilters] = useState<LeadFilters>(() => parseLeadFiltersFromSearch(searchParams).filters)
  const [keyword, setKeyword] = useState(() => parseLeadFiltersFromSearch(searchParams).keyword)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>()
  const leadStatusOptions = useMemo(() => getLeadStatusOptions(t), [t])
  const intentPackageOptions = useMemo(() => getIntentPackageOptions(t), [t])

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [leadRows, userRows, roleMappingsResult] = await Promise.all([
        listLeads({
          ...filters,
          keyword: keyword.trim() || undefined,
        }),
        listActiveUsers(),
        supabase
          .from('user_role_relations')
          .select('user_id, role:roles(code)')
          .returns<RoleMappingRow[]>(),
      ])

      setRows(leadRows)
      setUsers(userRows)
      if (roleMappingsResult.error) {
        setBdUsers(userRows)
      } else {
        const bdUserIds = new Set(
          (roleMappingsResult.data ?? [])
            .filter((item) => extractRoleCode(item.role) === 'bd_user')
            .map((item) => item.user_id),
        )
        const candidateBdUsers = userRows.filter((item) => bdUserIds.has(item.id))
        setBdUsers(candidateBdUsers.length > 0 ? candidateBdUsers : userRows)
      }
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.adminLeadPool.loadFail', { defaultValue: 'Failed to load lead pool' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const parsed = parseLeadFiltersFromSearch(searchParams)
    setFilters((current) => (JSON.stringify(current) === JSON.stringify(parsed.filters) ? current : parsed.filters))
    setKeyword((current) => (current === parsed.keyword ? current : parsed.keyword))
  }, [searchParams])

  function openAssignModal(row: Lead) {
    setSelectedLead(row)
    setSelectedUserId(row.assigned_bd_id ?? undefined)
    setAssignModalOpen(true)
  }

  async function handleAssign() {
    if (!selectedLead || !selectedUserId) {
      message.warning(t('pages.adminLeadPool.assignSelectWarning', { defaultValue: 'Select target user' }))
      return
    }

    try {
      await assignLead(selectedLead.id, selectedUserId, 'admin_pool_assignment')
      message.success(t('pages.adminLeadPool.assignSuccess', { defaultValue: 'Lead assigned from pool' }))
      setAssignModalOpen(false)
      setSelectedLead(null)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.adminLeadPool.assignFail', { defaultValue: 'Failed to assign lead' })
      message.error(text)
    }
  }

  async function handleBatchDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.adminLeadPool.selectWarning', { defaultValue: 'Please select at least one lead' }))
      return
    }

    try {
      await softDeleteLeads(ids)
      message.success(t('pages.adminLeadPool.deleteSelectedSuccess', { defaultValue: 'Deleted {{count}} lead(s)', count: ids.length }))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error ? error.message : t('pages.adminLeadPool.deleteSelectedFail', { defaultValue: 'Failed to delete selected leads' })
      message.error(text)
    }
  }

  const userOptions = useMemo(() => {
    return bdUsers.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [bdUsers])

  const userNameById = useMemo(() => {
    return new Map(
      users.map((item) => [
        item.id,
        item.full_name ? `${item.full_name} (${item.email})` : item.email,
      ]),
    )
  }, [users])

  return (
    <>
      <PageTitleBar
        title={t('pages.adminLeadPool.title', { defaultValue: 'Lead Pool Management' })}
        description={t('pages.adminLeadPool.description', {
          defaultValue: 'Operate common lead pool, triage opportunities, and dispatch to responsible BD owners.',
        })}
        extra={
          <Space wrap>
            <Popconfirm
              title={t('pages.adminLeadPool.deleteSelectedConfirmTitle', { defaultValue: 'Delete selected leads?' })}
              description={t('pages.adminLeadPool.deleteSelectedConfirmDesc', {
                defaultValue: 'Selected leads will be moved to Recently Deleted.',
              })}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(selectedIds)}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('pages.adminLeadPool.deleteSelected', { defaultValue: 'Delete Selected' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('pages.adminLeadPool.deleteAllFilteredConfirmTitle', { defaultValue: 'Delete all filtered leads?' })}
              description={t('pages.adminLeadPool.deleteAllFilteredConfirmDesc', {
                defaultValue: 'All currently filtered leads will be moved to Recently Deleted.',
              })}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                {t('pages.adminLeadPool.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
              </Button>
            </Popconfirm>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder={t('pages.adminLeadPool.statusPlaceholder', { defaultValue: 'Status' })}
            options={leadStatusOptions}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder={t('pages.adminLeadPool.regionPlaceholder', { defaultValue: 'Region' })}
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Select
            allowClear
            showSearch
            style={{ width: 280 }}
            placeholder={t('pages.adminLeadPool.salesPlaceholder', { defaultValue: 'Sales / BD Owner' })}
            value={filters.assignedBdId}
            options={userOptions}
            onChange={(value) => setFilters((current) => ({ ...current, assignedBdId: value || undefined }))}
            optionFilterProp="label"
          />
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder={t('pages.adminLeadPool.intentPackagePlaceholder', { defaultValue: 'BCS Business' })}
            options={intentPackageOptions}
            value={filters.intentPackage}
            onChange={(value) => setFilters((current) => ({ ...current, intentPackage: value || undefined }))}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminLeadPool.createdFrom', { defaultValue: 'Created From' })}
            value={filters.createdFrom ? dayjs(filters.createdFrom) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdFrom: value ? value.startOf('day').toISOString() : undefined,
              }))
            }
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminLeadPool.createdTo', { defaultValue: 'Created To' })}
            value={filters.createdTo ? dayjs(filters.createdTo) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdTo: value ? value.endOf('day').toISOString() : undefined,
              }))
            }
          />
          <Input.Search
            allowClear
            style={{ width: 280 }}
            placeholder={t('pages.adminLeadPool.keywordPlaceholder', {
              defaultValue: 'Keyword (lead code/company/contact/source)',
            })}
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
          { title: t('pages.adminLeadPool.columns.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code', width: 170 },
          { title: t('pages.adminLeadPool.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          {
            title: t('pages.adminLeadPool.columns.assignedBd', { defaultValue: 'Assigned BD' }),
            dataIndex: 'assigned_bd_id',
            width: 260,
            render: (value: string | null) => (value ? userNameById.get(value) ?? value : '-'),
          },
          { title: t('pages.adminLeadPool.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          { title: t('pages.adminLeadPool.columns.industry', { defaultValue: 'Industry' }), dataIndex: 'industry', width: 170 },
          {
            title: t('pages.adminLeadPool.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.adminLeadPool.columns.actions', { defaultValue: 'Actions' }),
            width: 260,
            render: (_: unknown, row: Lead) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}`)}>
                  {t('pages.adminLeadPool.view', { defaultValue: 'View' })}
                </Button>
                <Button size="small" onClick={() => openAssignModal(row)}>
                  {t('pages.adminLeadPool.assign', { defaultValue: 'Assign' })}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={t('pages.adminLeadPool.assignModalTitle', { defaultValue: 'Assign from Lead Pool' })}
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedLead(null)
        }}
        onOk={() => void handleAssign()}
        okText={t('pages.adminLeadPool.assign', { defaultValue: 'Assign' })}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">{t('pages.adminLeadPool.assignLeadLabel', { defaultValue: 'Lead' })}: {selectedLead?.lead_code}</p>
          <Select
            showSearch
            optionFilterProp="label"
            value={selectedUserId}
            options={userOptions}
            onChange={(value) => setSelectedUserId(value)}
            placeholder={t('pages.adminLeadPool.selectUser', { defaultValue: 'Select user' })}
          />
        </Space>
      </Modal>
    </>
  )
}
