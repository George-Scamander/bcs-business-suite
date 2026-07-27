import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Tag,
  Timeline,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  EyeOutlined,
} from '@ant-design/icons'
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  getSalesProductCategoryOptions,
  getSalesProductCategoryGroup,
  getSalesProductSubcategoryLabel,
  getFollowupTypeOptions,
} from '../../../lib/business-constants'
import {
  createSignedFileUrl,
} from '../../../lib/supabase/storage'
import {
  supabase,
} from '../../../lib/supabase/client'
import type {
  OnboardingCase,
  Project,
  SalesProductCategory,
  SalesProductSubcategory,
  SignedRecord,
  StoreTier,
} from '../../../types/business'
import {
  getLeadById,
  softDeleteLead,
  listLeadAttachments,
  listLeadFollowups,
  listLeadStatusLogs,
  listSignedRecords,
  updateLead,
  type LeadAttachment,
} from '../api'
import {
  listSalesOrders,
  type SalesOrderRow,
} from '../../sales/api'
import type {
  Lead,
  LeadFollowup,
  LeadStatusLog,
} from '../../../types/business'
import {
  useAuth,
} from '../../auth/auth-context'

const STORE_TIER_OPTIONS: Array<{ value: StoreTier; labelKey: string; defaultLabel: string }> = [
  { value: 'NORMAL', labelKey: 'pages.leadDetail.storeTierNormal', defaultLabel: 'Normal Store' },
  { value: 'KA', labelKey: 'pages.leadDetail.storeTierKa', defaultLabel: 'KA Store' },
]

function isSalesOrderFollowup(followupType: string, summary: string): boolean {
  const normalizedType = followupType.trim().toUpperCase()
  if (normalizedType === 'SALES_ORDER') {
    return true
  }
  return summary.trim().toLowerCase().startsWith('sales order ')
}

function resolveLeadDetailBackPath(rawBackPath: string | null, fallbackPath: string): string {
  if (!rawBackPath) {
    return fallbackPath
  }

  const isSafeAdminPath =
    rawBackPath === '/app/admin/onboarding/review-center' ||
    rawBackPath.startsWith('/app/admin/onboarding/review-center?') ||
    rawBackPath === '/app/admin/leads/pool' ||
    rawBackPath.startsWith('/app/admin/leads/pool/') ||
    rawBackPath.startsWith('/app/admin/leads/pool?') ||
    rawBackPath === '/app/admin/dashboard' ||
    rawBackPath === '/app/admin/store-alert' ||
    rawBackPath.startsWith('/app/admin/store-alert?')

  return isSafeAdminPath ? rawBackPath : fallbackPath
}

export function LeadDetailPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { leadId } = useParams<{ leadId: string }>()
  const [searchParams] = useSearchParams()
  const { roles } = useAuth()
  const fallbackBackPath = roles.includes('super_admin') || roles.includes('project_manager') ? '/app/admin/leads/pool' : '/app/bd/leads'
  const backPath = resolveLeadDetailBackPath(searchParams.get('back'), fallbackBackPath)

  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [followups, setFollowups] = useState<LeadFollowup[]>([])
  const [statusLogs, setStatusLogs] = useState<LeadStatusLog[]>([])
  const [attachments, setAttachments] = useState<LeadAttachment[]>([])
  const [salesOrders, setSalesOrders] = useState<SalesOrderRow[]>([])
  const [signedRecord, setSignedRecord] = useState<SignedRecord | null>(null)
  const [onboardingCase, setOnboardingCase] = useState<OnboardingCase | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [teamAttentionNote, setTeamAttentionNote] = useState('')
  const [storeTier, setStoreTier] = useState<StoreTier>('NORMAL')
  const deleteRetentionHint = t('labels.autoDelete30DaysHint', {
    defaultValue: 'Moved to Recently Deleted and auto-permanently deleted after 30 days.',
  })
  const [savingNote, setSavingNote] = useState(false)
  const [savingStoreTier, setSavingStoreTier] = useState(false)

  const canEditAttentionNote = roles.includes('super_admin')

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, followupRows, statusRows, attachmentRows, signedRows] = await Promise.all([
        getLeadById(leadId),
        listLeadFollowups(leadId),
        listLeadStatusLogs(leadId),
        listLeadAttachments(leadId),
        listSignedRecords({ leadId }),
      ])

      const signed = signedRows[0] ?? null

      setLead(leadResult)
      setTeamAttentionNote(leadResult.team_attention_note ?? '')
      setStoreTier(leadResult.store_tier)
      setFollowups(followupRows)
      setStatusLogs(statusRows)
      setAttachments(attachmentRows)
      setSignedRecord(signed)

      try {
        const salesRows = await listSalesOrders({ leadId })
        setSalesOrders(salesRows)
      } catch {
        setSalesOrders([])
      }

      if (signed) {
        const onboardingResult = await supabase
          .from('onboarding_cases')
          .select('*')
          .eq('signed_record_id', signed.id)
          .maybeSingle<OnboardingCase>()

        if (onboardingResult.error) {
          throw onboardingResult.error
        }

        const caseRow = onboardingResult.data ?? null
        setOnboardingCase(caseRow)

        if (caseRow) {
          const projectResult = await supabase
            .from('projects')
            .select('*')
            .eq('onboarding_case_id', caseRow.id)
            .maybeSingle<Project>()

          if (projectResult.error) {
            throw projectResult.error
          }

          setProject(projectResult.data ?? null)
        } else {
          setProject(null)
        }
      } else {
        setOnboardingCase(null)
        setProject(null)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.leadDetail.loadFail', { defaultValue: 'Failed to load lead detail' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [leadId, t])

  const categoryLabelByValue = useMemo(() => {
    return new Map(getSalesProductCategoryOptions(t).map((item) => [item.value, item.label]))
  }, [t])
  const followupTypeLabelByValue = useMemo(() => {
    const map = new Map(getFollowupTypeOptions(t).map((item) => [item.value, item.label]))
    map.set('SALES_ORDER', t('merchantActivityType.SALES_ORDER', { defaultValue: 'Sales Order' }))
    return map
  }, [t])

  const timelineFollowups = useMemo(() => {
    return followups.filter((item) => !isSalesOrderFollowup(item.followup_type, item.summary))
  }, [followups])

  const renderFollowupType = useCallback((followupType: string, summary: string) => {
    if (followupType === 'MEETING' && summary.startsWith('Sales order ')) {
      return t('merchantActivityType.SALES_ORDER', { defaultValue: 'Sales Order' })
    }
    return followupTypeLabelByValue.get(followupType) ?? followupType
  }, [followupTypeLabelByValue, t])

  async function handleSaveAttentionNote() {
    if (!lead || !canEditAttentionNote) {
      return
    }

    setSavingNote(true)

    try {
      const result = await updateLead({
        id: lead.id,
        team_attention_note: teamAttentionNote.trim() || undefined,
      })

      setLead(result)
      setTeamAttentionNote(result.team_attention_note ?? '')
      message.success(t('pages.leadDetail.teamAttentionSaveSuccess', { defaultValue: 'Team attention note updated' }))
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.leadDetail.teamAttentionSaveFail', { defaultValue: 'Failed to update team attention note' })
      message.error(text)
    } finally {
      setSavingNote(false)
    }
  }

  async function handleSaveStoreTier(nextTier: StoreTier) {
    if (!lead || !canEditAttentionNote) {
      return
    }

    setSavingStoreTier(true)

    try {
      const result = await updateLead({
        id: lead.id,
        store_tier: nextTier,
      })

      setLead(result)
      setStoreTier(result.store_tier)
      message.success(t('pages.leadDetail.storeTierSaveSuccess', { defaultValue: 'Store tier updated' }))
    } catch (error) {
      const text =
        error instanceof Error ? error.message : t('pages.leadDetail.storeTierSaveFail', { defaultValue: 'Failed to update store tier' })
      message.error(text)
    } finally {
      setSavingStoreTier(false)
    }
  }

  async function handlePreviewAttachment(row: LeadAttachment) {
    if (!row.object_path) {
      return
    }

    try {
      const url = await createSignedFileUrl(row.object_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.leadDetail.previewAttachmentFail', { defaultValue: 'Failed to preview attachment' })
      message.error(text)
    }
  }

  async function handleDeleteLead() {
    if (!lead) {
      return
    }

    try {
      await softDeleteLead(lead.id)
      message.success(t('pages.leadDetail.deleteSuccess', { defaultValue: 'Lead moved to Recently Deleted' }))
      navigate(backPath)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.leadDetail.deleteFail', { defaultValue: 'Failed to delete lead' })
      message.error(text)
    }
  }

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={lead ? `${t('pages.leadDetail.title', { defaultValue: 'Lead Detail' })} · ${lead.lead_code}` : t('pages.leadDetail.title', { defaultValue: 'Lead Detail' })}
        description={t('pages.leadDetail.description', {
          defaultValue: 'Review complete lead profile, progression history, signed linkage, and downstream delivery chain.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate(backPath)}>{t('pages.leadDetail.backToList', { defaultValue: 'Back to List' })}</Button>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            {lead ? (
              <Button type="primary" onClick={() => navigate(`/app/bd/leads/${lead.id}/edit`)}>
                {t('pages.leadDetail.edit', { defaultValue: 'Edit' })}
              </Button>
            ) : null}
            {lead ? (
              <Popconfirm
                title={t('pages.leadDetail.deleteConfirmTitle', { defaultValue: 'Delete this lead?' })}
                description={`${t('pages.leadDetail.deleteConfirmDesc', {
                  defaultValue: 'The lead will be moved to Recently Deleted.',
                })} ${deleteRetentionHint}`}
                okText={t('labels.delete', { defaultValue: 'Delete' })}
                cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                onConfirm={() => void handleDeleteLead()}
              >
                <Button danger>{t('labels.delete', { defaultValue: 'Delete' })}</Button>
              </Popconfirm>
            ) : null}
          </Space>
        }
      />

      {lead && ['NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING'].includes(lead.status) && (
        !lead.last_followup_at || dayjs().diff(dayjs(lead.last_followup_at), 'day') > 7
      ) ? (
        <Alert
          type="error"
          showIcon
          className="mb-5"
          message={!lead.last_followup_at
            ? t('pages.leadDetail.neverFollowedUp', { defaultValue: 'This lead has never been followed up. Please take action soon.' })
            : t('pages.leadDetail.overdueFollowup', { days: dayjs().diff(dayjs(lead.last_followup_at), 'day'), defaultValue: 'This lead has been overdue for {{days}} day(s). Please complete the follow-up soon.' })
          }
        />
      ) : null}

      <Card loading={loading} className="mb-5">
        {lead ? (
          <Descriptions bordered column={{ xs: 1, md: 2, lg: 3 }} size="small">
            <Descriptions.Item label={t('pages.leadDetail.leadCode', { defaultValue: 'Lead Code' })}>{lead.lead_code}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.status', { defaultValue: 'Status' })}>
              <StatusTag value={lead.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.company', { defaultValue: 'Company' })}>{lead.company_name}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.contact', { defaultValue: 'Contact' })}>{lead.contact_person ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.phone', { defaultValue: 'Phone' })}>{lead.contact_phone ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.email', { defaultValue: 'Email' })}>{lead.contact_email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.industry', { defaultValue: 'Industry' })}>{lead.industry ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.region', { defaultValue: 'Region' })}>{lead.region ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.city', { defaultValue: 'City' })}>{lead.city ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.intentLevel', { defaultValue: 'Intent Level' })}>{lead.intent_level ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.estimatedValue', { defaultValue: 'Estimated Value' })}>{lead.estimated_value ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.nextFollowup', { defaultValue: 'Next Follow-up' })}>
              {lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.address', { defaultValue: 'Address' })} span={3}>
              {lead.address ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description={t('pages.leadDetail.notFound', { defaultValue: 'Lead not found' })} />
        )}
      </Card>

      {lead ? (
        <Card title={t('pages.leadDetail.storeTierTitle', { defaultValue: 'Store Tier' })} className="mb-5">
          {canEditAttentionNote ? (
            <Select<StoreTier>
              style={{ width: 220 }}
              value={storeTier}
              loading={savingStoreTier}
              disabled={savingStoreTier}
              options={STORE_TIER_OPTIONS.map((item) => ({
                value: item.value,
                label: t(item.labelKey, { defaultValue: item.defaultLabel }),
              }))}
              onChange={(value) => void handleSaveStoreTier(value)}
            />
          ) : (
            <Tag color={storeTier === 'KA' ? 'gold' : 'default'}>
              {t(
                STORE_TIER_OPTIONS.find((item) => item.value === storeTier)?.labelKey ?? 'pages.leadDetail.storeTierNormal',
                { defaultValue: STORE_TIER_OPTIONS.find((item) => item.value === storeTier)?.defaultLabel ?? 'Normal Store' },
              )}
            </Tag>
          )}
        </Card>
      ) : null}

      {lead ? (
        <Card title={t('pages.leadDetail.teamAttentionNote', { defaultValue: 'Team Attention Note' })} className="mb-5">
          {canEditAttentionNote ? (
            <>
              <Input.TextArea
                rows={4}
                placeholder={t('pages.leadDetail.teamAttentionPlaceholder', {
                  defaultValue: 'Add internal team attention guidance...',
                })}
                value={teamAttentionNote}
                onChange={(event) => setTeamAttentionNote(event.target.value)}
              />
              <div className="mt-3">
                <Button type="primary" loading={savingNote} onClick={() => void handleSaveAttentionNote()}>
                  {t('pages.leadDetail.teamAttentionSave', { defaultValue: 'Save Note' })}
                </Button>
              </div>
            </>
          ) : (
            <p className="mb-0 app-text whitespace-pre-wrap">{teamAttentionNote || '-'}</p>
          )}
        </Card>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title={t('pages.leadDetail.followupTimeline', { defaultValue: 'Follow-up Timeline' })}
          extra={
            lead ? (
              <Button type="link" onClick={() => navigate(`/app/bd/leads/${lead.id}/followups`)}>
                {t('pages.leadDetail.manage', { defaultValue: 'Manage' })}
              </Button>
            ) : null
          }
        >
          {timelineFollowups.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.leadDetail.noFollowups', { defaultValue: 'No follow-up records yet' })} />
          ) : (
            <Timeline
              items={timelineFollowups.slice(0, 8).map((item) => ({
                color: 'blue',
                children: (
                  <div>
                    <p className="mb-1 font-medium">{renderFollowupType(item.followup_type, item.summary)}</p>
                    <p className="mb-1 app-text-soft">{item.summary}</p>
                    <p className="mb-0 text-xs app-text-soft">{new Date(item.followup_at).toLocaleString()}</p>
                  </div>
                ),
              }))}
            />
          )}
        </Card>

        <Card
          title={t('pages.leadDetail.statusChangeLogs', { defaultValue: 'Status Change Logs' })}
          extra={
            lead ? (
              <Button type="link" onClick={() => navigate(`/app/bd/leads/${lead.id}/followups`)}>
                {t('pages.leadDetail.manage', { defaultValue: 'Manage' })}
              </Button>
            ) : null
          }
        >
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={statusLogs.slice(0, 8)}
            columns={[
              {
                title: t('pages.leadDetail.changedAt', { defaultValue: 'Changed At' }),
                dataIndex: 'changed_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: t('pages.leadDetail.from', { defaultValue: 'From' }),
                dataIndex: 'from_status',
                render: (value: string | null) => (value ? <StatusTag value={value} /> : '-'),
              },
              {
                title: t('pages.leadDetail.to', { defaultValue: 'To' }),
                dataIndex: 'to_status',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: t('pages.leadDetail.reason', { defaultValue: 'Reason' }),
                dataIndex: 'reason',
                render: (value: string | null) => value ?? '-',
              },
            ]}
          />
        </Card>
      </div>

      <Card title={t('pages.leadDetail.salesOrders', { defaultValue: 'Sales Orders' })} className="mb-5">
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={salesOrders.slice(0, 8)}
          locale={{ emptyText: t('pages.leadDetail.noSalesOrders', { defaultValue: 'No sales orders linked yet' }) }}
          expandable={{
            expandedRowRender: (row: SalesOrderRow) => (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={row.items}
                columns={[
                  {
                    title: t('pages.leadDetail.salesCategory', { defaultValue: 'Category' }),
                    dataIndex: 'category',
                    width: 180,
                    render: (value: SalesProductCategory) => categoryLabelByValue.get(getSalesProductCategoryGroup(value)) ?? value,
                  },
                  {
                    title: t('pages.leadDetail.salesSubcategory', { defaultValue: 'Subcategory' }),
                    dataIndex: 'subcategory',
                    width: 160,
                    render: (value: SalesProductSubcategory | null, row) =>
                      getSalesProductSubcategoryLabel(row.category, value, t) ?? '-',
                  },
                  {
                    title: t('pages.leadDetail.salesProduct', { defaultValue: 'Product / Description' }),
                    dataIndex: 'product_name',
                    render: (value: string | null) => value ?? '-',
                  },
                  {
                    title: t('pages.leadDetail.salesQuantity', { defaultValue: 'Qty' }),
                    dataIndex: 'quantity',
                    width: 90,
                  },
                  {
                    title: t('pages.leadDetail.salesUnitPrice', { defaultValue: 'Unit Price' }),
                    dataIndex: 'unit_price',
                    width: 140,
                    render: (value: number | null) => (value === null ? '-' : Number(value).toLocaleString()),
                  },
                ]}
              />
            ),
          }}
          columns={[
            {
              title: t('pages.leadDetail.salesOrderNo', { defaultValue: 'Order No' }),
              dataIndex: 'order_no',
              width: 180,
            },
            {
              title: t('pages.leadDetail.salesSoldAt', { defaultValue: 'Sold At' }),
              dataIndex: 'sold_at',
              width: 190,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('pages.leadDetail.salesItemsCount', { defaultValue: 'Items' }),
              width: 90,
              render: (_: unknown, row: SalesOrderRow) => row.items.length,
            },
            {
              title: t('pages.leadDetail.salesNote', { defaultValue: 'Note' }),
              dataIndex: 'note',
              render: (value: string | null) => value ?? '-',
            },
          ]}
        />
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('pages.leadDetail.attachments', { defaultValue: 'Attachments' })}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={attachments}
            locale={{ emptyText: t('pages.leadDetail.noAttachments', { defaultValue: 'No attachments yet' }) }}
            columns={[
              { title: t('pages.leadDetail.fileName', { defaultValue: 'File Name' }), dataIndex: 'file_name' },
              {
                title: t('pages.leadDetail.uploadedAt', { defaultValue: 'Uploaded At' }),
                dataIndex: 'uploaded_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: t('pages.leadDetail.action', { defaultValue: 'Action' }),
                width: 90,
                render: (_: unknown, row: LeadAttachment) => (
                  <Button size="small" icon={<EyeOutlined />} onClick={() => void handlePreviewAttachment(row)} />
                ),
              },
            ]}
          />
        </Card>

        <Card title={t('pages.leadDetail.downstreamLinkage', { defaultValue: 'Downstream Linkage' })}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t('pages.leadDetail.signedRecord', { defaultValue: 'Signed Record' })}>
              {signedRecord?.contract_no ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.onboardingCase', { defaultValue: 'Onboarding Case' })}>
              {onboardingCase ? (
                <Space>
                  <span>{onboardingCase.case_no}</span>
                  <StatusTag value={onboardingCase.status} />
                </Space>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.leadDetail.project', { defaultValue: 'Project' })}>
              {project ? (
                <Space>
                  <span>{project.project_code}</span>
                  <StatusTag value={project.status} />
                  <Button size="small" onClick={() => navigate(`/app/bd/projects/${project.id}`)}>
                    {t('pages.leadDetail.view', { defaultValue: 'View' })}
                  </Button>
                </Space>
              ) : (
                '-'
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </>
  )
}
