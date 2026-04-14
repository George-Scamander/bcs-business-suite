import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Table, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { LEAD_STATUS_OPTIONS, LOST_REASON_OPTIONS } from '../../../lib/business-constants'
import { changeLeadStatus, getLeadById, listLeadStatusLogs } from '../api'
import { StatusTag } from '../../../components/common/StatusTag'
import type { Lead, LeadStatus, LeadStatusLog } from '../../../types/business'

interface StatusFormValues {
  to_status: LeadStatus
  reason?: string
  lost_reason_code?: string
  contract_no?: string
  contract_date?: dayjs.Dayjs
  contract_value?: number
}

export function LeadStatusChangePage() {
  const [form] = Form.useForm<StatusFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()

  const [lead, setLead] = useState<Lead | null>(null)
  const [statusLogs, setStatusLogs] = useState<LeadStatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSignedRecordId, setLastSignedRecordId] = useState<string | null>(null)

  const toStatus = Form.useWatch('to_status', form)

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, logs] = await Promise.all([getLeadById(leadId), listLeadStatusLogs(leadId)])
      setLead(leadResult)
      setStatusLogs(logs)
      setLastSignedRecordId(null)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load status data'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSubmit(values: StatusFormValues) {
    if (!leadId) {
      return
    }

    setSaving(true)

    try {
      const result = await changeLeadStatus({
        leadId,
        toStatus: values.to_status,
        reason: values.reason,
        lostReasonCode: values.lost_reason_code,
        contractNo: values.contract_no,
        contractDate: values.contract_date ? values.contract_date.format('YYYY-MM-DD') : undefined,
        contractValue: values.contract_value,
      })

      setLastSignedRecordId(result.signedRecordId)
      message.success('Lead status updated')
      form.resetFields(['reason', 'lost_reason_code', 'contract_no', 'contract_date', 'contract_value'])
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to change lead status'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={lead ? `Lead Status · ${lead.lead_code}` : 'Lead Status'}
        description="Apply governed state transitions with mandatory reasons and conversion-ready contract info."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {lead ? (
          <div className="mb-3 text-sm text-slate-600">
            Current status: <StatusTag value={lead.status} />
          </div>
        ) : null}

        {lastSignedRecordId ? (
          <Alert
            type="success"
            showIcon
            className="mb-4"
            message={`Signed record created: ${lastSignedRecordId}`}
            description="You can now start onboarding from the onboarding initiation page."
          />
        ) : null}

        <Form<StatusFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Form.Item name="to_status" label="Target Status" rules={[{ required: true, message: 'Select target status' }]}>
              <Select options={LEAD_STATUS_OPTIONS} placeholder="Select target status" />
            </Form.Item>

            <Form.Item name="lost_reason_code" label="Lost Reason" hidden={toStatus !== 'LOST'}>
              <Select options={LOST_REASON_OPTIONS} allowClear />
            </Form.Item>

            <Form.Item name="contract_no" label="Contract No." hidden={toStatus !== 'SIGNED'} rules={toStatus === 'SIGNED' ? [{ required: true, message: 'Contract no. is required' }] : []}>
              <Input placeholder="BCS-ID-2026-001" />
            </Form.Item>

            <Form.Item name="contract_date" label="Contract Date" hidden={toStatus !== 'SIGNED'}>
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="contract_value" label="Contract Value" hidden={toStatus !== 'SIGNED'}>
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Provide context for this transition." />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            Update Status
          </Button>
        </Form>
      </Card>

      <Table
        rowKey="id"
        bordered
        dataSource={statusLogs}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: 'Changed At',
            dataIndex: 'changed_at',
            width: 190,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: 'From',
            dataIndex: 'from_status',
            width: 150,
            render: (value: string | null) => (value ? <StatusTag value={value} /> : '-'),
          },
          {
            title: 'To',
            dataIndex: 'to_status',
            width: 150,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Reason',
            dataIndex: 'reason',
            render: (value: string | null) => value ?? '-',
          },
        ]}
      />
    </>
  )
}
