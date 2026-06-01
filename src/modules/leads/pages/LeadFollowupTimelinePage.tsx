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
  DatePicker,
  Form,
  Input,
  Radio,
  Select,
  Space,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useTranslation,
} from 'react-i18next'
import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getFollowupTypeOptions,
  getLeadStatusOptions,
  getLostReasonOptions,
  getNextFollowupArrangementOptions,
} from '../../../lib/business-constants'
import {
  addFollowup,
  changeLeadStatus,
  getLeadById,
  listLeadFollowups,
  listLeadStatusLogs,
} from '../api'
import { StatusTag } from '../../../components/common/StatusTag'
import { useAuth } from '../../auth/auth-context'
import { PERMISSIONS } from '../../../lib/permissions'
import type {
  Lead,
  LeadFollowup,
  LeadStatus,
  LeadStatusLog,
} from '../../../types/business'

interface FollowupFormValues {
  followup_type: string
  summary: string
  followup_at?: dayjs.Dayjs
  arrange_next_followup?: 'YES' | 'NO'
  next_followup_at?: dayjs.Dayjs
  bd_notes?: string
  team_attention_note?: string
  status_change_action?: 'NO_CHANGE' | 'CHANGE'
  to_status?: LeadStatus
  lost_reason_code?: string
  status_change_reason?: string
}

function isSalesOrderFollowup(followupType: string, summary: string): boolean {
  const normalizedType = followupType.trim().toUpperCase()
  if (normalizedType === 'SALES_ORDER') {
    return true
  }
  return summary.trim().toLowerCase().startsWith('sales order ')
}

export function LeadFollowupTimelinePage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const [form] = Form.useForm<FollowupFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()

  const [lead, setLead] = useState<Lead | null>(null)
  const [rows, setRows] = useState<LeadFollowup[]>([])
  const [statusLogs, setStatusLogs] = useState<LeadStatusLog[]>([])
  const [lastSignedRecordId, setLastSignedRecordId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const canChangeStatus = hasPermission(PERMISSIONS.LEADS_STATUS_CHANGE)
  const arrangeNextFollowup = Form.useWatch('arrange_next_followup', form)
  const statusChangeAction = Form.useWatch('status_change_action', form)
  const toStatus = Form.useWatch('to_status', form)
  const visibleRows = useMemo(() => rows.filter((item) => !isSalesOrderFollowup(item.followup_type, item.summary)), [rows])
  const followupTypeLabelByValue = useMemo(() => {
    const map = new Map(getFollowupTypeOptions(t).map((item) => [item.value, item.label]))
    map.set('SALES_ORDER', t('merchantActivityType.SALES_ORDER', { defaultValue: 'Sales Order' }))
    return map
  }, [t])

  const renderFollowupType = useCallback((followupType: string, summary: string) => {
    if (followupType === 'MEETING' && summary.startsWith('Sales order ')) {
      return t('merchantActivityType.SALES_ORDER', { defaultValue: 'Sales Order' })
    }
    return followupTypeLabelByValue.get(followupType) ?? followupType
  }, [followupTypeLabelByValue, t])

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, followups, logs] = await Promise.all([
        getLeadById(leadId),
        listLeadFollowups(leadId),
        listLeadStatusLogs(leadId),
      ])
      setLead(leadResult)
      setRows(followups)
      setStatusLogs(logs)
      setLastSignedRecordId(null)
      form.setFieldsValue({
        arrange_next_followup: leadResult.next_followup_at ? 'YES' : 'NO',
        bd_notes: leadResult.bd_notes ?? undefined,
        team_attention_note: leadResult.team_attention_note ?? undefined,
        status_change_action: 'NO_CHANGE',
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
      if (values.status_change_action === 'CHANGE') {
        if (!canChangeStatus) {
          throw new Error(t('page.leads.statusChangePermissionDenied', { defaultValue: 'You do not have permission to change status.' }))
        }
        if (!values.to_status) {
          throw new Error(t('page.leads.targetStatusRequired', { defaultValue: 'Please select target status.' }))
        }
        const statusResult = await changeLeadStatus({
          leadId,
          toStatus: values.to_status,
          reason: values.status_change_reason,
          lostReasonCode: values.lost_reason_code,
        })
        setLastSignedRecordId(statusResult.signedRecordId)
      }

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

      message.success(t('page.leads.followupAndStatusSaved', { defaultValue: 'Follow-up saved successfully' }))
      form.resetFields([
        'summary',
        'followup_type',
        'followup_at',
        'arrange_next_followup',
        'next_followup_at',
        'status_change_action',
        'to_status',
        'lost_reason_code',
        'status_change_reason',
      ])
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
        {lead ? (
          <div className="mb-3 text-sm text-slate-600">
            {t('page.leads.currentStatus', { defaultValue: 'Current status:' })} <StatusTag value={lead.status} />
          </div>
        ) : null}
        {lastSignedRecordId ? (
          <Alert
            type="success"
            showIcon
            className="mb-4"
            message={`${t('page.leads.signedRecordCreated', { defaultValue: 'Signed record created:' })} ${lastSignedRecordId}`}
          />
        ) : null}
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
              <DatePicker className="w-full" />
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
              <DatePicker className="w-full" />
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

          <div className="mb-2 mt-2 rounded-lg border border-slate-200 p-3">
            <Form.Item
              name="status_change_action"
              label={t('page.leads.statusChangePrompt', { defaultValue: 'Does this follow-up include a status change?' })}
              initialValue="NO_CHANGE"
            >
              <Radio.Group>
                <Radio.Button value="NO_CHANGE">{t('page.leads.statusKeepSame', { defaultValue: 'Keep current status' })}</Radio.Button>
                <Radio.Button value="CHANGE" disabled={!canChangeStatus}>
                  {t('page.leads.statusWillChange', { defaultValue: 'Change status now' })}
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Form.Item
                name="to_status"
                label={t('page.leads.targetStatus', { defaultValue: 'Target Status' })}
                hidden={statusChangeAction !== 'CHANGE'}
                rules={statusChangeAction === 'CHANGE' ? [{ required: true, message: t('page.leads.targetStatusRequired', { defaultValue: 'Please select target status.' }) }] : []}
              >
                <Select
                  options={getLeadStatusOptions(t).filter((item) => item.value !== 'SIGNED')}
                  placeholder={t('page.leads.targetStatus', { defaultValue: 'Target Status' })}
                />
              </Form.Item>

              <Form.Item
                name="lost_reason_code"
                label={t('page.leads.lostReason', { defaultValue: 'Lost Reason' })}
                hidden={statusChangeAction !== 'CHANGE' || toStatus !== 'LOST'}
              >
                <Select options={getLostReasonOptions(t)} allowClear />
              </Form.Item>
            </div>

            <Form.Item
              name="status_change_reason"
              label={t('page.leads.transitionContext', { defaultValue: 'Provide context for this transition.' })}
              hidden={statusChangeAction !== 'CHANGE'}
            >
              <Input.TextArea rows={2} />
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
        dataSource={visibleRows}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: t('page.leads.followupTime', { defaultValue: 'Follow-up Time' }),
            dataIndex: 'followup_at',
            width: 200,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: t('page.leads.type', { defaultValue: 'Type' }),
            dataIndex: 'followup_type',
            width: 130,
            render: (value: string, row: LeadFollowup) => renderFollowupType(value, row.summary),
          },
          { title: t('page.leads.summary', { defaultValue: 'Summary' }), dataIndex: 'summary' },
          {
            title: t('page.leads.nextFollowup', { defaultValue: 'Next Follow-up' }),
            dataIndex: 'next_followup_at',
            width: 200,
            render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
        ]}
      />

      <Card className="mt-5" title={t('page.leads.statusChangeLogs', { defaultValue: 'Status Change Logs' })}>
        <Table
          rowKey="id"
          bordered
          dataSource={statusLogs}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: t('page.leads.changedAt', { defaultValue: 'Changed At' }),
              dataIndex: 'changed_at',
              width: 190,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('page.onboarding.from', { defaultValue: 'From' }),
              dataIndex: 'from_status',
              width: 150,
              render: (value: string | null) => (value ? <StatusTag value={value} /> : '-'),
            },
            {
              title: t('page.onboarding.to', { defaultValue: 'To' }),
              dataIndex: 'to_status',
              width: 150,
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
    </>
  )
}
