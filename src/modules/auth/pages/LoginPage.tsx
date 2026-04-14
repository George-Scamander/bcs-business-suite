import { Button, Card, Form, Input, Typography, message } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { APP_NAME } from '../../../lib/constants'
import { useAuth } from '../auth-context'

interface LoginFormValues {
  email: string
  password: string
}

export function LoginPage() {
  const { t } = useTranslation()
  const { isAuthenticated, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  const fromPath = (location.state as { from?: string } | null)?.from ?? '/app'

  async function handleFinish(values: LoginFormValues) {
    try {
      await signIn(values.email, values.password)
      message.success(t('auth.login.success', { defaultValue: 'Signed in successfully' }))
      navigate(fromPath, { replace: true })
    } catch (error) {
      const text = error instanceof Error ? error.message : t('auth.login.failed', { defaultValue: 'Sign-in failed. Please try again.' })
      message.error(text)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 bg-[radial-gradient(circle_at_20%_20%,rgba(226,232,240,0.55),transparent_45%),linear-gradient(120deg,#f3f4f6,#e5e7eb)]">
      <Card className="w-full max-w-md shadow-[0_20px_45px_-24px_rgba(15,23,42,0.35)]">
        <div className="mb-6">
          <Typography.Title level={3} className="mb-1">
            {APP_NAME}
          </Typography.Title>
          <Typography.Paragraph className="mb-0 text-slate-500">
            {t('auth.login.description', {
              defaultValue: 'Sign in to manage BD leads, onboarding, and projects.',
            })}
          </Typography.Paragraph>
        </div>

        <Form<LoginFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false} autoComplete="off">
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

          <Form.Item
            label={t('auth.login.password', { defaultValue: 'Password' })}
            name="password"
            rules={[{ required: true, message: t('auth.login.passwordRequired', { defaultValue: 'Password is required' }) }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('auth.login.passwordPlaceholder', { defaultValue: 'Enter password' })} />
          </Form.Item>

          <div className="mb-4 flex items-center justify-end">
            <Link to="/forgot-password" className="text-sm">
              {t('auth.login.forgot', { defaultValue: 'Forgot password?' })}
            </Link>
          </div>

          <Button type="primary" htmlType="submit" block>
            {t('auth.login.submit', { defaultValue: 'Sign In' })}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
