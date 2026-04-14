import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getProjectStatusOptions } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { listProjects, type ProjectFilters } from '../api'
import type { Project } from '../../../types/business'

export function BdRelatedProjectsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, roles } = useAuth()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Project[]>([])
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [keyword, setKeyword] = useState('')

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const result = await listProjects({
        ...filters,
        keyword: keyword.trim() || undefined,
        bdOwnerId: roles.includes('super_admin') ? filters.bdOwnerId : user.id,
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
        title={t('page.bd.linkedProjectsTitle', { defaultValue: 'Linked Projects' })}
        description={t('page.bd.linkedProjectsDesc', {
          defaultValue: 'Read execution progress for projects handed over from your signed leads.',
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
          { title: t('page.pm.projectCode', { defaultValue: 'Project Code' }), dataIndex: 'project_code', width: 180 },
          { title: t('page.pm.projectName', { defaultValue: 'Name' }), dataIndex: 'name' },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 160,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.pm.progress', { defaultValue: 'Completion' }),
            dataIndex: 'completion_rate',
            width: 130,
            render: (value: number) => `${Number(value ?? 0).toFixed(1)}%`,
          },
          {
            title: t('page.projectOverview.targetEnd', { defaultValue: 'Target End' }),
            dataIndex: 'target_end_date',
            width: 150,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            width: 120,
            render: (_: unknown, row: Project) => (
              <Button size="small" onClick={() => navigate(`/app/bd/projects/${row.id}`)}>
                {t('page.common.view', { defaultValue: 'View' })}
              </Button>
            ),
          },
        ]}
      />
    </>
  )
}
