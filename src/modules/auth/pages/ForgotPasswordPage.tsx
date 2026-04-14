import { Button, Card, Form, Input, Typography, message } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth-context'

interface ForgotPasswordFormValues {
  email: string
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()

  async function handleFinish(values: ForgotPasswordFormValues) {
    try {
      await requestPasswordReset(values.email)
      message.success('Reset email sent. Please check your inbox.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to send reset email.'
      message.error(text)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 bg-[linear-gradient(120deg,#f8fafc,#e2e8f0)]">
      <Card className="w-full max-w-md">
        <Typography.Title level={4}>Forgot Password</Typography.Title>
        <Typography.Paragraph className="text-slate-500">
          Enter your email and we will send you a reset link.
        </Typography.Paragraph>

        <Form<ForgotPasswordFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Invalid email format' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="you@bosch.com" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            Send Reset Link
          </Button>
        </Form>

        <div className="mt-4 text-sm">
          <Link to="/login">Back to sign in</Link>
        </div>
      </Card>
    </div>
  )
}
