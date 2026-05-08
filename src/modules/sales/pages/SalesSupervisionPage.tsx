import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, DatePicker, Input, Select, Space, Table, Tag, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getSalesProductCategoryOptions } from '../../../lib/business-constants'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import { listSalesOrders, type SalesOrderRow } from '../api'
import type { SalesProductCategory } from '../../../types/business'

interface SupervisionFilters {
  keyword?: string
  bdUserId?: string
  soldFrom?: string
  soldTo?: string
}

export function SalesSupervisionPage() {
  const { t } = useTranslation()
  const { roles } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SalesOrderRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<SupervisionFilters>({})

  const categoryLabelByValue = useMemo(() => {
    return new Map(getSalesProductCategoryOptions(t).map((item) => [item.value, item.label]))
  }, [t])

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
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
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
        ]}
      />
    </>
  )
}
