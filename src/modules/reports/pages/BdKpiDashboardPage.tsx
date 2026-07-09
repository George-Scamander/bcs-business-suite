import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Card, DatePicker, Drawer, Grid, Input, InputNumber, Progress, Select, Space, Statistic, Tag, message } from 'antd'
import { LineChartOutlined, SettingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { AdaptiveTable as Table } from '../../../components/common/AdaptiveTable'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { PERMISSIONS } from '../../../lib/permissions'
import { BD_CITIES } from '../../../lib/constants'
import { formatDisplayName, formatEmailAccount } from '../../../lib/user-display'
import { useAuth } from '../../auth/auth-context'
import {
  getBdKpiTargetSettings,
  queryBdKpiSummary,
  saveBdKpiTargetSettings,
  type BdKpiRow,
  type BdKpiTargetSettings,
  type TeamKpiSummary,
} from '../api/kpi'

type DateRange = [Dayjs | null, Dayjs | null] | null

const { RangePicker } = DatePicker

const DEFAULT_TEAM: TeamKpiSummary = {
  bdCount: 0,
  salesAmount: 0,
  tireSalesQuantity: 0,
  accessorySalesAmount: 0,
  salesRecordCount: 0,
  bcsSignedCount: 0,
  exemptBdCount: 0,
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100)}%`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function toProgressPercent(value: number): number {
  const percent = value * 100
  if (!Number.isFinite(percent)) {
    return 0
  }
  return Math.max(0, Math.min(999.9, percent))
}

function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function completionRate(actual: number, target: number): number {
  if (target <= 0) {
    return 0
  }
  return actual / target
}

export function BdKpiDashboardPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const currentMonthRange: [Dayjs, Dayjs] = [dayjs().startOf('month'), dayjs().endOf('month')]
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<BdKpiRow[]>([])
  const [team, setTeam] = useState<TeamKpiSummary>(DEFAULT_TEAM)

  const [keywordInput, setKeywordInput] = useState('')
  const [dateRangeInput, setDateRangeInput] = useState<DateRange>(currentMonthRange)
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(currentMonthRange)
  const [cityFilter, setCityFilter] = useState<string | undefined>(undefined)
  const [teamSalesAmountTarget, setTeamSalesAmountTarget] = useState<number>(50_000_000)
  const [defaultPersonalSalesAmountTarget, setDefaultPersonalSalesAmountTarget] = useState<number>(5_000_000)
  const [targetSaving, setTargetSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const canPersistTargets = hasPermission(PERMISSIONS.SYSTEM_CONFIG)
  const insightsPath = location.pathname.startsWith('/app/admin/')
    ? '/app/admin/kpi/dashboard/insights'
    : '/app/pm/kpi/dashboard/insights'

  function toCurrentMonthRange(): [Dayjs, Dayjs] {
    return [dayjs().startOf('month'), dayjs().endOf('month')]
  }

  function applyFilters() {
    setKeyword(keywordInput.trim())
    setDateRange(dateRangeInput)
  }

  function resetAllFilters() {
    const monthRange = toCurrentMonthRange()
    setKeywordInput('')
    setKeyword('')
    setDateRangeInput(monthRange)
    setDateRange(monthRange)
    setCityFilter(undefined)
  }

  const loadTargetSettings = useCallback(async () => {
    try {
      const settings = await getBdKpiTargetSettings()
      if (settings.teamSalesAmountTarget !== undefined) {
        setTeamSalesAmountTarget(settings.teamSalesAmountTarget)
      }
      if (settings.defaultPersonalSalesAmountTarget !== undefined) {
        setDefaultPersonalSalesAmountTarget(settings.defaultPersonalSalesAmountTarget)
      }
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdKpi.loadTargetsFail', { defaultValue: 'Failed to load KPI target settings' })
      message.error(text)
    }
  }, [t])

  function formatDateRangeLabel(range: DateRange): string {
    const start = range?.[0]
    const end = range?.[1]
    if (!start || !end) {
      return t('pages.bdKpi.periodAll', { defaultValue: 'All Time' })
    }
    return `${start.format('YYYY-MM-DD')} ~ ${end.format('YYYY-MM-DD')}`
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await queryBdKpiSummary({
        keyword: keyword.trim() || undefined,
        city: cityFilter || undefined,
        dateFrom: dateRange?.[0] ? dateRange[0].startOf('day').toISOString() : undefined,
        dateTo: dateRange?.[1] ? dateRange[1].endOf('day').toISOString() : undefined,
      })
      setRows(result.rows)
      setTeam(result.team)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdKpi.loadFail', { defaultValue: 'Failed to load KPI summary' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [dateRange, keyword, cityFilter, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadTargetSettings()
  }, [loadTargetSettings])

  async function handleSaveTargets() {
    if (!canPersistTargets) {
      return
    }

    const payload: BdKpiTargetSettings = {
      teamSalesAmountTarget: safeNumber(teamSalesAmountTarget),
      defaultPersonalSalesAmountTarget: safeNumber(defaultPersonalSalesAmountTarget),
    }

    setTargetSaving(true)
    try {
      await saveBdKpiTargetSettings(payload)
      message.success(t('pages.bdKpi.saveTargetsSuccess', { defaultValue: 'KPI target settings saved' }))
      setPanelOpen(false)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdKpi.saveTargetsFail', { defaultValue: 'Failed to save KPI target settings' })
      message.error(text)
    } finally {
      setTargetSaving(false)
    }
  }

  const calculatedRows = useMemo(() => {
    const personalTarget = safeNumber(defaultPersonalSalesAmountTarget)
    return rows.map((row) => {
      const salesCompletionRate = completionRate(row.salesAmount, personalTarget)
      return {
        ...row,
        salesAmountTarget: personalTarget,
        salesCompletionRate,
      }
    })
  }, [defaultPersonalSalesAmountTarget, rows])

  const teamSalesCompletionRate = completionRate(team.salesAmount, safeNumber(teamSalesAmountTarget))

  const columns = useMemo(
    () => [
      {
        title: t('pages.bdKpi.columns.bd', { defaultValue: 'BD Staff' }),
        dataIndex: 'bdName',
        width: 240,
        render: (_value: string, row: BdKpiRow) => (
          <div>
            <div className="font-medium app-text">{formatDisplayName(row.bdName, row.bdEmail, row.bdUserId)}</div>
            <div className="text-xs app-text-soft">{formatEmailAccount(row.bdEmail)}</div>
            {row.bdCity && <Tag color="blue" className="mt-1">{row.bdCity}</Tag>}
          </div>
        ),
      },
      {
        title: t('pages.bdKpi.columns.salesAmount', { defaultValue: 'Sales Amount' }),
        dataIndex: 'salesAmount',
        width: 200,
        render: (value: number) => formatCurrency(safeNumber(value)),
      },
      {
        title: t('pages.bdKpi.columns.salesAmountTarget', { defaultValue: 'Target' }),
        dataIndex: 'salesAmountTarget',
        width: 180,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: t('pages.bdKpi.columns.salesCompletion', { defaultValue: 'Sales Completion' }),
        dataIndex: 'salesCompletionRate',
        width: 220,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" strokeColor="#16a34a" showInfo={false} />
            <span className="text-xs app-text-soft">{formatPercent(value)}</span>
          </Space>
        ),
      },
      {
        title: t('pages.bdKpi.columns.bcsSigned', { defaultValue: 'BCS Signed Count' }),
        dataIndex: 'bcsSignedCount',
        width: 150,
        render: (value: number) => formatNumber(safeNumber(value)),
      },
    ],
    [t],
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.bdKpi.title', { defaultValue: 'BD Staff KPI Dashboard' })}
        description={t('pages.bdKpi.description', {
          defaultValue:
            'Query and calculate KPI based on onboard merchants (BD owner) and actual sales records (BD owner).',
        })}
        extra={
          <>
            <Button
              icon={<LineChartOutlined />}
              onClick={() => {
                const params = new URLSearchParams()
                const trimmedKeyword = keyword.trim()
                if (trimmedKeyword) {
                  params.set('keyword', trimmedKeyword)
                }
                if (dateRange?.[0]) {
                  params.set('dateFrom', dateRange[0].startOf('day').toISOString())
                }
                if (dateRange?.[1]) {
                  params.set('dateTo', dateRange[1].endOf('day').toISOString())
                }
                const nextUrl = params.toString() ? `${insightsPath}?${params.toString()}` : insightsPath
                navigate(nextUrl)
              }}
            >
              {t('pages.bdKpi.analysis.entry', { defaultValue: 'View Analysis' })}
            </Button>
            <Button onClick={resetAllFilters}>
              {t('labels.refresh', { defaultValue: 'Refresh' })}
            </Button>
            {canPersistTargets ? (
              <Button icon={<SettingOutlined />} onClick={() => setPanelOpen(true)}>
                {t('pages.bdKpi.targetsPanel', { defaultValue: 'KPI Targets' })}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 rounded-xl border app-border app-surface p-4">
        <div className="mb-3 text-xs app-text-soft">
          {t('pages.bdKpi.periodLabel', { defaultValue: 'KPI Record Period:' })} <span className="font-medium app-text">{formatDateRangeLabel(dateRange)}</span>
        </div>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} wrap className={isMobile ? 'w-full' : undefined}>
          <RangePicker
            className={isMobile ? 'w-full' : undefined}
            value={dateRangeInput}
            onChange={(values) => setDateRangeInput(values)}
          />
          <Input
            allowClear
            className={isMobile ? 'w-full' : 'w-[220px]'}
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onPressEnter={applyFilters}
            placeholder={t('pages.bdKpi.keyword', { defaultValue: 'Search BD name or email' })}
          />
          <Select
            allowClear
            className={isMobile ? 'w-full' : 'w-[160px]'}
            placeholder={t('pages.bdKpi.allCities', { defaultValue: 'All Cities' })}
            options={BD_CITIES.map((c) => ({ value: c, label: c }))}
            value={cityFilter}
            onChange={(value: string | undefined) => setCityFilter(value ?? undefined)}
          />
          <Button type="primary" className={isMobile ? 'w-full' : undefined} onClick={applyFilters}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
          <Button className={isMobile ? 'w-full' : undefined} onClick={resetAllFilters}>
            {t('pages.bdKpi.currentMonth', { defaultValue: 'Current Month' })}
          </Button>
        </Space>
      </div>

      <Drawer
        title={t('pages.bdKpi.targetsPanel', { defaultValue: 'KPI Targets' })}
        styles={{ wrapper: { width: isMobile ? '100%' : 400 } }}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        destroyOnClose={false}
      >
        <Space direction="vertical" size={16} className="w-full">
          <div>
            <div className="mb-1 text-sm app-text-soft">
              {t('pages.bdKpi.teamSalesAmountTarget', { defaultValue: 'Team Sales Amount Target' })}
            </div>
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              value={teamSalesAmountTarget}
              onChange={(value) => setTeamSalesAmountTarget(Number(value ?? 0))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm app-text-soft">
              {t('pages.bdKpi.defaultPersonalSalesAmountTarget', { defaultValue: 'Default Personal Sales Amount Target' })}
            </div>
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              value={defaultPersonalSalesAmountTarget}
              onChange={(value) => setDefaultPersonalSalesAmountTarget(Number(value ?? 0))}
            />
          </div>
          <Button
            type="primary"
            loading={targetSaving}
            onClick={() => void handleSaveTargets()}
          >
            {t('pages.bdKpi.saveTargets', { defaultValue: 'Save Targets' })}
          </Button>
        </Space>
      </Drawer>

      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card size="small">
          <Statistic title={t('pages.bdKpi.team.bdCount', { defaultValue: 'BD Staff Count' })} value={team.bdCount} />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.team.salesAmount', { defaultValue: 'Team Total Sales Amount' })}
            value={team.salesAmount}
            formatter={(value) => formatCurrency(Number(value ?? 0))}
          />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.team.salesAmountTarget', { defaultValue: 'Team Sales Target' })}
            value={teamSalesAmountTarget}
            formatter={(value) => formatCurrency(Number(value ?? 0))}
          />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.team.salesAmountCompletion', { defaultValue: 'Team Sales Completion' })}
            valueRender={() => <span>{formatPercent(teamSalesCompletionRate)}</span>}
          />
        </Card>
        <Card size="small">
          <Statistic title={t('pages.bdKpi.team.bcsSigned', { defaultValue: 'Team BCS Signed Count' })} value={team.bcsSignedCount} />
        </Card>
        <Card size="small">
          <Statistic title={t('pages.bdKpi.team.salesRecordCount', { defaultValue: 'Team Sales Record Count' })} value={team.salesRecordCount} />
        </Card>
      </div>

      <div className="kpi-table-scroll-wrap">
        <Table
          rowKey="bdUserId"
          bordered
          loading={loading}
          dataSource={calculatedRows}
          pagination={{ pageSize: 12 }}
          columns={columns}
          scroll={{ x: 1000 }}
        />
      </div>
    </>
  )
}
