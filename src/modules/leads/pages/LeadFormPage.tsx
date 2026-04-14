import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { createLead, createLeadAttachment, getLeadById, updateLead } from '../api'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import { uploadPrivateDocument } from '../../../lib/supabase/storage'

interface LeadFormValues {
  company_name: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  industry?: string
  region?: string
  city?: string
  address?: string
  source?: string
  intent_level?: number
  estimated_value?: number
  assigned_bd_id?: string
  next_followup_at?: dayjs.Dayjs
}

export function LeadFormPage() {
  const [form] = Form.useForm<LeadFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const { user, roles } = useAuth()

  const [loading, setLoading] = useState(Boolean(leadId))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<UploadFile[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])

  const isEdit = Boolean(leadId)

  const loadUsers = useCallback(async () => {
    if (!roles.includes('super_admin')) {
      return
    }

    try {
      const result = await listActiveUsers()
      setUserOptions(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load user options'
      message.error(text)
    }
  }, [roles])

  const loadDetail = useCallback(async () => {
    if (!leadId) {
      if (user && !roles.includes('super_admin')) {
        form.setFieldValue('assigned_bd_id', user.id)
      }
      return
    }

    setLoading(true)

    try {
      const detail = await getLeadById(leadId)
      form.setFieldsValue({
        company_name: detail.company_name,
        contact_person: detail.contact_person ?? undefined,
        contact_phone: detail.contact_phone ?? undefined,
        contact_email: detail.contact_email ?? undefined,
        industry: detail.industry ?? undefined,
        region: detail.region ?? undefined,
        city: detail.city ?? undefined,
        address: detail.address ?? undefined,
        source: detail.source ?? undefined,
        intent_level: detail.intent_level ?? undefined,
        estimated_value: detail.estimated_value ?? undefined,
        assigned_bd_id: detail.assigned_bd_id ?? undefined,
        next_followup_at: detail.next_followup_at ? dayjs(detail.next_followup_at) : undefined,
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load lead detail'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [form, leadId, roles, user])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  async function uploadAttachments(targetLeadId: string) {
    if (!user || stagedFiles.length === 0) {
      return
    }

    setUploading(true)

    try {
      for (const file of stagedFiles) {
        if (!file.originFileObj) {
          continue
        }

        const metadata = await uploadPrivateDocument(file.originFileObj, user.id)
        await createLeadAttachment(targetLeadId, metadata.id, metadata.file_name, metadata.object_path)
      }

      setStagedFiles([])
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(values: LeadFormValues) {
    if (!user) {
      return
    }

    setSaving(true)

    try {
      const payload = {
        company_name: values.company_name,
        contact_person: values.contact_person,
        contact_phone: values.contact_phone,
        contact_email: values.contact_email,
        industry: values.industry,
        region: values.region,
        city: values.city,
        address: values.address,
        source: values.source,
        intent_level: values.intent_level,
        estimated_value: values.estimated_value,
        assigned_bd_id: values.assigned_bd_id,
        next_followup_at: values.next_followup_at ? values.next_followup_at.toISOString() : undefined,
      }

      const lead = isEdit
        ? await updateLead({
            id: leadId ?? '',
            ...payload,
          })
        : await createLead({
            ...payload,
            assigned_bd_id: roles.includes('super_admin') ? values.assigned_bd_id : user.id,
          })

      await uploadAttachments(lead.id)

      message.success(isEdit ? 'Lead updated successfully' : 'Lead created successfully')
      navigate(`/app/bd/leads/${lead.id}`)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to save lead'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  const assigneeOptions = useMemo(() => {
    if (!roles.includes('super_admin')) {
      return user
        ? [
            {
              value: user.id,
              label: 'Myself',
            },
          ]
        : []
    }

    return userOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [roles, user, userOptions])

  return (
    <>
      <PageTitleBar
        title={isEdit ? 'Edit Lead' : 'Create Lead'}
        description="Capture core prospect profile and handoff-ready context for BD execution."
      />

      <Card loading={loading}>
        <Form<LeadFormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="company_name" label="Company Name" rules={[{ required: true, message: 'Company name is required' }]}>
              <Input placeholder="PT Example Motor" />
            </Form.Item>

            <Form.Item name="assigned_bd_id" label="Assigned BD">
              <Select allowClear options={assigneeOptions} placeholder="Select assignee" />
            </Form.Item>

            <Form.Item name="contact_person" label="Contact Person">
              <Input />
            </Form.Item>

            <Form.Item name="contact_phone" label="Contact Phone">
              <Input />
            </Form.Item>

            <Form.Item name="contact_email" label="Contact Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
              <Input />
            </Form.Item>

            <Form.Item name="industry" label="Industry">
              <Input placeholder="Automotive workshop" />
            </Form.Item>

            <Form.Item name="region" label="Region">
              <Input placeholder="West Java" />
            </Form.Item>

            <Form.Item name="city" label="City">
              <Input placeholder="Bandung" />
            </Form.Item>

            <Form.Item name="source" label="Lead Source">
              <Input placeholder="Cold visit / Referral / Event" />
            </Form.Item>

            <Form.Item name="intent_level" label="Intent Level (1-5)">
              <InputNumber min={1} max={5} className="w-full" />
            </Form.Item>

            <Form.Item name="estimated_value" label="Estimated Contract Value">
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="next_followup_at" label="Next Follow-up Time">
              <DatePicker showTime className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="mb-4 rounded-lg border border-slate-200 p-4">
            <p className="mb-2 font-medium">Attachments</p>
            <Upload
              multiple
              beforeUpload={() => false}
              fileList={stagedFiles}
              onChange={(info) => setStagedFiles(info.fileList)}
              onRemove={(file) => {
                setStagedFiles((current) => current.filter((item) => item.uid !== file.uid))
              }}
            >
              <Button>Select Files</Button>
            </Upload>
            <p className="mb-0 mt-2 text-xs text-slate-500">Files will be uploaded after lead save and linked to this lead record.</p>
          </div>

          <Space>
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving || uploading}>
              {isEdit ? 'Save Changes' : 'Create Lead'}
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  )
}
