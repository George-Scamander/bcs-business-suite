import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { supabase } from '../../../lib/supabase/client'
import { exportRowsToCsv, listReportExports, requestReportExport } from '../../reports/api'
import type { ReportExport } from '../../../types/business'

type ReportModule = 'leads' | 'onboarding' | 'projects'

export function AdminReportExportPage() {
  const { t } = useTranslation()
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
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminReportExport.loadFail', { defaultValue: 'Failed to load report exports' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t])

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

      message.success(t('pages.adminReportExport.exportSuccess', { defaultValue: 'Report exported' }))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminReportExport.exportFail', { defaultValue: 'Failed to export report' })
      message.error(text)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.adminReportExport.title', { defaultValue: 'Report Export Center' })}
        description={t('pages.adminReportExport.description', {
          defaultValue: 'Generate operational exports for leads, onboarding, and project performance review.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Card className="mb-5">
        <Space wrap>
          <Select<ReportModule>
            value={moduleName}
            style={{ width: 220 }}
            options={[
              { label: t('pages.adminReportExport.modules.leads', { defaultValue: 'Lead Report' }), value: 'leads' },
              { label: t('pages.adminReportExport.modules.onboarding', { defaultValue: 'Onboarding Report' }), value: 'onboarding' },
              { label: t('pages.adminReportExport.modules.projects', { defaultValue: 'Project Report' }), value: 'projects' },
            ]}
            onChange={(value) => setModuleName(value)}
          />
          <Button type="primary" loading={exporting} onClick={() => void handleExport()}>
            {t('pages.adminReportExport.exportCsv', { defaultValue: 'Export CSV' })}
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
          {
            title: t('pages.adminReportExport.columns.requestedAt', { defaultValue: 'Requested At' }),
            dataIndex: 'requested_at',
            width: 180,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          { title: t('pages.adminReportExport.columns.module', { defaultValue: 'Module' }), dataIndex: 'module', width: 140 },
          { title: t('pages.adminReportExport.columns.status', { defaultValue: 'Status' }), dataIndex: 'status', width: 120 },
          {
            title: t('pages.adminReportExport.columns.requestedBy', { defaultValue: 'Requested By' }),
            dataIndex: 'requested_by',
            width: 300,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('pages.adminReportExport.columns.completedAt', { defaultValue: 'Completed At' }),
            dataIndex: 'completed_at',
            width: 180,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
