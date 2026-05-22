import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Card, DatePicker, Drawer, Input, InputNumber, Progress, Space, Statistic, Tooltip, message } from 'antd'
import { InfoCircleOutlined, LineChartOutlined, SettingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { AdaptiveTable as Table } from '../../../components/common/AdaptiveTable'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { PERMISSIONS } from '../../../lib/permissions'
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

interface PersonalTargetSetting {
  tireTarget: number
  accessoryTarget: number
  bcsTarget: number
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
  const currentMonthRange: [Dayjs, Dayjs] = [dayjs().startOf('month'), dayjs().endOf('month')]
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<BdKpiRow[]>([])
  const [team, setTeam] = useState<TeamKpiSummary>(DEFAULT_TEAM)

  const [keywordInput, setKeywordInput] = useState('')
  const [dateRangeInput, setDateRangeInput] = useState<DateRange>(currentMonthRange)
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(currentMonthRange)
  const [teamTireTarget, setTeamTireTarget] = useState<number>(100)
  const [teamAccessoryTarget, setTeamAccessoryTarget] = useState<number>(100000)
  const [teamBcsTarget, setTeamBcsTarget] = useState<number>(50)
  const [defaultPersonalTireTarget, setDefaultPersonalTireTarget] = useState<number>(10)
  const [defaultPersonalAccessoryTarget, setDefaultPersonalAccessoryTarget] = useState<number>(10000)
  const [defaultPersonalBcsTarget, setDefaultPersonalBcsTarget] = useState<number>(5)
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

  function applyCurrentMonthFilters() {
    const monthRange = toCurrentMonthRange()
    setDateRangeInput(monthRange)
    setDateRange(monthRange)
  }

  const loadTargetSettings = useCallback(async () => {
    try {
      const settings = await getBdKpiTargetSettings()
      if (settings.teamTireTarget !== undefined) {
        setTeamTireTarget(settings.teamTireTarget)
      }
      if (settings.teamAccessoryTarget !== undefined) {
        setTeamAccessoryTarget(settings.teamAccessoryTarget)
      }
      if (settings.teamBcsTarget !== undefined) {
        setTeamBcsTarget(settings.teamBcsTarget)
      }
      if (settings.defaultPersonalTireTarget !== undefined) {
        setDefaultPersonalTireTarget(settings.defaultPersonalTireTarget)
      }
      if (settings.defaultPersonalAccessoryTarget !== undefined) {
        setDefaultPersonalAccessoryTarget(settings.defaultPersonalAccessoryTarget)
      }
      if (settings.defaultPersonalBcsTarget !== undefined) {
        setDefaultPersonalBcsTarget(settings.defaultPersonalBcsTarget)
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
  }, [dateRange, keyword, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadTargetSettings()
  }, [loadTargetSettings])

  async function handleApplyControlPanel() {
    applyFilters()
    setPanelOpen(false)

    if (!canPersistTargets) {
      return
    }

    const payload: BdKpiTargetSettings = {
      teamTireTarget: safeNumber(teamTireTarget),
      teamAccessoryTarget: safeNumber(teamAccessoryTarget),
      teamBcsTarget: safeNumber(teamBcsTarget),
      defaultPersonalTireTarget: safeNumber(defaultPersonalTireTarget),
      defaultPersonalAccessoryTarget: safeNumber(defaultPersonalAccessoryTarget),
      defaultPersonalBcsTarget: safeNumber(defaultPersonalBcsTarget),
    }

    setTargetSaving(true)
    try {
      await saveBdKpiTargetSettings(payload)
      message.success(t('pages.bdKpi.saveTargetsSuccess', { defaultValue: 'KPI target settings saved' }))
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
    const unifiedTargets: PersonalTargetSetting = {
      tireTarget: safeNumber(defaultPersonalTireTarget),
      accessoryTarget: safeNumber(defaultPersonalAccessoryTarget),
      bcsTarget: safeNumber(defaultPersonalBcsTarget),
    }

    return rows.map((row) => {
      const tireCompletionRate = completionRate(row.tireSalesQuantity, unifiedTargets.tireTarget)
      const accessoryCompletionRate = completionRate(row.accessorySalesAmount, unifiedTargets.accessoryTarget)
      const bcsCompletionRate = row.isBcsTargetExempt ? 1 : completionRate(row.bcsSignedCount, unifiedTargets.bcsTarget)
      return {
        ...row,
        tireTarget: unifiedTargets.tireTarget,
        accessoryTarget: unifiedTargets.accessoryTarget,
        bcsTarget: unifiedTargets.bcsTarget,
        tireCompletionRate,
        accessoryCompletionRate,
        bcsCompletionRate,
        overallCompletionRate: (tireCompletionRate + accessoryCompletionRate + bcsCompletionRate) / 3,
      }
    })
  }, [defaultPersonalAccessoryTarget, defaultPersonalBcsTarget, defaultPersonalTireTarget, rows])

  const teamTireCompletionRate = completionRate(team.tireSalesQuantity, safeNumber(teamTireTarget))
  const teamAccessoryCompletionRate = completionRate(team.accessorySalesAmount, safeNumber(teamAccessoryTarget))
  const teamBcsCompletionRate = completionRate(team.bcsSignedCount, safeNumber(teamBcsTarget))
  const teamOverallCompletionRate = (teamTireCompletionRate + teamAccessoryCompletionRate + teamBcsCompletionRate) / 3

  const totalPersonalTireTarget = calculatedRows.reduce((sum, row) => sum + row.tireTarget, 0)
  const totalPersonalAccessoryTarget = calculatedRows.reduce((sum, row) => sum + row.accessoryTarget, 0)
  const totalPersonalBcsTarget = calculatedRows.reduce((sum, row) => sum + row.bcsTarget, 0)

  const columns = useMemo(
    () => [
      {
        title: t('pages.bdKpi.columns.bd', { defaultValue: 'BD Staff' }),
        dataIndex: 'bdName',
        width: 240,
        render: (_value: string, row: BdKpiRow) => (
          <div>
            <div className="font-medium text-slate-900">{formatDisplayName(row.bdName, row.bdEmail, row.bdUserId)}</div>
            <div className="text-xs text-slate-500">{formatEmailAccount(row.bdEmail)}</div>
          </div>
        ),
      },
      {
        title: t('pages.bdKpi.columns.tireSalesQuantity', { defaultValue: 'Tire Sales Quantity' }),
        dataIndex: 'tireSalesQuantity',
        width: 180,
        render: (value: number) => formatNumber(safeNumber(value)),
      },
      {
        title: t('pages.bdKpi.columns.tireTarget', { defaultValue: 'Personal Tire Target' }),
        dataIndex: 'tireTarget',
        width: 180,
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('pages.bdKpi.columns.tireCompletion', { defaultValue: 'Tire Completion' }),
        dataIndex: 'tireCompletionRate',
        width: 200,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" showInfo={false} />
            <span className="text-xs text-slate-500">{formatPercent(value)}</span>
          </Space>
        ),
      },
      {
        title: t('pages.bdKpi.columns.accessorySalesAmount', { defaultValue: 'Accessory Sales Amount' }),
        dataIndex: 'accessorySalesAmount',
        width: 180,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: t('pages.bdKpi.columns.accessoryTarget', { defaultValue: 'Personal Accessory Target' }),
        dataIndex: 'accessoryTarget',
        width: 200,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: t('pages.bdKpi.columns.accessoryCompletion', { defaultValue: 'Accessory Completion' }),
        dataIndex: 'accessoryCompletionRate',
        width: 210,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" showInfo={false} />
            <span className="text-xs text-slate-500">{formatPercent(value)}</span>
          </Space>
        ),
      },
      {
        title: t('pages.bdKpi.columns.bcsSigned', { defaultValue: 'BCS Signed Count' }),
        dataIndex: 'bcsSignedCount',
        width: 150,
        render: (value: number) => formatNumber(safeNumber(value)),
      },
      {
        title: t('pages.bdKpi.columns.bcsTarget', { defaultValue: 'BCS KPI Target' }),
        dataIndex: 'bcsTarget',
        width: 170,
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('pages.bdKpi.columns.bcsCompletion', { defaultValue: 'BCS Completion' }),
        dataIndex: 'bcsCompletionRate',
        width: 200,
        render: (value: number, row: BdKpiRow & { isBcsTargetExempt: boolean }) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" showInfo={false} />
            <span className="text-xs text-slate-500">
              {row.isBcsTargetExempt
                ? t('pages.bdKpi.bcsExempted', { defaultValue: 'Exempted this month (sales > IDR 5,000,000)' })
                : formatPercent(value)}
            </span>
          </Space>
        ),
      },
      {
        title: t('pages.bdKpi.columns.overall', { defaultValue: 'Overall Completion' }),
        dataIndex: 'overallCompletionRate',
        width: 190,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" strokeColor="#16a34a" showInfo={false} />
            <span className="text-xs text-slate-500">{formatPercent(value)}</span>
          </Space>
        ),
      },
    ],
    [t],
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.bdKpi.title', { defaultValue: 'BD Staff KPI Dashboard' })}
        description={
          <div className="space-y-1">
            <div>
              {t('pages.bdKpi.description', {
                defaultValue:
                  'Query and calculate KPI based on onboard merchants (BD owner) and actual sales records (BD owner).',
              })}
            </div>
            <div>
              {t('pages.bdKpi.periodLabel', { defaultValue: 'KPI Record Period:' })} {formatDateRangeLabel(dateRange)}
            </div>
          </div>
        }
        extra={
          <Space wrap>
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
            <Button
              onClick={() => {
                setKeywordInput('')
                setKeyword('')
                applyCurrentMonthFilters()
              }}
            >
              {t('labels.refresh', { defaultValue: 'Refresh' })}
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setPanelOpen(true)}>
              {t('pages.bdKpi.controlPanel', { defaultValue: 'Control Panel' })}
            </Button>
          </Space>
        }
      />
      <Drawer
        title={t('pages.bdKpi.controlPanel', { defaultValue: 'Control Panel' })}
        width={460}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        destroyOnClose={false}
      >
        <Space direction="vertical" size={16} className="w-full">
          <div>
            <div className="mb-1 text-sm text-slate-500">{t('pages.bdKpi.periodLabel', { defaultValue: 'KPI Record Period:' })}</div>
            <RangePicker className="w-full" value={dateRangeInput} onChange={(values) => setDateRangeInput(values)} />
          </div>
          <Input
            allowClear
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder={t('pages.bdKpi.keyword', { defaultValue: 'Search BD name or email' })}
          />
          <div>
            <div className="mb-1 text-sm text-slate-500">{t('pages.bdKpi.teamTireTarget', { defaultValue: 'Team Tire Target' })}</div>
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              value={teamTireTarget}
              onChange={(value) => setTeamTireTarget(Number(value ?? 0))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">{t('pages.bdKpi.teamAccessoryTarget', { defaultValue: 'Team Accessory Target' })}</div>
            <InputNumber
              min={0}
              precision={2}
              className="w-full"
              value={teamAccessoryTarget}
              onChange={(value) => setTeamAccessoryTarget(Number(value ?? 0))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">{t('pages.bdKpi.teamBcsTarget', { defaultValue: 'Team BCS Target' })}</div>
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              value={teamBcsTarget}
              onChange={(value) => setTeamBcsTarget(Number(value ?? 0))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">
              {t('pages.bdKpi.defaultPersonalTireTarget', { defaultValue: 'Default Tire / Person' })}
            </div>
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              value={defaultPersonalTireTarget}
              onChange={(value) => setDefaultPersonalTireTarget(Number(value ?? 0))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">
              {t('pages.bdKpi.defaultPersonalAccessoryTarget', { defaultValue: 'Default Accessory / Person' })}
            </div>
            <InputNumber
              min={0}
              precision={2}
              className="w-full"
              value={defaultPersonalAccessoryTarget}
              onChange={(value) => setDefaultPersonalAccessoryTarget(Number(value ?? 0))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">
              {t('pages.bdKpi.defaultPersonalBcsTarget', { defaultValue: 'Default BCS / Person' })}
            </div>
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              value={defaultPersonalBcsTarget}
              onChange={(value) => setDefaultPersonalBcsTarget(Number(value ?? 0))}
            />
          </div>
          <Space wrap>
            <Button
              type="primary"
              loading={targetSaving}
              onClick={() => void handleApplyControlPanel()}
            >
              {t('labels.apply', { defaultValue: 'Apply' })}
            </Button>
            <Button
              onClick={() => {
                applyCurrentMonthFilters()
                setPanelOpen(false)
              }}
            >
              {t('pages.bdKpi.currentMonth', { defaultValue: 'Current Month' })}
            </Button>
          </Space>
        </Space>
      </Drawer>

      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card size="small">
          <Statistic title={t('pages.bdKpi.team.bdCount', { defaultValue: 'BD Staff Count' })} value={team.bdCount} />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.team.tireSalesQuantity', { defaultValue: 'Team Tire Sales Quantity' })}
            value={team.tireSalesQuantity}
          />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.team.accessorySalesAmount', { defaultValue: 'Team Accessory Sales Amount' })}
            value={team.accessorySalesAmount}
            formatter={(value) => formatCurrency(Number(value ?? 0))}
          />
        </Card>
        <Card size="small">
          <Statistic title={t('pages.bdKpi.team.salesRecordCount', { defaultValue: 'Team Sales Record Count' })} value={team.salesRecordCount} />
        </Card>
        <Card size="small">
          <Statistic title={t('pages.bdKpi.team.bcsSigned', { defaultValue: 'Team BCS Signed Count' })} value={team.bcsSignedCount} />
        </Card>
        <Card size="small">
          <Statistic
            title={t('pages.bdKpi.team.overallCompletion', { defaultValue: 'Team Overall Completion' })}
            valueRender={() => <span>{formatPercent(teamOverallCompletionRate)}</span>}
          />
        </Card>
      </div>

      <Card
        title={t('pages.bdKpi.team.summaryTitle', { defaultValue: 'Team KPI Summary' })}
        size="small"
        className="mb-3"
      >
        <div className="grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-6">
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.tireTarget', { defaultValue: 'Team Tire Target' })}</div>
            <div className="font-semibold">{formatNumber(safeNumber(teamTireTarget))}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.tireCompletion', { defaultValue: 'Team Tire Completion' })}</div>
            <div className="font-semibold">{formatPercent(teamTireCompletionRate)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.accessoryTarget', { defaultValue: 'Team Accessory Target' })}</div>
            <div className="font-semibold">{formatCurrency(safeNumber(teamAccessoryTarget))}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.accessoryCompletion', { defaultValue: 'Team Accessory Completion' })}</div>
            <div className="font-semibold">{formatPercent(teamAccessoryCompletionRate)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.bcsTarget', { defaultValue: 'Team BCS Target' })}</div>
            <div className="font-semibold">{formatNumber(safeNumber(teamBcsTarget))}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.bcsCompletion', { defaultValue: 'Team BCS Completion' })}</div>
            <div className="font-semibold">{formatPercent(teamBcsCompletionRate)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.overall', { defaultValue: 'Team Overall Completion' })}</div>
            <div className="font-semibold">{formatPercent(teamOverallCompletionRate)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.bdCount', { defaultValue: 'BD Staff Count' })}</div>
            <div className="font-semibold">{formatNumber(team.bdCount)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.personalTireTargetSum', { defaultValue: 'Personal Tire Target Sum' })}</div>
            <div className="font-semibold">{formatNumber(totalPersonalTireTarget)}</div>
          </div>
          <div>
            <div className="text-slate-500">
              {t('pages.bdKpi.team.personalAccessoryTargetSum', { defaultValue: 'Personal Accessory Target Sum' })}
            </div>
            <div className="font-semibold">{formatCurrency(totalPersonalAccessoryTarget)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.personalBcsTargetSum', { defaultValue: 'Personal BCS Target Sum' })}</div>
            <div className="font-semibold">{formatNumber(totalPersonalBcsTarget)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-slate-500">
              {t('pages.bdKpi.team.exemptBdCount', { defaultValue: 'BCS Exempted BD Count' })}
              <Tooltip title={t('pages.bdKpi.exemptRuleHint', { defaultValue: 'If BD total sales amount in the selected period is above IDR 5,000,000, BCS signed target is exempted for that period.' })}>
                <InfoCircleOutlined />
              </Tooltip>
            </div>
            <div className="font-semibold">{formatNumber(team.exemptBdCount)}</div>
          </div>
        </div>
      </Card>

      <div className="kpi-table-scroll-wrap">
        <Table
          rowKey="bdUserId"
          bordered
          loading={loading}
          dataSource={calculatedRows}
          pagination={{ pageSize: 12 }}
          columns={columns}
          scroll={{ x: 2580 }}
        />
      </div>
    </>
  )
}
