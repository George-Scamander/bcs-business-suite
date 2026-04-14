import { useEffect, useMemo, useState } from 'react'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  BellOutlined,
  BranchesOutlined,
  ContainerOutlined,
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
  SolutionOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Drawer, Grid, Layout, Menu, Select, Space, Tag, Typography } from 'antd'
import { message } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { APP_NAME, NAV_ITEMS_BY_ROLE, ROLE_LABELS, SUPPORTED_LOCALES } from '../../lib/constants'
import type { LocaleCode, RoleCode } from '../../types/rbac'
import { useAuth } from '../../modules/auth/auth-context'
import i18n from '../../lib/i18n'

const { Header, Sider, Content } = Layout

const iconMap: Record<string, React.ReactNode> = {
  'admin-dashboard': <DashboardOutlined />,
  'users-roles': <TeamOutlined />,
  'lead-pool': <UnorderedListOutlined />,
  'onboarding-review': <ReconciliationOutlined />,
  'project-overview': <DeploymentUnitOutlined />,
  'report-export': <LineChartOutlined />,
  'system-config': <SettingFilled />,
  logs: <FileTextOutlined />,
  uploads: <AppstoreOutlined />,
  profile: <UserOutlined />,
  notifications: <BellOutlined />,
  'bd-dashboard': <HomeOutlined />,
  'bd-leads': <UnorderedListOutlined />,
  'bd-new-lead': <SolutionOutlined />,
  'bd-onboarding': <ContainerOutlined />,
  'bd-projects': <BranchesOutlined />,
  'pm-dashboard': <DashboardOutlined />,
  'pm-projects': <BranchesOutlined />,
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

export function AppLayout() {
  const { t } = useTranslation()
  const { profile, roles, signOut, updateLocale } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locale, setLocale] = useState(profile?.locale ?? 'en')
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

  useEffect(() => {
    if (profile?.locale) {
      setLocale(profile.locale)
      void i18n.changeLanguage(profile.locale)
    }
  }, [profile?.locale])

  async function handleLocaleChange(value: LocaleCode) {
    setLocale(value)
    await i18n.changeLanguage(value)

    try {
      await updateLocale(value)
    } catch {
      message.error('Failed to save language preference')
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
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
            <Tag color="red" className="m-0">
              {t(`role.${primaryRole}`, { defaultValue: ROLE_LABELS[primaryRole] })}
            </Tag>
          </div>
          {sideMenu}
        </Sider>
      ) : (
        <Drawer
          title={t('common.appName', { defaultValue: APP_NAME })}
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bodyStyle={{ padding: 0 }}
        >
          {sideMenu}
        </Drawer>
      )}

      <Layout>
        <Header className="flex items-center justify-between bg-white px-4 md:px-6 border-b border-slate-200">
          <Space>
            {screens.md === false ? (
              <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} type="text" />
            ) : null}
            <div>
              <Typography.Text className="block text-slate-900 font-medium">
                {profile?.full_name ?? profile?.email}
              </Typography.Text>
              <Typography.Text className="text-xs text-slate-500">
                {t('common.timezone', { defaultValue: 'Timezone' })}: {profile?.timezone ?? 'Asia/Jakarta'}
              </Typography.Text>
            </div>
          </Space>

          <Space>
            <Select
              size="small"
              value={locale}
              style={{ width: 150 }}
              options={SUPPORTED_LOCALES.map((item) => ({ value: item.code, label: item.label }))}
              onChange={(value: LocaleCode) => void handleLocaleChange(value)}
            />
            <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/app/settings/profile')} />
            <Button type="text" icon={<BellOutlined />} onClick={() => navigate('/app/notifications')} />
            <Avatar icon={<UserOutlined />} />
            <Button icon={<LogoutOutlined />} onClick={() => void handleSignOut()}>
              {t('common.logout', { defaultValue: 'Logout' })}
            </Button>
          </Space>
        </Header>

        <Content className="bg-[#f3f4f6] p-4 md:p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
