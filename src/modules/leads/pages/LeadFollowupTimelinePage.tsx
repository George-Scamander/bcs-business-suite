import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Form, Input, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getFollowupTypeOptions, getNextFollowupArrangementOptions } from '../../../lib/business-constants'
import { addFollowup, getLeadById, listLeadFollowups } from '../api'
import type { Lead, LeadFollowup } from '../../../types/business'

interface FollowupFormValues {
  followup_type: string
  summary: string
  followup_at?: dayjs.Dayjs
  arrange_next_followup?: 'YES' | 'NO'
  next_followup_at?: dayjs.Dayjs
  bd_notes?: string
  team_attention_note?: string
}

export function LeadFollowupTimelinePage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<FollowupFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()

  const [lead, setLead] = useState<Lead | null>(null)
  const [rows, setRows] = useState<LeadFollowup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const arrangeNextFollowup = Form.useWatch('arrange_next_followup', form)

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, followups] = await Promise.all([getLeadById(leadId), listLeadFollowups(leadId)])
      setLead(leadResult)
      setRows(followups)
      form.setFieldsValue({
        arrange_next_followup: leadResult.next_followup_at ? 'YES' : 'NO',
        bd_notes: leadResult.bd_notes ?? undefined,
        team_attention_note: leadResult.team_attention_note ?? undefined,
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load timeline'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [form, leadId])

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
        nextFollowupAt:
          values.arrange_next_followup === 'YES' && values.next_followup_at
            ? values.next_followup_at.toISOString()
            : undefined,
        bdNotes: values.bd_notes,
        teamAttentionNote: values.team_attention_note,
      })

      message.success(t('page.leads.followupRecorded', { defaultValue: 'Follow-up recorded' }))
      form.resetFields(['summary', 'followup_type', 'followup_at', 'arrange_next_followup', 'next_followup_at'])
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
        title={lead ? `${t('page.leads.followupTimeline', { defaultValue: 'Follow-up Timeline' })} · ${lead.lead_code}` : t('page.leads.followupTimeline', { defaultValue: 'Follow-up Timeline' })}
        description={t('page.leads.followupDesc', {
          defaultValue: 'Track each touchpoint and keep shared notes synchronized for all members.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>{t('page.leads.backToDetail', { defaultValue: 'Back to Detail' })}</Button>
            <Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <Card className="mb-5">
        <Form<FollowupFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Form.Item
              name="followup_type"
              label={t('page.leads.followupType', { defaultValue: 'Follow-up Type' })}
              rules={[{ required: true, message: t('page.leads.followupTypeRequired', { defaultValue: 'Follow-up type is required' }) }]}
            >
              <Select options={getFollowupTypeOptions(t)} placeholder={t('page.leads.selectType', { defaultValue: 'Select type' })} />
            </Form.Item>

            <Form.Item name="followup_at" label={t('page.leads.followupTime', { defaultValue: 'Follow-up Time' })}>
              <DatePicker showTime className="w-full" />
            </Form.Item>

            <Form.Item
              name="arrange_next_followup"
              label={t('page.leads.arrangeNextFollowup', { defaultValue: 'Arrange next follow-up?' })}
              initialValue="NO"
            >
              <Select options={getNextFollowupArrangementOptions(t)} />
            </Form.Item>

            <Form.Item
              name="next_followup_at"
              label={t('page.leads.nextFollowupTime', { defaultValue: 'Next Follow-up Time' })}
              hidden={arrangeNextFollowup !== 'YES'}
              rules={
                arrangeNextFollowup === 'YES'
                  ? [{ required: true, message: t('page.leads.nextFollowupRequired', { defaultValue: 'Please select next follow-up time' }) }]
                  : []
              }
            >
              <DatePicker showTime className="w-full" />
            </Form.Item>
          </div>

          <Form.Item
            name="summary"
            label={t('page.leads.summary', { defaultValue: 'Summary' })}
            rules={[{ required: true, message: t('page.leads.summaryRequired', { defaultValue: 'Summary is required' }) }]}
          >
            <Input.TextArea
              rows={3}
              placeholder={t('page.leads.followupSummaryPlaceholder', {
                defaultValue: 'Discussed workshop fit-out scope and investment willingness.',
              })}
            />
          </Form.Item>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="bd_notes" label={t('page.leads.bdNotes', { defaultValue: 'BD Notes' })}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="team_attention_note" label={t('page.leads.teamAttentionNote', { defaultValue: 'Team Attention Note' })}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={saving}>
            {t('page.leads.addFollowup', { defaultValue: 'Add Follow-up' })}
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
            title: t('page.leads.followupTime', { defaultValue: 'Follow-up Time' }),
            dataIndex: 'followup_at',
            width: 200,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          { title: t('page.leads.type', { defaultValue: 'Type' }), dataIndex: 'followup_type', width: 130 },
          { title: t('page.leads.summary', { defaultValue: 'Summary' }), dataIndex: 'summary' },
          {
            title: t('page.leads.nextFollowup', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            width: 200,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />
    </>
  )
}
