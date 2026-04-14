import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Alert, Button, Card, DatePicker, Descriptions, Form, Input, InputNumber, Space, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { changeLeadStatus, getLeadById, listSignedRecords } from '../api'
import type { Lead, SignedRecord } from '../../../types/business'

interface SignFormValues {
  contract_no: string
  contract_date?: dayjs.Dayjs
  contract_value?: number
  reason?: string
}

export function LeadSignContractPage() {
  const [form] = Form.useForm<SignFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)
  const [signedRecord, setSignedRecord] = useState<SignedRecord | null>(null)

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, signedRows] = await Promise.all([getLeadById(leadId), listSignedRecords({ leadId })])
      setLead(leadResult)
      setSignedRecord(signedRows[0] ?? null)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load sign data'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSubmit(values: SignFormValues) {
    if (!leadId) {
      return
    }

    setSaving(true)

    try {
      await changeLeadStatus({
        leadId,
        toStatus: 'SIGNED',
        reason: values.reason,
        contractNo: values.contract_no,
        contractDate: values.contract_date ? values.contract_date.format('YYYY-MM-DD') : undefined,
        contractValue: values.contract_value,
      })
      message.success('Lead converted to SIGNED')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to mark as signed'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={lead ? `Sign Contract · ${lead.lead_code}` : 'Sign Contract'}
        description="Convert negotiated lead into a signed customer and create contractual baseline."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>Back to Detail</Button>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}/onboarding`)} type="primary">
              Go to Onboarding
            </Button>
          </Space>
        }
      />

      <Card loading={loading}>
        {signedRecord ? (
          <>
            <Alert showIcon type="success" className="mb-4" message="This lead is already signed." />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Contract No.">{signedRecord.contract_no}</Descriptions.Item>
              <Descriptions.Item label="Contract Date">{signedRecord.contract_date ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Contract Value">{signedRecord.contract_value ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Currency">{signedRecord.contract_currency}</Descriptions.Item>
              <Descriptions.Item label="Signed At">{new Date(signedRecord.signed_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Form<SignFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Form.Item name="contract_no" label="Contract No." rules={[{ required: true, message: 'Contract no. is required' }]}>
                <Input placeholder="BCS-ID-2026-001" />
              </Form.Item>

              <Form.Item name="contract_date" label="Contract Date">
                <DatePicker className="w-full" />
              </Form.Item>

              <Form.Item name="contract_value" label="Contract Value">
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </div>

            <Form.Item name="reason" label="Remarks">
              <Input.TextArea rows={3} placeholder="Any additional context for this sign-off." />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={saving}>
              Confirm Signed
            </Button>
          </Form>
        )}
      </Card>
    </>
  )
}
