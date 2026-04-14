import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Form, Select, Space, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { supabase } from '../../../lib/supabase/client'
import { useAuth } from '../../auth/auth-context'
import { createOnboardingFromSigned } from '../../onboarding/api'
import { listSignedRecords } from '../api'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import type { OnboardingCase, SignedRecord } from '../../../types/business'

interface StartOnboardingFormValues {
  owner_user_id?: string
  reviewer_user_id?: string
}

export function LeadInitiateOnboardingPage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<StartOnboardingFormValues>()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signedRecord, setSignedRecord] = useState<SignedRecord | null>(null)
  const [existingCase, setExistingCase] = useState<OnboardingCase | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])

  const loadData = useCallback(async () => {
    if (!leadId) {
      return
    }

    setLoading(true)

    try {
      const [signedRows, userRows] = await Promise.all([listSignedRecords({ leadId }), listActiveUsers()])
      const signed = signedRows[0] ?? null
      setSignedRecord(signed)
      setUsers(userRows)

      if (signed) {
        const caseResult = await supabase
          .from('onboarding_cases')
          .select('*')
          .eq('signed_record_id', signed.id)
          .maybeSingle<OnboardingCase>()

        if (caseResult.error) {
          throw caseResult.error
        }

        setExistingCase(caseResult.data ?? null)
      } else {
        setExistingCase(null)
      }

      form.setFieldsValue({
        owner_user_id: user?.id,
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load onboarding initialization data'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [form, leadId, user?.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSubmit(values: StartOnboardingFormValues) {
    if (!signedRecord) {
      return
    }

    setSaving(true)

    try {
      const caseId = await createOnboardingFromSigned(
        signedRecord.id,
        values.owner_user_id || undefined,
        values.reviewer_user_id || undefined,
      )
      message.success(t('page.leads.onboardingCaseCreated', { defaultValue: 'Onboarding case created' }))
      navigate(`/app/bd/onboarding/${caseId}`)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to create onboarding case'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  const userOptions = useMemo(() => {
    return users.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [users])

  return (
    <>
      <PageTitleBar
        title={t('page.leads.initiateOnboardingTitle', { defaultValue: 'Initiate Onboarding' })}
        description={t('page.leads.initiateOnboardingDesc', {
          defaultValue: 'Start standardized onboarding flow immediately after contract signing.',
        })}
        extra={
          <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>
            {t('page.common.backToLead', { defaultValue: 'Back to Lead' })}
          </Button>
        }
      />

      <Card loading={loading}>
        {!signedRecord ? (
          <Empty
            description={t('page.leads.noSignedRecord', {
              defaultValue: 'No signed record found for this lead. Complete signing first.',
            })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : existingCase ? (
          <>
            <Alert
              type="info"
              showIcon
              className="mb-4"
              message={t('page.leads.existingOnboardingCase', {
                defaultValue: 'An onboarding case already exists for this lead.',
              })}
            />
            <Descriptions bordered size="small" column={1} className="mb-4">
              <Descriptions.Item label={t('page.leads.caseNo', { defaultValue: 'Case No.' })}>
                {existingCase.case_no}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.common.status', { defaultValue: 'Status' })}>{existingCase.status}</Descriptions.Item>
              <Descriptions.Item label={t('page.onboarding.started', { defaultValue: 'Started' })}>
                {new Date(existingCase.started_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            <Button type="primary" onClick={() => navigate(`/app/bd/onboarding/${existingCase.id}`)}>
              {t('page.leads.viewOnboardingCase', { defaultValue: 'View Onboarding Case' })}
            </Button>
          </>
        ) : (
          <Form<StartOnboardingFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} className="mb-4">
              <Descriptions.Item label={t('page.leads.contractNo', { defaultValue: 'Contract No.' })}>
                {signedRecord.contract_no}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.signedAt', { defaultValue: 'Signed At' })}>
                {new Date(signedRecord.signed_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.potentialPackage', { defaultValue: 'Potential Intent Package' })}>
                {signedRecord.contract_package === 'BCS'
                  ? t('page.leads.packageBCS', { defaultValue: 'BCS' })
                  : signedRecord.contract_package === 'PRODUCTS_SALES'
                    ? t('page.leads.packageProductsSales', { defaultValue: 'Products Sales' })
                    : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('page.leads.currency', { defaultValue: 'Currency' })}>{signedRecord.contract_currency}</Descriptions.Item>
            </Descriptions>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Form.Item name="owner_user_id" label={t('page.leads.onboardingOwner', { defaultValue: 'Onboarding Owner' })}>
                <Select allowClear options={userOptions} placeholder={t('page.leads.selectOwner', { defaultValue: 'Select owner' })} />
              </Form.Item>

              <Form.Item name="reviewer_user_id" label={t('page.onboarding.reviewer', { defaultValue: 'Reviewer' })}>
                <Select allowClear options={userOptions} placeholder={t('page.leads.selectReviewer', { defaultValue: 'Select reviewer' })} />
              </Form.Item>
            </div>

            <Space>
              <Button onClick={() => navigate(`/app/bd/leads/${leadId}`)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('page.leads.createOnboardingCase', { defaultValue: 'Create Onboarding Case' })}
              </Button>
            </Space>
          </Form>
        )}
      </Card>
    </>
  )
}
