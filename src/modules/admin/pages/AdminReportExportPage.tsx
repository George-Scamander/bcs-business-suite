import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
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
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  formatDisplayName,
  formatUserOptionLabel,
} from '../../../lib/user-display'
import {
  supabase,
} from '../../../lib/supabase/client'
import {
  exportRowsToCsv,
  listReportExports,
  requestReportExport,
} from '../../reports/api'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import {
  getSalesProductCategoryGroup,
  getSalesProductSubcategory,
} from '../../../lib/business-constants'
import type {
  ReportExport,
  SalesProductCategory,
  SalesProductSubcategory,
} from '../../../types/business'

type ReportModule = 'leads' | 'sales_leads' | 'sales_mom' | 'onboarding' | 'projects'
interface SalesLeadExportSourceRow {
  order_no: string
  company_name: string
  sold_at: string
  created_at: string
  note: string | null
  bd_user_id: string
  lead: { lead_code: string | null } | null
  bd_owner: { full_name: string | null; email: string | null } | null
  items: Array<{
    category: string
    subcategory: SalesProductSubcategory | null
    product_name: string | null
    quantity: number
    unit_price: number | null
  }>
}

interface SalesMomSourceRow {
  bd_user_id: string
  sold_at: string
  bd_owner: { full_name: string | null; email: string | null } | null
  items: Array<{ quantity: number; unit_price: number | null }>
}

function calcMomRate(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? '0.0%' : 'N/A'
  }
  const rate = ((current - previous) / previous) * 100
  return (rate >= 0 ? '+' : '') + rate.toFixed(1) + '%'
}

function calcMomDiff(current: number, previous: number): string {
  const diff = current - previous
  return (diff >= 0 ? '+' : '') + diff
}

function calcMomDiffFloat(current: number, previous: number): string {
  const diff = current - previous
  return (diff >= 0 ? '+' : '') + diff.toFixed(2)
}

interface BdMomStats {
  bdUserId: string
  bdName: string
  latestSoldAt: string
  currentOrders: number
  previousOrders: number
  currentAmount: number
  previousAmount: number
  currentQuantity: number
  previousQuantity: number
}

export function AdminReportExportPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [moduleName, setModuleName] = useState<ReportModule>('leads')
  const [createdFrom, setCreatedFrom] = useState<string | undefined>()
  const [createdTo, setCreatedTo] = useState<string | undefined>()
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>()
  const [rows, setRows] = useState<ReportExport[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const userOptions = useMemo(() => {
    return users.map((user) => ({
      value: user.id,
      label: formatUserOptionLabel(user),
    }))
  }, [users])

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [reportRows, userRows] = await Promise.all([listReportExports(), listActiveUsers()])
      setRows(reportRows)
      setUsers(userRows)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminReportExport.loadFail', { defaultValue: 'Failed to load report exports' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function applyCommonExportFilters<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(query: T): T {
    let nextQuery = query
    if (createdFrom) {
      nextQuery = nextQuery.gte('created_at', createdFrom)
    }
    if (createdTo) {
      nextQuery = nextQuery.lte('created_at', createdTo)
    }
    return nextQuery
  }

  function renderModuleLabel(value: string): string {
    if (value === 'leads') {
      return t('pages.adminReportExport.modules.leads', { defaultValue: 'Lead Report' })
    }
    if (value === 'sales_leads') {
      return t('pages.adminReportExport.modules.salesLeads', { defaultValue: 'Sales Lead Report' })
    }
    if (value === 'sales_mom') {
      return t('pages.adminReportExport.modules.salesMom', { defaultValue: 'Sales MoM Comparison' })
    }
    if (value === 'onboarding') {
      return t('pages.adminReportExport.modules.onboarding', { defaultValue: 'Onboarding Report' })
    }
    if (value === 'projects') {
      return t('pages.adminReportExport.modules.projects', { defaultValue: 'Project Report' })
    }
    return value
  }

  async function handleExport() {
    setExporting(true)

    try {
      const requestedAt = new Date().toISOString()
      const exportFilters: Record<string, unknown> = { requested_at: requestedAt }
      if (createdFrom) {
        exportFilters[moduleName === 'sales_leads' ? 'sold_from' : 'created_from'] = createdFrom
      }
      if (createdTo) {
        exportFilters[moduleName === 'sales_leads' ? 'sold_to' : 'created_to'] = createdTo
      }
      if (selectedUserId) {
        exportFilters.user_id = selectedUserId
      }
      await requestReportExport(moduleName, exportFilters)

      if (moduleName === 'leads') {
        let query = supabase
          .from('leads')
          .select('lead_code, company_name, region, industry, status, assigned_bd_id, created_at')
          .is('deleted_at', null)

        if (selectedUserId) {
          query = query.eq('assigned_bd_id', selectedUserId)
        }

        const result = await applyCommonExportFilters(query).order('created_at', { ascending: false })

        if (result.error) {
          throw result.error
        }

        exportRowsToCsv(`bcs-leads-${new Date().toISOString().slice(0, 10)}.csv`, result.data ?? [])
      } else if (moduleName === 'sales_leads') {
        let query = supabase
          .from('sales_orders')
          .select(
            'order_no, company_name, sold_at, created_at, note, bd_user_id, lead:leads(lead_code), bd_owner:profiles!sales_orders_bd_user_id_fkey(full_name, email), items:sales_order_items(category, subcategory, product_name, quantity, unit_price)',
          )
          .is('deleted_at', null)

        if (selectedUserId) {
          query = query.eq('bd_user_id', selectedUserId)
        }

        if (createdFrom) {
          query = query.gte('sold_at', createdFrom)
        }
        if (createdTo) {
          query = query.lte('sold_at', createdTo)
        }

        const result = await query
          .order('sold_at', { ascending: false })
          .returns<SalesLeadExportSourceRow[]>()

        if (result.error) {
          throw result.error
        }

        const exportRows = (result.data ?? []).map((row) => {
          const normalizedItems = row.items ?? []
          const totalQuantity = normalizedItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
          const totalAmount = normalizedItems.reduce((sum, item) => {
            const quantity = Number(item.quantity ?? 0)
            const unitPrice = Number(item.unit_price ?? 0)
            return sum + quantity * unitPrice
          }, 0)
          const categories = Array.from(new Set(normalizedItems.map((item) => item.category))).join(' | ')
          const categoryGroups = Array.from(new Set(normalizedItems.map((item) => getSalesProductCategoryGroup(item.category as SalesProductCategory)))).join(' | ')
          const subcategories = Array.from(new Set(normalizedItems
            .map((item) => getSalesProductSubcategory(item.category as SalesProductCategory, item.subcategory))
            .filter(Boolean))).join(' | ')
          const itemSummary = normalizedItems
            .map((item) => `${item.product_name?.trim() || item.category} x${item.quantity}`)
            .join('; ')

          return {
            order_no: row.order_no,
            lead_code: row.lead?.lead_code ?? '',
            company_name: row.company_name,
            bd_owner: formatDisplayName(row.bd_owner?.full_name, row.bd_owner?.email, row.bd_user_id),
            sold_at: row.sold_at,
            created_at: row.created_at,
            item_count: normalizedItems.length,
            total_quantity: totalQuantity,
            total_amount: totalAmount.toFixed(2),
            categories,
            category_groups: categoryGroups,
            subcategories,
            item_summary: itemSummary,
            note: row.note ?? '',
          }
        })

        exportRowsToCsv(`bcs-sales-leads-${new Date().toISOString().slice(0, 10)}.csv`, exportRows)
      } else if (moduleName === 'sales_mom') {
        // Determine current-month and previous-month date ranges
        const now = new Date()
        let currentStart: Date
        let currentEnd: Date

        if (createdFrom && createdTo) {
          currentStart = new Date(createdFrom)
          currentEnd = new Date(createdTo)
        } else {
          currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
          currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        }

        const monthDiff = currentStart.getMonth() - 1
        const prevYear = monthDiff < 0 ? currentStart.getFullYear() - 1 : currentStart.getFullYear()
        const prevMonth = monthDiff < 0 ? 11 : monthDiff
        const previousStart = new Date(prevYear, prevMonth, 1)
        const previousEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)

        const monthLabel = `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}`

        let currentQuery = supabase
          .from('sales_orders')
          .select('bd_user_id, sold_at, bd_owner:profiles!sales_orders_bd_user_id_fkey(full_name, email), items:sales_order_items(quantity, unit_price)')
          .is('deleted_at', null)
          .gte('sold_at', currentStart.toISOString())
          .lte('sold_at', currentEnd.toISOString())

        let previousQuery = supabase
          .from('sales_orders')
          .select('bd_user_id, sold_at, bd_owner:profiles!sales_orders_bd_user_id_fkey(full_name, email), items:sales_order_items(quantity, unit_price)')
          .is('deleted_at', null)
          .gte('sold_at', previousStart.toISOString())
          .lte('sold_at', previousEnd.toISOString())

        if (selectedUserId) {
          currentQuery = currentQuery.eq('bd_user_id', selectedUserId)
          previousQuery = previousQuery.eq('bd_user_id', selectedUserId)
        }

        const [currentResult, previousResult] = await Promise.all([
          currentQuery.returns<SalesMomSourceRow[]>(),
          previousQuery.returns<SalesMomSourceRow[]>(),
        ])

        if (currentResult.error) throw currentResult.error
        if (previousResult.error) throw previousResult.error

        // Aggregate by BD user
        const statsMap = new Map<string, BdMomStats>()

        function aggregateRows(rows: SalesMomSourceRow[], isCurrent: boolean) {
          for (const row of rows) {
            const bdId = row.bd_user_id
            const bdName = formatDisplayName(
              row.bd_owner?.full_name ?? null,
              row.bd_owner?.email ?? null,
              bdId,
            )
            if (!statsMap.has(bdId)) {
              statsMap.set(bdId, {
                bdUserId: bdId,
                bdName,
                latestSoldAt: row.sold_at,
                currentOrders: 0,
                previousOrders: 0,
                currentAmount: 0,
                previousAmount: 0,
                currentQuantity: 0,
                previousQuantity: 0,
              })
            }
            const entry = statsMap.get(bdId)!
            const items = row.items ?? []
            const orderAmount = items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0)
            const orderQuantity = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)

            if (isCurrent) {
              entry.currentOrders += 1
              entry.currentAmount += orderAmount
              entry.currentQuantity += orderQuantity
              if (row.sold_at > entry.latestSoldAt) {
                entry.latestSoldAt = row.sold_at
              }
            } else {
              entry.previousOrders += 1
              entry.previousAmount += orderAmount
              entry.previousQuantity += orderQuantity
            }
          }
        }

        aggregateRows(currentResult.data ?? [], true)
        aggregateRows(previousResult.data ?? [], false)

        // Sort by latest sold_at descending (actual data time, not name)
        const sortedStats = Array.from(statsMap.values()).sort(
          (a, b) => new Date(b.latestSoldAt).getTime() - new Date(a.latestSoldAt).getTime(),
        )

        // Build export rows (one row per BD)
        const exportRows = sortedStats.map((s) => ({
          bd_name: s.bdName,
          latest_sold_at: new Date(s.latestSoldAt).toLocaleDateString(),
          current_month_orders: s.currentOrders,
          previous_month_orders: s.previousOrders,
          orders_diff: calcMomDiff(s.currentOrders, s.previousOrders),
          orders_growth_rate: calcMomRate(s.currentOrders, s.previousOrders),
          current_month_amount: s.currentAmount.toFixed(2),
          previous_month_amount: s.previousAmount.toFixed(2),
          amount_diff: calcMomDiffFloat(s.currentAmount, s.previousAmount),
          amount_growth_rate: calcMomRate(s.currentAmount, s.previousAmount),
          current_month_quantity: s.currentQuantity,
          previous_month_quantity: s.previousQuantity,
          quantity_diff: calcMomDiff(s.currentQuantity, s.previousQuantity),
          quantity_growth_rate: calcMomRate(s.currentQuantity, s.previousQuantity),
        }))

        // Totals row
        const totalCurrent = { orders: 0, amount: 0, quantity: 0 }
        const totalPrevious = { orders: 0, amount: 0, quantity: 0 }
        for (const s of sortedStats) {
          totalCurrent.orders += s.currentOrders
          totalCurrent.amount += s.currentAmount
          totalCurrent.quantity += s.currentQuantity
          totalPrevious.orders += s.previousOrders
          totalPrevious.amount += s.previousAmount
          totalPrevious.quantity += s.previousQuantity
        }

        exportRows.push({
          bd_name: t('pages.adminReportExport.momTotalRow', { defaultValue: 'Team Total' }),
          latest_sold_at: '-',
          current_month_orders: totalCurrent.orders,
          previous_month_orders: totalPrevious.orders,
          orders_diff: calcMomDiff(totalCurrent.orders, totalPrevious.orders),
          orders_growth_rate: calcMomRate(totalCurrent.orders, totalPrevious.orders),
          current_month_amount: totalCurrent.amount.toFixed(2),
          previous_month_amount: totalPrevious.amount.toFixed(2),
          amount_diff: calcMomDiffFloat(totalCurrent.amount, totalPrevious.amount),
          amount_growth_rate: calcMomRate(totalCurrent.amount, totalPrevious.amount),
          current_month_quantity: totalCurrent.quantity,
          previous_month_quantity: totalPrevious.quantity,
          quantity_diff: calcMomDiff(totalCurrent.quantity, totalPrevious.quantity),
          quantity_growth_rate: calcMomRate(totalCurrent.quantity, totalPrevious.quantity),
        })

        exportRowsToCsv(`bcs-sales-mom-${monthLabel}.csv`, exportRows)
      } else if (moduleName === 'onboarding') {
        let query = supabase
          .from('onboarding_cases')
          .select('case_no, status, owner_user_id, reviewer_user_id, sla_due_at, started_at, completed_at')
          .is('deleted_at', null)

        if (selectedUserId) {
          query = query.eq('owner_user_id', selectedUserId)
        }

        const result = await applyCommonExportFilters(query).order('created_at', { ascending: false })

        if (result.error) {
          throw result.error
        }

        exportRowsToCsv(`bcs-onboarding-${new Date().toISOString().slice(0, 10)}.csv`, result.data ?? [])
      } else {
        let query = supabase
          .from('projects')
          .select('project_code, name, status, completion_rate, pm_owner_id, bd_owner_id, start_date, target_end_date')
          .is('deleted_at', null)

        if (selectedUserId) {
          query = query.or(`pm_owner_id.eq.${selectedUserId},bd_owner_id.eq.${selectedUserId}`)
        }

        const result = await applyCommonExportFilters(query).order('created_at', { ascending: false })

        if (result.error) {
          throw result.error
        }

        exportRowsToCsv(`bcs-projects-${new Date().toISOString().slice(0, 10)}.csv`, result.data ?? [])
      }

      message.success(t('pages.adminReportExport.exportSuccess', { defaultValue: 'Report exported' }))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminReportExport.exportFail', { defaultValue: 'Failed to export report' })
      message.error(text)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.adminReportExport.title', { defaultValue: 'Report Export Center' })}
        description={t('pages.adminReportExport.description', {
          defaultValue: 'Generate operational exports for leads, sales leads, onboarding, and project performance review.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Card className="mb-5">
        <Space wrap>
          <Select<ReportModule>
            value={moduleName}
            style={{ width: 220 }}
            options={[
              { label: t('pages.adminReportExport.modules.leads', { defaultValue: 'Lead Report' }), value: 'leads' },
              { label: t('pages.adminReportExport.modules.salesLeads', { defaultValue: 'Sales Lead Report' }), value: 'sales_leads' },
              { label: t('pages.adminReportExport.modules.salesMom', { defaultValue: 'Sales MoM Comparison' }), value: 'sales_mom' },
              { label: t('pages.adminReportExport.modules.onboarding', { defaultValue: 'Onboarding Report' }), value: 'onboarding' },
              { label: t('pages.adminReportExport.modules.projects', { defaultValue: 'Project Report' }), value: 'projects' },
            ]}
            onChange={(value) => setModuleName(value)}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={
              moduleName === 'sales_mom'
                ? t('pages.adminReportExport.currentMonthFrom', { defaultValue: 'Current Month Start' })
                : moduleName === 'sales_leads'
                  ? t('pages.adminReportExport.soldFrom', { defaultValue: 'Sold From' })
                  : t('pages.adminReportExport.createdFrom', { defaultValue: 'Created From' })
            }
            value={createdFrom ? dayjs(createdFrom) : undefined}
            onChange={(value) => setCreatedFrom(value ? value.startOf('day').toISOString() : undefined)}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={
              moduleName === 'sales_mom'
                ? t('pages.adminReportExport.currentMonthTo', { defaultValue: 'Current Month End' })
                : moduleName === 'sales_leads'
                  ? t('pages.adminReportExport.soldTo', { defaultValue: 'Sold To' })
                  : t('pages.adminReportExport.createdTo', { defaultValue: 'Created To' })
            }
            value={createdTo ? dayjs(createdTo) : undefined}
            onChange={(value) => setCreatedTo(value ? value.endOf('day').toISOString() : undefined)}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={selectedUserId}
            style={{ width: 300 }}
            placeholder={t('pages.adminReportExport.userPlaceholder', { defaultValue: 'Select user (optional)' })}
            options={userOptions}
            onChange={(value) => setSelectedUserId(value || undefined)}
          />
          <Button
            onClick={() => {
              setCreatedFrom(undefined)
              setCreatedTo(undefined)
              setSelectedUserId(undefined)
            }}
          >
            {t('pages.adminReportExport.clearFilters', { defaultValue: 'Clear Filters' })}
          </Button>
          <Button type="primary" loading={exporting} onClick={() => void handleExport()}>
            {t('pages.adminReportExport.exportCsv', { defaultValue: 'Export CSV' })}
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          {
            title: t('pages.adminReportExport.columns.requestedAt', { defaultValue: 'Requested At' }),
            dataIndex: 'requested_at',
            width: 180,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: t('pages.adminReportExport.columns.module', { defaultValue: 'Module' }),
            dataIndex: 'module',
            width: 160,
            render: (value: string) => renderModuleLabel(value),
          },
          { title: t('pages.adminReportExport.columns.status', { defaultValue: 'Status' }), dataIndex: 'status', width: 120 },
          {
            title: t('pages.adminReportExport.columns.requestedBy', { defaultValue: 'Requested By' }),
            dataIndex: 'requested_by',
            width: 300,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('pages.adminReportExport.columns.completedAt', { defaultValue: 'Completed At' }),
            dataIndex: 'completed_at',
            width: 180,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
