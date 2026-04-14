import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { ONBOARDING_STATUS_OPTIONS } from '../../../lib/business-constants'
import { supabase } from '../../../lib/supabase/client'
import { useAuth } from '../../auth/auth-context'
import { listOnboardingCases, type OnboardingFilters } from '../api'
import type { OnboardingCase, Project } from '../../../types/business'
import { StatusTag } from '../../../components/common/StatusTag'

export function BdOnboardingListPage() {
  const navigate = useNavigate()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<OnboardingCase[]>([])
  const [projectByCaseId, setProjectByCaseId] = useState<Record<string, Project>>({})
  const [filters, setFilters] = useState<OnboardingFilters>({})
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  const isSuperAdmin = roles.includes('super_admin')

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const onboardingRows = await listOnboardingCases({
        ...filters,
        keyword: keyword.trim() || undefined,
        ownerUserId: isSuperAdmin ? filters.ownerUserId : user.id,
      })

      setRows(onboardingRows)

      if (onboardingRows.length === 0) {
        setProjectByCaseId({})
        return
      }

      const caseIds = onboardingRows.map((item) => item.id)
      const projectResult = await supabase.from('projects').select('*').in('onboarding_case_id', caseIds)

      if (projectResult.error) {
        throw projectResult.error
      }

      const map: Record<string, Project> = {}
      ;(projectResult.data ?? []).forEach((project) => {
        const row = project as Project
        map[row.onboarding_case_id] = row
      })

      setProjectByCaseId(map)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load onboarding cases'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, isSuperAdmin, keyword, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => rows, [rows])

  return (
    <>
      <PageTitleBar
        title="Onboarding Cases"
        description="Track customer onboarding pipeline from data readiness to service activation."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 220 }}
            options={ONBOARDING_STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input.Search
            allowClear
            placeholder="Case no keyword"
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            Apply
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={filteredRows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'Case No', dataIndex: 'case_no', width: 190 },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 170,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'SLA Due',
            dataIndex: 'sla_due_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: 'Started',
            dataIndex: 'started_at',
            width: 190,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: 'Linked Project',
            key: 'linked_project',
            render: (_: unknown, row: OnboardingCase) => {
              const project = projectByCaseId[row.id]
              return project ? (
                <Space>
                  <span>{project.project_code}</span>
                  <StatusTag value={project.status} />
                </Space>
              ) : (
                '-'
              )
            },
          },
          {
            title: 'Actions',
            width: 220,
            render: (_: unknown, row: OnboardingCase) => {
              const project = projectByCaseId[row.id]
              return (
                <Space>
                  <Button size="small" onClick={() => navigate(`/app/bd/onboarding/${row.id}`)}>
                    View
                  </Button>
                  {project ? (
                    <Button size="small" onClick={() => navigate(`/app/bd/projects/${project.id}`)}>
                      Project
                    </Button>
                  ) : null}
                </Space>
              )
            },
          },
        ]}
      />
    </>
  )
}
