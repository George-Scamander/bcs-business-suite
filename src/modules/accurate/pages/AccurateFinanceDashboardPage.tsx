import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Grid,
  Input,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import {
  listAccurateSalesInvoices,
  listAccuratePurchaseInvoices,
  listAccurateInventory,
  listAccurateInventoryCategories,
  getAccurateInventoryItemDetail,
  listAccurateBackorders,
  listAccurateCashFlow,
  getLatestSyncLog,
  type AccurateSalesInvoice,
  type AccuratePurchaseInvoice,
  type AccurateInventoryItem,
  type AccurateBackorder,
  type AccurateCashFlow,
  type AccurateFilters,
} from '../api'

const { Text } = Typography
const { RangePicker } = DatePicker
const { Item: DescItem } = Descriptions

// ── 格式化工具 ─────────────────────────────────────────────────────────────

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function fmtIDR(val: number | null | undefined): string {
  if (val == null) return '—'
  return IDR.format(val)
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  return dayjs(val).format('DD MMM YYYY')
}

function statusTag(status: string | null | undefined): React.ReactNode {
  if (!status) return <Text type="secondary">—</Text>
  const map: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    PAID: 'success',
    OPEN: 'warning',
    OVERDUE: 'error',
    PARTIAL: 'warning',
    CLOSED: 'default',
    OPEN_PARTIAL: 'warning',
    OUTSTANDING: 'warning',
    QUEUE: 'default',
    PROCEED: 'default',
  }
  const color = map[status.toUpperCase()] ?? 'default'
  return <Tag color={color}>{status}</Tag>
}

// ── 詳情 Drawer：銷售發票 ───────────────────────────────────────────────────

function SalesInvoiceDrawer({ item, open, onClose }: {
  item: AccurateSalesInvoice | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Drawer
      title={item?.invoice_no ?? '—'}
      open={open}
      onClose={onClose}
      size="large"
      destroyOnClose
    >
      {item && (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <DescItem label={t('accurate.cols.customer')} span={2}>{item.customer_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.branch')}>{item.branch_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.status')}>{statusTag(item.status)}</DescItem>
          <DescItem label={t('accurate.cols.date')}>{fmtDate(item.transaction_date)}</DescItem>
          <DescItem label={t('accurate.cols.dueDate')}>{fmtDate(item.due_date)}</DescItem>
          <DescItem label={t('accurate.cols.total')}><Text strong>{fmtIDR(item.total_amount)}</Text></DescItem>
          <DescItem label={t('accurate.cols.paid')}><Text type="success">{fmtIDR(item.paid_amount)}</Text></DescItem>
          <DescItem label={t('accurate.cols.outstanding')} span={2}>
            <Text type={item.outstanding_amount && item.outstanding_amount > 0 ? 'danger' : 'success'}>
              {fmtIDR(item.outstanding_amount)}
            </Text>
          </DescItem>
          {item.note && (
            <DescItem label={t('accurate.cols.description')} span={2}>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{item.note}</Text>
            </DescItem>
          )}
        </Descriptions>
      )}
    </Drawer>
  )
}

// ── 詳情 Drawer：採購發票 ───────────────────────────────────────────────────

function PurchaseInvoiceDrawer({ item, open, onClose }: {
  item: AccuratePurchaseInvoice | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Drawer
      title={item?.invoice_no ?? '—'}
      open={open}
      onClose={onClose}
      size="large"
      destroyOnClose
    >
      {item && (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <DescItem label={t('accurate.cols.vendor')} span={2}>{item.vendor_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.branch')}>{item.branch_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.status')}>{statusTag(item.status)}</DescItem>
          <DescItem label={t('accurate.cols.date')}>{fmtDate(item.transaction_date)}</DescItem>
          <DescItem label={t('accurate.cols.dueDate')}>{fmtDate(item.due_date)}</DescItem>
          <DescItem label={t('accurate.cols.total')}><Text strong>{fmtIDR(item.total_amount)}</Text></DescItem>
          <DescItem label={t('accurate.cols.paid')}>{fmtIDR(item.paid_amount)}</DescItem>
          <DescItem label={t('accurate.cols.outstanding')} span={2}>
            <Text type={item.outstanding_amount && item.outstanding_amount > 0 ? 'danger' : undefined}>
              {fmtIDR(item.outstanding_amount)}
            </Text>
          </DescItem>
        </Descriptions>
      )}
    </Drawer>
  )
}

// ── 詳情 Drawer：庫存品項（含倉庫分布） ────────────────────────────────────

interface WarehouseStock {
  id: number
  warehouseName: string
  balance: number
  balanceUnit: string
  defaultWarehouse: boolean
}

function InventoryDrawer({ item, open, onClose }: {
  item: AccurateInventoryItem | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<AccurateInventoryItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!open || !item?.id) { setDetail(null); return }
    setDetailLoading(true)
    getAccurateInventoryItemDetail(item.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [open, item?.id])

  const warehouses: WarehouseStock[] = ((detail?.raw_data?.warehouseBreakdown ?? []) as WarehouseStock[])

  const whColumns: ColumnsType<WarehouseStock> = [
    {
      title: t('accurate.cols.warehouse'),
      dataIndex: 'warehouseName',
      ellipsis: true,
      render: (v: string, r) => (
        <Space>
          {v}
          {r.defaultWarehouse && <Tag color="blue" style={{ fontSize: 11 }}>Default</Tag>}
        </Space>
      ),
    },
    {
      title: t('accurate.cols.stock'),
      dataIndex: 'balance',
      width: 90,
      align: 'right',
      render: (v: number) => (
        <Text type={v > 0 ? undefined : 'secondary'}>{v}</Text>
      ),
    },
    { title: t('accurate.cols.unit'), dataIndex: 'balanceUnit', width: 90 },
  ]

  return (
    <Drawer
      title={
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 13, fontWeight: 600 }}>{item?.item_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>SKU: {item?.item_code ?? '—'}</Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      size="large"
      destroyOnClose
    >
      {item && (
        <Spin spinning={detailLoading}>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <DescItem label={t('accurate.cols.category')}>{item.category ?? '—'}</DescItem>
            <DescItem label={t('accurate.cols.unit')}>{item.unit ?? '—'}</DescItem>
            <DescItem label={t('accurate.cols.stock')}>
              <Text type={(item.stock_quantity ?? 0) <= (item.min_stock ?? 0) && (item.min_stock ?? 0) > 0 ? 'warning' : undefined} strong>
                {item.stock_quantity ?? 0}
              </Text>
            </DescItem>
            <DescItem label={t('accurate.cols.minStock')}>{item.min_stock ?? '—'}</DescItem>
            <DescItem label={t('accurate.cols.buyPrice')}>{fmtIDR(item.buy_price)}</DescItem>
            <DescItem label={t('accurate.cols.sellPrice')}>{fmtIDR(item.sell_price)}</DescItem>
          </Descriptions>

          <Divider style={{ marginTop: 20, fontSize: 13 }}>
            {t('accurate.warehouseDistribution')}
          </Divider>

          <Table<WarehouseStock>
            size="small"
            rowKey="id"
            dataSource={warehouses}
            columns={whColumns}
            pagination={false}
            locale={{ emptyText: '無倉庫庫存資料' }}
          />
        </Spin>
      )}
    </Drawer>
  )
}

// ── 詳情 Drawer：銷售訂單（Backorder）─────────────────────────────────────

function BackorderDrawer({ item, open, onClose }: {
  item: AccurateBackorder | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Drawer
      title={item?.order_no ?? '—'}
      open={open}
      onClose={onClose}
      size="large"
      destroyOnClose
    >
      {item && (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <DescItem label={t('accurate.cols.customer')} span={2}>{item.customer_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.branch')}>{item.branch_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.status')}>{statusTag(item.status)}</DescItem>
          <DescItem label={t('accurate.cols.orderDate')}>{fmtDate(item.transaction_date)}</DescItem>
          <DescItem label={t('accurate.cols.expectedDelivery')}>{fmtDate(item.expected_delivery_date)}</DescItem>
          {item.item_code && <DescItem label={t('accurate.cols.itemCode')}>{item.item_code}</DescItem>}
          {item.item_name && (
            <DescItem label={t('accurate.cols.itemName')} span={item.item_code ? 1 : 2}>
              <Text style={{ whiteSpace: 'normal', fontSize: 12 }}>{item.item_name}</Text>
            </DescItem>
          )}
          {item.ordered_quantity != null && (
            <>
              <DescItem label={t('accurate.cols.ordered')}>{item.ordered_quantity}</DescItem>
              <DescItem label={t('accurate.cols.delivered')}>{item.delivered_quantity ?? 0}</DescItem>
              <DescItem label={t('accurate.cols.remaining')} span={2}>
                <Text type="danger" strong>{item.remaining_quantity ?? 0}</Text>
              </DescItem>
            </>
          )}
          <DescItem label={t('accurate.cols.total')} span={2}>
            <Text strong>{fmtIDR(item.total_amount)}</Text>
          </DescItem>
        </Descriptions>
      )}
    </Drawer>
  )
}

// ── 詳情 Drawer：現金流 ─────────────────────────────────────────────────────

function CashFlowDrawer({ item, open, onClose }: {
  item: AccurateCashFlow | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Drawer
      title={item?.reference_no ?? item?.description?.slice(0, 30) ?? '—'}
      open={open}
      onClose={onClose}
      size="large"
      destroyOnClose
    >
      {item && (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <DescItem label={t('accurate.cols.date')}>{fmtDate(item.transaction_date)}</DescItem>
          <DescItem label={t('accurate.cols.type')}>{item.transaction_type ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.account')} span={2}>{item.account_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.branch')} span={2}>{item.branch_name ?? '—'}</DescItem>
          <DescItem label={t('accurate.cols.debit')}><Text>{fmtIDR(item.debit_amount)}</Text></DescItem>
          <DescItem label={t('accurate.cols.credit')}><Text type="danger">{fmtIDR(item.credit_amount)}</Text></DescItem>
          {item.balance != null && (
            <DescItem label={t('accurate.cols.balance')} span={2}>
              <Text strong>{fmtIDR(item.balance)}</Text>
            </DescItem>
          )}
          {item.description && (
            <DescItem label={t('accurate.cols.description')} span={2}>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{item.description}</Text>
            </DescItem>
          )}
        </Descriptions>
      )}
    </Drawer>
  )
}

// ── 銷售發票 Tab ────────────────────────────────────────────────────────────

function SalesInvoicesTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<AccurateSalesInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<AccurateFilters>({})
  const [selected, setSelected] = useState<AccurateSalesInvoice | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listAccurateSalesInvoices(filtersRef.current)
      setData(rows)
    } finally {
      setLoading(false)
    }
  }, []) // filtersRef 不需列為依賴，避免每次輸入都觸發重新加載

  useEffect(() => { load() }, [load])

  const totalOutstanding = data.reduce((s, r) => s + (r.outstanding_amount ?? 0), 0)
  const totalAmount = data.reduce((s, r) => s + (r.total_amount ?? 0), 0)

  const columns: ColumnsType<AccurateSalesInvoice> = [
    { title: t('accurate.cols.invoiceNo'), dataIndex: 'invoice_no', width: 160, fixed: 'left' },
    { title: t('accurate.cols.customer'), dataIndex: 'customer_name', ellipsis: true },
    { title: t('accurate.cols.branch'), dataIndex: 'branch_name', width: 140 },
    { title: t('accurate.cols.date'), dataIndex: 'transaction_date', width: 120, render: fmtDate },
    { title: t('accurate.cols.dueDate'), dataIndex: 'due_date', width: 120, render: fmtDate },
    { title: t('accurate.cols.total'), dataIndex: 'total_amount', width: 160, align: 'right', render: fmtIDR },
    { title: t('accurate.cols.paid'), dataIndex: 'paid_amount', width: 160, align: 'right', render: fmtIDR },
    {
      title: t('accurate.cols.outstanding'),
      dataIndex: 'outstanding_amount',
      width: 160,
      align: 'right',
      render: (v: number | null) => (
        <Text type={v && v > 0 ? 'danger' : 'success'}>{fmtIDR(v)}</Text>
      ),
    },
    { title: t('accurate.cols.status'), dataIndex: 'status', width: 110, render: statusTag },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Card size="small" className="min-w-[200px]">
          <Statistic title={t('accurate.stats.totalInvoices')} value={data.length} />
        </Card>
        <Card size="small" className="min-w-[200px]">
          <Statistic title={t('accurate.stats.totalAmount')} value={fmtIDR(totalAmount)} styles={{ content: { fontSize: 16 } }} />
        </Card>
        <Card size="small" className="min-w-[200px]">
          <Statistic
            title={t('accurate.stats.outstanding')}
            value={fmtIDR(totalOutstanding)}
            styles={{ content: { fontSize: 16, color: totalOutstanding > 0 ? '#cf1322' : undefined } }}
          />
        </Card>
      </div>
      <FilterBar filters={filters} onChange={setFilters} onSearch={load} loading={loading} />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => t('accurate.records', { count: total }) }}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <SalesInvoiceDrawer item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── 採購發票 Tab ────────────────────────────────────────────────────────────

function PurchaseInvoicesTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<AccuratePurchaseInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<AccurateFilters>({})
  const [selected, setSelected] = useState<AccuratePurchaseInvoice | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listAccuratePurchaseInvoices(filtersRef.current)
      setData(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const columns: ColumnsType<AccuratePurchaseInvoice> = [
    { title: t('accurate.cols.invoiceNo'), dataIndex: 'invoice_no', width: 160, fixed: 'left' },
    { title: t('accurate.cols.vendor'), dataIndex: 'vendor_name', ellipsis: true },
    { title: t('accurate.cols.branch'), dataIndex: 'branch_name', width: 140 },
    { title: t('accurate.cols.date'), dataIndex: 'transaction_date', width: 120, render: fmtDate },
    { title: t('accurate.cols.dueDate'), dataIndex: 'due_date', width: 120, render: fmtDate },
    { title: t('accurate.cols.total'), dataIndex: 'total_amount', width: 160, align: 'right', render: fmtIDR },
    { title: t('accurate.cols.paid'), dataIndex: 'paid_amount', width: 160, align: 'right', render: fmtIDR },
    {
      title: t('accurate.cols.outstanding'),
      dataIndex: 'outstanding_amount',
      width: 160,
      align: 'right',
      render: (v: number | null) => (
        <Text type={v && v > 0 ? 'danger' : 'success'}>{fmtIDR(v)}</Text>
      ),
    },
    { title: t('accurate.cols.status'), dataIndex: 'status', width: 110, render: statusTag },
  ]

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={setFilters} onSearch={load} loading={loading} />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => t('accurate.records', { count: total }) }}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <PurchaseInvoiceDrawer item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── 庫存 Tab ────────────────────────────────────────────────────────────────

function InventoryTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<AccurateInventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<AccurateFilters>({})
  const [selected, setSelected] = useState<AccurateInventoryItem | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listAccurateInventory(filtersRef.current)
      setData(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    listAccurateInventoryCategories().then(setCategories).catch(() => {})
  }, [])

  const lowStock = data.filter((r) => (r.stock_quantity ?? 0) <= (r.min_stock ?? 0) && (r.min_stock ?? 0) > 0)

  const columns: ColumnsType<AccurateInventoryItem> = [
    { title: 'SKU', dataIndex: 'item_code', width: 130, fixed: 'left' },
    {
      title: t('accurate.cols.itemName'),
      dataIndex: 'item_name',
      width: 320,
      ellipsis: { showTitle: true },
      render: (v: string, r) => (
        <Space>
          <span>{v}</span>
          {(r.stock_quantity ?? 0) <= (r.min_stock ?? 0) && (r.min_stock ?? 0) > 0 && (
            <Tooltip title={t('accurate.lowStockWarning')}>
              <WarningOutlined style={{ color: '#faad14', flexShrink: 0 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: t('accurate.cols.category'), dataIndex: 'category', width: 140 },
    {
      title: t('accurate.cols.warehouse'),
      dataIndex: 'warehouse_name',
      width: 180,
      ellipsis: true,
      render: (v: string | null) => (
        <Tooltip title={t('accurate.warehouseDistribution')}>
          <Text>{v ? (v.split('--')[1] ?? v) : '—'}</Text>
        </Tooltip>
      ),
    },
    { title: t('accurate.cols.unit'), dataIndex: 'unit', width: 80 },
    {
      title: t('accurate.cols.stock'),
      dataIndex: 'stock_quantity',
      width: 100,
      align: 'right',
      render: (v: number | null, r) => (
        <Text type={(v ?? 0) <= (r.min_stock ?? 0) && (r.min_stock ?? 0) > 0 ? 'warning' : undefined}>
          {v ?? 0}
        </Text>
      ),
    },
    { title: t('accurate.cols.minStock'), dataIndex: 'min_stock', width: 100, align: 'right', render: (v: number | null) => v ?? '—' },
    { title: t('accurate.cols.buyPrice'), dataIndex: 'buy_price', width: 140, align: 'right', render: fmtIDR },
    { title: t('accurate.cols.sellPrice'), dataIndex: 'sell_price', width: 140, align: 'right', render: fmtIDR },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Card size="small" className="min-w-[160px]">
          <Statistic title={t('accurate.stats.totalItems')} value={data.length} />
        </Card>
        {lowStock.length > 0 && (
          <Card size="small" className="min-w-[160px]">
            <Statistic
              title={t('accurate.stats.lowStockAlert')}
              value={lowStock.length}
              styles={{ content: { color: '#faad14' } }}
              prefix={<WarningOutlined />}
            />
          </Card>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onSearch={load}
          loading={loading}
          hideDateRange
          skuMode
        />
        <Select
          allowClear
          placeholder={t('accurate.cols.category')}
          style={{ width: 200 }}
          value={filters.category ?? undefined}
          onChange={(v) => setFilters((f) => ({ ...f, category: v ?? undefined }))}
          options={categories.map((c) => ({ label: c, value: c }))}
          showSearch
          filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        scroll={{ x: 1450, y: 520 }}
        virtual
        pagination={false}
        footer={() => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('accurate.items', { count: data.length })}
          </Text>
        )}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <InventoryDrawer item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── Backorder Tab ───────────────────────────────────────────────────────────

function BackorderTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<AccurateBackorder[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<AccurateFilters>({})
  const [selected, setSelected] = useState<AccurateBackorder | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listAccurateBackorders(filtersRef.current)
      setData(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalRemaining = data.reduce((s, r) => s + (r.remaining_quantity ?? 0), 0)

  const columns: ColumnsType<AccurateBackorder> = [
    { title: t('accurate.cols.orderNo'), dataIndex: 'order_no', width: 160, fixed: 'left' },
    { title: t('accurate.cols.customer'), dataIndex: 'customer_name', ellipsis: true },
    { title: t('accurate.cols.branch'), dataIndex: 'branch_name', width: 130 },
    { title: t('accurate.cols.itemCode'), dataIndex: 'item_code', width: 120 },
    { title: t('accurate.cols.itemName'), dataIndex: 'item_name', ellipsis: true },
    { title: t('accurate.cols.orderDate'), dataIndex: 'transaction_date', width: 120, render: fmtDate },
    { title: t('accurate.cols.expectedDelivery'), dataIndex: 'expected_delivery_date', width: 140, render: fmtDate },
    { title: t('accurate.cols.ordered'), dataIndex: 'ordered_quantity', width: 90, align: 'right' },
    { title: t('accurate.cols.delivered'), dataIndex: 'delivered_quantity', width: 90, align: 'right' },
    {
      title: t('accurate.cols.remaining'),
      dataIndex: 'remaining_quantity',
      width: 90,
      align: 'right',
      render: (v: number | null) => <Text type="danger">{v ?? 0}</Text>,
    },
    { title: t('accurate.cols.unit'), dataIndex: 'unit', width: 70 },
    { title: t('accurate.cols.unitPrice'), dataIndex: 'unit_price', width: 140, align: 'right', render: fmtIDR },
    { title: t('accurate.cols.status'), dataIndex: 'status', width: 100, render: statusTag },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Card size="small" className="min-w-[160px]">
          <Statistic title={t('accurate.stats.backorderLines')} value={data.length} />
        </Card>
        <Card size="small" className="min-w-[200px]">
          <Statistic title={t('accurate.stats.totalRemainingQty')} value={totalRemaining} styles={{ content: { color: '#cf1322' } }} />
        </Card>
      </div>
      <FilterBar filters={filters} onChange={setFilters} onSearch={load} loading={loading} />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => t('accurate.records', { count: total }) }}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <BackorderDrawer item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── 現金流 Tab ──────────────────────────────────────────────────────────────

function CashFlowTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<AccurateCashFlow[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<AccurateFilters>({})
  const [selected, setSelected] = useState<AccurateCashFlow | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listAccurateCashFlow(filtersRef.current)
      setData(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalDebit = data.reduce((s, r) => s + (r.debit_amount ?? 0), 0)
  const totalCredit = data.reduce((s, r) => s + (r.credit_amount ?? 0), 0)

  const columns: ColumnsType<AccurateCashFlow> = [
    { title: t('accurate.cols.date'), dataIndex: 'transaction_date', width: 110, render: fmtDate },
    { title: t('accurate.cols.refNo'), dataIndex: 'reference_no', width: 140 },
    { title: t('accurate.cols.description'), dataIndex: 'description', ellipsis: true },
    { title: t('accurate.cols.account'), dataIndex: 'account_name', width: 180, ellipsis: true },
    { title: t('accurate.cols.branch'), dataIndex: 'branch_name', width: 130 },
    { title: t('accurate.cols.type'), dataIndex: 'transaction_type', width: 100 },
    {
      title: t('accurate.cols.debit'),
      dataIndex: 'debit_amount',
      width: 150,
      align: 'right',
      render: (v: number) => v > 0 ? <Text>{fmtIDR(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: t('accurate.cols.credit'),
      dataIndex: 'credit_amount',
      width: 150,
      align: 'right',
      render: (v: number) => v > 0 ? <Text type="danger">{fmtIDR(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: t('accurate.cols.balance'),
      dataIndex: 'balance',
      width: 160,
      align: 'right',
      render: (v: number | null) => <Text strong>{fmtIDR(v)}</Text>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Card size="small" className="min-w-[200px]">
          <Statistic title={t('accurate.stats.totalDebit')} value={fmtIDR(totalDebit)} styles={{ content: { fontSize: 16 } }} />
        </Card>
        <Card size="small" className="min-w-[200px]">
          <Statistic title={t('accurate.stats.totalCredit')} value={fmtIDR(totalCredit)} styles={{ content: { fontSize: 16, color: '#cf1322' } }} />
        </Card>
        <Card size="small" className="min-w-[200px]">
          <Statistic
            title={t('accurate.stats.netFlow')}
            value={fmtIDR(totalDebit - totalCredit)}
            styles={{ content: { fontSize: 16, color: totalDebit >= totalCredit ? '#3f8600' : '#cf1322' } }}
          />
        </Card>
      </div>
      <FilterBar filters={filters} onChange={setFilters} onSearch={load} loading={loading} />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => t('accurate.records', { count: total }) }}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <CashFlowDrawer item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── 通用篩選欄 ──────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters: AccurateFilters
  onChange: (f: AccurateFilters) => void
  onSearch: () => void
  loading: boolean
  hideDateRange?: boolean
  skuMode?: boolean
}

function FilterBar({ filters, onChange, onSearch, loading, hideDateRange, skuMode }: FilterBarProps) {
  const { t } = useTranslation()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  return (
    <div className={isMobile ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2 items-center'}>
      <Input
        placeholder={skuMode ? t('accurate.skuSearchPlaceholder') : t('accurate.searchPlaceholder')}
        prefix={<SearchOutlined />}
        value={filters.keyword ?? ''}
        onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
        onPressEnter={onSearch}
        allowClear
        style={{ width: isMobile ? '100%' : (skuMode ? 280 : 220) }}
      />
      {!hideDateRange && (
        <RangePicker
          value={[
            filters.dateFrom ? dayjs(filters.dateFrom) : null,
            filters.dateTo ? dayjs(filters.dateTo) : null,
          ]}
          onChange={(dates) => onChange({
            ...filters,
            dateFrom: dates?.[0]?.format('YYYY-MM-DD'),
            dateTo: dates?.[1]?.format('YYYY-MM-DD'),
          })}
          style={{ width: isMobile ? '100%' : 260 }}
        />
      )}
      <div className={isMobile ? 'flex gap-2' : 'contents'}>
        <Button icon={<SearchOutlined />} onClick={onSearch} loading={loading} type="primary" className={isMobile ? 'flex-1' : ''}>
          {t('accurate.searchBtn')}
        </Button>
        <Button
          onClick={() => { onChange({}); setTimeout(onSearch, 0) }}
          disabled={loading}
          className={isMobile ? 'flex-1' : ''}
        >
          {t('accurate.reset')}
        </Button>
      </div>
    </div>
  )
}

// ── 主頁面 ──────────────────────────────────────────────────────────────────

export function AccurateFinanceDashboardPage() {
  const { t } = useTranslation()
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)

  useEffect(() => {
    getLatestSyncLog().then((log) => {
      if (log?.finished_at) {
        setLastSync(dayjs(log.finished_at).format('DD MMM YYYY HH:mm'))
      }
    }).catch(() => {})
  }, [])

  const handleManualSync = useCallback(async () => {
    setSyncLoading(true)
    try {
      const { supabase: sb } = await import('../../../lib/supabase/client')
      await sb.functions.invoke('accurate-sync')
      const log = await getLatestSyncLog()
      if (log?.finished_at) {
        setLastSync(dayjs(log.finished_at).format('DD MMM YYYY HH:mm'))
      }
    } catch {
      // Edge Function 尚未部署時靜默失敗
    } finally {
      setSyncLoading(false)
    }
  }, [])

  const tabItems = [
    {
      key: 'sales-invoices',
      label: t('accurate.tabs.salesInvoices'),
      children: <SalesInvoicesTab />,
    },
    {
      key: 'purchase-invoices',
      label: t('accurate.tabs.purchaseInvoices'),
      children: <PurchaseInvoicesTab />,
    },
    {
      key: 'inventory',
      label: t('accurate.tabs.inventory'),
      children: <InventoryTab />,
    },
    {
      key: 'backorders',
      label: (
        <Badge dot offset={[4, 0]}>
          {t('accurate.tabs.backorders')}
        </Badge>
      ),
      children: <BackorderTab />,
    },
    {
      key: 'cash-flow',
      label: t('accurate.tabs.cashFlow'),
      children: <CashFlowTab />,
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageTitleBar
          title={t('accurate.title')}
          description={t('accurate.subtitle')}
        />
        <Space>
          {lastSync && (
            <Text type="secondary" className="text-sm">
              {t('accurate.lastSync', { time: lastSync })}
            </Text>
          )}
          <Tooltip title={t('accurate.syncTooltip')}>
            <Button
              icon={syncLoading ? <SyncOutlined spin /> : <ReloadOutlined />}
              onClick={handleManualSync}
              loading={syncLoading}
            >
              {t('accurate.syncNow')}
            </Button>
          </Tooltip>
        </Space>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="sales-invoices"
          items={tabItems}
          size="large"
          destroyOnHidden={true}
        />
      </Card>
    </div>
  )
}
