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
  Select,
  Space,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
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
  type LeadFilters,
} from '../api'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import type {
  Lead,
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

export function PmLeadPoolPage() {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [bdUsers, setBdUsers] = useState<UserOption[]>([])
  const [filters, setFilters] = useState<LeadFilters>({})
  const [keyword, setKeyword] = useState('')

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
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load PM lead pool'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openAssignModal(row: Lead) {
    setSelectedLead(row)
    setSelectedUserId(row.assigned_bd_id ?? undefined)
    setAssignModalOpen(true)
  }

  async function handleAssign() {
    if (!selectedLead || !selectedUserId) {
      message.warning(t('pages.bdLeads.assignSelectWarning', { defaultValue: 'Select a target BD user' }))
      return
    }

    try {
      await assignLead(selectedLead.id, selectedUserId, 'pm_pool_assignment')
      message.success(t('pages.bdLeads.assignSuccess', { defaultValue: 'Lead assigned successfully' }))
      setAssignModalOpen(false)
      setSelectedLead(null)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.assignFail', { defaultValue: 'Failed to assign lead' })
      message.error(text)
    }
  }

  const bdUserOptions = useMemo(() => {
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
        title={t('pages.pmLeadPool.title', { defaultValue: 'PM Lead Pool' })}
        description={t('pages.pmLeadPool.description', {
          defaultValue: 'Review PM-created or accessible leads and assign responsible BD owners.',
        })}
        extra={
          <Space wrap>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder={t('pages.bdLeads.statusPlaceholder', { defaultValue: 'Status' })}
            options={leadStatusOptions}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder={t('pages.bdLeads.regionPlaceholder', { defaultValue: 'Region' })}
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Select
            allowClear
            showSearch
            style={{ width: 280 }}
            placeholder={t('pages.pmLeadPool.salesPlaceholder', { defaultValue: 'Sales / BD Owner' })}
            value={filters.assignedBdId}
            options={bdUserOptions}
            onChange={(value) => setFilters((current) => ({ ...current, assignedBdId: value || undefined }))}
            optionFilterProp="label"
          />
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder={t('pages.pmLeadPool.intentPackagePlaceholder', { defaultValue: 'BCS Business' })}
            options={intentPackageOptions}
            value={filters.intentPackage}
            onChange={(value) => setFilters((current) => ({ ...current, intentPackage: value || undefined }))}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.pmLeadPool.createdFrom', { defaultValue: 'Created From' })}
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
            placeholder={t('pages.pmLeadPool.createdTo', { defaultValue: 'Created To' })}
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
            placeholder={t('pages.pmLeadPool.keywordPlaceholder', {
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
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('pages.pmLeadPool.columns.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code', width: 170 },
          { title: t('pages.pmLeadPool.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          {
            title: t('pages.pmLeadPool.assignedBd', { defaultValue: 'Assigned BD' }),
            dataIndex: 'assigned_bd_id',
            width: 260,
            render: (value: string | null) => (value ? userNameById.get(value) ?? value : '-'),
          },
          { title: t('pages.pmLeadPool.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          {
            title: t('pages.pmLeadPool.columns.industry', { defaultValue: 'Industry' }),
            dataIndex: 'industry',
            width: 170,
            responsive: ['md'],
          },
          {
            title: t('pages.pmLeadPool.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.pmLeadPool.columns.actions', { defaultValue: 'Actions' }),
            width: 160,
            render: (_: unknown, row: Lead) => (
              <Button size="small" onClick={() => openAssignModal(row)}>
                {t('pages.bdLeads.actionAssign', { defaultValue: 'Assign' })}
              </Button>
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
        onOk={() => void handleAssign()}
        okText={t('pages.bdLeads.actionAssign', { defaultValue: 'Assign' })}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">
            {t('pages.pmLeadPool.assignLeadLabel', { defaultValue: 'Lead' })}: {selectedLead?.lead_code}
          </p>
          <Select
            showSearch
            optionFilterProp="label"
            value={selectedUserId}
            options={bdUserOptions}
            onChange={(value) => setSelectedUserId(value)}
            placeholder={t('pages.bdLeads.assignTargetPlaceholder', { defaultValue: 'Select target user' })}
          />
        </Space>
      </Modal>
    </>
  )
}
