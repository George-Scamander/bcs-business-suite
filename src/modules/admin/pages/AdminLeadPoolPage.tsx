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
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { EnvironmentOutlined, ExportOutlined, SettingOutlined } from '@ant-design/icons'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useLocation,
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
  formatDisplayName,
  formatUserOptionLabel,
} from '../../../lib/user-display'

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
  listLeadMerchantHealth,
  listLeads,
  softDeleteLeads,
  type LeadMerchantHealth,
  type LeadMerchantHealthTier,
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
const INTENT_PACKAGE_VALUES: IntentPackage[] = ['BCS', 'PRODUCTS_SALES', 'BOTH']
const INTENT_PACKAGE_GROUP_VALUES = ['BCS_RELATED', 'NON_BCS'] as const
const SIGNED_CONTRACT_PACKAGE_GROUP_VALUES = ['BCS_RELATED', 'NON_BCS'] as const
const MERCHANT_HEALTH_TIER_VALUES: LeadMerchantHealthTier[] = ['STAR', 'NORMAL', 'RISK']

function parseLeadFiltersFromSearch(searchParams: URLSearchParams): { filters: LeadFilters; keyword: string } {
  const statusParam = searchParams.get('status')
  const intentPackageParam = searchParams.get('intentPackage')
  const intentPackageGroupParam = searchParams.get('intentPackageGroup')
  const signedContractPackageGroupParam = searchParams.get('signedContractPackageGroup')
  const intentLevelMinParam = searchParams.get('intentLevelMin')
  const intentLevelMaxParam = searchParams.get('intentLevelMax')
  const hasSalesOrderParam = searchParams.get('hasSalesOrder')
  const merchantHealthTierParam = searchParams.get('merchantHealthTier')

  const status = statusParam && LEAD_STATUS_VALUES.includes(statusParam as LeadStatus) ? (statusParam as LeadStatus) : undefined
  const intentPackage =
    intentPackageParam && INTENT_PACKAGE_VALUES.includes(intentPackageParam as IntentPackage)
      ? (intentPackageParam as IntentPackage)
      : undefined
  const intentPackageGroup =
    intentPackageGroupParam && INTENT_PACKAGE_GROUP_VALUES.includes(intentPackageGroupParam as (typeof INTENT_PACKAGE_GROUP_VALUES)[number])
      ? (intentPackageGroupParam as LeadFilters['intentPackageGroup'])
      : undefined
  const signedContractPackageGroup =
    signedContractPackageGroupParam &&
    SIGNED_CONTRACT_PACKAGE_GROUP_VALUES.includes(signedContractPackageGroupParam as (typeof SIGNED_CONTRACT_PACKAGE_GROUP_VALUES)[number])
      ? (signedContractPackageGroupParam as LeadFilters['signedContractPackageGroup'])
      : undefined
  const parsedIntentLevelMin = intentLevelMinParam ? Number(intentLevelMinParam) : NaN
  const parsedIntentLevelMax = intentLevelMaxParam ? Number(intentLevelMaxParam) : NaN
  const intentLevelMin = Number.isFinite(parsedIntentLevelMin) ? Math.max(0, Math.min(5, parsedIntentLevelMin)) : undefined
  const intentLevelMax = Number.isFinite(parsedIntentLevelMax) ? Math.max(0, Math.min(5, parsedIntentLevelMax)) : undefined
  const hasSalesOrder = hasSalesOrderParam === '1' ? true : hasSalesOrderParam === '0' ? false : undefined
  const merchantHealthTier =
    merchantHealthTierParam && MERCHANT_HEALTH_TIER_VALUES.includes(merchantHealthTierParam as LeadMerchantHealthTier)
      ? (merchantHealthTierParam as LeadMerchantHealthTier)
      : undefined

  const region = searchParams.get('region') ?? undefined
  const assignedBdId = searchParams.get('assignedBdId') ?? undefined
  const createdFrom = searchParams.get('createdFrom') ?? undefined
  const createdTo = searchParams.get('createdTo') ?? undefined
  const excludeSigned = searchParams.get('excludeSigned') === '1'
  const keyword = searchParams.get('q') ?? ''

  return {
    filters: {
      status,
      intentPackage,
      intentPackageGroup,
      signedContractPackageGroup,
      intentLevelMin,
      intentLevelMax,
      excludeSigned,
      region: region || undefined,
      assignedBdId: assignedBdId || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      hasSalesOrder,
      merchantHealthTier,
    },
    keyword,
  }
}

export function AdminLeadPoolPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Lead[]>([])
  const [bdMatchedLeadIdSet, setBdMatchedLeadIdSet] = useState<Set<string>>(new Set())
  const [todayFollowupLeadIdSet, setTodayFollowupLeadIdSet] = useState<Set<string>>(new Set())
  const [merchantHealthByLeadId, setMerchantHealthByLeadId] = useState<Map<string, LeadMerchantHealth>>(new Map())
  const [users, setUsers] = useState<UserOption[]>([])
  const [bdUsers, setBdUsers] = useState<UserOption[]>([])
  const [filters, setFilters] = useState<LeadFilters>(() => parseLeadFiltersFromSearch(searchParams).filters)
  const [keyword, setKeyword] = useState(() => parseLeadFiltersFromSearch(searchParams).keyword)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [controlPanelOpen, setControlPanelOpen] = useState(false)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>()
  const leadStatusOptions = useMemo(() => getLeadStatusOptions(t), [t])
  const intentPackageOptions = useMemo(() => getIntentPackageOptions(t), [t])
  const deleteRetentionHint = t('labels.autoDelete30DaysHint', {
    defaultValue: 'Moved to Recently Deleted and auto-permanently deleted after 30 days.',
  })

  const loadData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true)
    }

    try {
      const keywordValue = keyword.trim() || undefined
      const shouldMergeTodayFollowup = Boolean(filters.assignedBdId)
      const startOfTodayIso = dayjs().startOf('day').toISOString()
      const endOfTodayIso = dayjs().endOf('day').toISOString()
      const leadFilters: LeadFilters = {
        ...filters,
        keyword: keywordValue,
      }

      const [leadRows, todayFollowupRows, merchantHealthRows, userRows, roleMappingsResult] = await Promise.all([
        listLeads(leadFilters),
        shouldMergeTodayFollowup
          ? listLeads({
              ...leadFilters,
              assignedBdId: undefined,
              followupFrom: startOfTodayIso,
              followupTo: endOfTodayIso,
            })
          : Promise.resolve([] as Lead[]),
        listLeadMerchantHealth(),
        listActiveUsers(),
        supabase
          .from('user_role_relations')
          .select('user_id, role:roles(code)')
          .returns<RoleMappingRow[]>(),
      ])

      const bdMatchedIds = shouldMergeTodayFollowup ? new Set(leadRows.map((item) => item.id)) : new Set<string>()
      const todayFollowupIds = shouldMergeTodayFollowup ? new Set(todayFollowupRows.map((item) => item.id)) : new Set<string>()
      const mergedRows = shouldMergeTodayFollowup
        ? Array.from(new Map([...leadRows, ...todayFollowupRows].map((item) => [item.id, item])).values()).sort((a, b) => {
            const aTime = new Date(a.updated_at).getTime()
            const bTime = new Date(b.updated_at).getTime()
            return bTime - aTime
          })
        : leadRows

      const healthByLeadId = new Map(merchantHealthRows.map((item) => [item.lead_id, item]))
      const filteredRows = mergedRows.filter((item) => {
        const health = healthByLeadId.get(item.id)
        if (filters.hasSalesOrder !== undefined && Boolean(health) !== filters.hasSalesOrder) {
          return false
        }
        if (filters.merchantHealthTier && health?.health_tier !== filters.merchantHealthTier) {
          return false
        }
        return true
      })

      setRows(filteredRows)
      setBdMatchedLeadIdSet(bdMatchedIds)
      setTodayFollowupLeadIdSet(todayFollowupIds)
      setMerchantHealthByLeadId(healthByLeadId)
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
      if (!options.silent) {
        setLoading(false)
      }
    }
  }, [filters, keyword, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleHealthRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }

      refreshTimer = setTimeout(() => {
        void loadData({ silent: true })
      }, 300)
    }

    const channel = supabase
      .channel('admin-lead-pool-merchant-health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, scheduleHealthRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, scheduleHealthRefresh)
      .subscribe()

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }
      void supabase.removeChannel(channel)
    }
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
      label: formatUserOptionLabel(item),
    }))
  }, [bdUsers])

  const userNameById = useMemo(() => {
    return new Map(
      users.map((item) => [
        item.id,
        formatDisplayName(item.full_name, item.email, item.id),
      ]),
    )
  }, [users])

  function openLeadDetail(leadId: string) {
    const backPath = `${location.pathname}${location.search}`
    navigate(`/app/bd/leads/${leadId}?back=${encodeURIComponent(backPath)}`)
  }

  async function handleApplyControlPanel() {
    await loadData()
    setControlPanelOpen(false)
  }

  function renderMerchantHealthTag(row: Lead) {
    const merchantHealth = merchantHealthByLeadId.get(row.id)
    if (!merchantHealth) {
      return null
    }

    const healthLabel = merchantHealth.health_tier === 'STAR'
      ? t('pages.adminLeadPool.merchantHealthTierStar', { defaultValue: 'Star Merchant' })
      : merchantHealth.health_tier === 'NORMAL'
        ? t('pages.adminLeadPool.merchantHealthTierNormal', { defaultValue: 'Normal Merchant' })
        : t('pages.adminLeadPool.merchantHealthTierRisk', { defaultValue: 'Risk Merchant' })
    const healthColor = merchantHealth.health_tier === 'STAR' ? 'green' : merchantHealth.health_tier === 'NORMAL' ? 'blue' : 'red'

    return (
      <Tooltip
        title={
          <div className="space-y-1 text-xs">
            <div className="font-semibold">{t('pages.adminLeadPool.merchantHealthRuleTitle', { defaultValue: 'Health Scoring Rules (100 pts)' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleTierStar', { defaultValue: 'Star Merchant: health score >= 80' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleTierNormal', { defaultValue: 'Normal Merchant: health score 60-79' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleTierRisk', { defaultValue: 'Risk Merchant: health score < 60' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleSpend', { defaultValue: 'Purchase amount: 30 pts, based on last 30 days sales rank across merchants.' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleFrequency', { defaultValue: 'Purchase frequency: 25 pts, compares last 30 days order count with the merchant baseline.' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleCategory', { defaultValue: 'High-frequency category rhythm: 25 pts, checks engine oil, filters, chemicals, beauty, and tires.' })}</div>
            <div>{t('pages.adminLeadPool.merchantHealthRuleTrend', { defaultValue: 'Trend: 20 pts, compares last 30 days sales with the previous 30 days.' })}</div>
          </div>
        }
      >
        <Tag color={healthColor}>{healthLabel}</Tag>
      </Tooltip>
    )
  }

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
              description={`${t('pages.adminLeadPool.deleteSelectedConfirmDesc', {
                defaultValue: 'Selected leads will be moved to Recently Deleted.',
              })} ${deleteRetentionHint}`}
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
              description={`${t('pages.adminLeadPool.deleteAllFilteredConfirmDesc', {
                defaultValue: 'All currently filtered leads will be moved to Recently Deleted.',
              })} ${deleteRetentionHint}`}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleBatchDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                {t('pages.adminLeadPool.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
              </Button>
            </Popconfirm>
            <Button
              icon={<EnvironmentOutlined />}
              onClick={() => window.open('/lead-region-distribution', '_blank', 'noopener,noreferrer')}
            >
              {t('pages.adminLeadPool.regionDistribution', { defaultValue: 'Region Distribution' })}
              <ExportOutlined className="ml-1 text-xs" />
            </Button>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button icon={<SettingOutlined />} onClick={() => setControlPanelOpen(true)}>
              {t('labels.controlPanel', { defaultValue: 'Control Panel' })}
            </Button>
          </Space>
        }
      />

      <Drawer
        title={t('labels.controlPanel', { defaultValue: 'Control Panel' })}
        width={460}
        open={controlPanelOpen}
        onClose={() => setControlPanelOpen(false)}
        destroyOnClose={false}
      >
        <Space direction="vertical" size={12} className="w-full">
          <Select
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.statusPlaceholder', { defaultValue: 'Status' })}
            options={leadStatusOptions}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            className="w-full"
            placeholder={t('pages.adminLeadPool.regionPlaceholder', { defaultValue: 'Region' })}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Select
            allowClear
            showSearch
            className="w-full"
            placeholder={t('pages.adminLeadPool.salesPlaceholder', { defaultValue: 'Sales / BD Owner' })}
            value={filters.assignedBdId}
            options={userOptions}
            onChange={(value) => setFilters((current) => ({ ...current, assignedBdId: value || undefined }))}
            optionFilterProp="label"
          />
          <Select
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.intentPackagePlaceholder', { defaultValue: 'BCS Business' })}
            options={intentPackageOptions}
            value={filters.intentPackage}
            onChange={(value) => setFilters((current) => ({ ...current, intentPackage: value || undefined }))}
          />
          <Select
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.intentGroupPlaceholder', { defaultValue: 'Intent Group' })}
            value={filters.intentPackageGroup}
            options={[
              { value: 'BCS_RELATED', label: t('pages.adminLeadPool.intentGroupBcs', { defaultValue: 'BCS Related' }) },
              { value: 'NON_BCS', label: t('pages.adminLeadPool.intentGroupNonBcs', { defaultValue: 'Non-BCS' }) },
            ]}
            onChange={(value) => setFilters((current) => ({ ...current, intentPackageGroup: value || undefined }))}
          />
          <Select
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.intentLevelMinPlaceholder', { defaultValue: 'Intent Level Min' })}
            value={filters.intentLevelMin}
            options={[
              { value: 5, label: 'H5' },
              { value: 4, label: 'H4+' },
              { value: 3, label: 'H3+' },
              { value: 2, label: 'H2+' },
              { value: 1, label: 'H1+' },
              { value: 0, label: 'H0+' },
            ]}
            onChange={(value) => setFilters((current) => ({ ...current, intentLevelMin: value === undefined ? undefined : Number(value) }))}
          />
          <Select
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.hasSalesOrderPlaceholder', { defaultValue: 'Sales Order Status' })}
            value={filters.hasSalesOrder === undefined ? undefined : filters.hasSalesOrder ? 'YES' : 'NO'}
            options={[
              { value: 'YES', label: t('pages.adminLeadPool.hasSalesOrderYes', { defaultValue: 'Has Sales Order' }) },
              { value: 'NO', label: t('pages.adminLeadPool.hasSalesOrderNo', { defaultValue: 'No Sales Order' }) },
            ]}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                hasSalesOrder: value === undefined ? undefined : value === 'YES',
              }))
            }
          />
          <Select
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.merchantHealthTierPlaceholder', { defaultValue: 'Merchant Health Tier' })}
            value={filters.merchantHealthTier}
            options={[
              { value: 'STAR', label: t('pages.adminLeadPool.merchantHealthTierStar', { defaultValue: 'Star Merchant' }) },
              { value: 'NORMAL', label: t('pages.adminLeadPool.merchantHealthTierNormal', { defaultValue: 'Normal Merchant' }) },
              { value: 'RISK', label: t('pages.adminLeadPool.merchantHealthTierRisk', { defaultValue: 'Risk Merchant' }) },
            ]}
            onChange={(value) => setFilters((current) => ({ ...current, merchantHealthTier: value }))}
          />
          <DatePicker
            className="w-full"
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
            className="w-full"
            placeholder={t('pages.adminLeadPool.createdTo', { defaultValue: 'Created To' })}
            value={filters.createdTo ? dayjs(filters.createdTo) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdTo: value ? value.endOf('day').toISOString() : undefined,
              }))
            }
          />
          <Input
            allowClear
            className="w-full"
            placeholder={t('pages.adminLeadPool.keywordPlaceholder', {
              defaultValue: 'Keyword (lead code/company/contact/source)',
            })}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => void handleApplyControlPanel()}
          />
          <Space wrap>
            <Button type="primary" onClick={() => void handleApplyControlPanel()}>
              {t('labels.apply', { defaultValue: 'Apply' })}
            </Button>
            <Button onClick={() => setControlPanelOpen(false)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </Space>
          <div className="text-sm app-text-soft">
            {t('pages.adminLeadPool.filteredTotal', { defaultValue: 'Filtered total: {{count}}', count: rows.length })}
          </div>
        </Space>
      </Drawer>

      <Table
        className="compact-data-table"
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{ pageSize: 12 }}
        onRow={(row) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (
              target.closest('button') ||
              target.closest('a') ||
              target.closest('.ant-checkbox-wrapper') ||
              target.closest('.ant-checkbox') ||
              target.closest('input') ||
              target.closest('label')
            ) {
              return
            }
            openLeadDetail(row.id)
          },
          className: 'cursor-pointer',
        })}
        columns={[
          {
            title: t('pages.adminLeadPool.columns.leadCode', { defaultValue: 'Lead Code' }),
            dataIndex: 'lead_code',
            width: 170,
            render: (value: string, row: Lead) => (
              <div className="space-y-1">
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 text-inherit"
                  onClick={(event) => {
                    event.stopPropagation()
                    openLeadDetail(row.id)
                  }}
                >
                  {value}
                </button>
                <Space size={6} wrap>
                  {bdMatchedLeadIdSet.has(row.id) ? (
                    <Tag color="blue">{t('pages.adminLeadPool.leadCodeBdMatchedTag', { defaultValue: 'BD Match' })}</Tag>
                  ) : null}
                  {todayFollowupLeadIdSet.has(row.id) ? (
                    <Tag color="gold">{t('pages.adminLeadPool.leadCodeTodayFollowupTag', { defaultValue: 'Follow-up Today' })}</Tag>
                  ) : null}
                </Space>
              </div>
            ),
          },
          {
            title: t('pages.adminLeadPool.columns.company', { defaultValue: 'Company' }),
            dataIndex: 'company_name',
            render: (value: string, row: Lead) => (
              <Space size={6} wrap>
                <span>{value}</span>
                {renderMerchantHealthTag(row)}
              </Space>
            ),
          },
          {
            title: t('pages.adminLeadPool.columns.assignedBd', { defaultValue: 'Assigned BD' }),
            dataIndex: 'assigned_bd_id',
            width: 260,
            render: (value: string | null) => (value ? userNameById.get(value) ?? value : '-'),
          },
          { title: t('pages.adminLeadPool.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          {
            title: t('pages.adminLeadPool.columns.industry', { defaultValue: 'Industry' }),
            dataIndex: 'industry',
            width: 170,
            responsive: ['md'],
          },
          {
            title: t('pages.adminLeadPool.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.adminLeadPool.columns.lastFollowupAt', { defaultValue: 'Latest Follow-up' }),
            dataIndex: 'last_followup_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.adminLeadPool.columns.nextFollowupAt', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.adminLeadPool.columns.actions', { defaultValue: 'Actions' }),
            width: 140,
            render: (_: unknown, row: Lead) => (
              <Space>
                <Button
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation()
                    openAssignModal(row)
                  }}
                >
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
          <p className="mb-0 text-sm app-text-soft">{t('pages.adminLeadPool.assignLeadLabel', { defaultValue: 'Lead' })}: {selectedLead?.lead_code}</p>
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
