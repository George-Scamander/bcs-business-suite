import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, List, Tag, Typography, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { supabase } from '../../../lib/supabase/client'
import { useAuth } from '../../auth/auth-context'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

export function NotificationsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)
    const result = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (result.error) {
      message.error(result.error.message || t('pages.notifications.loadFail', { defaultValue: 'Failed to load notifications' }))
      return
    }

    setItems((result.data ?? []) as NotificationRow[])
  }, [t, user])

  async function markAsRead(notificationId: string) {
    const result = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (result.error) {
      message.error(result.error.message || t('pages.notifications.markReadFail', { defaultValue: 'Failed to mark notification as read' }))
      return
    }

    setItems((current) => current.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)))
  }

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  return (
    <>
      <PageTitleBar
        title={t('pages.notifications.title', { defaultValue: 'Notification Center' })}
        description={t('pages.notifications.description', {
          defaultValue: 'Receive reminders for pending actions, review requests, and status updates.',
        })}
        extra={<Button onClick={() => void loadNotifications()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <List
          loading={loading}
          dataSource={items}
          locale={{ emptyText: t('pages.notifications.empty', { defaultValue: 'No notifications yet.' }) }}
          renderItem={(item) => (
            <List.Item
              actions={
                item.is_read
                  ? [
                      <Tag color="green" key="read">
                        {t('pages.notifications.read', { defaultValue: 'Read' })}
                      </Tag>,
                    ]
                  : [
                      <Button key="mark-read" type="link" onClick={() => void markAsRead(item.id)}>
                        {t('pages.notifications.markAsRead', { defaultValue: 'Mark as read' })}
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center gap-2">
                    <Badge color={item.is_read ? '#94a3b8' : '#ef4444'} />
                    <Typography.Text>{item.title}</Typography.Text>
                  </div>
                }
                description={
                  <>
                    <Typography.Paragraph className="mb-1">{item.body}</Typography.Paragraph>
                    <Typography.Text type="secondary">
                      {new Date(item.created_at).toLocaleString()}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </>
  )
}
