import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Button,
  Input,
  Select,
  Space,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useNavigate,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getOnboardingStatusOptions,
} from '../../../lib/business-constants'
import {
  supabase,
} from '../../../lib/supabase/client'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  listOnboardingCases,
  type OnboardingFilters,
} from '../api'
import type {
  OnboardingCase,
  Project,
} from '../../../types/business'
import {
  StatusTag,
} from '../../../components/common/StatusTag'

export function BdOnboardingListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, roles } = useAuth()

  const [rows, setRows] = useState<OnboardingCase[]>([])
  const [projectByCaseId, setProjectByCaseId] = useState<Record<string, Project>>({})
  const [filters, setFilters] = useState<OnboardingFilters>({})
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const onboardingStatusOptions = useMemo(() => getOnboardingStatusOptions(t), [t])

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
        if (row.onboarding_case_id) {
          map[row.onboarding_case_id] = row
        }
      })

      setProjectByCaseId(map)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.bdOnboarding.loadFail', { defaultValue: 'Failed to load onboarding cases' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, isSuperAdmin, keyword, t, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => rows, [rows])

  return (
    <>
      <PageTitleBar
        title={t('pages.bdOnboarding.title', { defaultValue: 'Onboarding Cases' })}
        description={t('pages.bdOnboarding.description', {
          defaultValue: 'Track customer onboarding pipeline from data readiness to service activation.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            placeholder={t('pages.bdOnboarding.statusPlaceholder', { defaultValue: 'Status' })}
            style={{ width: 220 }}
            options={onboardingStatusOptions}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input.Search
            allowClear
            placeholder={t('pages.bdOnboarding.keywordPlaceholder', { defaultValue: 'Case no keyword' })}
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
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
          { title: t('pages.bdOnboarding.columns.caseNo', { defaultValue: 'Case No' }), dataIndex: 'case_no', width: 190 },
          {
            title: t('pages.bdOnboarding.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 170,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.bdOnboarding.columns.slaDue', { defaultValue: 'SLA Due' }),
            dataIndex: 'sla_due_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.bdOnboarding.columns.started', { defaultValue: 'Started' }),
            dataIndex: 'started_at',
            width: 190,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: t('pages.bdOnboarding.columns.linkedProject', { defaultValue: 'Linked Project' }),
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
            title: t('pages.bdOnboarding.columns.actions', { defaultValue: 'Actions' }),
            width: 220,
            render: (_: unknown, row: OnboardingCase) => {
              const project = projectByCaseId[row.id]
              return (
                <Space>
                  <Button size="small" onClick={() => navigate(`/app/bd/onboarding/${row.id}`)}>
                    {t('pages.bdOnboarding.actionView', { defaultValue: 'View' })}
                  </Button>
                  {project ? (
                    <Button size="small" onClick={() => navigate(`/app/bd/projects/${project.id}`)}>
                      {t('pages.bdOnboarding.actionProject', { defaultValue: 'Project' })}
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
