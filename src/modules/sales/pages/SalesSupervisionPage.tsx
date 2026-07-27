import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  AutoComplete,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  useTranslation,
} from 'react-i18next'
import {
  useNavigate,
} from 'react-router-dom'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getSalesProductCategoryOptions,
  getSalesProductCategoryGroup,
  getSalesProductEntryCategoryOptions,
  getSalesProductSubcategory,
  getSalesProductSubcategoryLabel,
  getSalesProductSubcategoryOptions,
} from '../../../lib/business-constants'
import { BD_CITIES } from '../../../lib/constants'
import {
  supabase,
} from '../../../lib/supabase/client'
import {
  formatDisplayName,
  formatUserOptionLabel,
} from '../../../lib/user-display'
import {
  generateUuid,
} from '../../../lib/uuid'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import {
  confirmSalesOrderPayment,
  createSalesOrderWithAutoLeadAndAssignBd,
  fetchProductNameSuggestions,
  generateSalesPaymentDueNotifications,
  listTirePriceCatalog,
  listSalesOrders,
  softDeleteSalesOrder,
  updateSalesOrder,
  type SalesOrderRow,
  type TirePriceCatalogRow,
} from '../api'
import type {
  SalesOrderItem,
  SalesPaymentMethod,
  SalesProductCategory,
  SalesProductSubcategory,
  SalesTopTerm,
} from '../../../types/business'

interface SupervisionFilters {
  keyword?: string
  bdUserId?: string
  soldFrom?: string
  soldTo?: string
  category?: SalesProductCategory
  brandKeyword?: string
  paymentMethod?: SalesPaymentMethod
  paymentConfirmed?: boolean
}

interface DraftSalesItem {
  key: string
  category: SalesProductCategory
  subcategory: SalesProductSubcategory | null
  product_name: string
  quantity: number
  unit_price?: number
}

interface EditSalesFormValues {
  company_name: string
  sold_at: dayjs.Dayjs
  payment_method: SalesPaymentMethod
  payment_top_term?: SalesTopTerm
  note?: string
}

interface CreateSalesFormValues {
  bd_user_id: string
  company_name: string
  sold_at: dayjs.Dayjs
  payment_method: SalesPaymentMethod
  payment_top_term?: SalesTopTerm
  note?: string
}

interface RoleMappingRow {
  user_id: string
  role: { code: string } | Array<{ code: string }> | null
}

const BRAND_FILTER_OPTIONS = [
  'Bosch',
  'X-owl',
  'Sinopec',
  'Sailun',
].map((brand) => ({
  label: brand,
  value: brand,
}))

interface PaymentLabels {
  top: string
  cash: string
  consignment: string
  top30Days: string
  top60Days: string
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

function newDraftItem(): DraftSalesItem {
  return {
    key: generateUuid(),
    category: 'TIRE',
    subcategory: null,
    product_name: '',
    quantity: 1,
  }
}

function mapItemsForDraft(items: SalesOrderItem[] | undefined): DraftSalesItem[] {
  const mapped = (items ?? []).map((item) => ({
    key: generateUuid(),
    category: getSalesProductCategoryGroup(item.category),
    subcategory: getSalesProductSubcategory(item.category, item.subcategory),
    product_name: item.product_name ?? '',
    quantity: Number(item.quantity ?? 1),
    unit_price: item.unit_price ?? undefined,
  }))

  return mapped.length > 0 ? mapped : [newDraftItem()]
}

function renderPaymentMethodLabel(method: SalesPaymentMethod, topTerm: SalesTopTerm | null, labels: PaymentLabels): string {
  if (method === 'TOP') {
    return `${labels.top} (${topTerm === '60_DAYS' ? labels.top60Days : labels.top30Days})`
  }

  if (method === 'CONSIGNMENT') {
    return `${labels.consignment} (${labels.top30Days})`
  }

  return labels.cash
}

function getPaymentDueAt(soldAt: string, method: SalesPaymentMethod, topTerm: SalesTopTerm | null): dayjs.Dayjs | null {
  if (method === 'TOP') {
    const days = topTerm === '60_DAYS' ? 60 : 30
    return dayjs(soldAt).add(days, 'day')
  }

  if (method === 'CONSIGNMENT') {
    return dayjs(soldAt).add(30, 'day')
  }

  return null
}

function getReminderDaysLeft(dueAt: dayjs.Dayjs | null): number | null {
  if (!dueAt) {
    return null
  }

  return dueAt.startOf('day').diff(dayjs().startOf('day'), 'day')
}

function getSoldAtTimestamp(row: SalesOrderRow): number {
  return dayjs(row.sold_at).valueOf()
}

function getPaymentSortTimestamp(row: SalesOrderRow): number {
  const dueAt = getPaymentDueAt(row.sold_at, row.payment_method, row.payment_top_term)
  return dueAt ? dueAt.valueOf() : getSoldAtTimestamp(row)
}

function resolveBusinessTag(row: SalesOrderRow): 'BCS' | 'BOTH' | null {
  const leadIntentPackage = row.lead?.intent_package
  if (leadIntentPackage === 'BCS') {
    return 'BCS'
  }
  if (leadIntentPackage === 'BOTH') {
    return 'BOTH'
  }

  if (row.onboard_merchant?.onboarding_type === 'BCS_FRANCHISE') {
    return 'BCS'
  }

  return null
}

export function SalesSupervisionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [createForm] = Form.useForm<CreateSalesFormValues>()
  const [editForm] = Form.useForm<EditSalesFormValues>()
  const { roles } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SalesOrderRow[]>([])
  const [bdUsers, setBdUsers] = useState<UserOption[]>([])
  const [bdCityByUserId, setBdCityByUserId] = useState<Map<string, string | null>>(new Map())
  const [bdCityFilter, setBdCityFilter] = useState<string | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<SupervisionFilters>({})
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createItems, setCreateItems] = useState<DraftSalesItem[]>([newDraftItem()])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SalesOrderRow | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editItems, setEditItems] = useState<DraftSalesItem[]>([newDraftItem()])
  const [tireCatalogRows, setTireCatalogRows] = useState<TirePriceCatalogRow[]>([])
  const [productSuggestions, setProductSuggestions] = useState<Map<SalesProductCategory, string[]>>(new Map())
  const [editOpenedFromDetail, setEditOpenedFromDetail] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<SalesOrderRow | null>(null)
  const deleteRetentionHint = t('labels.autoDelete30DaysHint', {
    defaultValue: 'Moved to Recently Deleted and auto-permanently deleted after 30 days.',
  })

  const categoryLabelByValue = useMemo(() => {
    return new Map(getSalesProductCategoryOptions(t).map((item) => [item.value, item.label]))
  }, [t])
  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])
  const entryCategoryOptions = useMemo(() => getSalesProductEntryCategoryOptions(t), [t])
  const tireModelOptions = useMemo(
    () =>
      tireCatalogRows.map((row) => ({
        value: row.model_label,
        label: `${row.model_label} · IDR ${new Intl.NumberFormat().format(Number(row.price_incl_vat ?? 0))}`,
      })),
    [tireCatalogRows],
  )
  const paymentLabels = useMemo<PaymentLabels>(
    () => ({
      top: t('pages.salesSupervision.paymentMethodTopOption', { defaultValue: 'TOP' }),
      cash: t('pages.salesSupervision.paymentMethodCashOption', { defaultValue: 'Cash' }),
      consignment: t('pages.salesSupervision.paymentMethodConsignmentOption', { defaultValue: 'Consignment' }),
      top30Days: t('pages.salesSupervision.paymentTopTerm30Days', { defaultValue: '30 Days' }),
      top60Days: t('pages.salesSupervision.paymentTopTerm60Days', { defaultValue: '60 Days' }),
    }),
    [t],
  )
  const paymentMethodOptions = useMemo<Array<{ value: SalesPaymentMethod; label: string }>>(
    () => [
      { value: 'TOP', label: paymentLabels.top },
      { value: 'CASH', label: paymentLabels.cash },
      { value: 'CONSIGNMENT', label: paymentLabels.consignment },
    ],
    [paymentLabels],
  )
  const paymentTopTermOptions = useMemo<Array<{ value: SalesTopTerm; label: string }>>(
    () => [
      { value: '30_DAYS', label: paymentLabels.top30Days },
      { value: '60_DAYS', label: paymentLabels.top60Days },
    ],
    [paymentLabels],
  )

  const isSuperAdmin = roles.includes('super_admin')
  const isProjectManager = roles.includes('project_manager')
  const canFilterByBd = isSuperAdmin || isProjectManager
  const canCreateSalesLead = isSuperAdmin || isProjectManager

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      try {
        const insertedCount = await generateSalesPaymentDueNotifications()
        if (insertedCount > 0) {
          window.dispatchEvent(new Event('notifications:changed'))
        }
      } catch (error) {
        const code = typeof error === 'object' && error !== null ? String((error as { code?: string }).code ?? '') : ''
        const messageText = error instanceof Error ? error.message : ''
        const isRpcMissing = code === '42883' || code === 'PGRST202' || messageText.toLowerCase().includes('does not exist')
        if (!isRpcMissing) {
          throw error
        }
      }

      const [orderRows, userRows, roleMappingsResult] = await Promise.all([
        listSalesOrders({
          keyword: keyword.trim() || undefined,
          bdUserId: filters.bdUserId,
          soldFrom: filters.soldFrom,
          soldTo: filters.soldTo,
          category: filters.category,
          brandKeyword: filters.brandKeyword,
          paymentMethod: filters.paymentMethod,
          paymentConfirmed: filters.paymentConfirmed,
        }),
        listActiveUsers(),
        supabase
          .from('user_role_relations')
          .select('user_id, role:roles(code)')
          .returns<RoleMappingRow[]>(),
      ])
      setRows(orderRows)
      if (roleMappingsResult.error) {
        setBdUsers(userRows)
      } else {
        const bdUserIds = new Set(
          (roleMappingsResult.data ?? [])
            .filter((row) => extractRoleCode(row.role) === 'bd_user')
            .map((row) => row.user_id),
        )
        const filteredBdUsers = userRows.filter((user) => bdUserIds.has(user.id))
        setBdUsers(filteredBdUsers.length > 0 ? filteredBdUsers : userRows)

        const bdIdList = [...bdUserIds]
        if (bdIdList.length > 0) {
          const profileResult = await supabase
            .from('profiles')
            .select('id, city')
            .in('id', bdIdList)
          if (!profileResult.error) {
            const cityMap = new Map<string, string | null>(
              (profileResult.data ?? []).map((p: { id: string; city: string | null }) => [p.id, p.city]),
            )
            setBdCityByUserId(cityMap)
          }
        }
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.salesSupervision.loadFail', { defaultValue: 'Failed to load sales supervision data' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters.bdUserId, filters.soldFrom, filters.soldTo, filters.category, filters.brandKeyword, filters.paymentMethod, filters.paymentConfirmed, keyword, t])

  useEffect(() => {
    void loadData()
    fetchProductNameSuggestions()
      .then(setProductSuggestions)
      .catch(() => {})
  }, [loadData])

  useEffect(() => {
    let cancelled = false
    async function loadTireCatalog() {
      try {
        const rows = await listTirePriceCatalog(undefined, 600)
        if (!cancelled) {
          setTireCatalogRows(rows)
        }
      } catch {
        if (!cancelled) {
          setTireCatalogRows([])
        }
      }
    }
    void loadTireCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  function openEditModal(row: SalesOrderRow) {
    setEditingRow(row)
    setEditItems(mapItemsForDraft(row.items))
    editForm.setFieldsValue({
      company_name: row.company_name,
      sold_at: dayjs(row.sold_at),
      payment_method: row.payment_method,
      payment_top_term: (row.payment_method === 'TOP' || row.payment_method === 'CONSIGNMENT') ? (row.payment_top_term ?? '30_DAYS') : undefined,
      note: row.note ?? undefined,
    })
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setEditingRow(null)
    if (editOpenedFromDetail && detailRow) {
      setDetailModalOpen(true)
    }
    setEditOpenedFromDetail(false)
  }

  function openDetailModal(row: SalesOrderRow) {
    setDetailRow(row)
    setDetailModalOpen(true)
  }

  function openCreateModal() {
    createForm.resetFields()
    createForm.setFieldsValue({
      sold_at: dayjs(),
      bd_user_id: bdUsers[0]?.id,
      payment_method: 'CASH',
    })
    setCreateItems([newDraftItem()])
    setCreateModalOpen(true)
  }

  function addCreateItem() {
    setCreateItems((current) => [...current, newDraftItem()])
  }

  function removeCreateItem(key: string) {
    setCreateItems((current) => {
      if (current.length <= 1) {
        return [newDraftItem()]
      }
      return current.filter((item) => item.key !== key)
    })
  }

  function updateCreateItem(key: string, patch: Partial<DraftSalesItem>) {
    setCreateItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function addEditItem() {
    setEditItems((current) => [...current, newDraftItem()])
  }

  function removeEditItem(key: string) {
    setEditItems((current) => {
      if (current.length <= 1) {
        return [newDraftItem()]
      }
      return current.filter((item) => item.key !== key)
    })
  }

  function updateEditItem(key: string, patch: Partial<DraftSalesItem>) {
    setEditItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function handleSaveEdit(values: EditSalesFormValues) {
    if (!editingRow) {
      return
    }

    const normalizedItems = editItems
      .map((item) => ({
        category: item.category,
        subcategory: item.subcategory,
        product_name: item.product_name.trim() || undefined,
        quantity: Math.max(1, Number(item.quantity || 1)),
        unit_price: item.unit_price,
      }))
      .filter((item) => item.quantity > 0)

    if (!normalizedItems.length) {
      message.warning(t('pages.salesSupervision.itemsRequired', { defaultValue: 'At least one sales item is required' }))
      return
    }

    setEditSaving(true)
    try {
      await updateSalesOrder({
        orderId: editingRow.id,
        company_name: values.company_name.trim(),
        sold_at: values.sold_at.toISOString(),
        payment_method: values.payment_method,
        payment_top_term: values.payment_method === 'TOP' ? values.payment_top_term : (values.payment_method === 'CONSIGNMENT' ? '30_DAYS' : null),
        note: values.note ?? null,
        items: normalizedItems,
      })
      message.success(t('pages.salesSupervision.updateSuccess', { defaultValue: 'Sales order updated' }))
      setEditModalOpen(false)
      setEditingRow(null)
      setEditOpenedFromDetail(false)
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.salesSupervision.updateFail', { defaultValue: 'Failed to update sales order' })
      message.error(text)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(row: SalesOrderRow) {
    try {
      await softDeleteSalesOrder(row.id)
      message.success(t('pages.salesSupervision.deleteSuccess', { defaultValue: 'Sales order moved to Recently Deleted' }))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.salesSupervision.deleteFail', { defaultValue: 'Failed to delete sales order' })
      message.error(text)
    }
  }

  async function handleConfirmPayment(row: SalesOrderRow) {
    try {
      await confirmSalesOrderPayment(row.id)
      const alreadyConfirmed = Boolean(row.payment_confirmed_at)
      message.success(
        alreadyConfirmed
          ? t('pages.salesSupervision.paymentUnconfirmed', { defaultValue: 'Payment confirmation removed' })
          : t('pages.salesSupervision.paymentConfirmed', { defaultValue: 'Payment confirmed' }),
      )
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.salesSupervision.paymentConfirmFail', { defaultValue: 'Failed to update payment status' })
      message.error(text)
    }
  }

  async function handleCreate(values: CreateSalesFormValues) {
    const normalizedItems = createItems
      .map((item) => ({
        category: item.category,
        subcategory: item.subcategory,
        product_name: item.product_name.trim() || undefined,
        quantity: Math.max(1, Number(item.quantity || 1)),
        unit_price: item.unit_price,
      }))
      .filter((item) => item.quantity > 0)

    if (!normalizedItems.length) {
      message.warning(t('pages.salesSupervision.itemsRequired', { defaultValue: 'At least one sales item is required' }))
      return
    }

    setCreateSaving(true)
    try {
      const result = await createSalesOrderWithAutoLeadAndAssignBd({
        bd_user_id: values.bd_user_id,
        company_name: values.company_name.trim(),
        sold_at: values.sold_at.toISOString(),
        payment_method: values.payment_method,
        payment_top_term: values.payment_method === 'TOP' ? values.payment_top_term : (values.payment_method === 'CONSIGNMENT' ? '30_DAYS' : null),
        note: values.note ?? undefined,
        items: normalizedItems,
      })

      message.success(
        result.lead_created
          ? t('pages.salesSupervision.createSuccessWithLead', {
              defaultValue: 'Sales lead created and assigned. New lead {{leadCode}} has been added to lead pool.',
              leadCode: result.lead_code ?? 'SP',
            })
          : t('pages.salesSupervision.createSuccess', { defaultValue: 'Sales lead created and assigned successfully' }),
      )
      setCreateModalOpen(false)
      setCreateItems([newDraftItem()])
      createForm.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.salesSupervision.createFail', { defaultValue: 'Failed to create sales lead' })
      message.error(text)
    } finally {
      setCreateSaving(false)
    }
  }

  const bdOptions = useMemo(
    () =>
      bdUsers.map((user) => ({
        value: user.id,
        label: formatUserOptionLabel(user),
      })),
    [bdUsers],
  )
  const filteredRows = useMemo(() => {
    if (!bdCityFilter) {
      return rows
    }
    return rows.filter((row) => {
      const city = row.bd_user_id ? bdCityByUserId.get(row.bd_user_id) : undefined
      return city === bdCityFilter
    })
  }, [rows, bdCityFilter, bdCityByUserId])
  const detailDueAt = detailRow ? getPaymentDueAt(detailRow.sold_at, detailRow.payment_method, detailRow.payment_top_term) : null
  const detailReminderDaysLeft = getReminderDaysLeft(detailDueAt)
  const shouldShowDetailReminder = detailReminderDaysLeft !== null && detailReminderDaysLeft >= 0 && detailReminderDaysLeft <= 7

  return (
    <>
      <PageTitleBar
        title={t('pages.salesSupervision.title', { defaultValue: 'Sales Management' })}
        description={t('pages.salesSupervision.description', {
          defaultValue: 'PMO and Admin can monitor BD sales orders and auto-created SP leads in one place.',
        })}
        extra={
          <Space wrap>
            {canCreateSalesLead ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                {t('pages.salesSupervision.createSalesLead', { defaultValue: 'Create Sales Lead' })}
              </Button>
            ) : null}
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button onClick={() => navigate('/app/recently-deleted?tab=sales')}>
              {t('labels.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
            </Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border app-border app-surface p-4">
        <Space wrap>
          {canFilterByBd ? (
            <Select
              allowClear
              style={{ width: 280 }}
              placeholder={t('pages.salesSupervision.bdOwner', { defaultValue: 'BD Owner' })}
              options={bdOptions}
              value={filters.bdUserId}
              onChange={(value) => setFilters((current) => ({ ...current, bdUserId: value || undefined }))}
            />
          ) : null}
          {canFilterByBd ? (
            <Select
              allowClear
              style={{ width: 160 }}
              placeholder={t('pages.bdKpi.allCities', { defaultValue: 'All Cities' })}
              options={BD_CITIES.map((c) => ({ value: c, label: c }))}
              value={bdCityFilter}
              onChange={(value: string | undefined) => setBdCityFilter(value ?? undefined)}
            />
          ) : null}
          <Select
            allowClear
            style={{ width: 220 }}
            placeholder={t('pages.salesSupervision.categoryPlaceholder', { defaultValue: 'Sales Category' })}
            options={categoryOptions}
            value={filters.category}
            onChange={(value) => setFilters((current) => ({ ...current, category: (value as SalesProductCategory | undefined) ?? undefined }))}
          />
          <Select
            mode="tags"
            maxCount={1}
            allowClear
            showSearch
            style={{ width: 280 }}
            placeholder={t('pages.salesSupervision.brandPlaceholder', {
              defaultValue: 'Brand (Bosch / X-owl / Sinopec / Sailun)',
            })}
            options={BRAND_FILTER_OPTIONS}
            value={filters.brandKeyword ? [filters.brandKeyword] : []}
            onChange={(values) => {
              const first = Array.isArray(values) && values.length > 0 ? String(values[0]).trim() : ''
              setFilters((current) => ({
                ...current,
                brandKeyword: first || undefined,
              }))
            }}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder={t('pages.salesSupervision.filterPaymentMethod', { defaultValue: 'Payment Method' })}
            options={paymentMethodOptions}
            value={filters.paymentMethod}
            onChange={(value) => setFilters((current) => ({ ...current, paymentMethod: (value as SalesPaymentMethod | undefined) ?? undefined }))}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder={t('pages.salesSupervision.filterPaymentConfirmed', { defaultValue: 'Payment Status' })}
            options={[
              { value: 'true', label: t('pages.salesSupervision.filterPaymentConfirmedOption', { defaultValue: 'Paid' }) },
              { value: 'false', label: t('pages.salesSupervision.filterPaymentUnconfirmedOption', { defaultValue: 'Unpaid' }) },
            ]}
            value={filters.paymentConfirmed === undefined ? undefined : String(filters.paymentConfirmed)}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                paymentConfirmed: value === undefined ? undefined : value === 'true',
              }))
            }
          />
          <DatePicker
            style={{ width: 180 }}
            placeholder={t('pages.salesSupervision.soldFrom', { defaultValue: 'Sold from' })}
            value={filters.soldFrom ? dayjs(filters.soldFrom) : undefined}
            onChange={(value) =>
              setFilters((current) => ({ ...current, soldFrom: value ? value.startOf('day').toISOString() : undefined }))
            }
          />
          <DatePicker
            style={{ width: 180 }}
            placeholder={t('pages.salesSupervision.soldTo', { defaultValue: 'Sold to' })}
            value={filters.soldTo ? dayjs(filters.soldTo) : undefined}
            onChange={(value) =>
              setFilters((current) => ({ ...current, soldTo: value ? value.endOf('day').toISOString() : undefined }))
            }
          />
          <Input.Search
            allowClear
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
            placeholder={t('pages.salesSupervision.keyword', { defaultValue: 'Order no / company' })}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        className="compact-data-table"
        rowKey="id"
        bordered
        loading={loading}
        dataSource={filteredRows}
        pagination={{ pageSize: 12 }}
        scroll={{ x: 2100 }}
        showSorterTooltip={{ target: 'sorter-icon' }}
        locale={{
          triggerAsc: t('pages.salesSupervision.sortTriggerAsc', { defaultValue: 'Click to sort ascending' }),
          triggerDesc: t('pages.salesSupervision.sortTriggerDesc', { defaultValue: 'Click to sort descending' }),
          cancelSort: t('pages.salesSupervision.sortCancel', { defaultValue: 'Click to cancel sorting' }),
        }}
        onRow={(row) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('label')) {
              return
            }
            openDetailModal(row)
          },
          className: 'cursor-pointer',
        })}
        columns={[
          {
            title: t('pages.salesSupervision.columns.orderNo', { defaultValue: 'Order No' }),
            dataIndex: 'order_no',
            width: 170,
            render: (value: string, row: SalesOrderRow) => (
              <button
                type="button"
                className="border-0 bg-transparent p-0 text-inherit"
                onClick={(event) => {
                  event.stopPropagation()
                  openDetailModal(row)
                }}
              >
                {value}
              </button>
            ),
          },
          {
            title: t('pages.salesSupervision.columns.companyName', { defaultValue: 'Company' }),
            dataIndex: 'company_name',
            render: (value: string, row: SalesOrderRow) => {
              const businessTag = resolveBusinessTag(row)
              return (
                <Space size={[8, 6]} wrap>
                  <span>{value}</span>
                  {businessTag ? <Tag color="blue">{businessTag}</Tag> : null}
                </Space>
              )
            },
          },
          {
            title: t('pages.salesSupervision.columns.leadCode', { defaultValue: 'Lead Code' }),
            width: 160,
            render: (_: unknown, row: SalesOrderRow) => {
              const leadCode = row.lead?.lead_code ?? '-'
              const isSp = leadCode.startsWith('SP-')
              return (
                <Space>
                  <span>{leadCode}</span>
                  {isSp ? <Tag color="gold">SP</Tag> : null}
                </Space>
              )
            },
          },
          {
            title: t('pages.salesSupervision.columns.bdOwner', { defaultValue: 'BD Owner' }),
            width: 200,
            render: (_: unknown, row: SalesOrderRow) => {
              const city = row.bd_user_id ? bdCityByUserId.get(row.bd_user_id) : undefined
              return (
                <Space size={[6, 4]} wrap>
                  <span>{formatDisplayName(row.bd_owner?.full_name, row.bd_owner?.email, row.bd_user_id)}</span>
                  {city ? <Tag color="blue">{city}</Tag> : null}
                </Space>
              )
            },
          },
          {
            title: t('pages.salesSupervision.columns.itemCount', { defaultValue: 'Item Count' }),
            width: 110,
            render: (_: unknown, row: SalesOrderRow) => row.items.length,
          },
          {
            title: t('pages.salesSupervision.columns.soldAt', { defaultValue: 'Sold Time' }),
            dataIndex: 'sold_at',
            width: 190,
            onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            sorter: (a: SalesOrderRow, b: SalesOrderRow) => getSoldAtTimestamp(a) - getSoldAtTimestamp(b),
            sortDirections: ['descend', 'ascend'],
            render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
          },
          {
            title: t('pages.salesSupervision.paymentMethod', { defaultValue: 'Payment Method' }),
            width: 150,
            render: (_: unknown, row: SalesOrderRow) => renderPaymentMethodLabel(row.payment_method, row.payment_top_term, paymentLabels),
          },
          {
            title: t('pages.salesSupervision.paymentDueDate', { defaultValue: 'Payment Due Date' }),
            width: 200,
            onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            sorter: (a: SalesOrderRow, b: SalesOrderRow) => getPaymentSortTimestamp(a) - getPaymentSortTimestamp(b),
            sortDirections: ['descend', 'ascend'],
            render: (_: unknown, row: SalesOrderRow) => {
              const dueAt = getPaymentDueAt(row.sold_at, row.payment_method, row.payment_top_term)
              const daysLeft = getReminderDaysLeft(dueAt)

              if (!dueAt) {
                return '-'
              }

              const shouldRemind = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

              return (
                <Space wrap size={[8, 6]}>
                  <span>{dueAt.format('YYYY-MM-DD')}</span>
                  {shouldRemind ? (
                    <Tag color="volcano">
                      {t('pages.salesSupervision.collectionReminderTag', {
                        defaultValue: 'Collection Reminder D-{{days}}',
                        days: daysLeft,
                      })}
                    </Tag>
                  ) : null}
                </Space>
              )
            },
          },
          {
            title: t('pages.salesSupervision.columns.createdAt', { defaultValue: 'Created At' }),
            dataIndex: 'created_at',
            width: 190,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
          },
          {
            title: t('pages.salesSupervision.columns.paymentStatus', { defaultValue: 'Payment Status' }),
            width: 180,
            render: (_: unknown, row: SalesOrderRow) => {
              if (row.payment_confirmed_at) {
                return (
                  <Space direction="vertical" size={2}>
                    <Tag color="success">
                      {t('pages.salesSupervision.paymentStatusPaid', { defaultValue: 'Paid' })}
                    </Tag>
                    <span className="text-xs app-text-soft">
                      {dayjs(row.payment_confirmed_at).format('YYYY-MM-DD')}
                    </span>
                  </Space>
                )
              }
              return (
                <Tag>
                  {t('pages.salesSupervision.paymentStatusUnpaid', { defaultValue: 'Unpaid' })}
                </Tag>
              )
            },
          },
          {
            title: t('pages.salesSupervision.columns.actions', { defaultValue: 'Actions' }),
            width: 200,
            render: (_: unknown, row: SalesOrderRow) => {
              const isPaid = Boolean(row.payment_confirmed_at)
              return (
                <Space wrap>
                  {(isSuperAdmin || isProjectManager) ? (
                    <Popconfirm
                      title={
                        isPaid
                          ? t('pages.salesSupervision.paymentUnconfirmTitle', { defaultValue: 'Remove payment confirmation?' })
                          : t('pages.salesSupervision.paymentConfirmTitle', { defaultValue: 'Confirm payment received?' })
                      }
                      okText={t('labels.confirm', { defaultValue: 'Confirm' })}
                      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                      onConfirm={() => void handleConfirmPayment(row)}
                    >
                      <Button
                        size="small"
                        type={isPaid ? 'default' : 'primary'}
                      >
                        {isPaid
                          ? t('pages.salesSupervision.undoPayment', { defaultValue: 'Undo Payment' })
                          : t('pages.salesSupervision.confirmPayment', { defaultValue: 'Confirm Payment' })}
                      </Button>
                    </Popconfirm>
                  ) : null}
                  <Popconfirm
                    title={t('pages.salesSupervision.deleteConfirmTitle', { defaultValue: 'Delete this sales order?' })}
                    description={`${t('pages.salesSupervision.deleteConfirmDesc', {
                      defaultValue: 'The sales order will be moved to Recently Deleted.',
                    })} ${deleteRetentionHint}`}
                    okText={t('labels.delete', { defaultValue: 'Delete' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleDelete(row)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      {t('labels.delete', { defaultValue: 'Delete' })}
                    </Button>
                  </Popconfirm>
                </Space>
              )
            },
          },
        ]}
      />

      <Modal
        title={t('pages.salesSupervision.createTitle', { defaultValue: 'Create Sales Lead' })}
        open={createModalOpen}
        width={980}
        onCancel={() => {
          setCreateModalOpen(false)
        }}
        onOk={() => void createForm.submit()}
        okText={t('labels.create', { defaultValue: 'Create' })}
        confirmLoading={createSaving}
      >
        <Form<CreateSalesFormValues>
          form={createForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleCreate(values)}
          initialValues={{ sold_at: dayjs(), payment_method: 'CASH' }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Form.Item
              name="bd_user_id"
              label={t('pages.salesSupervision.bdOwner', { defaultValue: 'BD Owner' })}
              rules={[{ required: true, message: t('pages.salesSupervision.bdOwnerRequired', { defaultValue: 'BD owner is required' }) }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={bdOptions}
                placeholder={t('pages.salesSupervision.bdOwner', { defaultValue: 'BD Owner' })}
              />
            </Form.Item>
            <Form.Item
              name="company_name"
              label={t('pages.salesSupervision.columns.companyName', { defaultValue: 'Company' })}
              rules={[{ required: true, message: t('pages.salesSupervision.companyRequired', { defaultValue: 'Company name is required' }) }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="sold_at"
              label={t('pages.salesSupervision.columns.soldAt', { defaultValue: 'Sold Time' })}
              rules={[{ required: true, message: t('pages.salesSupervision.soldAtRequired', { defaultValue: 'Sold time is required' }) }]}
            >
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item
              name="payment_method"
              label={t('pages.salesSupervision.paymentMethod', { defaultValue: 'Payment Method' })}
              rules={[{ required: true, message: t('pages.salesSupervision.paymentMethodRequired', { defaultValue: 'Payment method is required' }) }]}
            >
              <Select options={paymentMethodOptions} />
            </Form.Item>
            <Form.Item noStyle dependencies={['payment_method']}>
              {({ getFieldValue }) => {
                const method = getFieldValue('payment_method') as SalesPaymentMethod
                if (method === 'TOP') {
                  return (
                    <Form.Item
                      name="payment_top_term"
                      label={t('pages.salesSupervision.paymentTopTerm', { defaultValue: 'TOP Term' })}
                      rules={[{ required: true, message: t('pages.salesSupervision.paymentTopTermRequired', { defaultValue: 'Please select TOP term' }) }]}
                    >
                      <Select options={paymentTopTermOptions} />
                    </Form.Item>
                  )
                }
                if (method === 'CONSIGNMENT') {
                  return (
                    <Form.Item label={t('pages.salesSupervision.paymentTopTerm', { defaultValue: 'TOP Term' })}>
                      <span className="app-text-soft text-sm">
                        {paymentLabels.top30Days}
                        {' '}({t('pages.salesSupervision.paymentMethodConsignmentOption', { defaultValue: 'Consignment' })})
                      </span>
                    </Form.Item>
                  )
                }
                return null
              }}
            </Form.Item>
          </div>
          <Form.Item name="note" label={t('pages.salesSupervision.note', { defaultValue: 'Remark' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium app-text-soft">
              {t('pages.salesSupervision.itemsTitle', { defaultValue: 'Sales Items' })}
            </div>
            <Button icon={<PlusOutlined />} onClick={addCreateItem}>
              {t('pages.salesSupervision.addItem', { defaultValue: 'Add Item' })}
            </Button>
          </div>

          <Table
            rowKey="key"
            pagination={false}
            dataSource={createItems}
            scroll={{ x: 900 }}
            columns={[
              {
                title: t('pages.salesSupervision.columns.category', { defaultValue: 'Category' }),
                width: 160,
                render: (_: unknown, row: DraftSalesItem) => (
                  <Select
                    value={row.category}
                    options={entryCategoryOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => {
                      const category = value as SalesProductCategory
                      updateCreateItem(row.key, { category, subcategory: getSalesProductSubcategory(category) })
                    }}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.subcategory', { defaultValue: 'Subcategory' }),
                width: 150,
                render: (_: unknown, row: DraftSalesItem) => {
                  const options = getSalesProductSubcategoryOptions(row.category, t)
                  return options.length > 0 ? (
                    <Select
                      value={row.subcategory ?? undefined}
                      options={options}
                      style={{ width: '100%' }}
                      onChange={(value) => updateCreateItem(row.key, { subcategory: value as SalesProductSubcategory })}
                    />
                  ) : '-'
                },
              },
              {
                title: t('pages.salesSupervision.columns.productName', { defaultValue: 'Product / Description' }),
                render: (_: unknown, row: DraftSalesItem) => (
                  row.category === 'TIRE' ? (
                    <AutoComplete
                      value={row.product_name}
                      options={tireModelOptions}
                      filterOption={(inputValue, option) =>
                        String(option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onChange={(value) => updateCreateItem(row.key, { product_name: value })}
                      placeholder={t('pages.salesSupervision.tireModelHint', {
                        defaultValue: 'Type tire model keywords; suggestions are optional',
                      })}
                    />
                  ) : (
                    <AutoComplete
                      value={row.product_name}
                      options={(productSuggestions.get(row.category) ?? [])
                        .filter((name) =>
                          !row.product_name || name.toLowerCase().includes(row.product_name.toLowerCase()),
                        )
                        .map((name) => ({ value: name, label: name }))}
                      onChange={(value) => updateCreateItem(row.key, { product_name: value })}
                      className="w-full"
                    />
                  )
                ),
              },
              {
                title: t('pages.salesSupervision.columns.quantity', { defaultValue: 'Qty' }),
                width: 160,
                render: (_: unknown, row: DraftSalesItem) => (
                  <InputNumber
                    min={1}
                    className="w-full"
                    value={row.quantity}
                    onChange={(value) => updateCreateItem(row.key, { quantity: Number(value ?? 1) })}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.unitPrice', { defaultValue: 'Unit Price' }),
                width: 220,
                render: (_: unknown, row: DraftSalesItem) => (
                  <InputNumber
                    min={0}
                    className="w-full"
                    value={row.unit_price}
                    onChange={(value) => updateCreateItem(row.key, { unit_price: value === null ? undefined : Number(value) })}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.actions', { defaultValue: 'Actions' }),
                width: 90,
                render: (_: unknown, row: DraftSalesItem) => (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeCreateItem(row.key)}
                  />
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center justify-between pr-10">
            <span>
              {detailRow
                ? `${t('pages.salesSupervision.detailTitle', { defaultValue: 'Sales Detail' })} · ${detailRow.order_no}`
                : t('pages.salesSupervision.detailTitle', { defaultValue: 'Sales Detail' })}
            </span>
            {detailRow ? (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailModalOpen(false)
                  setEditOpenedFromDetail(true)
                  openEditModal(detailRow)
                }}
              >
                {t('labels.edit', { defaultValue: 'Edit' })}
              </Button>
            ) : null}
          </div>
        }
        open={detailModalOpen}
        width={960}
        footer={null}
        onCancel={() => {
          setDetailModalOpen(false)
          setDetailRow(null)
        }}
      >
        {detailRow ? (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><strong>{t('pages.salesSupervision.columns.companyName', { defaultValue: 'Company' })}:</strong> {detailRow.company_name}</div>
              <div><strong>{t('pages.salesSupervision.columns.leadCode', { defaultValue: 'Lead Code' })}:</strong> {detailRow.lead?.lead_code ?? '-'}</div>
              <div><strong>{t('pages.salesSupervision.columns.bdOwner', { defaultValue: 'BD Owner' })}:</strong> {formatDisplayName(detailRow.bd_owner?.full_name, detailRow.bd_owner?.email, detailRow.bd_user_id)}</div>
              <div><strong>{t('pages.salesSupervision.columns.soldAt', { defaultValue: 'Sold Time' })}:</strong> {dayjs(detailRow.sold_at).format('YYYY-MM-DD')}</div>
              <div><strong>{t('pages.salesSupervision.paymentMethod', { defaultValue: 'Payment Method' })}:</strong> {renderPaymentMethodLabel(detailRow.payment_method, detailRow.payment_top_term, paymentLabels)}</div>
              <div><strong>{t('pages.salesSupervision.paymentDueDate', { defaultValue: 'Payment Due Date' })}:</strong> {detailDueAt ? detailDueAt.format('YYYY-MM-DD') : '-'}</div>
              {shouldShowDetailReminder ? (
                <div><Tag color="volcano">{t('pages.salesSupervision.collectionReminderTag', { defaultValue: 'Collection Reminder D-{{days}}', days: detailReminderDaysLeft })}</Tag></div>
              ) : null}
            </div>
            <Table
              rowKey="id"
              size="small"
              bordered
              pagination={false}
              dataSource={filters.category ? detailRow.items.filter((item) => item.category === filters.category) : detailRow.items}
              columns={[
                {
                  title: t('pages.salesSupervision.columns.category', { defaultValue: 'Category' }),
                  dataIndex: 'category',
                  width: 220,
                  render: (value: SalesProductCategory) => categoryLabelByValue.get(getSalesProductCategoryGroup(value)) ?? value,
                },
                {
                  title: t('pages.salesSupervision.columns.subcategory', { defaultValue: 'Subcategory' }),
                  dataIndex: 'subcategory',
                  width: 180,
                  render: (value: SalesProductSubcategory | null, row: SalesOrderItem) =>
                    getSalesProductSubcategoryLabel(row.category, value, t) ?? '-',
                },
                {
                  title: t('pages.salesSupervision.columns.productName', { defaultValue: 'Product / Description' }),
                  dataIndex: 'product_name',
                  render: (value: string | null) => value ?? '-',
                },
                {
                  title: t('pages.salesSupervision.columns.quantity', { defaultValue: 'Qty' }),
                  dataIndex: 'quantity',
                  width: 90,
                },
                {
                  title: t('pages.salesSupervision.columns.unitPrice', { defaultValue: 'Unit Price' }),
                  dataIndex: 'unit_price',
                  width: 130,
                  render: (value: number | null) => (value === null ? '-' : Number(value).toLocaleString()),
                },
              ]}
            />
          </>
        ) : null}
      </Modal>

      <Modal
        title={
          editingRow
            ? `${t('pages.salesSupervision.editTitle', { defaultValue: 'Edit Sales Order' })} · ${editingRow.order_no}`
            : t('pages.salesSupervision.editTitle', { defaultValue: 'Edit Sales Order' })
        }
        open={editModalOpen}
        width={980}
        onCancel={() => {
          closeEditModal()
        }}
        onOk={() => void editForm.submit()}
        okText={t('labels.save', { defaultValue: 'Save' })}
        confirmLoading={editSaving}
      >
        <Form<EditSalesFormValues>
          form={editForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleSaveEdit(values)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="company_name"
              label={t('pages.salesSupervision.columns.companyName', { defaultValue: 'Company' })}
              rules={[{ required: true, message: t('pages.salesSupervision.companyRequired', { defaultValue: 'Company name is required' }) }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="sold_at"
              label={t('pages.salesSupervision.columns.soldAt', { defaultValue: 'Sold Time' })}
              rules={[{ required: true, message: t('pages.salesSupervision.soldAtRequired', { defaultValue: 'Sold time is required' }) }]}
            >
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item
              name="payment_method"
              label={t('pages.salesSupervision.paymentMethod', { defaultValue: 'Payment Method' })}
              rules={[{ required: true, message: t('pages.salesSupervision.paymentMethodRequired', { defaultValue: 'Payment method is required' }) }]}
            >
              <Select options={paymentMethodOptions} />
            </Form.Item>
            <Form.Item noStyle dependencies={['payment_method']}>
              {({ getFieldValue }) => {
                const method = getFieldValue('payment_method') as SalesPaymentMethod
                if (method === 'TOP') {
                  return (
                    <Form.Item
                      name="payment_top_term"
                      label={t('pages.salesSupervision.paymentTopTerm', { defaultValue: 'TOP Term' })}
                      rules={[{ required: true, message: t('pages.salesSupervision.paymentTopTermRequired', { defaultValue: 'Please select TOP term' }) }]}
                    >
                      <Select options={paymentTopTermOptions} />
                    </Form.Item>
                  )
                }
                if (method === 'CONSIGNMENT') {
                  return (
                    <Form.Item label={t('pages.salesSupervision.paymentTopTerm', { defaultValue: 'TOP Term' })}>
                      <span className="app-text-soft text-sm">
                        {paymentLabels.top30Days}
                        {' '}({t('pages.salesSupervision.paymentMethodConsignmentOption', { defaultValue: 'Consignment' })})
                      </span>
                    </Form.Item>
                  )
                }
                return null
              }}
            </Form.Item>
          </div>
          <Form.Item name="note" label={t('pages.salesSupervision.note', { defaultValue: 'Remark' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium app-text-soft">
              {t('pages.salesSupervision.itemsTitle', { defaultValue: 'Sales Items' })}
            </div>
            <Button icon={<PlusOutlined />} onClick={addEditItem}>
              {t('pages.salesSupervision.addItem', { defaultValue: 'Add Item' })}
            </Button>
          </div>

          <Table
            rowKey="key"
            pagination={false}
            dataSource={editItems}
            scroll={{ x: 900 }}
            columns={[
              {
                title: t('pages.salesSupervision.columns.category', { defaultValue: 'Category' }),
                width: 160,
                render: (_: unknown, row: DraftSalesItem) => (
                  <Select
                    value={row.category}
                    options={entryCategoryOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => {
                      const category = value as SalesProductCategory
                      updateEditItem(row.key, { category, subcategory: getSalesProductSubcategory(category) })
                    }}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.subcategory', { defaultValue: 'Subcategory' }),
                width: 150,
                render: (_: unknown, row: DraftSalesItem) => {
                  const options = getSalesProductSubcategoryOptions(row.category, t)
                  return options.length > 0 ? (
                    <Select
                      value={row.subcategory ?? undefined}
                      options={options}
                      style={{ width: '100%' }}
                      onChange={(value) => updateEditItem(row.key, { subcategory: value as SalesProductSubcategory })}
                    />
                  ) : '-'
                },
              },
              {
                title: t('pages.salesSupervision.columns.productName', { defaultValue: 'Product / Description' }),
                render: (_: unknown, row: DraftSalesItem) => (
                  row.category === 'TIRE' ? (
                    <AutoComplete
                      value={row.product_name}
                      options={tireModelOptions}
                      filterOption={(inputValue, option) =>
                        String(option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onChange={(value) => updateEditItem(row.key, { product_name: value })}
                      placeholder={t('pages.salesSupervision.tireModelHint', {
                        defaultValue: 'Type tire model keywords; suggestions are optional',
                      })}
                    />
                  ) : (
                    <AutoComplete
                      value={row.product_name}
                      options={(productSuggestions.get(row.category) ?? [])
                        .filter((name) =>
                          !row.product_name || name.toLowerCase().includes(row.product_name.toLowerCase()),
                        )
                        .map((name) => ({ value: name, label: name }))}
                      onChange={(value) => updateEditItem(row.key, { product_name: value })}
                      className="w-full"
                    />
                  )
                ),
              },
              {
                title: t('pages.salesSupervision.columns.quantity', { defaultValue: 'Qty' }),
                width: 160,
                render: (_: unknown, row: DraftSalesItem) => (
                  <InputNumber
                    min={1}
                    className="w-full"
                    value={row.quantity}
                    onChange={(value) => updateEditItem(row.key, { quantity: Number(value ?? 1) })}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.unitPrice', { defaultValue: 'Unit Price' }),
                width: 220,
                render: (_: unknown, row: DraftSalesItem) => (
                  <InputNumber
                    min={0}
                    className="w-full"
                    value={row.unit_price}
                    onChange={(value) => updateEditItem(row.key, { unit_price: value === null ? undefined : Number(value) })}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.actions', { defaultValue: 'Actions' }),
                width: 90,
                render: (_: unknown, row: DraftSalesItem) => (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeEditItem(row.key)}
                  />
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  )
}
