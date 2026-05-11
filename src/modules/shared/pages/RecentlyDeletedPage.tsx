import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  Button,
  Input,
  Popconfirm,
  Progress,
  Space,
  Tabs,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useTranslation,
} from 'react-i18next'
import {
  useSearchParams,
} from 'react-router-dom'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  PERMISSIONS,
} from '../../../lib/permissions'
import type {
  Lead,
  OnboardMerchant,
  OnboardMerchantType,
  Project,
} from '../../../types/business'
import {
  hardDeleteLead,
  hardDeleteLeads,
  listDeletedLeads,
  restoreLead,
  restoreLeads,
} from '../../leads/api'
import {
  hardDeleteProject,
  hardDeleteProjects,
  listDeletedProjects,
  restoreProject,
  restoreProjects,
} from '../../projects/api'
import {
  hardDeleteOnboardMerchant,
  hardDeleteOnboardMerchants,
  listDeletedOnboardMerchants,
  restoreOnboardMerchant,
  restoreOnboardMerchants,
} from '../../onboarding/api'
import {
  hardDeleteSalesOrder,
  hardDeleteSalesOrders,
  listDeletedSalesOrders,
  restoreSalesOrder,
  restoreSalesOrders,
  type SalesOrderRow,
} from '../../sales/api'

type DeletedTabKey = 'leads' | 'sales' | 'projects' | 'merchants'

function parseDeletedTabKey(value: string | null): DeletedTabKey | null {
  if (value === 'leads' || value === 'sales' || value === 'projects' || value === 'merchants') {
    return value
  }
  return null
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage
    }
  }

  return fallback
}

export function RecentlyDeletedPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, roles, hasPermission } = useAuth()
  const isSuperAdmin = roles.includes('super_admin')
  const requestedTab = parseDeletedTabKey(searchParams.get('tab'))
  const canManageSalesRecords = roles.includes('super_admin') || roles.includes('project_manager')

  const canManageDeletedLeads = hasPermission(PERMISSIONS.LEADS_READ) && hasPermission(PERMISSIONS.LEADS_WRITE)
  const canManageDeletedProjects = hasPermission(PERMISSIONS.PROJECTS_READ) && hasPermission(PERMISSIONS.PROJECTS_WRITE)
  const canManageDeletedMerchants = hasPermission(PERMISSIONS.ONBOARDING_READ) && hasPermission(PERMISSIONS.ONBOARDING_WRITE)

  const availableTabs = useMemo<DeletedTabKey[]>(() => {
    const tabs: DeletedTabKey[] = []
    if (canManageDeletedLeads) {
      tabs.push('leads')
    }
    if (canManageSalesRecords) {
      tabs.push('sales')
    }
    if (canManageDeletedProjects) {
      tabs.push('projects')
    }
    if (canManageDeletedMerchants) {
      tabs.push('merchants')
    }
    return tabs
  }, [canManageDeletedLeads, canManageDeletedProjects, canManageDeletedMerchants, canManageSalesRecords])

  const [activeTab, setActiveTab] = useState<DeletedTabKey>(
    requestedTab && availableTabs.includes(requestedTab) ? requestedTab : availableTabs[0] ?? 'leads',
  )
  const [keyword, setKeyword] = useState('')

  const [leadRows, setLeadRows] = useState<Lead[]>([])
  const [leadLoading, setLeadLoading] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [salesRows, setSalesRows] = useState<SalesOrderRow[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [selectedSalesIds, setSelectedSalesIds] = useState<string[]>([])

  const [projectRows, setProjectRows] = useState<Project[]>([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [merchantRows, setMerchantRows] = useState<OnboardMerchant[]>([])
  const [merchantLoading, setMerchantLoading] = useState(false)
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<string[]>([])

  useEffect(() => {
    if (availableTabs.length === 0) {
      return
    }

    if (requestedTab && availableTabs.includes(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab)
      return
    }

    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0])
    }
  }, [activeTab, availableTabs, requestedTab])

  const loadDeletedLeads = useCallback(async () => {
    if (!user || !canManageDeletedLeads) {
      return
    }

    setLeadLoading(true)
    try {
      const assignedBdId = !isSuperAdmin && roles.includes('bd_user') ? user.id : undefined
      const rows = await listDeletedLeads({
        keyword: keyword.trim() || undefined,
        assignedBdId,
      })
      setLeadRows(rows)
      setSelectedLeadIds([])
    } catch (error) {
      const text = resolveErrorMessage(error, t('pages.bdDeletedLeads.loadFail', { defaultValue: 'Failed to load deleted leads' }))
      message.error(text)
    } finally {
      setLeadLoading(false)
    }
  }, [canManageDeletedLeads, isSuperAdmin, keyword, roles, t, user])

  const loadDeletedSales = useCallback(async () => {
    if (!user || !canManageSalesRecords) {
      return
    }

    setSalesLoading(true)
    try {
      const rows = await listDeletedSalesOrders({
        keyword: keyword.trim() || undefined,
      })
      setSalesRows(rows)
      setSelectedSalesIds([])
    } catch (error) {
      const text = resolveErrorMessage(error, t('pages.salesSupervision.loadFail', { defaultValue: 'Failed to load sales supervision data' }))
      message.error(text)
    } finally {
      setSalesLoading(false)
    }
  }, [canManageSalesRecords, keyword, t, user])

  const loadDeletedProjects = useCallback(async () => {
    if (!user || !canManageDeletedProjects) {
      return
    }

    setProjectLoading(true)
    try {
      const pmOwnerId = !isSuperAdmin && roles.includes('project_manager') ? user.id : undefined
      const rows = await listDeletedProjects({
        keyword: keyword.trim() || undefined,
        pmOwnerId,
      })
      setProjectRows(rows)
      setSelectedProjectIds([])
    } catch (error) {
      const text = resolveErrorMessage(error, t('pages.pmDeletedProjects.loadFail', { defaultValue: 'Failed to load deleted projects' }))
      message.error(text)
    } finally {
      setProjectLoading(false)
    }
  }, [canManageDeletedProjects, isSuperAdmin, keyword, roles, t, user])

  const loadDeletedMerchants = useCallback(async () => {
    if (!user || !canManageDeletedMerchants) {
      return
    }

    setMerchantLoading(true)
    try {
      const bdOwnerId = !isSuperAdmin && roles.includes('bd_user') ? user.id : undefined
      const rows = await listDeletedOnboardMerchants({
        keyword: keyword.trim() || undefined,
        bdOwnerId,
      })
      setMerchantRows(rows)
      setSelectedMerchantIds([])
    } catch (error) {
      const text = resolveErrorMessage(error, t('pages.onboardMerchantDeleted.loadFail', { defaultValue: 'Failed to load deleted onboard merchants' }))
      message.error(text)
    } finally {
      setMerchantLoading(false)
    }
  }, [canManageDeletedMerchants, isSuperAdmin, keyword, roles, t, user])

  const loadCurrentTab = useCallback(async () => {
    if (activeTab === 'leads') {
      await loadDeletedLeads()
      return
    }
    if (activeTab === 'sales') {
      await loadDeletedSales()
      return
    }
    if (activeTab === 'projects') {
      await loadDeletedProjects()
      return
    }
    await loadDeletedMerchants()
  }, [activeTab, loadDeletedLeads, loadDeletedMerchants, loadDeletedProjects, loadDeletedSales])

  useEffect(() => {
    void loadCurrentTab()
  }, [loadCurrentTab])

  async function handleLeadRestore(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.bdDeletedLeads.selectWarning', { defaultValue: 'Please select at least one lead' }))
      return
    }

    try {
      if (ids.length === 1) {
        await restoreLead(ids[0])
        message.success(t('pages.bdDeletedLeads.restoreSuccess', { defaultValue: 'Lead restored' }))
      } else {
        await restoreLeads(ids)
        message.success(
          t('pages.bdDeletedLeads.batchRestoreSuccess', {
            defaultValue: 'Restored {{count}} lead(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedLeads()
    } catch (error) {
      const text = resolveErrorMessage(error, t('pages.bdDeletedLeads.restoreFail', { defaultValue: 'Failed to restore lead' }))
      message.error(text)
    }
  }

  async function handleLeadPermanentDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.bdDeletedLeads.selectWarning', { defaultValue: 'Please select at least one lead' }))
      return
    }

    try {
      if (ids.length === 1) {
        await hardDeleteLead(ids[0])
        message.success(t('pages.bdDeletedLeads.permanentDeleteSuccess', { defaultValue: 'Lead permanently deleted' }))
      } else {
        await hardDeleteLeads(ids)
        message.success(
          t('pages.bdDeletedLeads.batchPermanentDeleteSuccess', {
            defaultValue: 'Permanently deleted {{count}} lead(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedLeads()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdDeletedLeads.permanentDeleteFail', { defaultValue: 'Failed to permanently delete lead' })
      message.error(text)
    }
  }

  async function handleSalesRestore(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.salesSupervision.selectWarning', { defaultValue: 'Please select at least one sales order' }))
      return
    }

    try {
      if (ids.length === 1) {
        await restoreSalesOrder(ids[0])
        message.success(t('pages.salesSupervision.restoreSuccess', { defaultValue: 'Sales order restored' }))
      } else {
        await restoreSalesOrders(ids)
        message.success(
          t('pages.salesSupervision.batchRestoreSuccess', {
            defaultValue: 'Restored {{count}} sales order(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedSales()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.salesSupervision.restoreFail', { defaultValue: 'Failed to restore sales order' })
      message.error(text)
    }
  }

  async function handleSalesPermanentDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.salesSupervision.selectWarning', { defaultValue: 'Please select at least one sales order' }))
      return
    }

    try {
      if (ids.length === 1) {
        await hardDeleteSalesOrder(ids[0])
        message.success(t('pages.salesSupervision.permanentDeleteSuccess', { defaultValue: 'Sales order permanently deleted' }))
      } else {
        await hardDeleteSalesOrders(ids)
        message.success(
          t('pages.salesSupervision.batchPermanentDeleteSuccess', {
            defaultValue: 'Permanently deleted {{count}} sales order(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedSales()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.salesSupervision.permanentDeleteFail', { defaultValue: 'Failed to permanently delete sales order' })
      message.error(text)
    }
  }

  async function handleProjectRestore(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.pmDeletedProjects.selectWarning', { defaultValue: 'Please select at least one project' }))
      return
    }

    try {
      if (ids.length === 1) {
        await restoreProject(ids[0])
        message.success(t('pages.pmDeletedProjects.restoreSuccess', { defaultValue: 'Project restored' }))
      } else {
        await restoreProjects(ids)
        message.success(
          t('pages.pmDeletedProjects.batchRestoreSuccess', {
            defaultValue: 'Restored {{count}} project(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedProjects()
    } catch (error) {
      const text = resolveErrorMessage(error, t('pages.pmDeletedProjects.restoreFail', { defaultValue: 'Failed to restore project' }))
      message.error(text)
    }
  }

  async function handleProjectPermanentDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.pmDeletedProjects.selectWarning', { defaultValue: 'Please select at least one project' }))
      return
    }

    try {
      if (ids.length === 1) {
        await hardDeleteProject(ids[0])
        message.success(t('pages.pmDeletedProjects.permanentDeleteSuccess', { defaultValue: 'Project permanently deleted' }))
      } else {
        await hardDeleteProjects(ids)
        message.success(
          t('pages.pmDeletedProjects.batchPermanentDeleteSuccess', {
            defaultValue: 'Permanently deleted {{count}} project(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedProjects()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmDeletedProjects.permanentDeleteFail', { defaultValue: 'Failed to permanently delete project' })
      message.error(text)
    }
  }

  async function handleMerchantRestore(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.onboardMerchantDeleted.selectWarning', { defaultValue: 'Please select at least one merchant' }))
      return
    }

    try {
      if (ids.length === 1) {
        await restoreOnboardMerchant(ids[0])
        message.success(t('pages.onboardMerchantDeleted.restoreSuccess', { defaultValue: 'Merchant restored' }))
      } else {
        await restoreOnboardMerchants(ids)
        message.success(
          t('pages.onboardMerchantDeleted.batchRestoreSuccess', {
            defaultValue: 'Restored {{count}} merchant(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedMerchants()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchantDeleted.restoreFail', { defaultValue: 'Failed to restore merchant' })
      message.error(text)
    }
  }

  async function handleMerchantPermanentDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning(t('pages.onboardMerchantDeleted.selectWarning', { defaultValue: 'Please select at least one merchant' }))
      return
    }

    try {
      if (ids.length === 1) {
        await hardDeleteOnboardMerchant(ids[0])
        message.success(t('pages.onboardMerchantDeleted.permanentDeleteSuccess', { defaultValue: 'Merchant permanently deleted' }))
      } else {
        await hardDeleteOnboardMerchants(ids)
        message.success(
          t('pages.onboardMerchantDeleted.batchPermanentDeleteSuccess', {
            defaultValue: 'Permanently deleted {{count}} merchant(s)',
            count: ids.length,
          }),
        )
      }
      await loadDeletedMerchants()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchantDeleted.permanentDeleteFail', { defaultValue: 'Failed to permanently delete merchant' })
      message.error(text)
    }
  }

  const isLeadTab = activeTab === 'leads'
  const isSalesTab = activeTab === 'sales'
  const isProjectTab = activeTab === 'projects'
  const currentRowsCount = isLeadTab ? leadRows.length : isSalesTab ? salesRows.length : isProjectTab ? projectRows.length : merchantRows.length
  const selectedCount = isLeadTab ? selectedLeadIds.length : isSalesTab ? selectedSalesIds.length : isProjectTab ? selectedProjectIds.length : selectedMerchantIds.length
  const tabItems: Array<{ key: DeletedTabKey; label: string; children: ReactNode }> = []

  if (canManageDeletedLeads) {
    tabItems.push({
      key: 'leads',
      label: t('pages.bdLeads.title', { defaultValue: 'Lead List' }),
      children: (
        <Table
          rowKey="id"
          loading={leadLoading}
          bordered
          dataSource={leadRows}
          rowSelection={{
            selectedRowKeys: selectedLeadIds,
            onChange: (keys) => setSelectedLeadIds(keys as string[]),
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
                    onConfirm={() => void handleLeadRestore([row.id])}
                  >
                    <Button size="small">{t('labels.restore', { defaultValue: 'Restore' })}</Button>
                  </Popconfirm>
                  <Popconfirm
                    title={t('pages.bdDeletedLeads.permanentDeleteConfirmTitle', { defaultValue: 'Permanently delete this lead?' })}
                    description={t('pages.bdDeletedLeads.permanentDeleteConfirmDesc', {
                      defaultValue: 'This action cannot be undone.',
                    })}
                    okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleLeadPermanentDelete([row.id])}
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
      ),
    })
  }

  if (canManageSalesRecords) {
    tabItems.push({
      key: 'sales',
      label: t('pages.salesSupervision.title', { defaultValue: 'Sales Supervision' }),
      children: (
        <Table
          rowKey="id"
          loading={salesLoading}
          bordered
          dataSource={salesRows}
          rowSelection={{
            selectedRowKeys: selectedSalesIds,
            onChange: (keys) => setSelectedSalesIds(keys as string[]),
          }}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: t('pages.salesSupervision.columns.orderNo', { defaultValue: 'Order No' }), dataIndex: 'order_no', width: 190 },
            { title: t('pages.salesSupervision.columns.companyName', { defaultValue: 'Company' }), dataIndex: 'company_name' },
            {
              title: t('pages.salesSupervision.columns.leadCode', { defaultValue: 'Lead Code' }),
              width: 180,
              render: (_: unknown, row: SalesOrderRow) => row.lead?.lead_code ?? '-',
            },
            {
              title: t('pages.salesSupervision.columns.itemCount', { defaultValue: 'Item Count' }),
              width: 120,
              render: (_: unknown, row: SalesOrderRow) => row.items.length,
            },
            {
              title: t('pages.salesSupervision.columns.soldAt', { defaultValue: 'Sold Time' }),
              dataIndex: 'sold_at',
              width: 190,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('pages.salesSupervision.columns.deletedAt', { defaultValue: 'Deleted At' }),
              dataIndex: 'deleted_at',
              width: 190,
              render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
            },
            {
              title: t('pages.salesSupervision.columns.actions', { defaultValue: 'Actions' }),
              width: 280,
              render: (_: unknown, row: SalesOrderRow) => (
                <Space wrap>
                  <Popconfirm
                    title={t('pages.salesSupervision.restoreConfirmTitle', { defaultValue: 'Restore this sales order?' })}
                    description={t('pages.salesSupervision.restoreConfirmDesc', {
                      defaultValue: 'The sales order will be moved back to the active supervision list.',
                    })}
                    okText={t('labels.restore', { defaultValue: 'Restore' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleSalesRestore([row.id])}
                  >
                    <Button size="small">{t('labels.restore', { defaultValue: 'Restore' })}</Button>
                  </Popconfirm>
                  <Popconfirm
                    title={t('pages.salesSupervision.permanentDeleteConfirmTitle', { defaultValue: 'Permanently delete this sales order?' })}
                    description={t('pages.salesSupervision.permanentDeleteConfirmDesc', {
                      defaultValue: 'This action cannot be undone.',
                    })}
                    okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleSalesPermanentDelete([row.id])}
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
      ),
    })
  }

  if (canManageDeletedProjects) {
    tabItems.push({
      key: 'projects',
      label: t('pages.pmProjects.title', { defaultValue: 'Projects' }),
      children: (
        <Table
          loading={projectLoading}
          rowKey="id"
          bordered
          dataSource={projectRows}
          rowSelection={{
            selectedRowKeys: selectedProjectIds,
            onChange: (keys) => setSelectedProjectIds(keys as string[]),
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
              render: (value: number | null) => (
                <Progress
                  percent={Math.max(0, Math.min(100, value ?? 0))}
                  size="small"
                  status={(value ?? 0) >= 100 ? 'success' : 'active'}
                />
              ),
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
                    onConfirm={() => void handleProjectRestore([row.id])}
                  >
                    <Button size="small">{t('labels.restore', { defaultValue: 'Restore' })}</Button>
                  </Popconfirm>
                  <Popconfirm
                    title={t('pages.pmDeletedProjects.permanentDeleteConfirmTitle', {
                      defaultValue: 'Permanently delete this project?',
                    })}
                    description={t('pages.pmDeletedProjects.permanentDeleteConfirmDesc', {
                      defaultValue: 'This action cannot be undone.',
                    })}
                    okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleProjectPermanentDelete([row.id])}
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
      ),
    })
  }

  if (canManageDeletedMerchants) {
    tabItems.push({
      key: 'merchants',
      label: t('pages.onboardMerchant.title', { defaultValue: 'Onboard Merchants' }),
      children: (
        <Table
          rowKey="id"
          loading={merchantLoading}
          bordered
          dataSource={merchantRows}
          rowSelection={{
            selectedRowKeys: selectedMerchantIds,
            onChange: (keys) => setSelectedMerchantIds(keys as string[]),
          }}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: t('pages.onboardMerchant.columns.merchantNo', { defaultValue: 'Merchant No' }), dataIndex: 'merchant_no', width: 190 },
            { title: t('pages.onboardMerchant.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
            {
              title: t('pages.onboardMerchant.columns.type', { defaultValue: 'Type' }),
              dataIndex: 'onboarding_type',
              width: 170,
              render: (value: OnboardMerchantType) => t(`onboardMerchantType.${value}`, { defaultValue: value }),
            },
            { title: t('pages.onboardMerchant.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
            { title: t('pages.onboardMerchant.columns.city', { defaultValue: 'City' }), dataIndex: 'city', width: 140 },
            {
              title: t('pages.onboardMerchantDeleted.deletedAt', { defaultValue: 'Deleted At' }),
              dataIndex: 'deleted_at',
              width: 190,
              render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
            },
            {
              title: t('pages.onboardMerchant.columns.actions', { defaultValue: 'Actions' }),
              width: 280,
              render: (_: unknown, row: OnboardMerchant) => (
                <Space wrap>
                  <Popconfirm
                    title={t('pages.onboardMerchantDeleted.restoreConfirmTitle', { defaultValue: 'Restore this merchant?' })}
                    description={t('pages.onboardMerchantDeleted.restoreConfirmDesc', {
                      defaultValue: 'The merchant will be moved back to active list.',
                    })}
                    okText={t('labels.restore', { defaultValue: 'Restore' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleMerchantRestore([row.id])}
                  >
                    <Button size="small">{t('labels.restore', { defaultValue: 'Restore' })}</Button>
                  </Popconfirm>
                  <Popconfirm
                    title={t('pages.onboardMerchantDeleted.permanentDeleteConfirmTitle', { defaultValue: 'Permanently delete this merchant?' })}
                    description={t('pages.onboardMerchantDeleted.permanentDeleteConfirmDesc', {
                      defaultValue: 'This action cannot be undone.',
                    })}
                    okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleMerchantPermanentDelete([row.id])}
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
      ),
    })
  }

  return (
    <>
      <PageTitleBar
        title={t('labels.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
        description={t('pages.recentlyDeleted.description', {
          defaultValue: 'Manage deleted leads and projects in one place, including restore and permanent delete.',
        })}
        extra={
          <Space>
            <Button onClick={() => void loadCurrentTab()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Popconfirm
              title={
                isLeadTab
                  ? t('pages.bdDeletedLeads.batchRestoreConfirmTitle', { defaultValue: 'Restore selected leads?' })
                  : isSalesTab
                    ? t('pages.salesSupervision.batchRestoreConfirmTitle', { defaultValue: 'Restore selected sales orders?' })
                    : isProjectTab
                    ? t('pages.pmDeletedProjects.batchRestoreConfirmTitle', { defaultValue: 'Restore selected projects?' })
                    : t('pages.onboardMerchantDeleted.batchRestoreConfirmTitle', { defaultValue: 'Restore selected merchants?' })
              }
              description={
                isLeadTab
                  ? t('pages.bdDeletedLeads.batchRestoreConfirmDesc', {
                      defaultValue: 'Selected leads will be moved back to the active lead list.',
                    })
                  : isSalesTab
                    ? t('pages.salesSupervision.batchRestoreConfirmDesc', {
                        defaultValue: 'Selected sales orders will be moved back to active sales supervision list.',
                      })
                    : isProjectTab
                    ? t('pages.pmDeletedProjects.batchRestoreConfirmDesc', {
                        defaultValue: 'Selected projects will be moved back to the active project list.',
                      })
                    : t('pages.onboardMerchantDeleted.batchRestoreConfirmDesc', {
                        defaultValue: 'Selected merchants will be moved back to the active merchant list.',
                      })
              }
              okText={t('labels.restore', { defaultValue: 'Restore' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() =>
                void (isLeadTab
                  ? handleLeadRestore(selectedLeadIds)
                  : isSalesTab
                    ? handleSalesRestore(selectedSalesIds)
                  : isProjectTab
                    ? handleProjectRestore(selectedProjectIds)
                    : handleMerchantRestore(selectedMerchantIds))
              }
            >
              <Button disabled={selectedCount === 0}>{t('labels.restore', { defaultValue: 'Restore' })}</Button>
            </Popconfirm>
            <Popconfirm
              title={
                isLeadTab
                  ? t('pages.bdDeletedLeads.batchPermanentDeleteConfirmTitle', { defaultValue: 'Permanently delete selected leads?' })
                  : isSalesTab
                    ? t('pages.salesSupervision.batchPermanentDeleteConfirmTitle', {
                        defaultValue: 'Permanently delete selected sales orders?',
                      })
                    : isProjectTab
                    ? t('pages.pmDeletedProjects.batchPermanentDeleteConfirmTitle', {
                        defaultValue: 'Permanently delete selected projects?',
                      })
                    : t('pages.onboardMerchantDeleted.batchPermanentDeleteConfirmTitle', {
                        defaultValue: 'Permanently delete selected merchants?',
                      })
              }
              description={
                isLeadTab
                  ? t('pages.bdDeletedLeads.batchPermanentDeleteConfirmDesc', { defaultValue: 'This action cannot be undone.' })
                  : isSalesTab
                    ? t('pages.salesSupervision.batchPermanentDeleteConfirmDesc', { defaultValue: 'This action cannot be undone.' })
                    : isProjectTab
                    ? t('pages.pmDeletedProjects.batchPermanentDeleteConfirmDesc', { defaultValue: 'This action cannot be undone.' })
                    : t('pages.onboardMerchantDeleted.batchPermanentDeleteConfirmDesc', { defaultValue: 'This action cannot be undone.' })
              }
              okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() =>
                void (isLeadTab
                  ? handleLeadPermanentDelete(selectedLeadIds)
                  : isSalesTab
                    ? handleSalesPermanentDelete(selectedSalesIds)
                  : isProjectTab
                    ? handleProjectPermanentDelete(selectedProjectIds)
                    : handleMerchantPermanentDelete(selectedMerchantIds))
              }
            >
              <Button danger disabled={selectedCount === 0}>
                {t('labels.delete', { defaultValue: 'Delete' })}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={
                isLeadTab
                  ? t('pages.bdDeletedLeads.batchPermanentDeleteAllConfirmTitle', { defaultValue: 'Permanently delete all filtered leads?' })
                  : isSalesTab
                    ? t('pages.salesSupervision.batchPermanentDeleteAllConfirmTitle', {
                        defaultValue: 'Permanently delete all filtered sales orders?',
                      })
                    : isProjectTab
                    ? t('pages.pmDeletedProjects.batchPermanentDeleteAllConfirmTitle', {
                        defaultValue: 'Permanently delete all filtered projects?',
                      })
                    : t('pages.onboardMerchantDeleted.batchPermanentDeleteAllConfirmTitle', {
                        defaultValue: 'Permanently delete all filtered merchants?',
                      })
              }
              description={
                isLeadTab
                  ? t('pages.bdDeletedLeads.batchPermanentDeleteAllConfirmDesc', {
                      defaultValue: 'All currently filtered leads will be permanently deleted.',
                    })
                  : isSalesTab
                    ? t('pages.salesSupervision.batchPermanentDeleteAllConfirmDesc', {
                        defaultValue: 'All currently filtered sales orders will be permanently deleted.',
                      })
                    : isProjectTab
                    ? t('pages.pmDeletedProjects.batchPermanentDeleteAllConfirmDesc', {
                        defaultValue: 'All currently filtered projects will be permanently deleted.',
                      })
                    : t('pages.onboardMerchantDeleted.batchPermanentDeleteAllConfirmDesc', {
                        defaultValue: 'All currently filtered merchants will be permanently deleted.',
                      })
              }
              okText={t('labels.permanentDelete', { defaultValue: 'Permanent Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() =>
                void (isLeadTab
                  ? handleLeadPermanentDelete(leadRows.map((item) => item.id))
                  : isSalesTab
                    ? handleSalesPermanentDelete(salesRows.map((item) => item.id))
                  : isProjectTab
                    ? handleProjectPermanentDelete(projectRows.map((item) => item.id))
                    : handleMerchantPermanentDelete(merchantRows.map((item) => item.id)))
              }
            >
              <Button danger disabled={currentRowsCount === 0}>
                {t('pages.recentlyDeleted.deleteAllFiltered', { defaultValue: 'Delete All Filtered' })}
              </Button>
            </Popconfirm>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Input.Search
            allowClear
            placeholder={
              isLeadTab
                ? t('pages.bdDeletedLeads.keywordPlaceholder', { defaultValue: 'Keyword (lead code/company/contact)' })
                : isSalesTab
                  ? t('pages.salesSupervision.keywordDeletedPlaceholder', { defaultValue: 'Order no / company / lead code' })
                : isProjectTab
                  ? t('pages.pmDeletedProjects.keywordPlaceholder', { defaultValue: 'Project code/name' })
                  : t('pages.onboardMerchantDeleted.keywordPlaceholder', { defaultValue: 'Keyword (merchant no/company/region/city)' })
            }
            style={{ width: 320 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadCurrentTab()}
          />
          <Button type="primary" onClick={() => void loadCurrentTab()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          const nextTab = key as DeletedTabKey
          setActiveTab(nextTab)
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tab', nextTab)
          setSearchParams(nextParams, { replace: true })
        }}
        items={tabItems}
      />
    </>
  )
}
