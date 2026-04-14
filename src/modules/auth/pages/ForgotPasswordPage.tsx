import { Button, Card, Form, Input, Typography, message } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth-context'

interface ForgotPasswordFormValues {
  email: string
}

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { requestPasswordReset } = useAuth()

  async function handleFinish(values: ForgotPasswordFormValues) {
    try {
      await requestPasswordReset(values.email)
      message.success(t('auth.forgotPassword.success', { defaultValue: 'Reset email sent. Please check your inbox.' }))
    } catch (error) {
      const text = error instanceof Error ? error.message : t('auth.forgotPassword.failed', { defaultValue: 'Failed to send reset email.' })
      message.error(text)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 bg-[linear-gradient(120deg,#f8fafc,#e2e8f0)]">
      <Card className="w-full max-w-md">
        <Typography.Title level={4}>{t('auth.forgotPassword.title', { defaultValue: 'Forgot Password' })}</Typography.Title>
        <Typography.Paragraph className="text-slate-500">
          {t('auth.forgotPassword.description', {
            defaultValue: 'Enter your email and we will send you a reset link.',
          })}
        </Typography.Paragraph>

        <Form<ForgotPasswordFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label={t('page.common.email', { defaultValue: 'Email' })}
            name="email"
            rules={[
              { required: true, message: t('auth.login.emailRequired', { defaultValue: 'Email is required' }) },
              { type: 'email', message: t('auth.login.emailInvalid', { defaultValue: 'Invalid email format' }) },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('auth.login.emailPlaceholder', { defaultValue: 'you@bosch.com' })} />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            {t('auth.forgotPassword.submit', { defaultValue: 'Send Reset Link' })}
          </Button>
        </Form>

        <div className="mt-4 text-sm">
          <Link to="/login">{t('auth.forgotPassword.backToLogin', { defaultValue: 'Back to sign in' })}</Link>
        </div>
      </Card>
    </div>
  )
}
