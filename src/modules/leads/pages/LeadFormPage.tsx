import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Alert, Button, Card, DatePicker, Form, Input, Select, Space, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { INDUSTRY_OPTIONS, INTENT_PACKAGE_OPTIONS, NEXT_FOLLOWUP_ARRANGEMENT_OPTIONS } from '../../../lib/business-constants'
import { checkDuplicateLeadByCompanyName, createLead, createLeadAttachment, getLeadById, updateLead } from '../api'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import { uploadPrivateDocument } from '../../../lib/supabase/storage'
import type { IntentPackage } from '../../../types/business'

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
  intent_package?: IntentPackage
  intent_level?: number
  bd_notes?: string
  team_attention_note?: string
  duplicate_note?: string
  schedule_next_followup?: 'YES' | 'NO'
  assigned_bd_id?: string
  next_followup_at?: dayjs.Dayjs
}

export function LeadFormPage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<LeadFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const { user, roles } = useAuth()

  const [loading, setLoading] = useState(Boolean(leadId))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<UploadFile[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [duplicateMatches, setDuplicateMatches] = useState<Array<{ id: string; lead_code: string; company_name: string }>>([])

  const isEdit = Boolean(leadId)
  const scheduleNextFollowup = Form.useWatch('schedule_next_followup', form)

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
        intent_package: detail.intent_package ?? undefined,
        intent_level: detail.intent_level ?? undefined,
        bd_notes: detail.bd_notes ?? undefined,
        team_attention_note: detail.team_attention_note ?? undefined,
        duplicate_note: detail.duplicate_note ?? undefined,
        schedule_next_followup: detail.next_followup_at ? 'YES' : 'NO',
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
      const duplicates = await checkDuplicateLeadByCompanyName(values.company_name, leadId)
      setDuplicateMatches(duplicates.map((item) => ({ id: item.id, lead_code: item.lead_code, company_name: item.company_name })))

      if (duplicates.length > 0 && !values.duplicate_note?.trim()) {
        message.warning(
          t('page.leads.duplicateNoteRequired', {
            defaultValue: 'This company name already exists. Please add a duplicate distinction note before saving.',
          }),
        )
        setSaving(false)
        return
      }

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
        intent_package: values.intent_package,
        intent_level: values.intent_level,
        bd_notes: values.bd_notes,
        team_attention_note: values.team_attention_note,
        duplicate_note: values.duplicate_note,
        assigned_bd_id: values.assigned_bd_id,
        next_followup_at:
          values.schedule_next_followup === 'YES' && values.next_followup_at
            ? values.next_followup_at.toISOString()
            : undefined,
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

      message.success(
        isEdit
          ? t('page.leads.updatedSuccess', { defaultValue: 'Lead updated successfully' })
          : t('page.leads.createdSuccess', { defaultValue: 'Lead created successfully' }),
      )
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

  const industryOptions = useMemo(() => {
    return INDUSTRY_OPTIONS.map((item) => ({
      value: item.value,
      label:
        item.value === 'Repair Workshop'
          ? t('page.leads.industryRepairWorkshop', { defaultValue: 'Repair Workshop' })
          : item.value === 'Parts Sales'
            ? t('page.leads.industryPartsSales', { defaultValue: 'Parts Sales' })
            : item.value === 'Car Wash'
              ? t('page.leads.industryCarWash', { defaultValue: 'Car Wash' })
              : item.value === 'Car Beauty'
                ? t('page.leads.industryCarBeauty', { defaultValue: 'Car Beauty' })
                : item.value === 'Body & Paint Specialist'
                  ? t('page.leads.industryBodyPaint', { defaultValue: 'Body & Paint Specialist' })
                  : t('page.leads.industryOther', { defaultValue: 'Other' }),
    }))
  }, [t])

  return (
    <>
      <PageTitleBar
        title={isEdit ? t('page.leads.editTitle', { defaultValue: 'Edit Lead' }) : t('page.leads.createTitle', { defaultValue: 'Create Lead' })}
        description={t('page.leads.formDesc', {
          defaultValue: 'Capture core prospect profile, potential package intent, and collaboration notes.',
        })}
      />

      <Card loading={loading}>
        <Form<LeadFormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
          {duplicateMatches.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              className="mb-4"
              message={t('page.leads.duplicateDetectedTitle', { defaultValue: 'Potential duplicate detected' })}
              description={`${t('page.leads.duplicateDetectedDesc', {
                defaultValue: 'Existing leads:',
              })} ${duplicateMatches.map((item) => `${item.lead_code} (${item.company_name})`).join(', ')}`}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="company_name"
              label={t('page.leads.companyName', { defaultValue: 'Company Name' })}
              rules={[{ required: true, message: t('page.leads.companyRequired', { defaultValue: 'Company name is required' }) }]}
            >
              <Input placeholder="PT Example Motor" />
            </Form.Item>

            <Form.Item name="assigned_bd_id" label={t('page.leads.assignedBd', { defaultValue: 'Assigned BD' })}>
              <Select allowClear options={assigneeOptions} placeholder={t('page.leads.selectAssignee', { defaultValue: 'Select assignee' })} />
            </Form.Item>

            <Form.Item name="contact_person" label={t('page.leads.contactPerson', { defaultValue: 'Contact Person' })}>
              <Input />
            </Form.Item>

            <Form.Item name="contact_phone" label={t('page.leads.contactPhone', { defaultValue: 'Contact Phone' })}>
              <Input />
            </Form.Item>

            <Form.Item
              name="contact_email"
              label={t('page.leads.contactEmail', { defaultValue: 'Contact Email' })}
              rules={[{ type: 'email', message: t('page.leads.validEmail', { defaultValue: 'Enter a valid email' }) }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name="industry" label={t('page.common.industry', { defaultValue: 'Industry' })}>
              <Select
                allowClear
                options={industryOptions}
                placeholder={t('page.leads.selectIndustry', { defaultValue: 'Select industry' })}
              />
            </Form.Item>

            <Form.Item name="region" label={t('page.common.region', { defaultValue: 'Region' })}>
              <Input placeholder="West Java" />
            </Form.Item>

            <Form.Item name="city" label={t('page.leads.city', { defaultValue: 'City' })}>
              <Input placeholder="Bandung" />
            </Form.Item>

            <Form.Item name="source" label={t('page.leads.leadSource', { defaultValue: 'Lead Source' })}>
              <Input placeholder="Cold visit / Referral / Event" />
            </Form.Item>

            <Form.Item
              name="intent_package"
              label={t('page.leads.potentialPackage', { defaultValue: 'Potential Intent Package' })}
              rules={[{ required: true, message: t('page.leads.packageRequired', { defaultValue: 'Please select a package' }) }]}
            >
              <Select
                options={INTENT_PACKAGE_OPTIONS.map((item) => ({
                  value: item.value,
                  label:
                    item.value === 'BCS'
                      ? t('page.leads.packageBCS', { defaultValue: 'BCS' })
                      : t('page.leads.packageProductsSales', { defaultValue: 'Products Sales' }),
                }))}
                placeholder={t('page.leads.selectPackage', { defaultValue: 'Select package' })}
              />
            </Form.Item>

            <Form.Item name="intent_level" label={t('page.leads.intentLevel', { defaultValue: 'Intent Level (1-5)' })}>
              <Select
                allowClear
                options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                placeholder={t('page.leads.selectIntentLevel', { defaultValue: 'Select level' })}
              />
            </Form.Item>

            <Form.Item
              name="schedule_next_followup"
              label={t('page.leads.arrangeNextFollowup', { defaultValue: 'Arrange next follow-up?' })}
              initialValue="NO"
            >
              <Select
                options={NEXT_FOLLOWUP_ARRANGEMENT_OPTIONS.map((item) => ({
                  value: item.value,
                  label:
                    item.value === 'YES'
                      ? t('page.common.yes', { defaultValue: 'Yes' })
                      : t('page.common.no', { defaultValue: 'No' }),
                }))}
              />
            </Form.Item>

            <Form.Item
              name="next_followup_at"
              label={t('page.leads.nextFollowupTime', { defaultValue: 'Next Follow-up Time' })}
              hidden={scheduleNextFollowup !== 'YES'}
              rules={
                scheduleNextFollowup === 'YES'
                  ? [{ required: true, message: t('page.leads.nextFollowupRequired', { defaultValue: 'Please select next follow-up time' }) }]
                  : []
              }
            >
              <DatePicker showTime className="w-full" />
            </Form.Item>

            <Form.Item name="duplicate_note" label={t('page.leads.duplicateNote', { defaultValue: 'Duplicate Distinction Note' })}>
              <Input placeholder={t('page.leads.duplicateNotePlaceholder', { defaultValue: 'e.g., Same brand but different branch in North Jakarta' })} />
            </Form.Item>
          </div>

          <Form.Item name="address" label={t('page.leads.address', { defaultValue: 'Address' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="bd_notes" label={t('page.leads.bdNotes', { defaultValue: 'BD Notes' })}>
            <Input.TextArea
              rows={3}
              placeholder={t('page.leads.bdNotesPlaceholder', {
                defaultValue: 'Record customer characteristics, business preference, and communication highlights.',
              })}
            />
          </Form.Item>

          <Form.Item name="team_attention_note" label={t('page.leads.teamAttentionNote', { defaultValue: 'Team Attention Note' })}>
            <Input.TextArea
              rows={3}
              placeholder={t('page.leads.teamAttentionPlaceholder', {
                defaultValue: 'Shared note for all team members to pay attention to this customer.',
              })}
            />
          </Form.Item>

          <div className="mb-4 rounded-lg border border-slate-200 p-4">
            <p className="mb-2 font-medium">{t('page.leads.attachments', { defaultValue: 'Attachments' })}</p>
            <Upload
              multiple
              beforeUpload={() => false}
              fileList={stagedFiles}
              onChange={(info) => setStagedFiles(info.fileList)}
              onRemove={(file) => {
                setStagedFiles((current) => current.filter((item) => item.uid !== file.uid))
              }}
            >
              <Button>{t('page.leads.selectFiles', { defaultValue: 'Select Files' })}</Button>
            </Upload>
            <p className="mb-0 mt-2 text-xs text-slate-500">
              {t('page.leads.attachmentsHint', {
                defaultValue: 'Files will be uploaded after lead save and linked to this lead record.',
              })}
            </p>
          </div>

          <Space>
            <Button onClick={() => navigate(-1)}>{t('page.usersRoles.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="primary" htmlType="submit" loading={saving || uploading}>
              {isEdit
                ? t('page.leads.saveChanges', { defaultValue: 'Save Changes' })
                : t('page.leads.createLead', { defaultValue: 'Create Lead' })}
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  )
}
