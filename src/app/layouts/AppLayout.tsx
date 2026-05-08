import { useEffect, useMemo, useState } from 'react'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  BellOutlined,
  BranchesOutlined,
  CloudUploadOutlined,
  ContainerOutlined,
  DeleteOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  HomeOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  ReconciliationOutlined,
  SettingFilled,
  SettingOutlined,
  PlusSquareOutlined,
  SolutionOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Drawer, Grid, Layout, Menu, Modal, Select, Space, Tag, Typography } from 'antd'
import { message } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { APP_NAME, APP_VERSION, NAV_ITEMS_BY_ROLE, ROLE_LABELS, SUPPORTED_LOCALES } from '../../lib/constants'
import type { LocaleCode, RoleCode } from '../../types/rbac'
import { useAuth } from '../../modules/auth/auth-context'
import { supabase } from '../../lib/supabase/client'
import {
  RELEASE_ANNOUNCEMENT_ENTITY_TYPE,
  RELEASE_ANNOUNCEMENT_ID,
  RELEASE_ANNOUNCEMENT_TYPE,
  getReleaseAnnouncementContent,
  getReleaseAnnouncementNotificationContent,
} from '../../modules/shared/release-announcement'
import i18n from '../../lib/i18n'

const { Header, Sider, Content } = Layout

const iconMap: Record<string, React.ReactNode> = {
  'admin-dashboard': <DashboardOutlined />,
  'users-roles': <TeamOutlined />,
  'lead-pool': <UnorderedListOutlined />,
  'admin-onboard-merchants': <ContainerOutlined />,
  'onboarding-review': <ReconciliationOutlined />,
  'project-overview': <DeploymentUnitOutlined />,
  'recently-deleted': <DeleteOutlined />,
  'report-export': <LineChartOutlined />,
  'system-config': <SettingFilled />,
  logs: <FileTextOutlined />,
  uploads: <AppstoreOutlined />,
  profile: <UserOutlined />,
  notifications: <BellOutlined />,
  'bd-dashboard': <HomeOutlined />,
  'bd-leads': <UnorderedListOutlined />,
  'bd-new-lead': <SolutionOutlined />,
  'bd-sales-new': <ShoppingOutlined />,
  'bd-onboarding': <ContainerOutlined />,
  'bd-projects': <BranchesOutlined />,
  'pm-dashboard': <DashboardOutlined />,
  'pm-lead-pool': <UnorderedListOutlined />,
  'pm-projects': <BranchesOutlined />,
  'pm-onboard-merchants': <ContainerOutlined />,
  'sales-supervision': <LineChartOutlined />,
  'pm-new-project': <PlusSquareOutlined />,
  'pm-leads-import': <CloudUploadOutlined />,
}

function resolvePrimaryRole(roles: RoleCode[]): RoleCode {
  if (roles.includes('super_admin')) {
    return 'super_admin'
  }

  if (roles.includes('project_manager')) {
    return 'project_manager'
  }

  return 'bd_user'
}

interface AnnouncementNotificationRow {
  id: string
  is_read: boolean
  title: string
  body: string | null
}

function getHomePathByRole(role: RoleCode): string {
  if (role === 'super_admin') {
    return '/app/admin/dashboard'
  }

  if (role === 'project_manager') {
    return '/app/pm/dashboard'
  }

  return '/app/bd/dashboard'
}

export function AppLayout() {
  const { t } = useTranslation()
  const { user, profile, roles, signOut, updateLocale } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locale, setLocale] = useState(profile?.locale ?? 'en')
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [announcementNotificationId, setAnnouncementNotificationId] = useState<string | null>(null)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const location = useLocation()

  const primaryRole = resolvePrimaryRole(roles)

  const menuItems: MenuProps['items'] = useMemo(() => {
    return NAV_ITEMS_BY_ROLE[primaryRole].map((item) => ({
      key: item.key,
      icon: iconMap[item.key] ?? <AppstoreOutlined />,
      label: t(`nav.${item.key}`, { defaultValue: item.label }),
      onClick: () => {
        navigate(item.path)
        setDrawerOpen(false)
      },
    }))
  }, [navigate, primaryRole, t])

  const selectedKey =
    NAV_ITEMS_BY_ROLE[primaryRole].find((item) => location.pathname.startsWith(item.path))?.key ??
    NAV_ITEMS_BY_ROLE[primaryRole][0]?.key

  const isPrimaryHomePath = location.pathname === getHomePathByRole(primaryRole)

  useEffect(() => {
    if (profile?.locale) {
      setLocale(profile.locale)
      void i18n.changeLanguage(profile.locale)
    }
  }, [profile?.locale])

  useEffect(() => {
    if (!user || !profile || !isPrimaryHomePath) {
      return
    }

    const currentUser = user
    const currentProfile = profile
    let canceled = false

    async function ensureAndShowAnnouncement() {
      const localizedAnnouncement = getReleaseAnnouncementContent(currentProfile.locale)
      const notificationAnnouncement = getReleaseAnnouncementNotificationContent()

      const existingResult = await supabase
        .from('notifications')
        .select('id, is_read, title, body')
        .eq('user_id', currentUser.id)
        .eq('type', RELEASE_ANNOUNCEMENT_TYPE)
        .eq('entity_type', RELEASE_ANNOUNCEMENT_ENTITY_TYPE)
        .eq('entity_id', RELEASE_ANNOUNCEMENT_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<AnnouncementNotificationRow>()

      if (existingResult.error) {
        message.error(
          existingResult.error.message ||
            t('pages.notifications.loadFail', { defaultValue: 'Failed to load notifications' }),
        )
        return
      }

      let notificationRow = existingResult.data

      if (!notificationRow) {
        const insertResult = await supabase
          .from('notifications')
          .insert({
            user_id: currentUser.id,
            type: RELEASE_ANNOUNCEMENT_TYPE,
            title: notificationAnnouncement.title,
            body: notificationAnnouncement.body,
            entity_type: RELEASE_ANNOUNCEMENT_ENTITY_TYPE,
            entity_id: RELEASE_ANNOUNCEMENT_ID,
            is_read: false,
          })
          .select('id, is_read, title, body')
          .single<AnnouncementNotificationRow>()

        if (insertResult.error) {
          message.error(
            insertResult.error.message ||
              t('pages.notifications.loadFail', { defaultValue: 'Failed to load notifications' }),
          )
          return
        }

        notificationRow = insertResult.data
      }

      if (canceled || !notificationRow) {
        return
      }

      if (!notificationRow.is_read) {
        setAnnouncementNotificationId(notificationRow.id)
        setAnnouncementTitle(localizedAnnouncement.title)
        setAnnouncementBody(localizedAnnouncement.body)
        setAnnouncementOpen(true)
      }
    }

    void ensureAndShowAnnouncement()

    return () => {
      canceled = true
    }
  }, [isPrimaryHomePath, profile, t, user])

  async function handleLocaleChange(value: LocaleCode) {
    setLocale(value)
    await i18n.changeLanguage(value)

    try {
      await updateLocale(value)
    } catch {
      message.error(t('common.saveLanguageFail', { defaultValue: 'Failed to save language preference' }))
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleCloseAnnouncement() {
    if (!announcementNotificationId) {
      setAnnouncementOpen(false)
      return
    }

    setAnnouncementSaving(true)

    const updateResult = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', announcementNotificationId)

    setAnnouncementSaving(false)

    if (updateResult.error) {
      message.error(
        updateResult.error.message ||
          t('pages.notifications.markReadFail', { defaultValue: 'Failed to mark notification as read' }),
      )
      return
    }

    setAnnouncementOpen(false)
  }

  const sideMenu = (
    <Menu
      mode="inline"
      selectedKeys={selectedKey ? [selectedKey] : []}
      items={menuItems}
      className="h-full border-0"
    />
  )

  return (
    <Layout className="min-h-dvh">
      {screens.md ? (
        <Sider width={248} className="bg-white border-r border-slate-200">
          <div className="px-5 py-5 border-b border-slate-200">
            <Typography.Title level={4} className="mb-1">
              {t('common.appName', { defaultValue: APP_NAME })}
            </Typography.Title>
            <Space size={8} align="center">
              <Tag color="red" className="m-0">
                {t(`role.${primaryRole}`, { defaultValue: ROLE_LABELS[primaryRole] })}
              </Tag>
              <Typography.Text type="secondary" className="text-xs">
                {APP_VERSION}
              </Typography.Text>
            </Space>
          </div>
          {sideMenu}
        </Sider>
      ) : (
        <Drawer
          title={t('common.appName', { defaultValue: APP_NAME })}
          placement="left"
          width={280}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bodyStyle={{ padding: 0 }}
        >
          {sideMenu}
        </Drawer>
      )}

      <Layout>
        <Header className="h-auto min-h-[64px] border-b border-slate-200 bg-white px-3 py-2 sm:px-4 md:px-6">
          <div className="flex w-full items-center justify-between gap-2 md:gap-3">
            <Space>
              {screens.md === false ? (
                <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} type="text" />
              ) : null}
              <div>
                <Typography.Text className="block text-slate-900 font-medium">
                  {profile?.full_name ?? profile?.email}
                </Typography.Text>
                <Typography.Text className="hidden text-xs text-slate-500 sm:block">
                  {t('common.timezone', { defaultValue: 'Timezone' })}: {profile?.timezone ?? 'Asia/Jakarta'}
                </Typography.Text>
              </div>
            </Space>

            <Space size={screens.md ? 'middle' : 'small'} wrap={!screens.md}>
              <Select
                size="small"
                value={locale}
                style={{ width: screens.md ? 150 : 120 }}
                options={SUPPORTED_LOCALES.map((item) => ({ value: item.code, label: item.label }))}
                onChange={(value: LocaleCode) => void handleLocaleChange(value)}
              />
              <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/app/settings/profile')} />
              <Button type="text" icon={<BellOutlined />} onClick={() => navigate('/app/notifications')} />
              {screens.md ? <Avatar icon={<UserOutlined />} /> : null}
              <Button icon={<LogoutOutlined />} onClick={() => void handleSignOut()}>
                {screens.md ? t('common.logout', { defaultValue: 'Logout' }) : null}
              </Button>
            </Space>
          </div>
        </Header>

        <Content className="bg-[#f3f4f6] p-3 sm:p-4 md:p-6">
          <Outlet />
        </Content>
      </Layout>

      <Modal
        open={announcementOpen}
        centered
        maskClosable={false}
        closable={false}
        width={760}
        title={announcementTitle}
        onCancel={() => void handleCloseAnnouncement()}
        footer={[
          <Button
            key="acknowledge"
            type="primary"
            loading={announcementSaving}
            onClick={() => void handleCloseAnnouncement()}
          >
            {t('common.confirm', { defaultValue: 'I Understand' })}
          </Button>,
        ]}
      >
        <Typography.Paragraph className="mb-0 whitespace-pre-line">{announcementBody}</Typography.Paragraph>
      </Modal>
    </Layout>
  )
}
