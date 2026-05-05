import { useCallback, useEffect, useState } from 'react'
import { Button, Col, Row, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { MetricCard } from '../../../components/common/MetricCard'
import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { getBdDashboardMetrics } from '../../dashboard/api'
import { listLeads } from '../../leads/api'
import { useAuth } from '../../auth/auth-context'

interface FollowupRow {
  id: string
  lead_code: string
  company_name: string
  status: string
  next_followup_at: string | null
}

export function BdDashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [metrics, setMetrics] = useState({
    myLeads: 0,
    dueFollowups: 0,
    signedThisMonth: 0,
    myOnboardingCases: 0,
    activeProjectsLinked: 0,
  })
  const [rows, setRows] = useState<FollowupRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const [metricData, leads] = await Promise.all([
        getBdDashboardMetrics(user.id),
        listLeads({ assignedBdId: user.id }),
      ])

      setMetrics(metricData)

      const dueRows = leads
        .filter((item) => item.next_followup_at !== null)
        .sort((a, b) => new Date(a.next_followup_at ?? '').getTime() - new Date(b.next_followup_at ?? '').getTime())
        .slice(0, 8)

      setRows(dueRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdDashboard.loadFail', { defaultValue: 'Failed to load BD dashboard' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={t('pages.bdDashboard.title', { defaultValue: 'BD Dashboard' })}
        description={t('pages.bdDashboard.description', {
          defaultValue: 'Track lead conversion, onboarding throughput, and follow-up commitments.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('pages.bdDashboard.metrics.myLeads', { defaultValue: 'My Leads' })} value={metrics.myLeads} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('pages.bdDashboard.metrics.followupDue', { defaultValue: 'Follow-up Due' })} value={metrics.dueFollowups} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title={t('pages.bdDashboard.metrics.signedMtd', { defaultValue: 'Signed (MTD)' })} value={metrics.signedThisMonth} />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard title={t('pages.bdDashboard.metrics.myOnboardingCases', { defaultValue: 'My Onboarding Cases' })} value={metrics.myOnboardingCases} />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title={t('pages.bdDashboard.metrics.linkedActiveProjects', { defaultValue: 'Linked Active Projects' })}
            value={metrics.activeProjectsLinked}
          />
        </Col>
      </Row>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        title={() => t('pages.bdDashboard.followupsTitle', { defaultValue: 'Upcoming Follow-ups' })}
        dataSource={rows}
        pagination={false}
        onRow={(record) => ({
          onClick: () => navigate(`/app/bd/leads/${record.id}`),
        })}
        columns={[
          { title: t('pages.bdDashboard.columns.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code' },
          { title: t('pages.bdDashboard.columns.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          {
            title: t('pages.bdDashboard.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.bdDashboard.columns.nextFollowup', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
