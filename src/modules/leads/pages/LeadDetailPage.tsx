import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Descriptions, Empty, Space, Table, Timeline, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
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
        title={lead ? `Lead Detail · ${lead.lead_code}` : 'Lead Detail'}
        description="Review complete lead profile, progression history, signed linkage, and downstream delivery chain."
        extra={
          <Space>
            <Button onClick={() => navigate('/app/bd/leads')}>Back to List</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
            {lead ? (
              <Button type="primary" onClick={() => navigate(`/app/bd/leads/${lead.id}/edit`)}>
                Edit
              </Button>
            ) : null}
          </Space>
        }
      />

      <Card loading={loading} className="mb-5">
        {lead ? (
          <Descriptions bordered column={{ xs: 1, md: 2, lg: 3 }} size="small">
            <Descriptions.Item label="Lead Code">{lead.lead_code}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <StatusTag value={lead.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Company">{lead.company_name}</Descriptions.Item>
            <Descriptions.Item label="Contact">{lead.contact_person ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Phone">{lead.contact_phone ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{lead.contact_email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Industry">{lead.industry ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Region">{lead.region ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="City">{lead.city ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Intent Level">{lead.intent_level ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Estimated Value">{lead.estimated_value ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Next Follow-up">{lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Address" span={3}>
              {lead.address ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="Lead not found" />
        )}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Follow-up Timeline"
          extra={
            lead ? (
              <Button type="link" onClick={() => navigate(`/app/bd/leads/${lead.id}/followups`)}>
                Manage
              </Button>
            ) : null
          }
        >
          {followups.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No follow-up records yet" />
          ) : (
            <Timeline
              items={followups.slice(0, 8).map((item) => ({
                color: 'blue',
                children: (
                  <div>
                    <p className="mb-1 font-medium">{item.followup_type}</p>
                    <p className="mb-1 text-slate-600">{item.summary}</p>
                    <p className="mb-0 text-xs text-slate-500">{new Date(item.followup_at).toLocaleString()}</p>
                  </div>
                ),
              }))}
            />
          )}
        </Card>

        <Card
          title="Status Change Logs"
          extra={
            lead ? (
              <Button type="link" onClick={() => navigate(`/app/bd/leads/${lead.id}/status`)}>
                Update Status
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
                title: 'Changed At',
                dataIndex: 'changed_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: 'From',
                dataIndex: 'from_status',
                render: (value: string | null) => (value ? <StatusTag value={value} /> : '-'),
              },
              {
                title: 'To',
                dataIndex: 'to_status',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: 'Reason',
                dataIndex: 'reason',
                render: (value: string | null) => value ?? '-',
              },
            ]}
          />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Attachments">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={attachments}
            locale={{ emptyText: 'No attachments yet' }}
            columns={[
              { title: 'File Name', dataIndex: 'file_name' },
              {
                title: 'Uploaded At',
                dataIndex: 'uploaded_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: 'Action',
                width: 90,
                render: (_: unknown, row: LeadAttachment) => (
                  <Button size="small" icon={<EyeOutlined />} onClick={() => void handlePreviewAttachment(row)} />
                ),
              },
            ]}
          />
        </Card>

        <Card title="Downstream Linkage">
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Signed Record">{signedRecord?.contract_no ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Onboarding Case">
              {onboardingCase ? (
                <Space>
                  <span>{onboardingCase.case_no}</span>
                  <StatusTag value={onboardingCase.status} />
                </Space>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Project">
              {project ? (
                <Space>
                  <span>{project.project_code}</span>
                  <StatusTag value={project.status} />
                  <Button size="small" onClick={() => navigate(`/app/bd/projects/${project.id}`)}>
                    View
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
