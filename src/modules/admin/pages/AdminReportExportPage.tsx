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
import type {
  ReportExport,
} from '../../../types/business'

type ReportModule = 'leads' | 'sales_leads' | 'onboarding' | 'projects'
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
    product_name: string | null
    quantity: number
    unit_price: number | null
  }>
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
      label: user.full_name ? `${user.full_name} (${user.email})` : user.email,
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
            'order_no, company_name, sold_at, created_at, note, bd_user_id, lead:leads(lead_code), bd_owner:profiles!sales_orders_bd_user_id_fkey(full_name, email), items:sales_order_items(category, product_name, quantity, unit_price)',
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
          const itemSummary = normalizedItems
            .map((item) => `${item.product_name?.trim() || item.category} x${item.quantity}`)
            .join('; ')

          return {
            order_no: row.order_no,
            lead_code: row.lead?.lead_code ?? '',
            company_name: row.company_name,
            bd_owner: row.bd_owner?.full_name ? `${row.bd_owner.full_name} (${row.bd_owner.email ?? ''})` : row.bd_owner?.email ?? row.bd_user_id,
            sold_at: row.sold_at,
            created_at: row.created_at,
            item_count: normalizedItems.length,
            total_quantity: totalQuantity,
            total_amount: totalAmount.toFixed(2),
            categories,
            item_summary: itemSummary,
            note: row.note ?? '',
          }
        })

        exportRowsToCsv(`bcs-sales-leads-${new Date().toISOString().slice(0, 10)}.csv`, exportRows)
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
              { label: t('pages.adminReportExport.modules.onboarding', { defaultValue: 'Onboarding Report' }), value: 'onboarding' },
              { label: t('pages.adminReportExport.modules.projects', { defaultValue: 'Project Report' }), value: 'projects' },
            ]}
            onChange={(value) => setModuleName(value)}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminReportExport.createdFrom', { defaultValue: 'Created From' })}
            value={createdFrom ? dayjs(createdFrom) : undefined}
            onChange={(value) => setCreatedFrom(value ? value.startOf('day').toISOString() : undefined)}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminReportExport.createdTo', { defaultValue: 'Created To' })}
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
