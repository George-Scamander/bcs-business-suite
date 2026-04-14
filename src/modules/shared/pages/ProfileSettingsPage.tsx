import { useEffect } from 'react'
import { Button, Card, Form, Input, Select, Space, Typography, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { SUPPORTED_LOCALES } from '../../../lib/constants'
import { recordOperationLog } from '../../../lib/supabase/logs'
import { supabase } from '../../../lib/supabase/client'
import { useAuth } from '../../auth/auth-context'

interface ProfileFormValues {
  full_name: string
  locale: string
  timezone: string
}

export function ProfileSettingsPage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<ProfileFormValues>()
  const { user, profile, refreshProfile } = useAuth()

  useEffect(() => {
    form.setFieldsValue({
      full_name: profile?.full_name ?? '',
      locale: profile?.locale ?? 'en',
      timezone: profile?.timezone ?? 'Asia/Jakarta',
    })
  }, [form, profile])

  async function handleSave(values: ProfileFormValues) {
    if (!user) {
      return
    }

    const updateResult = await supabase
      .from('profiles')
      .update({
        full_name: values.full_name,
        locale: values.locale,
        timezone: values.timezone,
      })
      .eq('id', user.id)

    if (updateResult.error) {
      message.error(updateResult.error.message)
      return
    }

    await refreshProfile()
    await recordOperationLog({
      module: 'profile',
      entityType: 'profiles',
      entityId: user.id,
      action: 'update_profile',
      afterData: values,
    })

    message.success(t('page.profile.updated', { defaultValue: 'Profile updated' }))
  }

  return (
    <>
      <PageTitleBar
        title={t('page.profile.title', { defaultValue: 'Profile Settings' })}
        description={t('page.profile.desc', { defaultValue: 'Manage your display info, locale, and timezone.' })}
      />

      <Card className="max-w-2xl">
        <Form<ProfileFormValues> form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          <Form.Item label={t('page.common.email', { defaultValue: 'Email' })}>
            <Input value={profile?.email ?? ''} disabled />
          </Form.Item>

          <Form.Item
            label={t('page.profile.fullName', { defaultValue: 'Full Name' })}
            name="full_name"
            rules={[{ required: true, message: t('page.profile.fullNameRequired', { defaultValue: 'Full name is required' }) }]}
          >
            <Input placeholder={t('page.profile.fullNamePlaceholder', { defaultValue: 'Your full name' })} />
          </Form.Item>

          <Form.Item
            label={t('page.profile.locale', { defaultValue: 'Locale' })}
            name="locale"
            rules={[{ required: true, message: t('page.profile.localeRequired', { defaultValue: 'Locale is required' }) }]}
          >
            <Select options={SUPPORTED_LOCALES.map((item) => ({ value: item.code, label: item.label }))} />
          </Form.Item>

          <Form.Item
            label={t('page.profile.timezone', { defaultValue: 'Timezone' })}
            name="timezone"
            rules={[{ required: true, message: t('page.profile.timezoneRequired', { defaultValue: 'Timezone is required' }) }]}
          >
            <Select
              options={[
                { value: 'Asia/Jakarta', label: 'Asia/Jakarta (UTC+7)' },
                { value: 'Asia/Makassar', label: 'Asia/Makassar (UTC+8)' },
                { value: 'Asia/Jayapura', label: 'Asia/Jayapura (UTC+9)' },
                { value: 'UTC', label: 'UTC' },
              ]}
            />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit">
              {t('page.leads.saveChanges', { defaultValue: 'Save Changes' })}
            </Button>
          </Space>
        </Form>

        <Typography.Paragraph className="mt-4 mb-0 text-slate-500 text-sm">
          {t('page.profile.tip', {
            defaultValue:
              'Tip: For operation timeline consistency, we store all timestamps in UTC and display in your selected timezone.',
          })}
        </Typography.Paragraph>
      </Card>
    </>
  )
}
