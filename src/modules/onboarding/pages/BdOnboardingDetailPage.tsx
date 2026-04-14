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
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { ONBOARDING_STATUS_OPTIONS } from '../../../lib/business-constants'
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
      message.warning('Please select a file')
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
      message.success('Document submitted')
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
      message.success('Onboarding status updated')
      await loadData()

      if (result.projectId) {
        message.info(`Project created: ${result.projectId}`)
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
      message.success('Review submitted')
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
        title={caseRow ? `Onboarding Case · ${caseRow.case_no}` : 'Onboarding Case'}
        description="Manage onboarding documents, review loops, SLA progression, and downstream project handoff."
        extra={
          <Space>
            <Button onClick={() => navigate('/app/bd/onboarding')}>Back to List</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
            {linkedProject ? (
              <Button type="primary" onClick={() => navigate(`/app/bd/projects/${linkedProject.id}`)}>
                View Project
              </Button>
            ) : null}
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {caseRow ? (
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, lg: 3 }}>
            <Descriptions.Item label="Case No.">{caseRow.case_no}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <StatusTag value={caseRow.status} />
            </Descriptions.Item>
            <Descriptions.Item label="SLA Due">{caseRow.sla_due_at ? new Date(caseRow.sla_due_at).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Started">{new Date(caseRow.started_at).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Completed">{caseRow.completed_at ? new Date(caseRow.completed_at).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Reviewer">{caseRow.reviewer_user_id ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Remarks" span={3}>
              {caseRow.remarks ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        {linkedProject ? (
          <Alert
            className="mt-4"
            type="success"
            showIcon
            message={`Linked project created: ${linkedProject.project_code}`}
          />
        ) : null}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Workflow Steps">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={steps}
            columns={[
              { title: 'Order', dataIndex: 'step_order', width: 70 },
              { title: 'Step', dataIndex: 'step_name' },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: 'Due',
                dataIndex: 'due_at',
                width: 170,
                render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
              },
            ]}
          />
        </Card>

        <Card title="Case Status Transition">
          <Form<StatusFormValues> form={statusForm} layout="vertical" onFinish={handleChangeStatus} requiredMark={false}>
            <Form.Item name="to_status" label="Target Status" rules={[{ required: true, message: 'Select target status' }]}>
              <Select options={ONBOARDING_STATUS_OPTIONS} />
            </Form.Item>

            <Form.Item name="pm_owner_id" label="PM Owner (for completion -> project handoff)">
              <Select allowClear options={dropdownUserOptions} placeholder="Optional" />
            </Form.Item>

            <Form.Item name="reason" label="Reason">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={statusSaving}>
              Update Onboarding Status
            </Button>
          </Form>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Document Submission">
          <Form<DocUploadFormValues> form={docForm} layout="vertical" onFinish={handleUploadDocument} requiredMark={false}>
            <Form.Item name="doc_type" label="Document Type" rules={[{ required: true, message: 'Document type is required' }]}>
              <Input placeholder="Business license / Site layout / Contract appendix" />
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
              <Button>Select File</Button>
            </Upload>

            <Button type="primary" className="mt-4" htmlType="submit" loading={docSaving}>
              Submit Document
            </Button>
          </Form>
        </Card>

        <Card title="Status Logs">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={statusLogs.slice(0, 10)}
            columns={[
              {
                title: 'Time',
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
            ]}
          />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Onboarding Documents">
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            dataSource={documents}
            columns={[
              { title: 'Type', dataIndex: 'doc_type', width: 180 },
              { title: 'File', dataIndex: 'file_name', render: (value: string | null) => value ?? '-' },
              {
                title: 'Review Status',
                dataIndex: 'review_status',
                width: 170,
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: 'Actions',
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
                        Review
                      </Button>
                    ) : null}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Review History">
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            dataSource={reviews}
            columns={[
              {
                title: 'Reviewed At',
                dataIndex: 'reviewed_at',
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              { title: 'Decision', dataIndex: 'decision', width: 160, render: (value: string) => <StatusTag value={value} /> },
              { title: 'Comment', dataIndex: 'comment', render: (value: string | null) => value ?? '-' },
            ]}
          />
        </Card>
      </div>

      <Modal
        title="Review Document"
        open={reviewModalOpen}
        onCancel={() => {
          setReviewModalOpen(false)
          setReviewTarget(null)
        }}
        onOk={() => void handleSubmitReview()}
        okText="Submit Review"
        confirmLoading={reviewSaving}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">Document: {reviewTarget?.doc_type ?? '-'}</p>
          <Select
            value={reviewDecision}
            onChange={(value) => setReviewDecision(value)}
            options={[
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Revision Required', value: 'REVISION_REQUIRED' },
              { label: 'Rejected', value: 'REJECTED' },
            ]}
          />
          <Input.TextArea
            rows={3}
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder="Review notes"
          />
        </Space>
      </Modal>
    </>
  )
}
