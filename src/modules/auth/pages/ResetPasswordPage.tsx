import { Button, Card, Form, Input, Typography, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth-context'

interface ResetPasswordFormValues {
  password: string
  confirmPassword: string
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  async function handleFinish(values: ResetPasswordFormValues) {
    if (values.password !== values.confirmPassword) {
      message.error('Passwords do not match')
      return
    }

    try {
      await updatePassword(values.password)
      message.success('Password updated successfully. Please sign in again.')
      navigate('/login', { replace: true })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Password reset failed.'
      message.error(text)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 bg-[linear-gradient(135deg,#f9fafb,#dbeafe)]">
      <Card className="w-full max-w-md">
        <Typography.Title level={4}>Reset Password</Typography.Title>
        <Typography.Paragraph className="text-slate-500">
          Set a new password for your account.
        </Typography.Paragraph>

        <Form<ResetPasswordFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label="New Password"
            name="password"
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Minimum 8 characters" />
          </Form.Item>

          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            rules={[{ required: true, message: 'Please confirm your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm your password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            Update Password
          </Button>
        </Form>
      </Card>
    </div>
  )
}
