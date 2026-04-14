import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Form, Input, Select, Space, Table, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { FOLLOWUP_TYPE_OPTIONS } from '../../../lib/business-constants'
import { addFollowup, getLeadById, listLeadFollowups } from '../api'
import type { Lead, LeadFollowup } from '../../../types/business'

interface FollowupFormValues {
  followup_type: string
  summary: string
  followup_at?: dayjs.Dayjs
  next_followup_at?: dayjs.Dayjs
}

export function LeadFollowupTimelinePage() {
  const [form] = Form.useForm<FollowupFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()

  const [lead, setLead] = useState<Lead | null>(null)
  const [rows, setRows] = useState<LeadFollowup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, followups] = await Promise.all([getLeadById(leadId), listLeadFollowups(leadId)])
      setLead(leadResult)
      setRows(followups)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load timeline'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSubmit(values: FollowupFormValues) {
    if (!leadId) {
      return
    }

    setSaving(true)

    try {
      await addFollowup({
        leadId,
        followupType: values.followup_type,
        summary: values.summary,
        followupAt: values.followup_at ? values.followup_at.toISOString() : undefined,
        nextFollowupAt: values.next_followup_at ? values.next_followup_at.toISOString() : undefined,
      })

      message.success('Follow-up recorded')
      form.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to add follow-up'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={lead ? `Follow-up Timeline · ${lead.lead_code}` : 'Follow-up Timeline'}
        description="Track each touchpoint from cold visit to closing conversation with full time sequence."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card className="mb-5">
        <Form<FollowupFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Form.Item
              name="followup_type"
              label="Follow-up Type"
              rules={[{ required: true, message: 'Follow-up type is required' }]}
            >
              <Select options={FOLLOWUP_TYPE_OPTIONS} placeholder="Select type" />
            </Form.Item>

            <Form.Item name="followup_at" label="Follow-up Time">
              <DatePicker showTime className="w-full" />
            </Form.Item>

            <Form.Item name="next_followup_at" label="Next Follow-up Time">
              <DatePicker showTime className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="summary" label="Summary" rules={[{ required: true, message: 'Summary is required' }]}>
            <Input.TextArea rows={3} placeholder="Discussed workshop fit-out scope and investment willingness." />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            Add Follow-up
          </Button>
        </Form>
      </Card>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: 'Follow-up Time',
            dataIndex: 'followup_at',
            width: 200,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          { title: 'Type', dataIndex: 'followup_type', width: 130 },
          { title: 'Summary', dataIndex: 'summary' },
          {
            title: 'Next Follow-up',
            dataIndex: 'next_followup_at',
            width: 200,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
