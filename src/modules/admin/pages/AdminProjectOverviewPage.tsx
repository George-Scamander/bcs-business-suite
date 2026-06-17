import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Col,
  DatePicker,
  Input,
  Progress,
  Row,
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
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  MetricCard,
} from '../../../components/common/MetricCard'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getProjectStatusOptions,
} from '../../../lib/business-constants'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  listProjects,
  markDelayedProjects,
  type ProjectFilters,
} from '../../projects/api'
import type {
  Project,
  ProjectStatus,
} from '../../../types/business'

const PROJECT_STATUS_VALUES: ProjectStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CLOSED']

function parseProjectFiltersFromSearch(searchParams: URLSearchParams): { filters: ProjectFilters; keyword: string } {
  const statusParam = searchParams.get('status')
  const status = statusParam && PROJECT_STATUS_VALUES.includes(statusParam as ProjectStatus) ? (statusParam as ProjectStatus) : undefined
  const createdFrom = searchParams.get('createdFrom') ?? undefined
  const createdTo = searchParams.get('createdTo') ?? undefined
  const keyword = searchParams.get('q') ?? ''

  return {
    filters: {
      ...(status ? { status } : {}),
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    },
    keyword,
  }
}

export function AdminProjectOverviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>(() => parseProjectFiltersFromSearch(searchParams).filters)
  const [keyword, setKeyword] = useState(() => parseProjectFiltersFromSearch(searchParams).keyword)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      await markDelayedProjects()
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
      })
      setRows(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load project overview'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const parsed = parseProjectFiltersFromSearch(searchParams)
    setFilters((current) => (JSON.stringify(current) === JSON.stringify(parsed.filters) ? current : parsed.filters))
    setKeyword((current) => (current === parsed.keyword ? current : parsed.keyword))
  }, [searchParams])

  const metrics = useMemo(() => {
    const total = rows.length
    const delayed = rows.filter((item) => item.status === 'DELAYED').length
    const inProgress = rows.filter((item) => item.status === 'IN_PROGRESS').length
    const completed = rows.filter((item) => item.status === 'COMPLETED' || item.status === 'CLOSED').length
    const avgCompletion =
      rows.length === 0 ? 0 : Number((rows.reduce((sum, item) => sum + Number(item.completion_rate ?? 0), 0) / rows.length).toFixed(1))

    return {
      total,
      delayed,
      inProgress,
      completed,
      avgCompletion,
    }
  }, [rows])

  return (
    <>
      <PageTitleBar
        title={t('pages.adminProjectOverview.title', { defaultValue: 'Project Overview' })}
        description={t('pages.adminProjectOverview.description', {
          defaultValue: 'Global execution visibility across all active and closed implementation projects.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('pages.adminProjectOverview.metrics.totalProjects', { defaultValue: 'Total Projects' })} value={metrics.total} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('status.IN_PROGRESS', { defaultValue: 'In Progress' })} value={metrics.inProgress} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('status.DELAYED', { defaultValue: 'Delayed' })} value={metrics.delayed} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('pages.adminProjectOverview.metrics.completedClosed', { defaultValue: 'Completed/Closed' })} value={metrics.completed} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('pages.adminProjectOverview.metrics.avgCompletion', { defaultValue: 'Avg Completion' })} value={metrics.avgCompletion} suffix="%" />
        </Col>
      </Row>

      <div className="mb-4 rounded-xl border app-border app-surface p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('pages.adminProjectOverview.statusPlaceholder', { defaultValue: 'Status' })}
            style={{ width: 220 }}
            options={getProjectStatusOptions(t)}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminProjectOverview.createdFrom', { defaultValue: 'Created From' })}
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
            placeholder={t('pages.adminProjectOverview.createdTo', { defaultValue: 'Created To' })}
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
            placeholder={t('pages.adminProjectOverview.keywordPlaceholder', { defaultValue: 'Project keyword' })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
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
        columns={[
          { title: t('pages.adminProjectOverview.columns.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code', width: 170 },
          { title: t('pages.adminProjectOverview.columns.projectName', { defaultValue: 'Name' }), dataIndex: 'name' },
          {
            title: t('pages.adminProjectOverview.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.adminProjectOverview.columns.completion', { defaultValue: 'Completion' }),
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: t('pages.adminProjectOverview.columns.targetEnd', { defaultValue: 'Target End' }),
            dataIndex: 'target_end_date',
            width: 130,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('pages.adminProjectOverview.columns.actions', { defaultValue: 'Actions' }),
            width: 120,
            render: (_: unknown, row: Project) => (
              <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}`)}>
                {t('pages.adminProjectOverview.open', { defaultValue: 'Open' })}
              </Button>
            ),
          },
        ]}
      />
    </>
  )
}
