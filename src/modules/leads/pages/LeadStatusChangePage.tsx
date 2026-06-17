import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
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
  getLeadStatusOptions,
  getLostReasonOptions,
} from '../../../lib/business-constants'
import {
  changeLeadStatus,
  getLeadById,
  listLeadStatusLogs,
} from '../api'
import {
  StatusTag,
} from '../../../components/common/StatusTag'
import type {
  Lead,
  LeadStatus,
  LeadStatusLog,
} from '../../../types/business'

interface StatusFormValues {
  to_status: LeadStatus
  reason?: string
  lost_reason_code?: string
}

export function LeadStatusChangePage() {
  const { t } = useTranslation()
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
      })

      setLastSignedRecordId(result.signedRecordId)
      message.success(t('page.leads.statusUpdated', { defaultValue: 'Lead status updated' }))
      form.resetFields(['reason', 'lost_reason_code'])
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
        title={
          lead
            ? `${t('page.leads.statusTitle', { defaultValue: 'Lead Status' })} · ${lead.lead_code}`
            : t('page.leads.statusTitle', { defaultValue: 'Lead Status' })
        }
        description={t('page.leads.statusDesc', {
          defaultValue: 'Apply governed state transitions with mandatory reasons and conversion-ready contract info.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>{t('page.leads.backToDetail', { defaultValue: 'Back to Detail' })}</Button>
            <Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {lead ? (
          <div className="mb-3 text-sm app-text-soft">
            {t('page.leads.currentStatus', { defaultValue: 'Current status:' })} <StatusTag value={lead.status} />
          </div>
        ) : null}

        {lastSignedRecordId ? (
          <Alert
            type="success"
            showIcon
            className="mb-4"
            message={`${t('page.leads.signedRecordCreated', { defaultValue: 'Signed record created:' })} ${lastSignedRecordId}`}
            description={t('page.leads.signedRecordDesc', {
              defaultValue: 'You can now start onboarding from the onboarding initiation page.',
            })}
          />
        ) : null}

        <Form<StatusFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Form.Item
              name="to_status"
              label={t('page.onboarding.targetStatus', { defaultValue: 'Target Status' })}
              rules={[{ required: true, message: t('page.onboarding.selectTargetStatus', { defaultValue: 'Select target status' }) }]}
            >
              <Select
                options={getLeadStatusOptions(t).filter((item) => item.value !== 'SIGNED')}
                placeholder={t('page.onboarding.selectTargetStatus', { defaultValue: 'Select target status' })}
              />
            </Form.Item>

            <Form.Item name="lost_reason_code" label={t('page.leads.lostReason', { defaultValue: 'Lost Reason' })} hidden={toStatus !== 'LOST'}>
              <Select options={getLostReasonOptions(t)} allowClear />
            </Form.Item>
          </div>

          <Form.Item name="reason" label={t('page.onboarding.reason', { defaultValue: 'Reason' })}>
            <Input.TextArea rows={3} placeholder={t('page.leads.transitionContext', { defaultValue: 'Provide context for this transition.' })} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            {t('page.leads.updateStatus', { defaultValue: 'Update Status' })}
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
    </>
  )
}
