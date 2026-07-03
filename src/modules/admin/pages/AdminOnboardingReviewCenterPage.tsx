import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import { ActionMenu } from '../../../components/common/ActionMenu'
import {
  useTranslation,
} from 'react-i18next'
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getOnboardingStatusOptions,
} from '../../../lib/business-constants'
import {
  createSignedFileUrl,
} from '../../../lib/supabase/storage'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import {
  listOnboardingCases,
  listOnboardingDocuments,
  reviewOnboardingCase,
  reviewOnboardingDocument,
  changeOnboardingStatus,
  type OnboardingFilters,
} from '../../onboarding/api'
import {
  downgradeLeadIntentLevelByReview,
  listHighIntentDowngradeCandidates,
  type LeadIntentDowngradeCandidate,
} from '../../leads/api'
import type {
  OnboardingCase,
  OnboardingDocument,
  OnboardingStatus,
} from '../../../types/business'

const ONBOARDING_STATUS_VALUES: OnboardingStatus[] = [
  'NOT_STARTED',
  'INFO_PENDING',
  'DOCUMENT_PENDING',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'CONTRACT_CONFIRMED',
  'SERVICE_ACTIVATING',
  'COMPLETED',
  'REJECTED',
]

function parseOnboardingFiltersFromSearch(searchParams: URLSearchParams): { filters: OnboardingFilters; keyword: string } {
  const statusParam = searchParams.get('status')
  const status = statusParam && ONBOARDING_STATUS_VALUES.includes(statusParam as OnboardingStatus) ? (statusParam as OnboardingStatus) : undefined
  const createdFrom = searchParams.get('createdFrom') ?? undefined
  const createdTo = searchParams.get('createdTo') ?? undefined
  const keyword = searchParams.get('q') ?? ''
  const activeOnly = searchParams.get('activeOnly') === '1'

  if (createdFrom || createdTo) {
    return {
      filters: {
        ...(status ? { status } : {}),
        ...(activeOnly ? { activeOnly: true } : {}),
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
      },
      keyword,
    }
  }

  if (status) {
    return {
      filters: { status },
      keyword,
    }
  }

  if (activeOnly) {
    return {
      filters: { activeOnly: true },
      keyword,
    }
  }

  return {
    filters: { status: 'UNDER_REVIEW' },
    keyword,
  }
}

function canTransitionTo(currentStatus: OnboardingStatus, targetStatus: OnboardingStatus): boolean {
  if (currentStatus === 'NOT_STARTED') {
    return targetStatus === 'INFO_PENDING' || targetStatus === 'REJECTED'
  }

  if (currentStatus === 'INFO_PENDING') {
    return targetStatus === 'DOCUMENT_PENDING' || targetStatus === 'REJECTED'
  }

  if (currentStatus === 'DOCUMENT_PENDING') {
    return targetStatus === 'UNDER_REVIEW' || targetStatus === 'REJECTED'
  }

  if (currentStatus === 'UNDER_REVIEW') {
    return targetStatus === 'REVISION_REQUIRED' || targetStatus === 'CONTRACT_CONFIRMED' || targetStatus === 'REJECTED'
  }

  if (currentStatus === 'REVISION_REQUIRED') {
    return targetStatus === 'DOCUMENT_PENDING' || targetStatus === 'REJECTED'
  }

  if (currentStatus === 'CONTRACT_CONFIRMED') {
    return targetStatus === 'SERVICE_ACTIVATING' || targetStatus === 'REJECTED'
  }

  if (currentStatus === 'SERVICE_ACTIVATING') {
    return targetStatus === 'COMPLETED' || targetStatus === 'REJECTED'
  }

  return false
}

function canCompleteCaseReview(currentStatus: OnboardingStatus): boolean {
  return currentStatus === 'NOT_STARTED' ||
    currentStatus === 'INFO_PENDING' ||
    currentStatus === 'DOCUMENT_PENDING' ||
    currentStatus === 'UNDER_REVIEW' ||
    currentStatus === 'REVISION_REQUIRED'
}

export function AdminOnboardingReviewCenterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [leadReviewLoading, setLeadReviewLoading] = useState(false)
  const [rows, setRows] = useState<OnboardingCase[]>([])
  const [leadReviewRows, setLeadReviewRows] = useState<LeadIntentDowngradeCandidate[]>([])
  const [documentsByCase, setDocumentsByCase] = useState<Record<string, OnboardingDocument[]>>({})
  const [filters, setFilters] = useState<OnboardingFilters>(() => parseOnboardingFiltersFromSearch(searchParams).filters)
  const [keyword, setKeyword] = useState(() => parseOnboardingFiltersFromSearch(searchParams).keyword)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<OnboardingCase | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [onboardingRows, candidateRows] = await Promise.all([
        listOnboardingCases({
          ...filters,
          keyword: keyword.trim() || undefined,
        }),
        listHighIntentDowngradeCandidates(14),
      ])

      setRows(onboardingRows)
      setLeadReviewRows(candidateRows)

      const map: Record<string, OnboardingDocument[]> = {}
      await Promise.all(
        onboardingRows.map(async (row) => {
          const docs = await listOnboardingDocuments(row.id)
          map[row.id] = docs
        }),
      )
      setDocumentsByCase(map)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load onboarding review center'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const parsed = parseOnboardingFiltersFromSearch(searchParams)
    setFilters((current) => (JSON.stringify(current) === JSON.stringify(parsed.filters) ? current : parsed.filters))
    setKeyword((current) => (current === parsed.keyword ? current : parsed.keyword))
  }, [searchParams])

  async function ensureCaseUnderReview(caseId: string, currentStatus: OnboardingStatus): Promise<OnboardingStatus> {
    let status = currentStatus

    if (status === 'UNDER_REVIEW') {
      return status
    }

    if (status === 'NOT_STARTED' && canTransitionTo(status, 'INFO_PENDING')) {
      await changeOnboardingStatus({
        caseId,
        toStatus: 'INFO_PENDING',
        reason: 'Auto-progressed by admin review center to start case review',
      })
      status = 'INFO_PENDING'
    }

    if (status === 'INFO_PENDING' && canTransitionTo(status, 'DOCUMENT_PENDING')) {
      await changeOnboardingStatus({
        caseId,
        toStatus: 'DOCUMENT_PENDING',
        reason: 'Auto-progressed by admin review center to start document review',
      })
      status = 'DOCUMENT_PENDING'
    }

    if (status === 'REVISION_REQUIRED' && canTransitionTo(status, 'DOCUMENT_PENDING')) {
      await changeOnboardingStatus({
        caseId,
        toStatus: 'DOCUMENT_PENDING',
        reason: 'Auto-progressed by admin review center to continue review cycle',
      })
      status = 'DOCUMENT_PENDING'
    }

    if (status === 'DOCUMENT_PENDING' && canTransitionTo(status, 'UNDER_REVIEW')) {
      await changeOnboardingStatus({
        caseId,
        toStatus: 'UNDER_REVIEW',
        reason: 'Auto-progressed by admin review center to perform review',
      })
      status = 'UNDER_REVIEW'
    }

    return status
  }

  async function handleCaseReview(decision: 'APPROVED' | 'REJECTED') {
    if (!selectedCase) {
      return
    }

    setReviewLoading(true)

    try {
      let currentStatus = selectedCase.status
      const pendingDocs = selectedDocs.filter((item) => item.review_status === 'PENDING')
      const comment = decision === 'APPROVED'
        ? 'Admin case-level review completed'
        : 'Admin case-level review rejected'

      if (decision === 'APPROVED') {
        currentStatus = await ensureCaseUnderReview(selectedCase.id, currentStatus)

        if (pendingDocs.length > 0) {
          await Promise.all(
            pendingDocs.map((doc) =>
              reviewOnboardingDocument({
                caseId: selectedCase.id,
                documentId: doc.id,
                decision: 'APPROVED',
                comment,
              }),
            ),
          )
        } else {
          await reviewOnboardingCase({
            caseId: selectedCase.id,
            decision,
            comment,
          })
        }

        if (canTransitionTo(currentStatus, 'CONTRACT_CONFIRMED')) {
          await changeOnboardingStatus({
            caseId: selectedCase.id,
            toStatus: 'CONTRACT_CONFIRMED',
            reason: 'Case review completed by admin review center',
          })
        }
      } else {
        if (pendingDocs.length > 0) {
          await Promise.all(
            pendingDocs.map((doc) =>
              reviewOnboardingDocument({
                caseId: selectedCase.id,
                documentId: doc.id,
                decision: 'REJECTED',
                comment,
              }),
            ),
          )
        } else {
          await reviewOnboardingCase({
            caseId: selectedCase.id,
            decision,
            comment,
          })
        }

        if (canTransitionTo(currentStatus, 'REJECTED')) {
          await changeOnboardingStatus({
            caseId: selectedCase.id,
            toStatus: 'REJECTED',
            reason: 'Case review rejected by admin review center',
          })
        }
      }

      message.success(
        decision === 'APPROVED'
          ? t('pages.adminOnboardingReview.caseReviewCompleted', { defaultValue: 'Case review completed' })
          : t('pages.adminOnboardingReview.caseReviewRejected', { defaultValue: 'Case review rejected' }),
      )
      setRows((current) => current.filter((item) => item.id !== selectedCase.id))
      setDrawerOpen(false)
      setSelectedCase(null)
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminOnboardingReview.caseReviewFail', { defaultValue: 'Failed to submit case review' })
      message.error(text)
    } finally {
      setReviewLoading(false)
    }
  }

  async function handlePreviewDocument(row: OnboardingDocument) {
    if (!row.object_path) {
      message.warning(t('pages.adminOnboardingReview.fileMissing', { defaultValue: 'This document has no file attached' }))
      return
    }

    try {
      const url = await createSignedFileUrl(row.object_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminOnboardingReview.previewFail', { defaultValue: 'Failed to preview file' })
      message.error(text)
    }
  }

  async function handleDocumentReview(row: OnboardingDocument, decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED') {
    if (!selectedCase) {
      return
    }

    setReviewLoading(true)

    try {
      let currentStatus = selectedCase.status

      if (decision === 'APPROVED' || decision === 'REVISION_REQUIRED') {
        currentStatus = await ensureCaseUnderReview(selectedCase.id, currentStatus)
      }

      await reviewOnboardingDocument({
        caseId: selectedCase.id,
        documentId: row.id,
        decision,
        comment: `Admin review decision: ${decision}${decision === 'REVISION_REQUIRED' ? ' (request supplemental files)' : ''}`,
      })

      if (decision === 'APPROVED') {
        if (canTransitionTo(currentStatus, 'CONTRACT_CONFIRMED')) {
          await changeOnboardingStatus({
            caseId: selectedCase.id,
            toStatus: 'CONTRACT_CONFIRMED',
            reason: 'Documents approved by admin review center',
          })
        }
      } else if (decision === 'REVISION_REQUIRED') {
        if (canTransitionTo(currentStatus, 'REVISION_REQUIRED')) {
          await changeOnboardingStatus({
            caseId: selectedCase.id,
            toStatus: 'REVISION_REQUIRED',
            reason: 'Supplemental files requested by admin review center',
          })
        }
      } else if (decision === 'REJECTED') {
        if (canTransitionTo(currentStatus, 'REJECTED')) {
          await changeOnboardingStatus({
            caseId: selectedCase.id,
            toStatus: 'REJECTED',
            reason: 'Rejected in admin review center',
          })
        }
      }

      message.success(t('pages.adminOnboardingReview.reviewSubmitted', { defaultValue: 'Review decision submitted' }))
      setDrawerOpen(false)
      setSelectedCase(null)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to submit review decision'
      message.error(text)
    } finally {
      setReviewLoading(false)
    }
  }

  async function handleDowngradeLeadIntent(row: LeadIntentDowngradeCandidate) {
    setLeadReviewLoading(true)
    try {
      await downgradeLeadIntentLevelByReview(row.id, 3)
      message.success(t('pages.adminOnboardingReview.leadIntentDowngradeSuccess', { defaultValue: 'Lead intent level downgraded' }))
      setLeadReviewRows((current) => current.filter((item) => item.id !== row.id))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminOnboardingReview.leadIntentDowngradeFail', { defaultValue: 'Failed to downgrade lead intent level' })
      message.error(text)
    } finally {
      setLeadReviewLoading(false)
    }
  }

  const selectedDocs = useMemo(() => {
    if (!selectedCase) {
      return []
    }

    return documentsByCase[selectedCase.id] ?? []
  }, [documentsByCase, selectedCase])

  const selectedPendingDocsCount = useMemo(
    () => selectedDocs.filter((item) => item.review_status === 'PENDING').length,
    [selectedDocs],
  )

  return (
    <>
      <PageTitleBar
        title={t('pages.adminOnboardingReview.title', { defaultValue: 'Onboarding Review Center' })}
        description={t('pages.adminOnboardingReview.description', {
          defaultValue: 'Central queue for compliance checks, document approval decisions, and revision control.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <div className="mb-4 rounded-xl border app-border app-surface p-3">
        <Space size={8} wrap>
          <Select
            allowClear
            placeholder={t('pages.adminOnboardingReview.statusPlaceholder', { defaultValue: 'Status' })}
            style={{ width: 220 }}
            options={getOnboardingStatusOptions(t)}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminOnboardingReview.createdFrom', { defaultValue: 'Created From' })}
            value={filters.createdFrom ? dayjs(filters.createdFrom) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdFrom: value ? value.startOf('day').toISOString() : undefined,
              }))
            }
          />
          <DatePicker
            style={{ width: 170 }}
            placeholder={t('pages.adminOnboardingReview.createdTo', { defaultValue: 'Created To' })}
            value={filters.createdTo ? dayjs(filters.createdTo) : undefined}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                createdTo: value ? value.endOf('day').toISOString() : undefined,
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder={t('pages.adminOnboardingReview.caseKeyword', { defaultValue: 'Case no.' })}
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
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('pages.adminOnboardingReview.columns.caseNo', { defaultValue: 'Case No' }), dataIndex: 'case_no', width: 190 },
          {
            title: t('pages.adminOnboardingReview.columns.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 160,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('pages.adminOnboardingReview.columns.pendingDocs', { defaultValue: 'Pending Docs' }),
            key: 'pending_docs',
            width: 130,
            render: (_: unknown, row: OnboardingCase) => {
              const docs = documentsByCase[row.id] ?? []
              const pending = docs.filter((item) => item.review_status === 'PENDING').length
              return <Tag color={pending > 0 ? 'orange' : 'green'}>{pending}</Tag>
            },
          },
          {
            title: t('pages.adminOnboardingReview.columns.slaDue', { defaultValue: 'SLA Due' }),
            dataIndex: 'sla_due_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: t('pages.adminOnboardingReview.columns.actions', { defaultValue: 'Actions' }),
            width: 120,
            render: (_: unknown, row: OnboardingCase) => (
              <Button size="small" onClick={() => {
                setSelectedCase(row)
                setDrawerOpen(true)
              }}>
                {t('pages.adminOnboardingReview.review', { defaultValue: 'Review' })}
              </Button>
            ),
          },
        ]}
      />

      <Card
        className="mt-5"
        title={t('pages.adminOnboardingReview.leadIntentQueueTitle', { defaultValue: 'Lead Intent Adjustment Review' })}
        extra={
          <Typography.Text type="secondary">
            {t('pages.adminOnboardingReview.leadIntentQueueHint', { defaultValue: 'High intent BCS leads idle for 14+ days' })}
          </Typography.Text>
        }
      >
        <Table
          rowKey="id"
          bordered
          loading={loading || leadReviewLoading}
          dataSource={leadReviewRows}
          pagination={{ pageSize: 8 }}
          locale={{
            emptyText: t('pages.adminOnboardingReview.leadIntentQueueEmpty', {
              defaultValue: 'No high intent leads pending downgrade review',
            }),
          }}
          columns={[
            {
              title: t('pages.adminOnboardingReview.columns.leadCode', { defaultValue: 'Lead Code' }),
              dataIndex: 'lead_code',
              width: 180,
            },
            {
              title: t('pages.adminOnboardingReview.columns.company', { defaultValue: 'Company' }),
              dataIndex: 'company_name',
            },
            {
              title: t('pages.adminOnboardingReview.columns.intentLevel', { defaultValue: 'Intent Level' }),
              dataIndex: 'intent_level',
              width: 140,
              render: (value: number | null) => (value === null ? '-' : `H${value}`),
            },
            {
              title: t('pages.adminOnboardingReview.columns.staleDays', { defaultValue: 'Idle Days' }),
              dataIndex: 'staleDays',
              width: 140,
            },
            {
              title: t('pages.adminOnboardingReview.columns.actions', { defaultValue: 'Actions' }),
              width: 130,
              render: (_: unknown, row: LeadIntentDowngradeCandidate) => (
                <ActionMenu
                  primaryLabel={t('pages.adminOnboardingReview.openLead', { defaultValue: 'Open Lead' })}
                  primaryOnClick={() => {
                    const backPath = `${location.pathname}${location.search}`
                    navigate(`/app/bd/leads/${row.id}?back=${encodeURIComponent(backPath)}`)
                  }}
                  items={[
                    {
                      key: 'downgrade',
                      label: t('pages.adminOnboardingReview.downgradeToLowIntent', { defaultValue: 'Downgrade to H3' }),
                      onClick: () => void handleDowngradeLeadIntent(row),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={
          selectedCase
            ? `${t('pages.adminOnboardingReview.reviewCase', { defaultValue: 'Review Case' })} ${selectedCase.case_no}`
            : t('pages.adminOnboardingReview.reviewCase', { defaultValue: 'Review Case' })
        }
        open={drawerOpen}
        styles={{ wrapper: { width: 760 } }}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedCase(null)
        }}
      >
        <div className="mb-4 rounded-lg border app-border p-3" style={{ backgroundColor: 'var(--app-surface-muted)' }}>
          <Typography.Text className="block text-sm app-text-soft">
            {t('pages.adminOnboardingReview.currentStatus', { defaultValue: 'Current Status' })}:{' '}
            <strong>{selectedCase?.status ?? '-'}</strong>
          </Typography.Text>
          <Typography.Text className="mt-1 block text-sm app-text-soft">
            {t('pages.adminOnboardingReview.pendingDocsCount', { defaultValue: 'Pending Documents' })}: {selectedPendingDocsCount}
          </Typography.Text>
        </div>

        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-800/50 dark:bg-blue-950/40">
          <Typography.Text className="block text-sm app-text-soft">
            {selectedDocs.length === 0
              ? t('pages.adminOnboardingReview.noDocumentsCaseReviewHint', {
                  defaultValue: 'No documents are attached. You can still complete or reject this case review directly.',
                })
              : t('pages.adminOnboardingReview.caseReviewHint', {
                  defaultValue: 'Complete or reject the whole case. Pending documents will be updated with the same decision.',
                })}
          </Typography.Text>
          <Space className="mt-3" wrap>
            <Button
              type="primary"
              loading={reviewLoading}
              disabled={!selectedCase || !canCompleteCaseReview(selectedCase.status)}
              onClick={() => void handleCaseReview('APPROVED')}
            >
              {t('pages.adminOnboardingReview.completeCaseReview', { defaultValue: 'Complete Review' })}
            </Button>
            <Button
              danger
              loading={reviewLoading}
              disabled={!selectedCase || !canTransitionTo(selectedCase.status, 'REJECTED')}
              onClick={() => void handleCaseReview('REJECTED')}
            >
              {t('pages.adminOnboardingReview.rejectCaseReview', { defaultValue: 'Reject Review' })}
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={reviewLoading}
          bordered
          dataSource={selectedDocs}
          pagination={{ pageSize: 8 }}
          locale={{
            emptyText: t('pages.adminOnboardingReview.noDocuments', {
              defaultValue: 'No documents attached. Use the case-level review actions above.',
            }),
          }}
          columns={[
            { title: t('pages.adminOnboardingReview.columns.documentType', { defaultValue: 'Document Type' }), dataIndex: 'doc_type' },
            {
              title: t('pages.adminOnboardingReview.columns.fileName', { defaultValue: 'File Name' }),
              dataIndex: 'file_name',
              render: (value: string | null) => value ?? '-',
            },
            {
              title: t('pages.adminOnboardingReview.columns.reviewStatus', { defaultValue: 'Review Status' }),
              dataIndex: 'review_status',
              width: 160,
              render: (value: string) => <StatusTag value={value} />,
            },
            {
              title: t('pages.adminOnboardingReview.columns.actions', { defaultValue: 'Actions' }),
              width: 130,
              render: (_: unknown, row: OnboardingDocument) => (
                <ActionMenu
                  primaryLabel={t('pages.adminOnboardingReview.preview', { defaultValue: 'Preview' })}
                  primaryOnClick={() => void handlePreviewDocument(row)}
                  items={[
                    {
                      key: 'approve',
                      label: t('pages.adminOnboardingReview.approve', { defaultValue: 'Approve' }),
                      disabled: row.review_status !== 'PENDING',
                      onClick: () => void handleDocumentReview(row, 'APPROVED'),
                    },
                    {
                      key: 'revise',
                      label: t('pages.adminOnboardingReview.revise', { defaultValue: 'Request Files' }),
                      disabled: row.review_status !== 'PENDING',
                      onClick: () => void handleDocumentReview(row, 'REVISION_REQUIRED'),
                    },
                    {
                      key: 'reject',
                      label: t('pages.adminOnboardingReview.reject', { defaultValue: 'Reject' }),
                      danger: true,
                      disabled: row.review_status !== 'PENDING',
                      onClick: () => void handleDocumentReview(row, 'REJECTED'),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Drawer>
    </>
  )
}
