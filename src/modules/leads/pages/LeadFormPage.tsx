import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Form, Input, Popconfirm, Select, Space, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getIntentPackageOptions } from '../../../lib/business-constants'
import { createLead, createLeadAttachment, findDuplicateLeadCompanies, getLeadById, softDeleteLead, updateLead } from '../api'
import { useAuth } from '../../auth/auth-context'
import { uploadPrivateDocument } from '../../../lib/supabase/storage'
import { listDictionaryItems, type DictionaryItem } from '../../shared/api/dictionary'
import { buildLeadSourceOptions, buildRegionOptions, findCitiesByRegion } from '../lead-options'
import type { IntentPackage } from '../../../types/business'

interface LeadFormValues {
  company_name: string
  intent_package?: IntentPackage
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  industry?: string
  region?: string
  city?: string
  address?: string
  source?: string
  team_attention_note?: string
  intent_level?: number
  next_followup_at?: dayjs.Dayjs
}

interface DraftLeadFormValues extends Omit<LeadFormValues, 'next_followup_at'> {
  next_followup_at?: string
}

interface SupabaseLikeError {
  message?: string
}

function toIsoStringOrUndefined(value?: dayjs.Dayjs | string): string | undefined {
  if (!value) {
    return undefined
  }

  const parsed = dayjs.isDayjs(value) ? value : dayjs(value)
  if (!parsed.isValid()) {
    return undefined
  }

  return parsed.toISOString()
}

function normalizeText(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  const text = value.trim()
  return text.length > 0 ? text : undefined
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as SupabaseLikeError
    if (supabaseError.message && supabaseError.message.trim().length > 0) {
      return supabaseError.message
    }
  }

  return fallback
}

export function LeadFormPage() {
  const [form] = Form.useForm<LeadFormValues>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { leadId } = useParams<{ leadId: string }>()
  const { user, roles } = useAuth()

  const [loading, setLoading] = useState(Boolean(leadId))
  const [saving, setSaving] = useState(false)
  const deleteRetentionHint = t('labels.autoDelete30DaysHint', {
    defaultValue: 'Moved to Recently Deleted and auto-permanently deleted after 30 days.',
  })
  const [uploading, setUploading] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<UploadFile[]>([])
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])

  const isEdit = Boolean(leadId)
  const isSuperAdmin = roles.includes('super_admin')
  const canEditTeamAttentionOnThisPage = !isEdit || isSuperAdmin
  const canUploadAttachments = roles.includes('super_admin') || roles.includes('project_manager')

  const draftKey = useMemo(() => {
    return `lead-form-draft:${leadId ?? 'new'}`
  }, [leadId])
  const legacyDraftKey = useMemo(() => `lead-form-draft:${leadId ?? 'new'}:${user?.id ?? 'anonymous'}`, [leadId, user?.id])

  const regionOptions = useMemo(() => buildRegionOptions(dictionaryItems), [dictionaryItems])
  const sourceOptions = useMemo(() => buildLeadSourceOptions(dictionaryItems), [dictionaryItems])
  const intentPackageOptions = useMemo(() => getIntentPackageOptions(t), [t])

  const selectedRegion = Form.useWatch('region', form)
  const selectedSource = Form.useWatch('source', form)
  const selectedIntentPackage = Form.useWatch('intent_package', form)
  const cityOptions = useMemo(() => {
    return findCitiesByRegion(regionOptions, selectedRegion).map((city) => ({
      value: city,
      label: city,
    }))
  }, [regionOptions, selectedRegion])

  const mergedSourceOptions = useMemo(() => {
    if (!selectedSource || sourceOptions.some((item) => item.value === selectedSource)) {
      return sourceOptions
    }

    return [{ label: selectedSource, value: selectedSource }, ...sourceOptions]
  }, [selectedSource, sourceOptions])

  const intentLevelOptions = useMemo(
    () => Array.from({ length: 6 }, (_, level) => ({ value: level, label: `H${level}` })),
    [],
  )

  const loadDictionary = useCallback(async () => {
    try {
      const rows = await listDictionaryItems()
      setDictionaryItems(rows)
    } catch (error) {
      message.error(
        extractErrorMessage(error, t('pages.leadForm.loadDictionaryFail', { defaultValue: 'Failed to load dictionary options' })),
      )
    }
  }, [t])

  const applyDraftIfExists = useCallback(() => {
    try {
      const raw = localStorage.getItem(draftKey) ?? localStorage.getItem(legacyDraftKey)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as DraftLeadFormValues
      const draftFollowup = parsed.next_followup_at ? dayjs(parsed.next_followup_at) : undefined
      form.setFieldsValue({
        ...parsed,
        next_followup_at: draftFollowup?.isValid() ? draftFollowup : undefined,
      })
    } catch {
      // Ignore corrupted local draft and continue with server/default values.
    }
  }, [draftKey, form, legacyDraftKey])

  const loadDetail = useCallback(async () => {
    if (!leadId) {
      applyDraftIfExists()
      return
    }

    setLoading(true)

    try {
      const detail = await getLeadById(leadId)
      form.setFieldsValue({
        company_name: detail.company_name,
        intent_package: detail.intent_package ?? undefined,
        contact_person: detail.contact_person ?? undefined,
        contact_phone: detail.contact_phone ?? undefined,
        contact_email: detail.contact_email ?? undefined,
        industry: detail.industry ?? undefined,
        region: detail.region ?? undefined,
        city: detail.city ?? undefined,
        address: detail.address ?? undefined,
        source: detail.source ?? undefined,
        team_attention_note: detail.team_attention_note ?? undefined,
        intent_level: detail.intent_level ?? undefined,
        next_followup_at: detail.next_followup_at ? dayjs(detail.next_followup_at) : undefined,
      })
      applyDraftIfExists()
    } catch (error) {
      message.error(extractErrorMessage(error, t('pages.leadForm.loadDetailFail', { defaultValue: 'Failed to load lead detail' })))
    } finally {
      setLoading(false)
    }
  }, [applyDraftIfExists, form, leadId, t])

  useEffect(() => {
    void loadDictionary()
  }, [loadDictionary])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!selectedRegion) {
      form.setFieldValue('city', undefined)
      return
    }

    if (cityOptions.length === 0) {
      return
    }

    const currentCity = form.getFieldValue('city')
    if (!currentCity || cityOptions.some((item) => item.value === currentCity)) {
      return
    }

    const caseInsensitiveMatched = cityOptions.find((item) => item.value.toLowerCase() === String(currentCity).toLowerCase())
    if (caseInsensitiveMatched) {
      form.setFieldValue('city', caseInsensitiveMatched.value)
      return
    }

    form.setFieldValue('city', undefined)
  }, [cityOptions, form, selectedRegion])

  useEffect(() => {
    if (selectedIntentPackage === 'PRODUCTS_SALES') {
      form.setFieldValue('intent_level', undefined)
    }
  }, [form, selectedIntentPackage])

  async function uploadAttachments(targetLeadId: string) {
    if (!user || stagedFiles.length === 0 || !canUploadAttachments) {
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
      const manuallySelectedNextFollowupAt = toIsoStringOrUndefined(values.next_followup_at)
      const shouldDefaultNextFollowup =
        !isEdit &&
        roles.includes('bd_user') &&
        !roles.includes('project_manager') &&
        !roles.includes('super_admin')
      const basePayload = {
        company_name: normalizeText(values.company_name) ?? '',
        intent_package: values.intent_package,
        contact_person: normalizeText(values.contact_person),
        contact_phone: normalizeText(values.contact_phone),
        contact_email: normalizeText(values.contact_email),
        industry: normalizeText(values.industry),
        region: normalizeText(values.region),
        city: normalizeText(values.city),
        address: normalizeText(values.address),
        source: normalizeText(values.source),
        intent_level: values.intent_level,
        next_followup_at:
          manuallySelectedNextFollowupAt ??
          (shouldDefaultNextFollowup ? dayjs().add(7, 'day').toISOString() : undefined),
      }

      const duplicates = await findDuplicateLeadCompanies(basePayload.company_name, leadId)
      if (duplicates.length > 0) {
        const existing = duplicates[0]
        message.error(
          t('pages.leadForm.duplicateCompanyBlocked', {
            defaultValue: `Company name already exists: ${existing.company_name} (${existing.lead_code}).`,
          }),
        )
        return
      }

      const noteValue = normalizeText(values.team_attention_note)
      const payload = canEditTeamAttentionOnThisPage
        ? isEdit
          ? { ...basePayload, team_attention_note: noteValue ?? null }
          : noteValue
            ? { ...basePayload, team_attention_note: noteValue }
            : basePayload
        : basePayload

      const lead = isEdit
        ? await updateLead({
            id: leadId ?? '',
            ...payload,
            updated_by: user.id,
          })
        : await createLead({
            ...payload,
            assigned_bd_id: user.id,
            created_by: user.id,
            updated_by: user.id,
          })

      localStorage.removeItem(draftKey)
      localStorage.removeItem(legacyDraftKey)

      if (canUploadAttachments && stagedFiles.length > 0) {
        try {
          await uploadAttachments(lead.id)
        } catch (error) {
          message.warning(
            extractErrorMessage(
              error,
              t('pages.leadForm.uploadAfterSaveFail', { defaultValue: 'Lead saved, but attachments failed to upload' }),
            ),
          )
        }
      }

      message.success(
        isEdit
          ? t('pages.leadForm.updateSuccess', { defaultValue: 'Lead updated successfully' })
          : t('pages.leadForm.createSuccess', { defaultValue: 'Lead created successfully' }),
      )
      navigate(`/app/bd/leads/${lead.id}`)
    } catch (error) {
      message.error(extractErrorMessage(error, t('pages.leadForm.saveFail', { defaultValue: 'Failed to save lead' })))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteLead() {
    if (!leadId) {
      return
    }

    try {
      await softDeleteLead(leadId)
      localStorage.removeItem(draftKey)
      localStorage.removeItem(legacyDraftKey)
      message.success(t('pages.leadForm.deleteSuccess', { defaultValue: 'Lead moved to Recently Deleted' }))
      navigate('/app/bd/leads')
    } catch (error) {
      message.error(extractErrorMessage(error, t('pages.leadForm.deleteFail', { defaultValue: 'Failed to delete lead' })))
    }
  }

  function handleValuesChange(_changedValues: Partial<LeadFormValues>, allValues: LeadFormValues) {
    const draft: DraftLeadFormValues = {
      ...allValues,
      company_name: allValues.company_name,
      next_followup_at: toIsoStringOrUndefined(allValues.next_followup_at),
    }

    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // Ignore local persistence failure on restricted mobile webviews/private mode.
    }
  }

  return (
    <>
      <PageTitleBar
        title={
          isEdit
            ? t('pages.leadForm.titleEdit', { defaultValue: 'Edit Lead' })
            : t('pages.leadForm.titleCreate', { defaultValue: 'Create Lead' })
        }
        description={t('pages.leadForm.description', {
          defaultValue: 'Capture core prospect profile and handoff-ready context for BD execution.',
        })}
      />

      <Card loading={loading}>
        <Form<LeadFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="company_name"
              label={t('pages.leadForm.companyName', { defaultValue: 'Company Name' })}
              rules={[{ required: true, message: t('pages.leadForm.companyNameRequired', { defaultValue: 'Company name is required' }) }]}
            >
              <Input placeholder={t('pages.leadForm.companyNamePlaceholder', { defaultValue: 'PT Example Motor' })} />
            </Form.Item>

            <Form.Item name="contact_person" label={t('pages.leadForm.contactPerson', { defaultValue: 'Contact Person' })}>
              <Input />
            </Form.Item>

            <Form.Item name="contact_phone" label={t('pages.leadForm.contactPhone', { defaultValue: 'Contact Phone' })}>
              <Input />
            </Form.Item>

            <Form.Item
              name="contact_email"
              label={t('pages.leadForm.contactEmail', { defaultValue: 'Contact Email' })}
              rules={[{ type: 'email', message: t('pages.leadForm.contactEmailInvalid', { defaultValue: 'Enter a valid email' }) }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name="industry" label={t('pages.leadForm.industry', { defaultValue: 'Industry' })}>
              <Input placeholder={t('pages.leadForm.industryPlaceholder', { defaultValue: 'Automotive workshop' })} />
            </Form.Item>

            <Form.Item
              name="region"
              label={t('pages.leadForm.region', { defaultValue: 'Region' })}
              rules={[{ required: true, message: t('pages.leadForm.regionRequired', { defaultValue: 'Region is required' }) }]}
            >
              <Select
                showSearch
                options={regionOptions.map((item) => ({ value: item.value, label: item.label }))}
                placeholder={t('pages.leadForm.selectRegion', { defaultValue: 'Select region' })}
                optionFilterProp="label"
                onChange={() => form.setFieldValue('city', undefined)}
              />
            </Form.Item>

            <Form.Item
              name="city"
              label={t('pages.leadForm.city', { defaultValue: 'City' })}
              rules={[{ required: true, message: t('pages.leadForm.cityRequired', { defaultValue: 'City is required' }) }]}
            >
              <Select
                showSearch
                options={cityOptions}
                placeholder={
                  selectedRegion
                    ? t('pages.leadForm.selectCity', { defaultValue: 'Select city' })
                    : t('pages.leadForm.selectRegionFirst', { defaultValue: 'Select region first' })
                }
                optionFilterProp="label"
                disabled={!selectedRegion}
              />
            </Form.Item>

            <Form.Item
              name="source"
              label={t('pages.leadForm.leadSource', { defaultValue: 'Lead Source' })}
              rules={[{ required: true, message: t('pages.leadForm.leadSourceRequired', { defaultValue: 'Lead source is required' }) }]}
            >
              <Select
                showSearch
                options={mergedSourceOptions}
                placeholder={t('pages.leadForm.selectLeadSource', { defaultValue: 'Select lead source' })}
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="intent_package"
              label={t('pages.leadForm.intentPackage', { defaultValue: 'Business Segment' })}
              rules={[
                {
                  required: true,
                  message: t('pages.leadForm.intentPackageRequired', {
                    defaultValue: 'Business segment is required',
                  }),
                },
              ]}
            >
              <Select
                options={intentPackageOptions}
                placeholder={t('pages.leadForm.intentPackagePlaceholder', {
                  defaultValue: 'Select business segment',
                })}
              />
            </Form.Item>

            {selectedIntentPackage !== 'PRODUCTS_SALES' ? (
              <Form.Item name="intent_level" label={t('pages.leadForm.intentLevel', { defaultValue: 'Intent Level (H0-H5)' })}>
                <Select
                  options={intentLevelOptions}
                  placeholder={t('pages.leadForm.intentLevelPlaceholder', { defaultValue: 'Select intent level' })}
                />
              </Form.Item>
            ) : null}

            <Form.Item name="next_followup_at" label={t('pages.leadForm.nextFollowupTime', { defaultValue: 'Next Follow-up Time' })}>
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="address" label={t('pages.leadForm.address', { defaultValue: 'Address' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          {canEditTeamAttentionOnThisPage ? (
            <Form.Item name="team_attention_note" label={t('pages.leadForm.teamAttentionNote', { defaultValue: 'Team Attention Note' })}>
              <Input.TextArea
                rows={3}
                placeholder={t('pages.leadForm.teamAttentionPlaceholder', {
                  defaultValue: 'Internal notes for team attention and handoff context...',
                })}
              />
            </Form.Item>
          ) : null}

          {canUploadAttachments ? (
            <div className="mb-4 rounded-lg border border-slate-200 p-4">
              <p className="mb-2 font-medium">{t('pages.leadForm.attachments', { defaultValue: 'Attachments' })}</p>
              <Upload
                multiple
                beforeUpload={() => false}
                fileList={stagedFiles}
                onChange={(info) => setStagedFiles(info.fileList)}
                onRemove={(file) => {
                  setStagedFiles((current) => current.filter((item) => item.uid !== file.uid))
                }}
              >
                <Button>{t('pages.leadForm.selectFiles', { defaultValue: 'Select Files' })}</Button>
              </Upload>
              <p className="mb-0 mt-2 text-xs text-slate-500">
                {t('pages.leadForm.attachmentsHint', {
                  defaultValue: 'Files will be uploaded after lead save and linked to this lead record.',
                })}
              </p>
            </div>
          ) : null}

          <Space wrap>
            <Button onClick={() => navigate(-1)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
            {isEdit ? (
              <Popconfirm
                title={t('pages.leadForm.deleteConfirmTitle', { defaultValue: 'Delete this lead?' })}
                description={`${t('pages.leadForm.deleteConfirmDesc', {
                  defaultValue: 'The lead will be moved to Recently Deleted.',
                })} ${deleteRetentionHint}`}
                okText={t('labels.delete', { defaultValue: 'Delete' })}
                cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                onConfirm={() => void handleDeleteLead()}
              >
                <Button danger>{t('labels.delete', { defaultValue: 'Delete' })}</Button>
              </Popconfirm>
            ) : null}
            <Button type="primary" htmlType="submit" loading={saving || uploading}>
              {isEdit
                ? t('pages.leadForm.saveChanges', { defaultValue: 'Save Changes' })
                : t('pages.leadForm.titleCreate', { defaultValue: 'Create Lead' })}
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  )
}
