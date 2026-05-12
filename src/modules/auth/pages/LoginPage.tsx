import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Button, Card, Checkbox, Form, Input, Select, Space, Tag, Typography, message } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { APP_NAME } from '../../../lib/constants'
import { SUPPORTED_LOCALES } from '../../../lib/constants'
import type { LocaleCode } from '../../../types/rbac'
import i18n from '../../../lib/i18n'
import { useAuth } from '../auth-context'

interface LoginFormValues {
  email: string
  password: string
  rememberMe: boolean
}

const LOGIN_DOMAIN = 'xmotorsid.onmicrosoft.com'
const RECENT_EMAILS_KEY = 'login-recent-emails'
const REMEMBER_LOGIN_KEY = 'login-remembered-credentials'
const LOGIN_LOCALE_KEY = 'login-locale'
const MAX_RECENT_EMAILS = 5

function normalizeEmailInput(rawEmail: string): string {
  const value = rawEmail.trim()
  if (!value) {
    return value
  }

  if (value.includes('@')) {
    return value
  }

  return `${value}@${LOGIN_DOMAIN}`
}

function isEmailLike(value: string): boolean {
  const input = value.trim()
  if (!input) {
    return false
  }

  if (!input.includes('@')) {
    return /^[A-Za-z0-9._%+-]+$/.test(input)
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

export function LoginPage() {
  const [form] = Form.useForm<LoginFormValues>()
  const { t } = useTranslation()
  const { isAuthenticated, isLoading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [recentEmails, setRecentEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState(false)
  const [locale, setLocale] = useState<LocaleCode>(i18n.language as LocaleCode)

  const fromPath = (location.state as { from?: string } | null)?.from ?? '/app'

  useEffect(() => {
    if (!pendingRedirect) {
      return
    }

    if (isAuthenticated && !isLoading) {
      navigate(fromPath, { replace: true })
      setPendingRedirect(false)
    }
  }, [fromPath, isAuthenticated, isLoading, navigate, pendingRedirect])

  useEffect(() => {
    if (isAuthenticated && !isLoading && !pendingRedirect) {
      navigate('/app', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, pendingRedirect])

  useEffect(() => {
    try {
      const rememberedRaw = localStorage.getItem(REMEMBER_LOGIN_KEY)
      if (rememberedRaw) {
        const remembered = JSON.parse(rememberedRaw) as { email?: string; password?: string }
        if (remembered.email && remembered.password) {
          form.setFieldsValue({
            email: remembered.email,
            password: remembered.password,
            rememberMe: true,
          })
          setEmailInput(remembered.email)
        }
      }
    } catch {
      localStorage.removeItem(REMEMBER_LOGIN_KEY)
    }

    try {
      const storedLocale = localStorage.getItem(LOGIN_LOCALE_KEY) as LocaleCode | null
      if (storedLocale && SUPPORTED_LOCALES.some((item) => item.code === storedLocale)) {
        setLocale(storedLocale)
        void i18n.changeLanguage(storedLocale)
      }
    } catch {
      localStorage.removeItem(LOGIN_LOCALE_KEY)
    }
  }, [form])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_EMAILS_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return
      }

      const emails = parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
      setRecentEmails(emails.slice(0, MAX_RECENT_EMAILS))
    } catch {
      setRecentEmails([])
    }
  }, [])

  const autoCompleteOptions = useMemo(() => {
    const input = emailInput.trim().toLowerCase()
    const suggestions = new Set<string>()

    if (input) {
      if (input.includes('@')) {
        suggestions.add(emailInput.trim())
      } else {
        suggestions.add(`${emailInput.trim()}@${LOGIN_DOMAIN}`)
      }
    }

    for (const email of recentEmails) {
      if (!input || email.toLowerCase().includes(input)) {
        suggestions.add(email)
      }
    }

    return Array.from(suggestions).map((value) => ({ value }))
  }, [emailInput, recentEmails])

  function persistRecentEmail(email: string) {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      return
    }

    const next = [normalized, ...recentEmails.filter((item) => item.toLowerCase() !== normalized)].slice(0, MAX_RECENT_EMAILS)
    setRecentEmails(next)
    localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next))
  }

  async function handleFinish(values: LoginFormValues) {
    setSubmitting(true)

    try {
      const normalizedEmail = normalizeEmailInput(values.email)
      await signIn(normalizedEmail, values.password)
      persistRecentEmail(normalizedEmail)
      if (values.rememberMe) {
        localStorage.setItem(
          REMEMBER_LOGIN_KEY,
          JSON.stringify({
            email: normalizedEmail,
            password: values.password,
          }),
        )
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY)
      }
      message.success(t('auth.login.success', { defaultValue: 'Signed in successfully' }))
      setPendingRedirect(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('auth.login.failed', { defaultValue: 'Sign-in failed. Please try again.' })
      message.error(text)
      setPendingRedirect(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10 bg-[radial-gradient(circle_at_20%_20%,rgba(226,232,240,0.55),transparent_45%),linear-gradient(120deg,#f3f4f6,#e5e7eb)]">
      <Card className="w-full max-w-md shadow-[0_20px_45px_-24px_rgba(15,23,42,0.35)]">
        <div className="mb-4 flex justify-end">
          <Select
            size="small"
            value={locale}
            style={{ width: 156 }}
            options={SUPPORTED_LOCALES.map((item) => ({ value: item.code, label: item.label }))}
            onChange={(value: LocaleCode) => {
              setLocale(value)
              localStorage.setItem(LOGIN_LOCALE_KEY, value)
              void i18n.changeLanguage(value)
            }}
          />
        </div>
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

        <Form<LoginFormValues>
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
          autoComplete="off"
          initialValues={{ rememberMe: false }}
        >
          <Form.Item
            label={t('page.common.email', { defaultValue: 'Email' })}
            name="email"
            rules={[
              { required: true, message: t('auth.login.emailRequired', { defaultValue: 'Email is required' }) },
              {
                validator: async (_rule, value: string) => {
                  if (!value || isEmailLike(value)) {
                    return
                  }
                  throw new Error(t('auth.login.emailInvalid', { defaultValue: 'Invalid email format' }))
                },
              },
            ]}
          >
            <AutoComplete
              options={autoCompleteOptions}
              onSearch={(value) => setEmailInput(value)}
              onChange={(value) => setEmailInput(value)}
              onSelect={(value) => {
                setEmailInput(value)
                form.setFieldValue('email', value)
              }}
              filterOption={false}
            >
              <Input
                prefix={<MailOutlined />}
                addonAfter={!emailInput.includes('@') ? `@${LOGIN_DOMAIN}` : undefined}
                placeholder={t('auth.login.emailPlaceholder', { defaultValue: 'yourname' })}
              />
            </AutoComplete>
          </Form.Item>

          {recentEmails.length > 0 ? (
            <div className="mb-3">
              <div className="mb-2 text-xs text-slate-500">
                {t('auth.login.recentAccounts', { defaultValue: 'Recent accounts' })}
              </div>
              <Space size={[8, 8]} wrap>
                {recentEmails.map((email) => (
                  <Tag
                    key={email}
                    className="cursor-pointer"
                    onClick={() => {
                      form.setFieldValue('email', email)
                      setEmailInput(email)
                    }}
                  >
                    {email}
                  </Tag>
                ))}
              </Space>
            </div>
          ) : null}

          <Form.Item
            label={t('auth.login.password', { defaultValue: 'Password' })}
            name="password"
            rules={[{ required: true, message: t('auth.login.passwordRequired', { defaultValue: 'Password is required' }) }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('auth.login.passwordPlaceholder', { defaultValue: 'Enter password' })} />
          </Form.Item>

          <div className="mb-4 flex items-center justify-between">
            <Form.Item name="rememberMe" valuePropName="checked" noStyle>
              <Checkbox>{t('auth.login.rememberMe', { defaultValue: 'Remember username and password' })}</Checkbox>
            </Form.Item>
            <Link to="/forgot-password" className="text-sm">
              {t('auth.login.forgot', { defaultValue: 'Forgot password?' })}
            </Link>
          </div>

          <Button type="primary" htmlType="submit" block loading={submitting}>
            {t('auth.login.submit', { defaultValue: 'Sign In' })}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
