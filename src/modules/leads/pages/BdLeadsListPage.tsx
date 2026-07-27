import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Upload,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import { ActionMenu } from '../../../components/common/ActionMenu'
import type {
  UploadFile,
} from 'antd'
import {
  FilterOutlined,
  PlusOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons'
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
  getIntentPackageOptions,
  getLeadStatusOptions,
  getLostReasonOptions,
} from '../../../lib/business-constants'
import {
  PERMISSIONS,
} from '../../../lib/permissions'
import {
  formatDisplayName,
  formatUserOptionLabel,
} from '../../../lib/user-display'
import {
  createLead,
  listLeads,
  softDeleteLead,
  softDeleteLeads,
  assignLead as assignLeadApi,
  changeLeadStatus,
  type LeadFilters,
} from '../api'
import {
  buildRegionOptions,
} from '../lead-options'
import {
  listDictionaryItems,
  type DictionaryItem,
} from '../../shared/api/dictionary'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import type {
  IntentPackage,
  Lead,
  LeadStatus,
} from '../../../types/business'

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

const LEAD_STATUS_VALUES: LeadStatus[] = ['NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING', 'ON_HOLD', 'LOST', 'SIGNED', 'REJECTED']
const INTENT_PACKAGE_VALUES: IntentPackage[] = ['BCS', 'PRODUCTS_SALES', 'BOTH']

function getCurrentMonthRangeIso(): { startIso: string; endIso: string } {
  const now = new Date()
  const start = new Date(now)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  return {
    startIso: start.toISOString(),
    endIso: now.toISOString(),
  }
}

function getNextFollowupSortTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const timestamp = dayjs(value).valueOf()
  return Number.isFinite(timestamp) ? timestamp : null
}

const OVERDUE_ACTIVE_STATUSES: LeadStatus[] = ['NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING']

function isLeadOverdue(lead: Lead): boolean {
  if (!OVERDUE_ACTIVE_STATUSES.includes(lead.status)) return false
  if (!lead.last_followup_at) return true
  return dayjs().diff(dayjs(lead.last_followup_at), 'day') > 7
}

function getOverdueDays(lead: Lead): number | null {
  if (!lead.last_followup_at) return null
  return dayjs().diff(dayjs(lead.last_followup_at), 'day')
}

function parseLeadFiltersFromSearch(searchParams: URLSearchParams): { filters: LeadFilters; keyword: string } {
  const statusParam = searchParams.get('status')
  const intentPackageParam = searchParams.get('intentPackage')
  const followupParam = searchParams.get('followup')
  const signedParam = searchParams.get('signed')

  const status = statusParam && LEAD_STATUS_VALUES.includes(statusParam as LeadStatus) ? (statusParam as LeadStatus) : undefined
  const intentPackage =
    intentPackageParam && INTENT_PACKAGE_VALUES.includes(intentPackageParam as IntentPackage)
      ? (intentPackageParam as IntentPackage)
      : undefined
  const region = searchParams.get('region') ?? undefined
  const industry = searchParams.get('industry') ?? undefined
  const createdFrom = searchParams.get('createdFrom') ?? undefined
  const createdTo = searchParams.get('createdTo') ?? undefined
  const assignedBdId = searchParams.get('bdId') ?? undefined
  const keyword = searchParams.get('q') ?? ''

  const filters: LeadFilters = {
    status,
    intentPackage,
    region: region || undefined,
    industry: industry || undefined,
    createdFrom: createdFrom || undefined,
    createdTo: createdTo || undefined,
    assignedBdId: assignedBdId || undefined,
  }

  if (followupParam === 'due') {
    filters.followupDue = true
    filters.followupDueBefore = new Date().toISOString()
  }

  if (signedParam === 'mtd') {
    const { startIso, endIso } = getCurrentMonthRangeIso()
    filters.signedFrom = startIso
    filters.signedTo = endIso
  }

  return { filters, keyword }
}

export function BdLeadsListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { user, roles, hasPermission } = useAuth()

  const [rows, setRows] = useState<Lead[]>([])
  const [bdMatchedLeadIdSet, setBdMatchedLeadIdSet] = useState<Set<string>>(new Set())
  const [todayFollowupLeadIdSet, setTodayFollowupLeadIdSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LeadFilters>(() => parseLeadFiltersFromSearch(searchParams).filters)
  const [keyword, setKeyword] = useState(() => parseLeadFiltersFromSearch(searchParams).keyword)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importFileList, setImportFileList] = useState<UploadFile[]>([])
  const [controlPanelOpen, setControlPanelOpen] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>()
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])

  const [statusDrawerLead, setStatusDrawerLead] = useState<Lead | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusForm] = Form.useForm<{ to_status: LeadStatus; lost_reason_code?: string }>()
  const statusDrawerToStatus = Form.useWatch('to_status', statusForm)

  const canAssign = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_ASSIGN)
  const isProjectManager = roles.includes('project_manager') && !roles.includes('super_admin')
  const canFilterByBd = roles.includes('super_admin') || roles.includes('project_manager')
  const shouldScopeToMyLeads = roles.includes('bd_user') && !roles.includes('super_admin') && !roles.includes('project_manager')
  const canImport = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_IMPORT)
  const canCreateLead = roles.includes('super_admin') || hasPermission(PERMISSIONS.LEADS_WRITE)
  const leadStatusOptions = useMemo(
    () => getLeadStatusOptions(t).filter((item) => item.value !== 'SIGNED'),
    [t],
  )
  const intentPackageOptions = useMemo(() => getIntentPackageOptions(t), [t])
  const regionOptions = useMemo(() => buildRegionOptions(dictionaryItems), [dictionaryItems])
  const deleteRetentionHint = t('labels.autoDelete30DaysHint', {
    defaultValue: 'Moved to Recently Deleted and auto-permanently deleted after 30 days.',
  })

  const loadRows = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const keywordValue = keyword.trim() || undefined
      const baseFilters: LeadFilters = {
        ...filters,
        keyword: keywordValue,
        assignedBdId: shouldScopeToMyLeads ? undefined : filters.assignedBdId,
        createdById: undefined,
      }
      const shouldMergeTodayFollowup = canFilterByBd && Boolean(baseFilters.assignedBdId) && !shouldScopeToMyLeads
      const startOfTodayIso = dayjs().startOf('day').toISOString()
      const endOfTodayIso = dayjs().endOf('day').toISOString()

      const [result, todayFollowupRows] = await Promise.all([
        listLeads(baseFilters),
        shouldMergeTodayFollowup
          ? listLeads({
              ...baseFilters,
              assignedBdId: undefined,
              followupFrom: startOfTodayIso,
              followupTo: endOfTodayIso,
            })
          : Promise.resolve([] as Lead[]),
      ])

      const bdMatchedIds = shouldMergeTodayFollowup ? new Set(result.map((item) => item.id)) : new Set<string>()
      const todayFollowupIds = shouldMergeTodayFollowup ? new Set(todayFollowupRows.map((item) => item.id)) : new Set<string>()

      const mergedRows = shouldMergeTodayFollowup
        ? Array.from(new Map([...result, ...todayFollowupRows].map((item) => [item.id, item])).values()).sort((a, b) => {
            const aTime = new Date(a.updated_at).getTime()
            const bTime = new Date(b.updated_at).getTime()
            return bTime - aTime
          })
        : result

      const scopedRows = shouldScopeToMyLeads
        ? mergedRows.filter((item) => item.assigned_bd_id === user.id || item.created_by === user.id)
        : mergedRows

      setRows(scopedRows)
      setBdMatchedLeadIdSet(new Set(scopedRows.filter((item) => bdMatchedIds.has(item.id)).map((item) => item.id)))
      setTodayFollowupLeadIdSet(new Set(scopedRows.filter((item) => todayFollowupIds.has(item.id)).map((item) => item.id)))
      setSelectedIds([])
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.loadFail', { defaultValue: 'Failed to load leads' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [canFilterByBd, filters, keyword, shouldScopeToMyLeads, t, user])

  const loadUsers = useCallback(async () => {
    if (!canAssign && !canFilterByBd) {
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
  }, [canAssign, canFilterByBd, t])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    const parsed = parseLeadFiltersFromSearch(searchParams)
    setFilters((current) => (JSON.stringify(current) === JSON.stringify(parsed.filters) ? current : parsed.filters))
    setKeyword((current) => (current === parsed.keyword ? current : parsed.keyword))
  }, [searchParams])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    listDictionaryItems()
      .then(setDictionaryItems)
      .catch(() => {})
  }, [])

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

  function openStatusDrawer(lead: Lead) {
    setStatusDrawerLead(lead)
    statusForm.resetFields()
  }

  async function handleStatusDrawerSubmit(values: { to_status: LeadStatus; lost_reason_code?: string }) {
    if (!statusDrawerLead) {
      return
    }

    setStatusSaving(true)

    try {
      await changeLeadStatus({
        leadId: statusDrawerLead.id,
        toStatus: values.to_status,
        lostReasonCode: values.lost_reason_code,
      })
      message.success(t('page.leads.statusUpdated', { defaultValue: 'Lead status updated' }))
      setStatusDrawerLead(null)
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdLeads.statusUpdateFail', { defaultValue: 'Failed to change lead status' })
      message.error(text)
    } finally {
      setStatusSaving(false)
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
      label: formatUserOptionLabel(item),
    }))
  }, [userOptions])

  const bdUserOptions = useMemo(
    () =>
      userOptions.map((item) => ({
        value: item.id,
        label: formatUserOptionLabel(item),
      })),
    [userOptions],
  )

  const bdUserNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of userOptions) {
      map.set(item.id, formatDisplayName(item.full_name, item.email, item.id))
    }
    if (user?.id && user.email) {
      map.set(user.id, map.get(user.id) ?? formatDisplayName(undefined, user.email, user.id))
    }
    return map
  }, [user?.email, user?.id, userOptions])

  function handleApplyControlPanel() {
    void loadRows()
    setControlPanelOpen(false)
  }

  function handleResetControlPanel() {
    setFilters({})
    setKeyword('')
  }

  const secondaryActiveCount = [
    filters.region,
    filters.industry,
    filters.intentPackage,
    filters.assignedBdId,
    filters.createdFrom,
    filters.createdTo,
  ].filter(Boolean).length

  const filterPanel = (
    <Space direction={isProjectManager ? 'vertical' : 'horizontal'} size={12} wrap={!isProjectManager} className="w-full">
      <Select
        allowClear
        className={isProjectManager ? 'w-full' : undefined}
        placeholder={t('pages.bdLeads.statusPlaceholder', { defaultValue: 'Status' })}
        style={isProjectManager ? undefined : { width: 180 }}
        options={leadStatusOptions}
        value={filters.status}
        onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
      />
      <Select
        allowClear
        showSearch
        className={isProjectManager ? 'w-full' : undefined}
        placeholder={t('pages.bdLeads.regionPlaceholder', { defaultValue: 'Region' })}
        style={isProjectManager ? undefined : { width: 180 }}
        options={regionOptions.map((r) => ({ value: r.value, label: r.label }))}
        value={filters.region}
        onChange={(value) => setFilters((current) => ({ ...current, region: value || undefined }))}
        optionFilterProp="label"
      />
      <Input
        className={isProjectManager ? 'w-full' : undefined}
        placeholder={t('pages.bdLeads.industryPlaceholder', { defaultValue: 'Industry' })}
        style={isProjectManager ? undefined : { width: 180 }}
        value={filters.industry}
        onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value || undefined }))}
      />
      <Select
        allowClear
        className={isProjectManager ? 'w-full' : undefined}
        placeholder={t('pages.bdLeads.intentPackagePlaceholder', { defaultValue: 'BCS Business' })}
        style={isProjectManager ? undefined : { width: 200 }}
        options={intentPackageOptions}
        value={filters.intentPackage}
        onChange={(value) => setFilters((current) => ({ ...current, intentPackage: value || undefined }))}
      />
      {isProjectManager ? (
        <Select
          allowClear
          className="w-full"
          placeholder={t('pages.bdLeads.intentLevelPlaceholder', { defaultValue: 'Intent Level' })}
          value={filters.intentLevelMin === filters.intentLevelMax ? filters.intentLevelMin : undefined}
          options={[
            { value: 5, label: 'H5' },
            { value: 4, label: 'H4' },
            { value: 3, label: 'H3' },
            { value: 2, label: 'H2' },
            { value: 1, label: 'H1' },
            { value: 0, label: 'H0' },
          ]}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              intentLevelMin: value === undefined ? undefined : Number(value),
              intentLevelMax: value === undefined ? undefined : Number(value),
            }))
          }
        />
      ) : null}
      {canFilterByBd ? (
        <Select
          allowClear
          showSearch
          className={isProjectManager ? 'w-full' : undefined}
          optionFilterProp="label"
          placeholder={t('pages.bdLeads.bdOwnerPlaceholder', { defaultValue: 'BD Owner' })}
          style={isProjectManager ? undefined : { width: 240 }}
          options={bdUserOptions}
          value={filters.assignedBdId}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              assignedBdId: value || undefined,
            }))
          }
        />
      ) : null}
      <DatePicker
        className={isProjectManager ? 'w-full' : undefined}
        style={isProjectManager ? undefined : { width: 170 }}
        placeholder={t('pages.bdLeads.createdFrom', { defaultValue: 'Created From' })}
        value={filters.createdFrom ? dayjs(filters.createdFrom) : undefined}
        onChange={(value) =>
          setFilters((current) => ({
            ...current,
            createdFrom: value ? value.startOf('day').toISOString() : undefined,
          }))
        }
      />
      <DatePicker
        className={isProjectManager ? 'w-full' : undefined}
        style={isProjectManager ? undefined : { width: 170 }}
        placeholder={t('pages.bdLeads.createdTo', { defaultValue: 'Created To' })}
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
        className={isProjectManager ? 'w-full' : undefined}
        placeholder={t('pages.bdLeads.keywordPlaceholder', { defaultValue: 'Keyword (lead code/company/contact/source)' })}
        style={isProjectManager ? undefined : { width: 280 }}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        onSearch={isProjectManager ? handleApplyControlPanel : () => void loadRows()}
      />
      <Space wrap>
        <Button type="primary" onClick={isProjectManager ? handleApplyControlPanel : () => void loadRows()}>
          {t('labels.apply', { defaultValue: 'Apply' })}
        </Button>
        {isProjectManager ? (
          <Button onClick={handleResetControlPanel}>
            {t('labels.reset', { defaultValue: 'Reset' })}
          </Button>
        ) : null}
      </Space>
    </Space>
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.bdLeads.title', { defaultValue: 'My Leads' })}
        description={t('pages.bdLeads.description', {
          defaultValue: 'Manage only your own leads (created by you or assigned to you).',
        })}
        extra={
          <Space>
            <Button onClick={() => void loadRows()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button onClick={() => navigate('/app/recently-deleted')}>
              {t('pages.bdLeads.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
            </Button>
            <Popconfirm
              title={t('pages.bdLeads.bulkDeleteConfirmTitle', { defaultValue: 'Delete selected leads?' })}
              description={`${t('pages.bdLeads.bulkDeleteConfirmDesc', {
                defaultValue: 'Selected leads will be moved to Recently Deleted.',
              })} ${deleteRetentionHint}`}
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
              description={`${t('pages.bdLeads.bulkDeleteAllConfirmDesc', {
                defaultValue: 'All currently filtered leads will be moved to Recently Deleted.',
              })} ${deleteRetentionHint}`}
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
            {isProjectManager ? (
              <Button icon={<SettingOutlined />} onClick={() => setControlPanelOpen(true)}>
                {t('labels.controlPanel', { defaultValue: 'Control Panel' })}
              </Button>
            ) : null}
          </Space>
        }
      />

      {canImport ? (
        <div className="mb-5 rounded-xl border app-border app-surface p-4">
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
            <p className="mb-0 text-xs app-text-soft">
              {t('pages.bdLeads.csvHeaderHint', {
                defaultValue:
                  'CSV header example: company_name,contact_person,contact_phone,contact_email,industry,region,city,source,intent_level,estimated_value',
              })}
            </p>
          </Space>
        </div>
      ) : null}

      {isProjectManager ? (
        <Drawer
          title={t('labels.controlPanel', { defaultValue: 'Control Panel' })}
          width="min(460px, 100vw)"
          open={controlPanelOpen}
          onClose={() => setControlPanelOpen(false)}
          destroyOnClose={false}
        >
          {filterPanel}
        </Drawer>
      ) : (
        <>
          <div className="mb-4 rounded-xl border app-border app-surface p-3">
            <Space size={8} wrap>
              <Input.Search
                allowClear
                style={{ width: 280 }}
                placeholder={t('pages.bdLeads.keywordPlaceholder', { defaultValue: 'Keyword (lead code/company/contact/source)' })}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onSearch={() => void loadRows()}
              />
              <Select
                allowClear
                style={{ width: 160 }}
                placeholder={t('pages.bdLeads.statusPlaceholder', { defaultValue: 'Status' })}
                options={leadStatusOptions}
                value={filters.status}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              />
              <Button type="primary" onClick={() => void loadRows()}>
                {t('labels.apply', { defaultValue: 'Apply' })}
              </Button>
              <Badge count={secondaryActiveCount} size="small">
                <Button icon={<FilterOutlined />} onClick={() => setMoreFiltersOpen(true)}>
                  {t('labels.moreFilters', { defaultValue: '更多篩選' })}
                </Button>
              </Badge>
            </Space>
          </div>

          <Drawer
            title={t('labels.moreFilters', { defaultValue: '更多篩選' })}
            placement="right"
            open={moreFiltersOpen}
            onClose={() => setMoreFiltersOpen(false)}
            destroyOnClose={false}
            styles={{ wrapper: { width: 360 } }}
          >
            <Space direction="vertical" size={12} className="w-full">
              <Select
                allowClear
                showSearch
                className="w-full"
                placeholder={t('pages.bdLeads.regionPlaceholder', { defaultValue: 'Region' })}
                options={regionOptions.map((r) => ({ value: r.value, label: r.label }))}
                value={filters.region}
                onChange={(value) => setFilters((current) => ({ ...current, region: value || undefined }))}
                optionFilterProp="label"
              />
              <Input
                className="w-full"
                placeholder={t('pages.bdLeads.industryPlaceholder', { defaultValue: 'Industry' })}
                value={filters.industry}
                onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value || undefined }))}
              />
              <Select
                allowClear
                className="w-full"
                placeholder={t('pages.bdLeads.intentPackagePlaceholder', { defaultValue: 'BCS Business' })}
                options={intentPackageOptions}
                value={filters.intentPackage}
                onChange={(value) => setFilters((current) => ({ ...current, intentPackage: value || undefined }))}
              />
              {canFilterByBd ? (
                <Select
                  allowClear
                  showSearch
                  className="w-full"
                  optionFilterProp="label"
                  placeholder={t('pages.bdLeads.bdOwnerPlaceholder', { defaultValue: 'BD Owner' })}
                  options={bdUserOptions}
                  value={filters.assignedBdId}
                  onChange={(value) => setFilters((current) => ({ ...current, assignedBdId: value || undefined }))}
                />
              ) : null}
              <DatePicker
                className="w-full"
                placeholder={t('pages.bdLeads.createdFrom', { defaultValue: 'Created From' })}
                value={filters.createdFrom ? dayjs(filters.createdFrom) : undefined}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, createdFrom: value ? value.startOf('day').toISOString() : undefined }))
                }
              />
              <DatePicker
                className="w-full"
                placeholder={t('pages.bdLeads.createdTo', { defaultValue: 'Created To' })}
                value={filters.createdTo ? dayjs(filters.createdTo) : undefined}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, createdTo: value ? value.endOf('day').toISOString() : undefined }))
                }
              />
              <Space>
                <Button onClick={handleResetControlPanel}>
                  {t('labels.reset', { defaultValue: 'Reset' })}
                </Button>
                <Button
                  type="primary"
                  onClick={() => { void loadRows(); setMoreFiltersOpen(false) }}
                >
                  {t('labels.apply', { defaultValue: 'Apply' })}
                </Button>
              </Space>
            </Space>
          </Drawer>
        </>
      )}

      <Table
        className="compact-data-table"
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        rowClassName={(row: Lead) => (isLeadOverdue(row) ? 'lead-overdue-row' : '')}
        showSorterTooltip={{ target: 'sorter-icon' }}
        locale={{
          triggerAsc: t('pages.salesSupervision.sortTriggerAsc', { defaultValue: 'Click to sort ascending' }),
          triggerDesc: t('pages.salesSupervision.sortTriggerDesc', { defaultValue: 'Click to sort descending' }),
          cancelSort: t('pages.salesSupervision.sortCancel', { defaultValue: 'Click to cancel sorting' }),
        }}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{ pageSize: 12 }}
        columns={[
          {
            title: t('pages.bdLeads.columns.leadCode', { defaultValue: 'Lead Code' }),
            dataIndex: 'lead_code',
            width: 220,
            render: (value: string, row: Lead) => {
              const bdOwnerName =
                (row.assigned_bd_id ? bdUserNameMap.get(row.assigned_bd_id) : null) ??
                t('pages.bdLeads.bdOwnerUnknown', { defaultValue: 'Unassigned' })
              return (
                <div>
                  <div className="font-medium app-text">{value}</div>
                  <Space size={6} wrap className="mt-1">
                    {bdMatchedLeadIdSet.has(row.id) ? (
                      <Tag color="blue">{t('pages.bdLeads.leadCodeBdMatchedTag', { defaultValue: 'BD Match' })}</Tag>
                    ) : null}
                    {todayFollowupLeadIdSet.has(row.id) ? (
                      <Tag color="gold">{t('pages.bdLeads.leadCodeTodayFollowupTag', { defaultValue: 'Follow-up Today' })}</Tag>
                    ) : null}
                    {isLeadOverdue(row) ? (
                      <Tag color="error">
                        {row.last_followup_at
                          ? t('pages.bdLeads.leadCodeOverdueTag', { days: getOverdueDays(row), defaultValue: '⚠️ Overdue {{days}}d' })
                          : t('pages.bdLeads.leadCodeNeverFollowedTag', { defaultValue: '⚠️ Never Followed Up' })}
                      </Tag>
                    ) : null}
                  </Space>
                  <div className="mt-0.5 text-xs app-text-soft">
                    {t('pages.bdLeads.bdOwnerLabel', { defaultValue: 'BD Owner' })}: {bdOwnerName}
                  </div>
                </div>
              )
            },
          },
          { title: t('pages.bdLeads.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          { title: t('pages.bdLeads.columns.industry', { defaultValue: 'Industry' }), dataIndex: 'industry', width: 160 },
          { title: t('pages.bdLeads.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          { title: t('pages.bdLeads.columns.city', { defaultValue: 'Customer City' }), dataIndex: 'city', width: 130 },
          ...(isProjectManager
            ? [{
                title: t('pages.bdLeads.columns.intentLevel', { defaultValue: 'Intent Level' }),
                dataIndex: 'intent_level',
                width: 120,
                render: (value: number | null) => (value === null ? '-' : `H${value}`),
              }]
            : []),
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
            onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            sorter: (a: Lead, b: Lead) => {
              const aTimestamp = getNextFollowupSortTimestamp(a.next_followup_at)
              const bTimestamp = getNextFollowupSortTimestamp(b.next_followup_at)

              if (aTimestamp === null && bTimestamp === null) {
                return 0
              }

              if (aTimestamp === null) {
                return 1
              }

              if (bTimestamp === null) {
                return -1
              }

              return aTimestamp - bTimestamp
            },
            sortDirections: ['descend', 'ascend'],
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.bdLeads.actions', { defaultValue: 'Actions' }),
            key: 'actions',
            width: 130,
            render: (_: unknown, row: Lead) => (
              <ActionMenu
                primaryLabel={t('pages.bdLeads.actionDetail', { defaultValue: 'Detail' })}
                primaryOnClick={() => navigate(`/app/bd/leads/${row.id}`)}
                items={[
                  {
                    key: 'edit',
                    label: t('pages.bdLeads.actionEdit', { defaultValue: 'Edit' }),
                    onClick: () => navigate(`/app/bd/leads/${row.id}/edit`),
                  },
                  {
                    key: 'timeline',
                    label: t('pages.bdLeads.actionTimeline', { defaultValue: 'Timeline' }),
                    onClick: () => navigate(`/app/bd/leads/${row.id}/followups`),
                  },
                  ...(row.status !== 'SIGNED' ? [{
                    key: 'statusChange',
                    label: t('pages.bdLeads.actionStatusChange', { defaultValue: 'Status Change' }),
                    onClick: () => openStatusDrawer(row),
                  }] : []),
                  ...(row.status !== 'SIGNED' ? [{
                    key: 'sign',
                    label: t('pages.bdLeads.actionSign', { defaultValue: 'Sign' }),
                    onClick: () => navigate(`/app/bd/leads/${row.id}/sign`),
                  }] : []),
                  ...(row.status === 'SIGNED' ? [{
                    key: 'onboard',
                    label: t('pages.bdLeads.actionOnboard', { defaultValue: 'Onboard' }),
                    onClick: () => navigate(`/app/bd/leads/${row.id}/onboarding`),
                  }] : []),
                  ...(canAssign ? [{
                    key: 'assign',
                    label: t('pages.bdLeads.actionAssign', { defaultValue: 'Assign' }),
                    onClick: () => openAssignModal(row),
                  }] : []),
                  {
                    key: 'delete',
                    label: t('labels.delete', { defaultValue: 'Delete' }),
                    danger: true,
                    confirmTitle: t('pages.bdLeads.deleteConfirmTitle', { defaultValue: 'Delete this lead?' }),
                    confirmDescription: `${t('pages.bdLeads.deleteConfirmDesc', { defaultValue: 'The lead will be moved to Recently Deleted.' })} ${deleteRetentionHint}`,
                    confirmOkText: t('labels.delete', { defaultValue: 'Delete' }),
                    onClick: () => void handleDeleteLead(row.id),
                  },
                ]}
              />
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
          <p className="mb-0 text-sm app-text-soft">
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

      <Drawer
        title={
          statusDrawerLead
            ? `${t('pages.bdLeads.actionStatusChange', { defaultValue: 'Status Change' })} · ${statusDrawerLead.lead_code}`
            : t('pages.bdLeads.actionStatusChange', { defaultValue: 'Status Change' })
        }
        placement="bottom"
        height="auto"
        open={statusDrawerLead !== null}
        onClose={() => setStatusDrawerLead(null)}
        destroyOnClose
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={(values) => void handleStatusDrawerSubmit(values)}
          requiredMark={false}
        >
          <Form.Item
            name="to_status"
            label={t('pages.bdLeads.statusChangeTargetLabel', { defaultValue: 'Target Status' })}
            rules={[{ required: true, message: t('pages.bdLeads.statusChangeTargetPlaceholder', { defaultValue: 'Select target status' }) }]}
          >
            <Select
              options={getLeadStatusOptions(t).filter((item) => item.value !== 'SIGNED')}
              placeholder={t('pages.bdLeads.statusChangeTargetPlaceholder', { defaultValue: 'Select target status' })}
            />
          </Form.Item>

          <Form.Item
            name="lost_reason_code"
            label={t('pages.bdLeads.statusChangeLostReasonLabel', { defaultValue: 'Lost Reason' })}
            hidden={statusDrawerToStatus !== 'LOST'}
          >
            <Select options={getLostReasonOptions(t)} allowClear />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={statusSaving} block>
            {t('pages.bdLeads.statusChangeSubmit', { defaultValue: 'Update Status' })}
          </Button>
        </Form>
      </Drawer>
    </>
  )
}
