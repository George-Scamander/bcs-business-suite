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
} from '../../../lib/business-constants'
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
  listSalesOrders,
  softDeleteSalesOrder,
  updateSalesOrder,
  type SalesOrderRow,
} from '../api'
import type {
  SalesOrderItem,
  SalesProductCategory,
} from '../../../types/business'

interface SupervisionFilters {
  keyword?: string
  bdUserId?: string
  soldFrom?: string
  soldTo?: string
}

interface DraftSalesItem {
  key: string
  category: SalesProductCategory
  product_name: string
  quantity: number
  unit_price?: number
}

interface EditSalesFormValues {
  company_name: string
  sold_at: dayjs.Dayjs
  note?: string
}

function newDraftItem(): DraftSalesItem {
  return {
    key: generateUuid(),
    category: 'TIRE',
    product_name: '',
    quantity: 1,
  }
}

function mapItemsForDraft(items: SalesOrderItem[] | undefined): DraftSalesItem[] {
  const mapped = (items ?? []).map((item) => ({
    key: generateUuid(),
    category: item.category,
    product_name: item.product_name ?? '',
    quantity: Number(item.quantity ?? 1),
    unit_price: item.unit_price ?? undefined,
  }))

  return mapped.length > 0 ? mapped : [newDraftItem()]
}

export function SalesSupervisionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editForm] = Form.useForm<EditSalesFormValues>()
  const { roles } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SalesOrderRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<SupervisionFilters>({})
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SalesOrderRow | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editItems, setEditItems] = useState<DraftSalesItem[]>([newDraftItem()])

  const categoryLabelByValue = useMemo(() => {
    return new Map(getSalesProductCategoryOptions(t).map((item) => [item.value, item.label]))
  }, [t])
  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])

  const isAdmin = roles.includes('super_admin')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [orderRows, userRows] = await Promise.all([
        listSalesOrders({
          keyword: keyword.trim() || undefined,
          bdUserId: filters.bdUserId,
          soldFrom: filters.soldFrom,
          soldTo: filters.soldTo,
        }),
        listActiveUsers(),
      ])
      setRows(orderRows)
      setUsers(userRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.salesSupervision.loadFail', { defaultValue: 'Failed to load sales supervision data' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters.bdUserId, filters.soldFrom, filters.soldTo, keyword, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openEditModal(row: SalesOrderRow) {
    setEditingRow(row)
    setEditItems(mapItemsForDraft(row.items))
    editForm.setFieldsValue({
      company_name: row.company_name,
      sold_at: dayjs(row.sold_at),
      note: row.note ?? undefined,
    })
    setEditModalOpen(true)
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
        note: values.note ?? null,
        items: normalizedItems,
      })
      message.success(t('pages.salesSupervision.updateSuccess', { defaultValue: 'Sales order updated' }))
      setEditModalOpen(false)
      setEditingRow(null)
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

  const bdOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: user.full_name ? `${user.full_name} (${user.email})` : user.email,
      })),
    [users],
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.salesSupervision.title', { defaultValue: 'Sales Supervision' })}
        description={t('pages.salesSupervision.description', {
          defaultValue: 'PMO and Admin can monitor BD sales orders and auto-created SP leads in one place.',
        })}
        extra={
          <Space wrap>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Button onClick={() => navigate('/app/recently-deleted?tab=sales')}>
              {t('labels.recentlyDeleted', { defaultValue: 'Recently Deleted' })}
            </Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          {isAdmin ? (
            <Select
              allowClear
              style={{ width: 280 }}
              placeholder={t('pages.salesSupervision.bdOwner', { defaultValue: 'BD Owner' })}
              options={bdOptions}
              value={filters.bdUserId}
              onChange={(value) => setFilters((current) => ({ ...current, bdUserId: value || undefined }))}
            />
          ) : null}
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
        rowKey="id"
        bordered
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        expandable={{
          expandedRowRender: (row) => (
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={row.items}
              columns={[
                {
                  title: t('pages.salesSupervision.columns.category', { defaultValue: 'Category' }),
                  dataIndex: 'category',
                  width: 220,
                  render: (value: string) => categoryLabelByValue.get(value as SalesProductCategory) ?? value,
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
          ),
        }}
        columns={[
          {
            title: t('pages.salesSupervision.columns.orderNo', { defaultValue: 'Order No' }),
            dataIndex: 'order_no',
            width: 170,
          },
          {
            title: t('pages.salesSupervision.columns.companyName', { defaultValue: 'Company' }),
            dataIndex: 'company_name',
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
            width: 260,
            render: (_: unknown, row: SalesOrderRow) =>
              row.bd_owner?.full_name ? `${row.bd_owner.full_name} (${row.bd_owner.email})` : row.bd_owner?.email ?? row.bd_user_id,
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
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
          },
          {
            title: t('pages.salesSupervision.columns.createdAt', { defaultValue: 'Created At' }),
            dataIndex: 'created_at',
            width: 190,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
          },
          {
            title: t('pages.salesSupervision.columns.actions', { defaultValue: 'Actions' }),
            width: 220,
            render: (_: unknown, row: SalesOrderRow) => (
              <Space wrap>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(row)}>
                  {t('labels.edit', { defaultValue: 'Edit' })}
                </Button>
                <Popconfirm
                  title={t('pages.salesSupervision.deleteConfirmTitle', { defaultValue: 'Delete this sales order?' })}
                  description={t('pages.salesSupervision.deleteConfirmDesc', {
                    defaultValue: 'The sales order will be moved to Recently Deleted.',
                  })}
                  okText={t('labels.delete', { defaultValue: 'Delete' })}
                  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => void handleDelete(row)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    {t('labels.delete', { defaultValue: 'Delete' })}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={
          editingRow
            ? `${t('pages.salesSupervision.editTitle', { defaultValue: 'Edit Sales Order' })} · ${editingRow.order_no}`
            : t('pages.salesSupervision.editTitle', { defaultValue: 'Edit Sales Order' })
        }
        open={editModalOpen}
        width={980}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingRow(null)
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
              <DatePicker showTime className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="note" label={t('pages.salesSupervision.note', { defaultValue: 'Remark' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
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
                width: 220,
                render: (_: unknown, row: DraftSalesItem) => (
                  <Select
                    value={row.category}
                    options={categoryOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => updateEditItem(row.key, { category: value as SalesProductCategory })}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.productName', { defaultValue: 'Product / Description' }),
                render: (_: unknown, row: DraftSalesItem) => (
                  <Input
                    value={row.product_name}
                    onChange={(event) => updateEditItem(row.key, { product_name: event.target.value })}
                  />
                ),
              },
              {
                title: t('pages.salesSupervision.columns.quantity', { defaultValue: 'Qty' }),
                width: 120,
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
                width: 160,
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
