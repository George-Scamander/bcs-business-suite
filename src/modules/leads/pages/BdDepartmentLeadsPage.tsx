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
  Descriptions,
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
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getIntentPackageOptions,
  getLeadStatusOptions,
} from '../../../lib/business-constants'
import {
  listDepartmentLeads,
  type DepartmentLeadFilters,
  type DepartmentLeadRow,
} from '../api'
import {
  StatusTag,
} from '../../../components/common/StatusTag'

export function BdDepartmentLeadsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DepartmentLeadRow[]>([])
  const [filters, setFilters] = useState<DepartmentLeadFilters>({})
  const [keyword, setKeyword] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<DepartmentLeadRow | null>(null)

  const leadStatusOptions = useMemo(() => getLeadStatusOptions(t), [t])
  const intentPackageOptions = useMemo(() => getIntentPackageOptions(t), [t])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listDepartmentLeads({
        ...filters,
        keyword: keyword.trim() || undefined,
      })
      setRows(data)
    } catch (error) {
      const text = error instanceof Error
        ? error.message
        : t('pages.bdDepartmentLeads.loadFail', { defaultValue: 'Failed to load department leads' })
      message.error({
        key: 'bd-department-leads-load',
        content: text,
      })
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, t])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  function openDetail(row: DepartmentLeadRow) {
    setDetailRow(row)
    setDetailOpen(true)
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.bdDepartmentLeads.title', { defaultValue: 'Department Leads' })}
        description={t('pages.bdDepartmentLeads.description', {
          defaultValue: 'Read-only overview of BD-created leads, imported leads, and admin-assigned leads across the department.',
        })}
        extra={
          <Space>
            <Button onClick={() => void loadRows()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('pages.bdDepartmentLeads.statusPlaceholder', { defaultValue: 'Status' })}
            style={{ width: 180 }}
            options={leadStatusOptions}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder={t('pages.bdDepartmentLeads.regionPlaceholder', { defaultValue: 'Region' })}
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Input
            placeholder={t('pages.bdDepartmentLeads.industryPlaceholder', { defaultValue: 'Industry' })}
            style={{ width: 180 }}
            value={filters.industry}
            onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value || undefined }))}
          />
          <Select
            allowClear
            placeholder={t('pages.bdDepartmentLeads.intentPackagePlaceholder', { defaultValue: 'BCS Business' })}
            style={{ width: 200 }}
            options={intentPackageOptions}
            value={filters.intentPackage}
            onChange={(value) => setFilters((current) => ({ ...current, intentPackage: value || undefined }))}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.bdDepartmentLeads.createdFrom', { defaultValue: 'Created From' })}
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
            placeholder={t('pages.bdDepartmentLeads.createdTo', { defaultValue: 'Created To' })}
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
            placeholder={t('pages.bdDepartmentLeads.keywordPlaceholder', {
              defaultValue: 'Keyword (lead code/company/contact/source)',
            })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadRows()}
          />
          <Button type="primary" onClick={() => void loadRows()}>
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
        onRow={(row) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('label')) {
              return
            }
            openDetail(row)
          },
          className: 'cursor-pointer',
        })}
        columns={[
          {
            title: t('pages.bdDepartmentLeads.columns.leadCode', { defaultValue: 'Lead Code' }),
            dataIndex: 'lead_code',
            width: 220,
            render: (value: string) => <span className="font-medium text-slate-900">{value}</span>,
          },
          { title: t('pages.bdDepartmentLeads.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          {
            title: t('pages.bdDepartmentLeads.columns.bdOwner', { defaultValue: 'BD Owner' }),
            width: 220,
            render: (_: unknown, row: DepartmentLeadRow) => row.assigned_bd_name ?? row.assigned_bd_email ?? '-',
          },
          {
            title: t('pages.bdDepartmentLeads.columns.createdBy', { defaultValue: 'Created By' }),
            width: 220,
            render: (_: unknown, row: DepartmentLeadRow) => row.created_by_name ?? row.created_by_email ?? '-',
          },
          { title: t('pages.bdDepartmentLeads.columns.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          {
            title: t('pages.bdDepartmentLeads.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 160,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.bdDepartmentLeads.columns.createdAt', { defaultValue: 'Created At' }),
            dataIndex: 'created_at',
            width: 190,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
          },
        ]}
      />

      <Modal
        title={t('pages.bdDepartmentLeads.detailTitle', { defaultValue: 'Lead Detail (Read-only)' })}
        open={detailOpen}
        footer={null}
        width={920}
        onCancel={() => {
          setDetailOpen(false)
          setDetailRow(null)
        }}
      >
        {detailRow ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.leadCode', { defaultValue: 'Lead Code' })}>{detailRow.lead_code}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.company', { defaultValue: 'Company' })}>{detailRow.company_name}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.status', { defaultValue: 'Status' })}><StatusTag value={detailRow.status} /></Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.intentPackage', { defaultValue: 'Business Segment' })}>{detailRow.intent_package ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.intentLevel', { defaultValue: 'Intent Level' })}>{detailRow.intent_level ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.source', { defaultValue: 'Source' })}>{detailRow.source ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.bdOwner', { defaultValue: 'BD Owner' })}>{detailRow.assigned_bd_name ?? detailRow.assigned_bd_email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.createdBy', { defaultValue: 'Created By' })}>{detailRow.created_by_name ?? detailRow.created_by_email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.contactPerson', { defaultValue: 'Contact Person' })}>{detailRow.contact_person ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.contactPhone', { defaultValue: 'Contact Phone' })}>{detailRow.contact_phone ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.contactEmail', { defaultValue: 'Contact Email' })}>{detailRow.contact_email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.region', { defaultValue: 'Region' })}>{detailRow.region ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.city', { defaultValue: 'City' })}>{detailRow.city ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.nextFollowup', { defaultValue: 'Next Follow-up' })}>{detailRow.next_followup_at ? dayjs(detailRow.next_followup_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.createdAt', { defaultValue: 'Created At' })}>{dayjs(detailRow.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.updatedAt', { defaultValue: 'Updated At' })}>{dayjs(detailRow.updated_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label={t('pages.bdDepartmentLeads.columns.address', { defaultValue: 'Address' })} span={2}>{detailRow.address ?? '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </>
  )
}
