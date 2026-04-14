import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Select, Space, Table, message } from 'antd'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { supabase } from '../../../lib/supabase/client'
import { exportRowsToCsv, listReportExports, requestReportExport } from '../../reports/api'
import type { ReportExport } from '../../../types/business'

type ReportModule = 'leads' | 'onboarding' | 'projects'

export function AdminReportExportPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [moduleName, setModuleName] = useState<ReportModule>('leads')
  const [rows, setRows] = useState<ReportExport[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listReportExports()
      setRows(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load report exports'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleExport() {
    setExporting(true)

    try {
      await requestReportExport(moduleName, { requested_at: new Date().toISOString() })

      if (moduleName === 'leads') {
        const result = await supabase
          .from('leads')
          .select('lead_code, company_name, region, industry, status, assigned_bd_id, created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (result.error) {
          throw result.error
        }

        exportRowsToCsv(`bcs-leads-${new Date().toISOString().slice(0, 10)}.csv`, result.data ?? [])
      } else if (moduleName === 'onboarding') {
        const result = await supabase
          .from('onboarding_cases')
          .select('case_no, status, owner_user_id, reviewer_user_id, sla_due_at, started_at, completed_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (result.error) {
          throw result.error
        }

        exportRowsToCsv(`bcs-onboarding-${new Date().toISOString().slice(0, 10)}.csv`, result.data ?? [])
      } else {
        const result = await supabase
          .from('projects')
          .select('project_code, name, status, completion_rate, pm_owner_id, bd_owner_id, start_date, target_end_date')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (result.error) {
          throw result.error
        }

        exportRowsToCsv(`bcs-projects-${new Date().toISOString().slice(0, 10)}.csv`, result.data ?? [])
      }

      message.success('Report exported')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to export report'
      message.error(text)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title="Report Export Center"
        description="Generate operational exports for leads, onboarding, and project performance review."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <Card className="mb-5">
        <Space wrap>
          <Select<ReportModule>
            value={moduleName}
            style={{ width: 220 }}
            options={[
              { label: 'Lead Report', value: 'leads' },
              { label: 'Onboarding Report', value: 'onboarding' },
              { label: 'Project Report', value: 'projects' },
            ]}
            onChange={(value) => setModuleName(value)}
          />
          <Button type="primary" loading={exporting} onClick={() => void handleExport()}>
            Export CSV
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'Requested At', dataIndex: 'requested_at', width: 180, render: (value: string) => new Date(value).toLocaleString() },
          { title: 'Module', dataIndex: 'module', width: 140 },
          { title: 'Status', dataIndex: 'status', width: 120 },
          { title: 'Requested By', dataIndex: 'requested_by', width: 300, render: (value: string | null) => value ?? '-' },
          { title: 'Completed At', dataIndex: 'completed_at', width: 180, render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-') },
        ]}
      />
    </>
  )
}
