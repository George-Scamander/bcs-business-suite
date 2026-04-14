import { Button, Card, Form, Input, Typography, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth-context'

interface ResetPasswordFormValues {
  password: string
  confirmPassword: string
}

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  async function handleFinish(values: ResetPasswordFormValues) {
    if (values.password !== values.confirmPassword) {
      message.error(t('auth.resetPassword.mismatch', { defaultValue: 'Passwords do not match' }))
      return
    }

    try {
      await updatePassword(values.password)
      message.success(t('auth.resetPassword.success', { defaultValue: 'Password updated successfully. Please sign in again.' }))
      navigate('/login', { replace: true })
    } catch (error) {
      const text = error instanceof Error ? error.message : t('auth.resetPassword.failed', { defaultValue: 'Password reset failed.' })
      message.error(text)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 bg-[linear-gradient(135deg,#f9fafb,#dbeafe)]">
      <Card className="w-full max-w-md">
        <Typography.Title level={4}>{t('auth.resetPassword.title', { defaultValue: 'Reset Password' })}</Typography.Title>
        <Typography.Paragraph className="text-slate-500">
          {t('auth.resetPassword.description', { defaultValue: 'Set a new password for your account.' })}
        </Typography.Paragraph>

        <Form<ResetPasswordFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label={t('auth.resetPassword.newPassword', { defaultValue: 'New Password' })}
            name="password"
            rules={[
              { required: true, message: t('auth.login.passwordRequired', { defaultValue: 'Password is required' }) },
              { min: 8, message: t('auth.resetPassword.minLength', { defaultValue: 'Password must be at least 8 characters' }) },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder', { defaultValue: 'Minimum 8 characters' })}
            />
          </Form.Item>

          <Form.Item
            label={t('auth.resetPassword.confirmPassword', { defaultValue: 'Confirm Password' })}
            name="confirmPassword"
            rules={[{ required: true, message: t('auth.resetPassword.confirmRequired', { defaultValue: 'Please confirm your password' }) }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.resetPassword.confirmPlaceholder', { defaultValue: 'Confirm your password' })}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            {t('auth.resetPassword.submit', { defaultValue: 'Update Password' })}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
