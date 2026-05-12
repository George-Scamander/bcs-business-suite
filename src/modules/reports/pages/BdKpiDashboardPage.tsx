import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dayjs } from 'dayjs'
import { Button, Card, DatePicker, Input, InputNumber, Progress, Space, Statistic, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { AdaptiveTable as Table } from '../../../components/common/AdaptiveTable'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { queryBdKpiSummary, type BdKpiRow, type TeamKpiSummary } from '../api/kpi'

type DateRange = [Dayjs | null, Dayjs | null] | null

const { RangePicker } = DatePicker

const DEFAULT_TEAM: TeamKpiSummary = {
  bdCount: 0,
  salesAmount: 0,
  salesLeadCount: 0,
  bcsSignedCount: 0,
}

interface PersonalTargetSetting {
  salesTarget: number
  bcsTarget: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
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
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<BdKpiRow[]>([])
  const [team, setTeam] = useState<TeamKpiSummary>(DEFAULT_TEAM)

  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [teamSalesTarget, setTeamSalesTarget] = useState<number>(100000)
  const [teamBcsTarget, setTeamBcsTarget] = useState<number>(50)
  const [defaultPersonalSalesTarget, setDefaultPersonalSalesTarget] = useState<number>(10000)
  const [defaultPersonalBcsTarget, setDefaultPersonalBcsTarget] = useState<number>(5)
  const [personalTargets, setPersonalTargets] = useState<Record<string, PersonalTargetSetting>>({})

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
      setPersonalTargets((current) => {
        const next: Record<string, PersonalTargetSetting> = { ...current }
        for (const row of result.rows) {
          if (!next[row.bdUserId]) {
            next[row.bdUserId] = {
              salesTarget: safeNumber(defaultPersonalSalesTarget),
              bcsTarget: safeNumber(defaultPersonalBcsTarget),
            }
          }
        }
        return next
      })
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdKpi.loadFail', { defaultValue: 'Failed to load KPI summary' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [dateRange, defaultPersonalBcsTarget, defaultPersonalSalesTarget, keyword, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function updatePersonalTarget(bdUserId: string, field: keyof PersonalTargetSetting, value: number | null) {
    const normalized = safeNumber(Number(value ?? 0))
    setPersonalTargets((current) => ({
      ...current,
      [bdUserId]: {
        salesTarget: current[bdUserId]?.salesTarget ?? safeNumber(defaultPersonalSalesTarget),
        bcsTarget: current[bdUserId]?.bcsTarget ?? safeNumber(defaultPersonalBcsTarget),
        [field]: normalized,
      },
    }))
  }

  function applyDefaultTargetsToAll() {
    const nextTargets: Record<string, PersonalTargetSetting> = {}
    for (const row of rows) {
      nextTargets[row.bdUserId] = {
        salesTarget: safeNumber(defaultPersonalSalesTarget),
        bcsTarget: safeNumber(defaultPersonalBcsTarget),
      }
    }
    setPersonalTargets(nextTargets)
  }

  function getPersonalTargets(bdUserId: string): PersonalTargetSetting {
    return (
      personalTargets[bdUserId] ?? {
        salesTarget: safeNumber(defaultPersonalSalesTarget),
        bcsTarget: safeNumber(defaultPersonalBcsTarget),
      }
    )
  }

  const calculatedRows = useMemo(() => {
    return rows.map((row) => {
      const target = getPersonalTargets(row.bdUserId)
      const salesCompletionRate = completionRate(row.salesAmount, target.salesTarget)
      const bcsCompletionRate = completionRate(row.bcsSignedCount, target.bcsTarget)
      return {
        ...row,
        salesTarget: target.salesTarget,
        bcsTarget: target.bcsTarget,
        salesCompletionRate,
        bcsCompletionRate,
        overallCompletionRate: (salesCompletionRate + bcsCompletionRate) / 2,
      }
    })
  }, [defaultPersonalBcsTarget, defaultPersonalSalesTarget, personalTargets, rows])

  const teamSalesCompletionRate = completionRate(team.salesAmount, safeNumber(teamSalesTarget))
  const teamBcsCompletionRate = completionRate(team.bcsSignedCount, safeNumber(teamBcsTarget))
  const teamOverallCompletionRate = (teamSalesCompletionRate + teamBcsCompletionRate) / 2

  const totalPersonalSalesTarget = calculatedRows.reduce((sum, row) => sum + row.salesTarget, 0)
  const totalPersonalBcsTarget = calculatedRows.reduce((sum, row) => sum + row.bcsTarget, 0)

  const columns = useMemo(
    () => [
      {
        title: t('pages.bdKpi.columns.bd', { defaultValue: 'BD Staff' }),
        dataIndex: 'bdName',
        width: 240,
        render: (_value: string, row: BdKpiRow) => (
          <div>
            <div className="font-medium text-slate-900">{row.bdName}</div>
            <div className="text-xs text-slate-500">{row.bdEmail}</div>
          </div>
        ),
      },
      {
        title: t('pages.bdKpi.columns.salesAmount', { defaultValue: 'Product Sales Amount' }),
        dataIndex: 'salesAmount',
        width: 180,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: t('pages.bdKpi.columns.salesLeadCount', { defaultValue: 'Sales Lead Count' }),
        dataIndex: 'salesLeadCount',
        width: 150,
      },
      {
        title: t('pages.bdKpi.columns.salesTarget', { defaultValue: 'Sales KPI Target' }),
        dataIndex: 'salesTarget',
        width: 190,
        render: (_value: number, row: (BdKpiRow & { salesTarget: number })) => (
          <InputNumber
            min={0}
            precision={2}
            value={row.salesTarget}
            onChange={(value) => updatePersonalTarget(row.bdUserId, 'salesTarget', value)}
            style={{ width: '100%' }}
          />
        ),
      },
      {
        title: t('pages.bdKpi.columns.salesCompletion', { defaultValue: 'Sales Completion' }),
        dataIndex: 'salesCompletionRate',
        width: 210,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" />
            <span className="text-xs text-slate-500">{formatPercent(value)}</span>
          </Space>
        ),
      },
      {
        title: t('pages.bdKpi.columns.bcsSigned', { defaultValue: 'BCS Signed Count' }),
        dataIndex: 'bcsSignedCount',
        width: 150,
      },
      {
        title: t('pages.bdKpi.columns.bcsTarget', { defaultValue: 'BCS KPI Target' }),
        dataIndex: 'bcsTarget',
        width: 170,
        render: (_value: number, row: (BdKpiRow & { bcsTarget: number })) => (
          <InputNumber
            min={0}
            precision={0}
            value={row.bcsTarget}
            onChange={(value) => updatePersonalTarget(row.bdUserId, 'bcsTarget', value)}
            style={{ width: '100%' }}
          />
        ),
      },
      {
        title: t('pages.bdKpi.columns.bcsCompletion', { defaultValue: 'BCS Completion' }),
        dataIndex: 'bcsCompletionRate',
        width: 200,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" />
            <span className="text-xs text-slate-500">{formatPercent(value)}</span>
          </Space>
        ),
      },
      {
        title: t('pages.bdKpi.columns.overall', { defaultValue: 'Overall Completion' }),
        dataIndex: 'overallCompletionRate',
        width: 190,
        render: (value: number) => (
          <Space direction="vertical" size={2} className="w-full">
            <Progress percent={toProgressPercent(value)} size="small" strokeColor="#16a34a" />
            <span className="text-xs text-slate-500">{formatPercent(value)}</span>
          </Space>
        ),
      },
    ],
    [defaultPersonalBcsTarget, defaultPersonalSalesTarget, t],
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.bdKpi.title', { defaultValue: 'BD Staff KPI Dashboard' })}
        description={t('pages.bdKpi.description', {
          defaultValue:
            'Query and calculate KPI based on onboard merchants (BD owner) and sales lead management records (BD owner).',
        })}
        extra={
          <Space wrap>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <RangePicker value={dateRange} onChange={(values) => setDateRange(values)} />
          <Input.Search
            allowClear
            style={{ width: 260 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
            placeholder={t('pages.bdKpi.keyword', { defaultValue: 'Search BD name or email' })}
          />
          <div className="kpi-filter-number-item">
            <div className="kpi-filter-number-label">{t('pages.bdKpi.teamSalesTarget', { defaultValue: 'Team Sales Target' })}</div>
            <InputNumber
              min={0}
              precision={2}
              style={{ width: 200 }}
              value={teamSalesTarget}
              onChange={(value) => setTeamSalesTarget(Number(value ?? 0))}
            />
          </div>
          <div className="kpi-filter-number-item">
            <div className="kpi-filter-number-label">{t('pages.bdKpi.teamBcsTarget', { defaultValue: 'Team BCS Target' })}</div>
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 200 }}
              value={teamBcsTarget}
              onChange={(value) => setTeamBcsTarget(Number(value ?? 0))}
            />
          </div>
          <div className="kpi-filter-number-item">
            <div className="kpi-filter-number-label">
              {t('pages.bdKpi.defaultPersonalSalesTarget', { defaultValue: 'Default Sales / Person' })}
            </div>
            <InputNumber
              min={0}
              precision={2}
              style={{ width: 220 }}
              value={defaultPersonalSalesTarget}
              onChange={(value) => setDefaultPersonalSalesTarget(Number(value ?? 0))}
            />
          </div>
          <div className="kpi-filter-number-item">
            <div className="kpi-filter-number-label">
              {t('pages.bdKpi.defaultPersonalBcsTarget', { defaultValue: 'Default BCS / Person' })}
            </div>
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 220 }}
              value={defaultPersonalBcsTarget}
              onChange={(value) => setDefaultPersonalBcsTarget(Number(value ?? 0))}
            />
          </div>
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
          <Button onClick={applyDefaultTargetsToAll}>
            {t('pages.bdKpi.applyDefaultToAll', { defaultValue: 'Apply Default Personal Targets' })}
          </Button>
        </Space>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Statistic title={t('pages.bdKpi.team.bdCount', { defaultValue: 'BD Staff Count' })} value={team.bdCount} />
        </Card>
        <Card>
          <Statistic
            title={t('pages.bdKpi.team.salesAmount', { defaultValue: 'Team Product Sales Amount' })}
            value={team.salesAmount}
            formatter={(value) => formatCurrency(Number(value ?? 0))}
          />
        </Card>
        <Card>
          <Statistic title={t('pages.bdKpi.team.salesLeadCount', { defaultValue: 'Team Sales Lead Count' })} value={team.salesLeadCount} />
        </Card>
        <Card>
          <Statistic title={t('pages.bdKpi.team.bcsSigned', { defaultValue: 'Team BCS Signed Count' })} value={team.bcsSignedCount} />
        </Card>
        <Card>
          <Statistic
            title={t('pages.bdKpi.team.overallCompletion', { defaultValue: 'Team Overall Completion' })}
            value={toProgressPercent(teamOverallCompletionRate)}
            suffix="%"
          />
        </Card>
      </div>

      <Card
        title={t('pages.bdKpi.team.summaryTitle', { defaultValue: 'Team KPI Summary' })}
        className="mb-4"
      >
        <div className="grid gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.salesTarget', { defaultValue: 'Team Sales Target' })}</div>
            <div className="font-semibold">{formatCurrency(safeNumber(teamSalesTarget))}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.salesCompletion', { defaultValue: 'Team Sales Completion' })}</div>
            <div className="font-semibold">{formatPercent(teamSalesCompletionRate)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.bcsTarget', { defaultValue: 'Team BCS Target' })}</div>
            <div className="font-semibold">{safeNumber(teamBcsTarget)}</div>
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
            <div className="font-semibold">{team.bdCount}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.personalSalesTargetSum', { defaultValue: 'Personal Sales Target Sum' })}</div>
            <div className="font-semibold">{formatCurrency(totalPersonalSalesTarget)}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('pages.bdKpi.team.personalBcsTargetSum', { defaultValue: 'Personal BCS Target Sum' })}</div>
            <div className="font-semibold">{totalPersonalBcsTarget}</div>
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
          scroll={{ x: 1780 }}
        />
      </div>
    </>
  )
}
