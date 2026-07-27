import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from 'antd'
import {
  ExportOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  BD_CITIES,
} from '../../../lib/constants'
import {
  getLeadStatusOptions,
} from '../../../lib/business-constants'
import {
  exportRowsToCsv,
} from '../../reports/api'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import {
  formatUserOptionLabel,
} from '../../../lib/user-display'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  fetchStoreAlerts,
  listStoreAlertRuleConfig,
  updateStoreAlertRuleConfig,
  type StoreAlertFilters,
  type StoreAlertRow,
  type StoreAlertRuleConfig,
} from '../api/store-alerts'
import type {
  LeadStatus,
  StoreTier,
} from '../../../types/business'

const DEFAULT_RULE_BY_TIER: Record<StoreTier, StoreAlertRuleConfig> = {
  NORMAL: { tier: 'NORMAL', no_visit_days: 7, no_deal_visit_count: 2 },
  KA: { tier: 'KA', no_visit_days: 3, no_deal_visit_count: 2 },
}

export function AdminStoreAlertPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<StoreAlertRow[]>([])
  const [summary, setSummary] = useState({ totalAlerts: 0, noVisitCount: 0, noDealCount: 0, processedTodayCount: 0 })
  const [bdUsers, setBdUsers] = useState<UserOption[]>([])
  const [ruleByTier, setRuleByTier] = useState<Record<StoreTier, StoreAlertRuleConfig>>(DEFAULT_RULE_BY_TIER)
  const [savingTier, setSavingTier] = useState<StoreTier | null>(null)
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false)

  const [filters, setFilters] = useState<StoreAlertFilters>({})
  const [keyword, setKeyword] = useState('')

  const leadStatusOptions = useMemo(
    () => getLeadStatusOptions(t).filter((item) => item.value !== 'SIGNED' && item.value !== 'REJECTED'),
    [t],
  )

  const loadRules = useCallback(async () => {
    try {
      const configs = await listStoreAlertRuleConfig()
      setRuleByTier((current) => {
        const next = { ...current }
        for (const config of configs) {
          next[config.tier] = config
        }
        return next
      })
    } catch {
      // fall back to defaults silently; thresholds still apply server-side via listing logic
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [result, userRows] = await Promise.all([
        fetchStoreAlerts({ ...filters, keyword: keyword.trim() || undefined }),
        listActiveUsers(),
      ])
      setRows(result.rows)
      setSummary(result.summary)
      setBdUsers(userRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.adminStoreAlert.loadFail', { defaultValue: 'Failed to load store alerts' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, t])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const bdOptions = useMemo(
    () => bdUsers.map((item) => ({ value: item.id, label: formatUserOptionLabel(item) })),
    [bdUsers],
  )

  function openLeadDetail(leadId: string) {
    const backPath = `${location.pathname}${location.search}`
    navigate(`/app/bd/leads/${leadId}?back=${encodeURIComponent(backPath)}`)
  }

  function handleExport() {
    if (rows.length === 0) {
      message.warning(t('pages.adminStoreAlert.noDataToExport', { defaultValue: 'No data to export' }))
      return
    }

    exportRowsToCsv(
      'store-alerts.xlsx',
      rows.map((row) => ({
        lead_code: row.leadCode,
        company_name: row.companyName,
        store_tier: row.storeTier,
        status: row.status,
        city: row.city ?? '',
        assigned_bd: row.assignedBdName ?? '',
        last_followup_at: row.lastFollowupAt ?? '',
        no_visit_days: row.noVisitDays ?? '',
        visit_count: row.visitCount,
        deal_amount: row.dealAmount,
        no_visit_alert: row.noVisitAlert ? 'YES' : 'NO',
        no_deal_alert: row.noDealAlert ? 'YES' : 'NO',
      })),
    )
  }

  async function handleSaveRule(tier: StoreTier, payload: { no_visit_days?: number; no_deal_visit_count?: number }) {
    setSavingTier(tier)
    try {
      const updated = await updateStoreAlertRuleConfig(tier, payload)
      setRuleByTier((current) => ({ ...current, [tier]: updated }))
      message.success(t('pages.adminStoreAlert.ruleSaveSuccess', { defaultValue: 'Alert rule updated' }))
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.adminStoreAlert.ruleSaveFail', { defaultValue: 'Failed to update alert rule' })
      message.error(text)
    } finally {
      setSavingTier(null)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.adminStoreAlert.title', { defaultValue: 'Store Visit Alerts' })}
        description={t('pages.adminStoreAlert.description', {
          defaultValue: 'Monitor stores with overdue visits or repeated visits without a deal.',
        })}
        extra={
          <Space wrap>
            <Button icon={<SettingOutlined />} onClick={() => setRuleEditorOpen((current) => !current)}>
              {t('pages.adminStoreAlert.ruleSettings', { defaultValue: 'Alert Rules' })}
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              {t('pages.adminStoreAlert.export', { defaultValue: 'Export' })}
            </Button>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      {ruleEditorOpen ? (
        <Card className="mb-5" title={t('pages.adminStoreAlert.ruleSettings', { defaultValue: 'Alert Rules' })}>
          <Row gutter={[16, 16]}>
            {(['NORMAL', 'KA'] as StoreTier[]).map((tier) => {
              const rule = ruleByTier[tier]
              return (
                <Col xs={24} md={12} key={tier}>
                  <Card size="small" type="inner" title={tier === 'KA'
                    ? t('pages.leadDetail.storeTierKa', { defaultValue: 'KA Store' })
                    : t('pages.leadDetail.storeTierNormal', { defaultValue: 'Normal Store' })}
                  >
                    <Space direction="vertical" size={10} className="w-full">
                      <div>
                        <div className="mb-1 text-xs app-text-soft">
                          {t('pages.adminStoreAlert.noVisitDaysLabel', { defaultValue: 'No-visit threshold (days)' })}
                        </div>
                        <InputNumber
                          className="w-full"
                          min={1}
                          value={rule.no_visit_days}
                          disabled={savingTier === tier}
                          onChange={(value) => setRuleByTier((current) => ({ ...current, [tier]: { ...current[tier], no_visit_days: Number(value ?? current[tier].no_visit_days) } }))}
                          onBlur={(event) => void handleSaveRule(tier, { no_visit_days: Number(event.target.value) || rule.no_visit_days })}
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs app-text-soft">
                          {t('pages.adminStoreAlert.noDealCountLabel', { defaultValue: 'Consecutive visits without a deal' })}
                        </div>
                        <InputNumber
                          className="w-full"
                          min={1}
                          value={rule.no_deal_visit_count}
                          disabled={savingTier === tier}
                          onChange={(value) => setRuleByTier((current) => ({ ...current, [tier]: { ...current[tier], no_deal_visit_count: Number(value ?? current[tier].no_deal_visit_count) } }))}
                          onBlur={(event) => void handleSaveRule(tier, { no_deal_visit_count: Number(event.target.value) || rule.no_deal_visit_count })}
                        />
                      </div>
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        </Card>
      ) : null}

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false}>
            <Statistic title={t('pages.adminStoreAlert.totalAlerts', { defaultValue: 'Pending Alert Stores' })} value={summary.totalAlerts} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false}>
            <Statistic title={t('pages.adminStoreAlert.noVisitCount', { defaultValue: 'Overdue No-Visit' })} value={summary.noVisitCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false}>
            <Statistic title={t('pages.adminStoreAlert.noDealCount', { defaultValue: 'No Deal After Visits' })} value={summary.noDealCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false}>
            <Statistic title={t('pages.adminStoreAlert.processedToday', { defaultValue: 'Followed Up Today' })} value={summary.processedTodayCount} />
          </Card>
        </Col>
      </Row>

      <div className="mb-4 rounded-xl border app-border app-surface p-3">
        <Space size={8} wrap>
          <Input.Search
            allowClear
            style={{ width: 260 }}
            placeholder={t('pages.adminStoreAlert.keywordPlaceholder', { defaultValue: 'Store name / Lead code' })}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder={t('pages.adminStoreAlert.statusPlaceholder', { defaultValue: 'Status' })}
            options={leadStatusOptions}
            value={filters.status}
            onChange={(value: LeadStatus | undefined) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Select
            allowClear
            showSearch
            style={{ width: 200 }}
            placeholder={t('pages.adminStoreAlert.salesPlaceholder', { defaultValue: 'Sales / BD Owner' })}
            options={bdOptions}
            value={filters.assignedBdId}
            onChange={(value) => setFilters((current) => ({ ...current, assignedBdId: value || undefined }))}
            optionFilterProp="label"
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder={t('pages.adminStoreAlert.cityPlaceholder', { defaultValue: 'City' })}
            options={BD_CITIES.map((city) => ({ value: city, label: city }))}
            value={filters.city}
            onChange={(value) => setFilters((current) => ({ ...current, city: value || undefined }))}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table<StoreAlertRow>
        loading={loading}
        rowKey="id"
        dataSource={rows}
        onRow={(row) => ({ onClick: () => openLeadDetail(row.id) })}
        columns={[
          {
            title: t('pages.adminStoreAlert.columnStore', { defaultValue: 'Store' }),
            dataIndex: 'companyName',
            render: (value: string, row) => (
              <span>
                <span className="font-medium">{value}</span>
                <span className="ml-2 app-text-soft text-xs">{row.leadCode}</span>
              </span>
            ),
          },
          {
            title: t('pages.adminStoreAlert.columnAlert', { defaultValue: 'Alert' }),
            width: 220,
            render: (_: unknown, row) => (
              <Space size={4} wrap>
                {row.noVisitAlert ? (
                  <Tag color="red">
                    {t('pages.adminStoreAlert.tagNoVisit', { defaultValue: 'No Visit' })}
                    {row.noVisitDays !== null ? ` ${row.noVisitDays}d` : ''}
                  </Tag>
                ) : null}
                {row.noDealAlert ? (
                  <Tag color="gold">
                    {t('pages.adminStoreAlert.tagNoDeal', { defaultValue: 'No Deal' })}
                  </Tag>
                ) : null}
              </Space>
            ),
          },
          {
            title: t('pages.adminStoreAlert.columnTier', { defaultValue: 'Tier' }),
            dataIndex: 'storeTier',
            width: 110,
            render: (value: StoreTier) => (
              <Tag color={value === 'KA' ? 'blue' : 'default'}>
                {value === 'KA'
                  ? t('pages.leadDetail.storeTierKa', { defaultValue: 'KA Store' })
                  : t('pages.leadDetail.storeTierNormal', { defaultValue: 'Normal Store' })}
              </Tag>
            ),
          },
          {
            title: t('pages.adminStoreAlert.columnStatus', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 130,
            render: (value: LeadStatus) => <StatusTag value={value} />,
          },
          {
            title: t('pages.adminStoreAlert.columnBd', { defaultValue: 'BD Owner' }),
            dataIndex: 'assignedBdName',
            width: 160,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('pages.adminStoreAlert.columnCity', { defaultValue: 'City' }),
            dataIndex: 'city',
            width: 120,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('pages.adminStoreAlert.columnLastFollowup', { defaultValue: 'Last Visit' }),
            dataIndex: 'lastFollowupAt',
            width: 170,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.adminStoreAlert.columnVisitCount', { defaultValue: 'Visits' }),
            dataIndex: 'visitCount',
            width: 90,
          },
        ]}
      />
    </>
  )
}
