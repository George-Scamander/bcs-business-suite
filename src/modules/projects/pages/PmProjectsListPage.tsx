import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Progress, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getProjectStatusOptions } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listProjects, markDelayedProjects, type ProjectFilters } from '../api'
import type { Project } from '../../../types/business'

export function PmProjectsListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [keyword, setKeyword] = useState('')

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      await markDelayedProjects()
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
        pmOwnerId: roles.includes('super_admin') ? filters.pmOwnerId : user.id,
      })
      setRows(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load projects'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword, roles, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={t('page.projects.listTitle', { defaultValue: 'Projects' })}
        description={t('page.projects.listDesc', {
          defaultValue: 'Manage execution portfolio with real-time progress, delay signaling, and closure discipline.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('page.common.status', { defaultValue: 'Status' })}
            style={{ width: 220 }}
            options={getProjectStatusOptions(t)}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input.Search
            allowClear
            placeholder={t('page.projects.keywordPlaceholder', { defaultValue: 'Project code/name' })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('page.common.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('page.pm.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code', width: 170 },
          { title: t('page.pm.projectName', { defaultValue: 'Name' }), dataIndex: 'name' },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.pm.progress', { defaultValue: 'Progress' }),
            dataIndex: 'completion_rate',
            width: 220,
            render: (value: number) => <Progress percent={Number(Number(value ?? 0).toFixed(1))} size="small" />,
          },
          {
            title: t('page.projectOverview.targetEnd', { defaultValue: 'Target End' }),
            dataIndex: 'target_end_date',
            width: 150,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            width: 320,
            render: (_: unknown, row: Project) => (
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}`)}>
                  {t('page.projects.detail', { defaultValue: 'Detail' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/progress`)}>
                  {t('page.projects.progress', { defaultValue: 'Progress' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/tasks`)}>
                  {t('page.projects.tasks', { defaultValue: 'Tasks' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/members`)}>
                  {t('page.projects.members', { defaultValue: 'Members' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/risks`)}>
                  {t('page.projects.risks', { defaultValue: 'Risks' })}
                </Button>
                <Button size="small" onClick={() => navigate(`/app/pm/projects/${row.id}/closure`)}>
                  {t('page.projects.closure', { defaultValue: 'Closure' })}
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
