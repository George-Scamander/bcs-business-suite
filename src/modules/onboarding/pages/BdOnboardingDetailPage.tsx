import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Upload,
  message,
} from 'antd'
import type { UploadFile } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getOnboardingStatusOptions } from '../../../lib/business-constants'
import { createSignedFileUrl, uploadPrivateDocument } from '../../../lib/supabase/storage'
import { supabase } from '../../../lib/supabase/client'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import {
  changeOnboardingStatus,
  getOnboardingCase,
  listOnboardingDocuments,
  listOnboardingReviews,
  listOnboardingStatusLogs,
  listOnboardingSteps,
  reviewOnboardingDocument,
  submitOnboardingDocument,
} from '../api'
import { StatusTag } from '../../../components/common/StatusTag'
import type {
  OnboardingCase,
  OnboardingDocument,
  OnboardingReview,
  OnboardingStatus,
  OnboardingStatusLog,
  OnboardingStep,
  Project,
} from '../../../types/business'

interface StatusFormValues {
  to_status: OnboardingStatus
  reason?: string
  pm_owner_id?: string
}

interface DocUploadFormValues {
  doc_type: string
}

export function BdOnboardingDetailPage() {
  const { t } = useTranslation()
  const [statusForm] = Form.useForm<StatusFormValues>()
  const [docForm] = Form.useForm<DocUploadFormValues>()
  const navigate = useNavigate()
  const { caseId } = useParams<{ caseId: string }>()
  const { user, roles } = useAuth()

  const [loading, setLoading] = useState(true)
  const [statusSaving, setStatusSaving] = useState(false)
  const [docSaving, setDocSaving] = useState(false)
  const [reviewSaving, setReviewSaving] = useState(false)

  const [caseRow, setCaseRow] = useState<OnboardingCase | null>(null)
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [documents, setDocuments] = useState<OnboardingDocument[]>([])
  const [reviews, setReviews] = useState<OnboardingReview[]>([])
  const [statusLogs, setStatusLogs] = useState<OnboardingStatusLog[]>([])
  const [linkedProject, setLinkedProject] = useState<Project | null>(null)
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [docFileList, setDocFileList] = useState<UploadFile[]>([])

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<OnboardingDocument | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'>('APPROVED')
  const [reviewComment, setReviewComment] = useState('')

  const canReview = roles.includes('super_admin') || roles.includes('project_manager')

  const loadData = useCallback(async () => {
    if (!caseId) {
      return
    }

    setLoading(true)

    try {
      const [caseResult, stepRows, documentRows, reviewRows, logRows, users] = await Promise.all([
        getOnboardingCase(caseId),
        listOnboardingSteps(caseId),
        listOnboardingDocuments(caseId),
        listOnboardingReviews(caseId),
        listOnboardingStatusLogs(caseId),
        listActiveUsers(),
      ])

      setCaseRow(caseResult)
      setSteps(stepRows)
      setDocuments(documentRows)
      setReviews(reviewRows)
      setStatusLogs(logRows)
      setUserOptions(users)

      statusForm.setFieldsValue({
        to_status: caseResult.status,
      })

      const projectResult = await supabase
        .from('projects')
        .select('*')
        .eq('onboarding_case_id', caseResult.id)
        .maybeSingle<Project>()

      if (projectResult.error) {
        throw projectResult.error
      }

      setLinkedProject(projectResult.data ?? null)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load onboarding detail'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [caseId, statusForm])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handlePreviewDocument(row: OnboardingDocument) {
    if (!row.object_path) {
      return
    }

    try {
      const url = await createSignedFileUrl(row.object_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to preview document'
      message.error(text)
    }
  }

  async function handleUploadDocument(values: DocUploadFormValues) {
    if (!caseId || !user) {
      return
    }

    const file = docFileList[0]?.originFileObj

    if (!file) {
      message.warning(t('page.files.selectAtLeastOne', { defaultValue: 'Select at least one file' }))
      return
    }

    setDocSaving(true)

    try {
      const metadata = await uploadPrivateDocument(file, user.id)
      await submitOnboardingDocument({
        caseId,
        docType: values.doc_type,
        fileRecordId: metadata.id,
        fileName: metadata.file_name,
        objectPath: metadata.object_path,
      })
      message.success(t('page.onboarding.documentSubmitted', { defaultValue: 'Document submitted' }))
      setDocFileList([])
      docForm.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to submit document'
      message.error(text)
    } finally {
      setDocSaving(false)
    }
  }

  async function handleChangeStatus(values: StatusFormValues) {
    if (!caseId) {
      return
    }

    setStatusSaving(true)

    try {
      const result = await changeOnboardingStatus({
        caseId,
        toStatus: values.to_status,
        reason: values.reason,
        pmOwnerId: values.pm_owner_id,
      })
      message.success(t('page.onboarding.statusUpdated', { defaultValue: 'Onboarding status updated' }))
      await loadData()

      if (result.projectId) {
        message.info(`${t('page.onboarding.projectCreated', { defaultValue: 'Project created:' })} ${result.projectId}`)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to change status'
      message.error(text)
    } finally {
      setStatusSaving(false)
    }
  }

  function openReviewModal(row: OnboardingDocument) {
    setReviewTarget(row)
    setReviewDecision('APPROVED')
    setReviewComment('')
    setReviewModalOpen(true)
  }

  async function handleSubmitReview() {
    if (!caseId || !reviewTarget) {
      return
    }

    setReviewSaving(true)

    try {
      await reviewOnboardingDocument({
        caseId,
        documentId: reviewTarget.id,
        decision: reviewDecision,
        comment: reviewComment || undefined,
      })
      message.success(t('page.onboarding.reviewSubmitted', { defaultValue: 'Review submitted' }))
      setReviewModalOpen(false)
      setReviewTarget(null)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to submit review'
      message.error(text)
    } finally {
      setReviewSaving(false)
    }
  }

  const dropdownUserOptions = useMemo(() => {
    return userOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [userOptions])

  return (
    <>
      <PageTitleBar
        title={
          caseRow
            ? `${t('page.onboarding.detailTitle', { defaultValue: 'Onboarding Case' })} · ${caseRow.case_no}`
            : t('page.onboarding.detailTitle', { defaultValue: 'Onboarding Case' })
        }
        description={t('page.onboarding.detailDesc', {
          defaultValue: 'Manage onboarding documents, review loops, SLA progression, and downstream project handoff.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate('/app/bd/onboarding')}>{t('page.onboarding.backToList', { defaultValue: 'Back to List' })}</Button>
            <Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
            {linkedProject ? (
              <Button type="primary" onClick={() => navigate(`/app/bd/projects/${linkedProject.id}`)}>
                {t('page.onboarding.viewProject', { defaultValue: 'View Project' })}
              </Button>
            ) : null}
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {caseRow ? (
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, lg: 3 }}>
            <Descriptions.Item label={t('page.admin.caseNo', { defaultValue: 'Case No' })}>{caseRow.case_no}</Descriptions.Item>
            <Descriptions.Item label={t('page.common.status', { defaultValue: 'Status' })}>
              <StatusTag value={caseRow.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('page.admin.slaDue', { defaultValue: 'SLA Due' })}>
              {caseRow.sla_due_at ? new Date(caseRow.sla_due_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.onboarding.started', { defaultValue: 'Started' })}>{new Date(caseRow.started_at).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label={t('status.COMPLETED', { defaultValue: 'Completed' })}>
              {caseRow.completed_at ? new Date(caseRow.completed_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('page.onboarding.reviewer', { defaultValue: 'Reviewer' })}>{caseRow.reviewer_user_id ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('page.onboarding.remarks', { defaultValue: 'Remarks' })} span={3}>
              {caseRow.remarks ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        {linkedProject ? (
          <Alert
            className="mt-4"
            type="success"
            showIcon
            message={`${t('page.onboarding.linkedProjectCreated', { defaultValue: 'Linked project created:' })} ${linkedProject.project_code}`}
          />
        ) : null}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('page.onboarding.workflowSteps', { defaultValue: 'Workflow Steps' })}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={steps}
            columns={[
              { title: t('page.onboarding.order', { defaultValue: 'Order' }), dataIndex: 'step_order', width: 70 },
              { title: t('page.onboarding.step', { defaultValue: 'Step' }), dataIndex: 'step_name' },
              {
                title: t('page.common.status', { defaultValue: 'Status' }),
                dataIndex: 'status',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: t('page.onboarding.due', { defaultValue: 'Due' }),
                dataIndex: 'due_at',
                width: 170,
                render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
              },
            ]}
          />
        </Card>

        <Card title={t('page.onboarding.caseStatusTransition', { defaultValue: 'Case Status Transition' })}>
          <Form<StatusFormValues> form={statusForm} layout="vertical" onFinish={handleChangeStatus} requiredMark={false}>
            <Form.Item
              name="to_status"
              label={t('page.onboarding.targetStatus', { defaultValue: 'Target Status' })}
              rules={[{ required: true, message: t('page.onboarding.selectTargetStatus', { defaultValue: 'Select target status' }) }]}
            >
              <Select options={getOnboardingStatusOptions(t)} />
            </Form.Item>

            <Form.Item name="pm_owner_id" label={t('page.onboarding.pmOwner', { defaultValue: 'PM Owner (for completion -> project handoff)' })}>
              <Select allowClear options={dropdownUserOptions} placeholder={t('page.onboarding.optional', { defaultValue: 'Optional' })} />
            </Form.Item>

            <Form.Item name="reason" label={t('page.onboarding.reason', { defaultValue: 'Reason' })}>
              <Input.TextArea rows={3} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={statusSaving}>
              {t('page.onboarding.updateStatus', { defaultValue: 'Update Onboarding Status' })}
            </Button>
          </Form>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('page.onboarding.docSubmission', { defaultValue: 'Document Submission' })}>
          <Form<DocUploadFormValues> form={docForm} layout="vertical" onFinish={handleUploadDocument} requiredMark={false}>
            <Form.Item
              name="doc_type"
              label={t('page.onboarding.docType', { defaultValue: 'Document Type' })}
              rules={[{ required: true, message: t('page.onboarding.docTypeRequired', { defaultValue: 'Document type is required' }) }]}
            >
              <Input placeholder={t('page.onboarding.docPlaceholder', { defaultValue: 'Business license / Site layout / Contract appendix' })} />
            </Form.Item>

            <Upload
              maxCount={1}
              beforeUpload={() => false}
              fileList={docFileList}
              onChange={(info) => setDocFileList(info.fileList)}
              onRemove={(file) => {
                setDocFileList((current) => current.filter((item) => item.uid !== file.uid))
              }}
            >
              <Button>{t('page.leads.selectFiles', { defaultValue: 'Select Files' })}</Button>
            </Upload>

            <Button type="primary" className="mt-4" htmlType="submit" loading={docSaving}>
              {t('page.onboarding.submitDocument', { defaultValue: 'Submit Document' })}
            </Button>
          </Form>
        </Card>

        <Card title={t('page.onboarding.statusLogs', { defaultValue: 'Status Logs' })}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={statusLogs.slice(0, 10)}
            columns={[
              {
                title: t('page.logs.time', { defaultValue: 'Time' }),
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
            ]}
          />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('page.onboarding.documents', { defaultValue: 'Onboarding Documents' })}>
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            dataSource={documents}
            columns={[
              { title: t('page.files.fileType', { defaultValue: 'Type' }), dataIndex: 'doc_type', width: 180 },
              { title: t('page.files.fileName', { defaultValue: 'File' }), dataIndex: 'file_name', render: (value: string | null) => value ?? '-' },
              {
                title: t('page.onboarding.reviewStatus', { defaultValue: 'Review Status' }),
                dataIndex: 'review_status',
                width: 170,
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: t('page.common.actions', { defaultValue: 'Actions' }),
                width: 170,
                render: (_: unknown, row: OnboardingDocument) => (
                  <Space>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => void handlePreviewDocument(row)}
                      disabled={!row.object_path}
                    />
                    {canReview ? (
                      <Button size="small" onClick={() => openReviewModal(row)}>
                        {t('page.onboardingReview.review', { defaultValue: 'Review' })}
                      </Button>
                    ) : null}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card title={t('page.onboarding.reviewHistory', { defaultValue: 'Review History' })}>
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            dataSource={reviews}
            columns={[
              {
                title: t('page.onboarding.reviewedAt', { defaultValue: 'Reviewed At' }),
                dataIndex: 'reviewed_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              { title: t('page.onboarding.decision', { defaultValue: 'Decision' }), dataIndex: 'decision', width: 160, render: (value: string) => <StatusTag value={value} /> },
              { title: t('page.onboarding.comment', { defaultValue: 'Comment' }), dataIndex: 'comment', render: (value: string | null) => value ?? '-' },
            ]}
          />
        </Card>
      </div>

      <Modal
        title={t('page.onboarding.reviewDocument', { defaultValue: 'Review Document' })}
        open={reviewModalOpen}
        onCancel={() => {
          setReviewModalOpen(false)
          setReviewTarget(null)
        }}
        onOk={() => void handleSubmitReview()}
        okText={t('page.onboarding.submitReview', { defaultValue: 'Submit Review' })}
        confirmLoading={reviewSaving}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">
            {t('page.onboarding.documentLabel', { defaultValue: 'Document:' })} {reviewTarget?.doc_type ?? '-'}
          </p>
          <Select
            value={reviewDecision}
            onChange={(value) => setReviewDecision(value)}
            options={[
              { label: t('status.APPROVED', { defaultValue: 'Approved' }), value: 'APPROVED' },
              { label: t('status.REVISION_REQUIRED', { defaultValue: 'Revision Required' }), value: 'REVISION_REQUIRED' },
              { label: t('status.REJECTED', { defaultValue: 'Rejected' }), value: 'REJECTED' },
            ]}
          />
          <Input.TextArea
            rows={3}
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder={t('page.onboarding.reviewNotes', { defaultValue: 'Review notes' })}
          />
        </Space>
      </Modal>
    </>
  )
}
