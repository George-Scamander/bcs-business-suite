import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Alert, Button, Card, DatePicker, Descriptions, Form, Input, Select, Space, Upload, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import type { UploadFile } from 'antd'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { INTENT_PACKAGE_OPTIONS } from '../../../lib/business-constants'
import { createSignedFileUrl, deleteUploadedFile, getUploadedFileById, uploadPrivateDocument } from '../../../lib/supabase/storage'
import { useAuth } from '../../auth/auth-context'
import { changeLeadStatus, createLeadAttachment, getLeadById, listSignedRecords } from '../api'
import type { IntentPackage, Lead, SignedRecord } from '../../../types/business'
import type { UploadFileRecord } from '../../../types/rbac'

interface SignFormValues {
  contract_no: string
  contract_date?: dayjs.Dayjs
  contract_package?: IntentPackage
  reason?: string
}

export function LeadSignContractPage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<SignFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)
  const [signedRecord, setSignedRecord] = useState<SignedRecord | null>(null)
  const [contractFileList, setContractFileList] = useState<UploadFile[]>([])
  const [signedContractFile, setSignedContractFile] = useState<UploadFileRecord | null>(null)

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [leadResult, signedRows] = await Promise.all([getLeadById(leadId), listSignedRecords({ leadId })])
      setLead(leadResult)
      const currentSignedRecord = signedRows[0] ?? null
      setSignedRecord(currentSignedRecord)

      if (currentSignedRecord?.contract_file_id) {
        const fileRow = await getUploadedFileById(currentSignedRecord.contract_file_id)
        setSignedContractFile(fileRow)
      } else {
        setSignedContractFile(null)
      }
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
    if (!leadId || !user) {
      return
    }

    const uploadFile = contractFileList[0]?.originFileObj

    if (!uploadFile) {
      message.warning(t('page.leads.contractFileRequired', { defaultValue: 'Please upload contract file before signing' }))
      return
    }

    setSaving(true)
    let uploadedContract: UploadFileRecord | null = null

    try {
      uploadedContract = await uploadPrivateDocument(uploadFile, user.id)

      await changeLeadStatus({
        leadId,
        toStatus: 'SIGNED',
        reason: values.reason,
        contractNo: values.contract_no,
        contractDate: values.contract_date ? values.contract_date.format('YYYY-MM-DD') : undefined,
        contractPackage: values.contract_package,
        contractFileId: uploadedContract.id,
      })

      try {
        await createLeadAttachment(leadId, uploadedContract.id, uploadedContract.file_name, uploadedContract.object_path)
      } catch (attachmentError) {
        const warningText =
          attachmentError instanceof Error
            ? attachmentError.message
            : t('page.leads.contractAttachmentCreateFail', {
                defaultValue: 'Signed successfully, but failed to create lead attachment record.',
              })
        message.warning(warningText)
      }

      setContractFileList([])
      message.success(t('page.leads.signedSuccess', { defaultValue: 'Lead converted to SIGNED' }))
      await loadData()
    } catch (error) {
      if (uploadedContract) {
        try {
          await deleteUploadedFile(uploadedContract)
        } catch {
          // ignore cleanup error to preserve the original failure context
        }
      }

      const text = error instanceof Error ? error.message : 'Failed to mark as signed'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function handlePreviewSignedContract() {
    if (!signedContractFile?.object_path) {
      return
    }

    try {
      const url = await createSignedFileUrl(signedContractFile.object_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('page.leads.previewContractFail', { defaultValue: 'Failed to preview contract file' })
      message.error(text)
    }
  }

  return (
    <>
      <PageTitleBar
        title={
          lead
            ? `${t('page.leads.signContractTitle', { defaultValue: 'Sign Contract' })} · ${lead.lead_code}`
            : t('page.leads.signContractTitle', { defaultValue: 'Sign Contract' })
        }
        description={t('page.leads.signContractDesc', {
          defaultValue: 'Convert negotiated lead into a signed customer and create contractual baseline.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>
              {t('page.common.backToDetail', { defaultValue: 'Back to Detail' })}
            </Button>
            <Button onClick={() => navigate(`/app/bd/leads/${leadId}/onboarding`)} type="primary">
              {t('page.leads.goToOnboarding', { defaultValue: 'Go to Onboarding' })}
            </Button>
          </Space>
        }
      />

      <Card loading={loading}>
        {signedRecord ? (
          <>
            <Alert
              showIcon
              type="success"
              className="mb-4"
              message={t('page.leads.alreadySigned', { defaultValue: 'This lead is already signed.' })}
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('page.leads.contractNo', { defaultValue: 'Contract No.' })}>
                {signedRecord.contract_no}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.contractDate', { defaultValue: 'Contract Date' })}>
                {signedRecord.contract_date ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.potentialPackage', { defaultValue: 'Potential Intent Package' })}>
                {signedRecord.contract_package === 'BCS'
                  ? t('page.leads.packageBCS', { defaultValue: 'BCS' })
                  : signedRecord.contract_package === 'PRODUCTS_SALES'
                    ? t('page.leads.packageProductsSales', { defaultValue: 'Products Sales' })
                    : signedRecord.contract_package === 'BOTH'
                      ? t('intentPackage.BOTH', { defaultValue: 'Both' })
                    : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.currency', { defaultValue: 'Currency' })}>
                {signedRecord.contract_currency}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.signedAt', { defaultValue: 'Signed At' })}>
                {new Date(signedRecord.signed_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.contractFile', { defaultValue: 'Contract File' })}>
                {signedContractFile ? (
                  <Button type="link" className="!px-0" onClick={() => void handlePreviewSignedContract()}>
                    {signedContractFile.file_name}
                  </Button>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Form<SignFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Form.Item
                name="contract_no"
                label={t('page.leads.contractNo', { defaultValue: 'Contract No.' })}
                rules={[{ required: true, message: t('page.leads.contractNoRequired', { defaultValue: 'Contract no. is required' }) }]}
              >
                <Input placeholder="BCS-ID-2026-001" />
              </Form.Item>

              <Form.Item name="contract_date" label={t('page.leads.contractDate', { defaultValue: 'Contract Date' })}>
                <DatePicker className="w-full" />
              </Form.Item>

              <Form.Item
                name="contract_package"
                label={t('page.leads.potentialPackage', { defaultValue: 'Potential Intent Package' })}
                rules={[{ required: true, message: t('page.leads.packageRequired', { defaultValue: 'Please select a package' }) }]}
              >
                <Select
                  options={INTENT_PACKAGE_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.value === 'BCS'
                      ? t('page.leads.packageBCS', { defaultValue: 'BCS' })
                      : item.value === 'PRODUCTS_SALES'
                        ? t('page.leads.packageProductsSales', { defaultValue: 'Products Sales' })
                        : t('intentPackage.BOTH', { defaultValue: 'Both' }),
                  }))}
                />
              </Form.Item>
            </div>

            <Form.Item name="reason" label={t('page.onboarding.remarks', { defaultValue: 'Remarks' })}>
              <Input.TextArea
                rows={3}
                placeholder={t('page.leads.signRemarksPlaceholder', {
                  defaultValue: 'Any additional context for this sign-off.',
                })}
              />
            </Form.Item>

            <Form.Item
              label={t('page.leads.contractFile', { defaultValue: 'Contract File' })}
              required
              extra={t('page.leads.contractFileHint', {
                defaultValue: 'Please upload signed contract document (PDF, DOC, DOCX, JPG, PNG).',
              })}
            >
              <Upload
                maxCount={1}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                beforeUpload={() => false}
                fileList={contractFileList}
                onChange={(info) => setContractFileList(info.fileList)}
                onRemove={(file) => {
                  setContractFileList((current) => current.filter((item) => item.uid !== file.uid))
                }}
              >
                <Button>{t('page.leads.uploadContractFile', { defaultValue: 'Upload Contract File' })}</Button>
              </Upload>
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={saving}>
              {t('page.leads.confirmSigned', { defaultValue: 'Confirm Signed' })}
            </Button>
          </Form>
        )}
      </Card>
    </>
  )
}
