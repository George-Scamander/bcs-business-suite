import { useCallback, useEffect, useState } from 'react'
import { Button, Col, Row, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { MetricCard } from '../../../components/common/MetricCard'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getAdminDashboardMetrics } from '../../dashboard/api'
import { listOnboardingCases } from '../../onboarding/api'
import { StatusTag } from '../../../components/common/StatusTag'

interface PendingCaseRow {
  id: string
  case_no: string
  status: string
  sla_due_at: string | null
}

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    signedLeads: 0,
    activeOnboardingCases: 0,
    totalProjects: 0,
    delayedProjects: 0,
    activeUsers: 0,
  })
  const [pendingCases, setPendingCases] = useState<PendingCaseRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [metricData, onboardingCases] = await Promise.all([
        getAdminDashboardMetrics(),
        listOnboardingCases(),
      ])

      setMetrics(metricData)
      setPendingCases(
        onboardingCases
          .filter((item) => item.status !== 'COMPLETED' && item.status !== 'REJECTED')
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            case_no: item.case_no,
            status: item.status,
            sla_due_at: item.sla_due_at,
          })),
      )
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load admin dashboard'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={t('page.admin.overviewTitle', { defaultValue: 'Admin Overview' })}
        description={t('page.admin.overviewDesc', {
          defaultValue: 'Global operational view across leads, onboarding, and projects.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.admin.totalLeads', { defaultValue: 'Total Leads' })} value={metrics.totalLeads} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.admin.signedLeads', { defaultValue: 'Signed Leads' })} value={metrics.signedLeads} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('page.admin.onboardingActive', { defaultValue: 'Onboarding Active' })}
            value={metrics.activeOnboardingCases}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.admin.totalProjects', { defaultValue: 'Total Projects' })} value={metrics.totalProjects} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard
            title={t('page.admin.delayedProjects', { defaultValue: 'Delayed Projects' })}
            value={metrics.delayedProjects}
          />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('page.admin.activeUsers', { defaultValue: 'Active Users' })} value={metrics.activeUsers} />
        </Col>
      </Row>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={pendingCases}
        pagination={false}
        title={() => t('page.admin.pendingOnboardingQueue', { defaultValue: 'Pending Onboarding Queue' })}
        columns={[
          { title: t('page.admin.caseNo', { defaultValue: 'Case No' }), dataIndex: 'case_no' },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.admin.slaDue', { defaultValue: 'SLA Due' }),
            dataIndex: 'sla_due_at',
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
