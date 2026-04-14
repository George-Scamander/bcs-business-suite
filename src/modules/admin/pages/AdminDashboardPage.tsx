import { useCallback, useEffect, useState } from 'react'
import { Button, Col, Row, Table, message } from 'antd'

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
        title="Admin Overview"
        description="Global operational view across leads, onboarding, and projects."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <Row gutter={[16, 16]} className="mb-5">
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Total Leads" value={metrics.totalLeads} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Signed Leads" value={metrics.signedLeads} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Onboarding Active" value={metrics.activeOnboardingCases} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Total Projects" value={metrics.totalProjects} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Delayed Projects" value={metrics.delayedProjects} />
        </Col>
        <Col xs={24} md={12} xl={4}>
          <MetricCard title="Active Users" value={metrics.activeUsers} />
        </Col>
      </Row>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={pendingCases}
        pagination={false}
        title={() => 'Pending Onboarding Queue'}
        columns={[
          { title: 'Case No', dataIndex: 'case_no' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'SLA Due',
            dataIndex: 'sla_due_at',
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
