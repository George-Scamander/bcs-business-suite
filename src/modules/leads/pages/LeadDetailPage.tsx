import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Descriptions, Empty, Space, Table, Timeline, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { createSignedFileUrl } from '../../../lib/supabase/storage'
import { supabase } from '../../../lib/supabase/client'
import type { OnboardingCase, Project, SignedRecord } from '../../../types/business'
import {
  getLeadById,
  listLeadAttachments,
  listLeadFollowups,
  listLeadStatusLogs,
  listSignedRecords,
  type LeadAttachment,
} from '../api'
import type { Lead, LeadFollowup, LeadStatusLog } from '../../../types/business'

export function LeadDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()

  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [followups, setFollowups] = useState<LeadFollowup[]>([])
  const [statusLogs, setStatusLogs] = useState<LeadStatusLog[]>([])
  const [attachments, setAttachments] = useState<LeadAttachment[]>([])
  const [signedRecord, setSignedRecord] = useState<SignedRecord | null>(null)
  const [onboardingCase, setOnboardingCase] = useState<OnboardingCase | null>(null)
  const [project, setProject] = useState<Project | null>(null)

  const industryLabelMap: Record<string, string> = {
    'Repair Workshop': t('page.leads.industryRepairWorkshop', { defaultValue: 'Repair Workshop' }),
    'Parts Sales': t('page.leads.industryPartsSales', { defaultValue: 'Parts Sales' }),
    'Car Wash': t('page.leads.industryCarWash', { defaultValue: 'Car Wash' }),
    'Car Beauty': t('page.leads.industryCarBeauty', { defaultValue: 'Car Beauty' }),
    'Body & Paint Specialist': t('page.leads.industryBodyPaint', { defaultValue: 'Body & Paint Specialist' }),
    Other: t('page.leads.industryOther', { defaultValue: 'Other' }),
  }

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
      setFollowups(followupRows)
      setStatusLogs(statusRows)
      setAttachments(attachmentRows)
      setSignedRecord(signed)

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
      const text = error instanceof Error ? error.message : 'Failed to load lead detail'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  async function handlePreviewAttachment(row: LeadAttachment) {
    if (!row.object_path) {
      return
    }

    try {
      const url = await createSignedFileUrl(row.object_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to preview attachment'
      message.error(text)
    }
  }

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={
          lead
            ? `${t('page.leads.detailTitle', { defaultValue: 'Lead Detail' })} · ${lead.lead_code}`
            : t('page.leads.detailTitle', { defaultValue: 'Lead Detail' })
        }
        description={t('page.leads.detailDesc', {
          defaultValue: 'Review complete lead profile, progression history, signed linkage, and downstream delivery chain.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate('/app/bd/leads')}>
              {t('page.common.backToList', { defaultValue: 'Back to List' })}
            </Button>
            <Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
            {lead ? (
              <Button type="primary" onClick={() => navigate(`/app/bd/leads/${lead.id}/edit`)}>
                {t('page.leads.edit', { defaultValue: 'Edit' })}
              </Button>
            ) : null}
          </Space>
        }
      />

      <Card loading={loading} className="mb-5">
        {lead ? (
          <Descriptions bordered column={{ xs: 1, md: 2, lg: 3 }} size="small">
            <Descriptions.Item label={t('page.admin.leadCode', { defaultValue: 'Lead Code' })}>{lead.lead_code}</Descriptions.Item>
            <Descriptions.Item label={t('page.common.status', { defaultValue: 'Status' })}>
              <StatusTag value={lead.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('page.common.company', { defaultValue: 'Company' })}>{lead.company_name}</Descriptions.Item>
            <Descriptions.Item label={t('page.leads.contactPerson', { defaultValue: 'Contact Person' })}>
              {lead.contact_person ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.contactPhone', { defaultValue: 'Contact Phone' })}>
              {lead.contact_phone ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.common.email', { defaultValue: 'Email' })}>{lead.contact_email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('page.common.industry', { defaultValue: 'Industry' })}>
              {lead.industry ? industryLabelMap[lead.industry] ?? lead.industry : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.common.region', { defaultValue: 'Region' })}>{lead.region ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('page.leads.city', { defaultValue: 'City' })}>{lead.city ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('page.leads.potentialPackage', { defaultValue: 'Potential Intent Package' })}>
              {lead.intent_package === 'BCS'
                ? t('page.leads.packageBCS', { defaultValue: 'BCS' })
                : lead.intent_package === 'PRODUCTS_SALES'
                  ? t('page.leads.packageProductsSales', { defaultValue: 'Products Sales' })
                  : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.intentLevel', { defaultValue: 'Intent Level (1-5)' })}>
              {lead.intent_level ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.nextFollowup', { defaultValue: 'Next Follow-up' })}>
              {lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.duplicateNote', { defaultValue: 'Duplicate Distinction Note' })}>
              {lead.duplicate_note ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.bdNotes', { defaultValue: 'BD Notes' })} span={3}>
              {lead.bd_notes ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.teamAttentionNote', { defaultValue: 'Team Attention Note' })} span={3}>
              {lead.team_attention_note ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.address', { defaultValue: 'Address' })} span={3}>
              {lead.address ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description={t('page.leads.notFound', { defaultValue: 'Lead not found' })} />
        )}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title={t('page.leads.followupTimeline', { defaultValue: 'Follow-up Timeline' })}
          extra={
            lead ? (
              <Button type="link" onClick={() => navigate(`/app/bd/leads/${lead.id}/followups`)}>
                {t('page.leads.manageFollowups', { defaultValue: 'Manage' })}
              </Button>
            ) : null
          }
        >
          {followups.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('page.leads.noFollowupRecords', { defaultValue: 'No follow-up records yet' })}
            />
          ) : (
            <Timeline
              items={followups.slice(0, 8).map((item) => ({
                color: 'blue',
                children: (
                  <div>
                    <p className="mb-1 font-medium">{t(`followupType.${item.followup_type}`, { defaultValue: item.followup_type })}</p>
                    <p className="mb-1 text-slate-600">{item.summary}</p>
                    <p className="mb-0 text-xs text-slate-500">{new Date(item.followup_at).toLocaleString()}</p>
                  </div>
                ),
              }))}
            />
          )}
        </Card>

        <Card
          title={t('page.leads.statusChangeLogs', { defaultValue: 'Status Change Logs' })}
          extra={
            lead ? (
              <Button type="link" onClick={() => navigate(`/app/bd/leads/${lead.id}/status`)}>
                {t('page.leads.updateStatus', { defaultValue: 'Update Status' })}
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
                title: t('page.leads.changedAt', { defaultValue: 'Changed At' }),
                dataIndex: 'changed_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: t('page.onboarding.from', { defaultValue: 'From' }),
                dataIndex: 'from_status',
                render: (value: string | null) => (value ? <StatusTag value={value} /> : '-'),
              },
              {
                title: t('page.onboarding.to', { defaultValue: 'To' }),
                dataIndex: 'to_status',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: t('page.onboarding.reason', { defaultValue: 'Reason' }),
                dataIndex: 'reason',
                render: (value: string | null) => value ?? '-',
              },
            ]}
          />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('page.leads.attachments', { defaultValue: 'Attachments' })}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={attachments}
            locale={{ emptyText: t('page.leads.noAttachments', { defaultValue: 'No attachments yet' }) }}
            columns={[
              { title: t('page.files.fileName', { defaultValue: 'File Name' }), dataIndex: 'file_name' },
              {
                title: t('page.files.uploadedAt', { defaultValue: 'Uploaded At' }),
                dataIndex: 'uploaded_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: t('page.common.actions', { defaultValue: 'Actions' }),
                width: 90,
                render: (_: unknown, row: LeadAttachment) => (
                  <Button size="small" icon={<EyeOutlined />} onClick={() => void handlePreviewAttachment(row)} />
                ),
              },
            ]}
          />
        </Card>

        <Card title={t('page.leads.downstreamLinkage', { defaultValue: 'Downstream Linkage' })}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t('page.leads.signedRecord', { defaultValue: 'Signed Record' })}>
              {signedRecord?.contract_no ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.leads.onboardingCase', { defaultValue: 'Onboarding Case' })}>
              {onboardingCase ? (
                <Space>
                  <span>{onboardingCase.case_no}</span>
                  <StatusTag value={onboardingCase.status} />
                </Space>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.onboarding.project', { defaultValue: 'Project' })}>
              {project ? (
                <Space>
                  <span>{project.project_code}</span>
                  <StatusTag value={project.status} />
                  <Button size="small" onClick={() => navigate(`/app/bd/projects/${project.id}`)}>
                    {t('page.common.view', { defaultValue: 'View' })}
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
