import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { ONBOARDING_STATUS_OPTIONS } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import {
  listOnboardingCases,
  listOnboardingDocuments,
  reviewOnboardingDocument,
  changeOnboardingStatus,
  type OnboardingFilters,
} from '../../onboarding/api'
import type { OnboardingCase, OnboardingDocument } from '../../../types/business'

export function AdminOnboardingReviewCenterPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OnboardingCase[]>([])
  const [documentsByCase, setDocumentsByCase] = useState<Record<string, OnboardingDocument[]>>({})
  const [filters, setFilters] = useState<OnboardingFilters>({
    status: 'UNDER_REVIEW',
  })
  const [keyword, setKeyword] = useState('')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<OnboardingCase | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const onboardingRows = await listOnboardingCases({
        ...filters,
        keyword: keyword.trim() || undefined,
      })

      setRows(onboardingRows)

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

  async function handleDocumentReview(documentId: string, caseId: string, decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED') {
    setReviewLoading(true)

    try {
      await reviewOnboardingDocument({
        caseId,
        documentId,
        decision,
        comment: `Admin review decision: ${decision}`,
      })

      if (decision === 'APPROVED') {
        await changeOnboardingStatus({
          caseId,
          toStatus: 'CONTRACT_CONFIRMED',
          reason: 'Documents approved by admin review center',
        })
      } else if (decision === 'REVISION_REQUIRED') {
        await changeOnboardingStatus({
          caseId,
          toStatus: 'REVISION_REQUIRED',
          reason: 'Revision requested by admin review center',
        })
      } else if (decision === 'REJECTED') {
        await changeOnboardingStatus({
          caseId,
          toStatus: 'REJECTED',
          reason: 'Rejected in admin review center',
        })
      }

      message.success('Review decision submitted')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to submit review decision'
      message.error(text)
    } finally {
      setReviewLoading(false)
    }
  }

  const selectedDocs = useMemo(() => {
    if (!selectedCase) {
      return []
    }

    return documentsByCase[selectedCase.id] ?? []
  }, [documentsByCase, selectedCase])

  return (
    <>
      <PageTitleBar
        title="Onboarding Review Center"
        description="Central queue for compliance checks, document approval decisions, and revision control."
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
            placeholder="Case no."
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
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'Case No', dataIndex: 'case_no', width: 190 },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 160,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Pending Docs',
            key: 'pending_docs',
            width: 130,
            render: (_: unknown, row: OnboardingCase) => {
              const docs = documentsByCase[row.id] ?? []
              const pending = docs.filter((item) => item.review_status === 'PENDING').length
              return <Tag color={pending > 0 ? 'orange' : 'green'}>{pending}</Tag>
            },
          },
          {
            title: 'SLA Due',
            dataIndex: 'sla_due_at',
            width: 190,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: 'Action',
            width: 120,
            render: (_: unknown, row: OnboardingCase) => (
              <Button size="small" onClick={() => {
                setSelectedCase(row)
                setDrawerOpen(true)
              }}>
                Review
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title={selectedCase ? `Review Case ${selectedCase.case_no}` : 'Review Case'}
        open={drawerOpen}
        width={760}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedCase(null)
        }}
      >
        <Table
          rowKey="id"
          loading={reviewLoading}
          bordered
          dataSource={selectedDocs}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Document Type', dataIndex: 'doc_type' },
            { title: 'File Name', dataIndex: 'file_name', render: (value: string | null) => value ?? '-' },
            {
              title: 'Review Status',
              dataIndex: 'review_status',
              width: 160,
              render: (value: string) => <StatusTag value={value} />,
            },
            {
              title: 'Actions',
              width: 260,
              render: (_: unknown, row: OnboardingDocument) => (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => void handleDocumentReview(row.id, row.onboarding_case_id, 'APPROVED')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    onClick={() => void handleDocumentReview(row.id, row.onboarding_case_id, 'REVISION_REQUIRED')}
                  >
                    Revise
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => void handleDocumentReview(row.id, row.onboarding_case_id, 'REJECTED')}
                  >
                    Reject
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Drawer>
    </>
  )
}
