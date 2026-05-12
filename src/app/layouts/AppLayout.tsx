import { useEffect, useMemo, useState } from 'react'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
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
import { Avatar, Button, Drawer, Grid, Layout, Menu, Select, Space, Tag, Typography } from 'antd'
import { message } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { APP_NAME, APP_VERSION, NAV_ITEMS_BY_ROLE, ROLE_LABELS, SUPPORTED_LOCALES } from '../../lib/constants'
import type { LocaleCode, RoleCode } from '../../types/rbac'
import { useAuth } from '../../modules/auth/auth-context'
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
  'bd-kpi-dashboard': <LineChartOutlined />,
  'pm-new-project': <PlusSquareOutlined />,
  'pm-leads-import': <CloudUploadOutlined />,
}

const MOBILE_QUICK_NAV_KEYS_BY_ROLE: Record<RoleCode, string[]> = {
  super_admin: ['admin-dashboard', 'users-roles', 'lead-pool', 'admin-onboard-merchants'],
  bd_user: ['bd-dashboard', 'bd-leads', 'bd-new-lead', 'bd-onboarding'],
  project_manager: ['pm-dashboard', 'pm-projects', 'pm-lead-pool', 'pm-onboard-merchants'],
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

const MOBILE_HOME_PATHS = new Set(['/app', '/app/admin/dashboard', '/app/bd/dashboard', '/app/pm/dashboard'])

export function AppLayout() {
  const { t } = useTranslation()
  const { profile, roles, signOut, updateLocale } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locale, setLocale] = useState(profile?.locale ?? 'en')
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const location = useLocation()

  const primaryRole = resolvePrimaryRole(roles)
  const navItemsForRole = NAV_ITEMS_BY_ROLE[primaryRole]
  const isMobile = screens.md === false

  const menuItems: MenuProps['items'] = useMemo(() => {
    return navItemsForRole.map((item) => ({
      key: item.key,
      icon: iconMap[item.key] ?? <AppstoreOutlined />,
      label: t(`nav.${item.key}`, { defaultValue: item.label }),
      onClick: () => {
        navigate(item.path)
        setDrawerOpen(false)
      },
    }))
  }, [navigate, navItemsForRole, t])

  const selectedKey =
    navItemsForRole.find((item) => location.pathname.startsWith(item.path))?.key ?? navItemsForRole[0]?.key

  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/'
  const showMobileBackButton = isMobile && !MOBILE_HOME_PATHS.has(normalizedPath)

  const mobileQuickNavItems = useMemo(() => {
    const quickKeys = new Set(MOBILE_QUICK_NAV_KEYS_BY_ROLE[primaryRole])
    return navItemsForRole.filter((item) => quickKeys.has(item.key))
  }, [navItemsForRole, primaryRole])

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
      message.error(t('common.saveLanguageFail', { defaultValue: 'Failed to save language preference' }))
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function handleMobileBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/app', { replace: true })
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
          width="86vw"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bodyStyle={{ padding: 0 }}
        >
          <div className="px-4 pb-3">
            <Typography.Text className="block text-sm font-medium text-slate-900">
              {profile?.full_name ?? profile?.email}
            </Typography.Text>
            <Typography.Text className="block text-xs text-slate-500">{profile?.email}</Typography.Text>
            <div className="mt-2">
              <Tag color="red" className="m-0">
                {t(`role.${primaryRole}`, { defaultValue: ROLE_LABELS[primaryRole] })}
              </Tag>
            </div>
            <div className="mt-2">
              <Typography.Text type="secondary" className="ml-6 block text-xs">
                {APP_VERSION}
              </Typography.Text>
            </div>
          </div>
          {sideMenu}
        </Drawer>
      )}

      <Layout>
        <Header className="h-auto min-h-[64px] border-b border-slate-200 bg-white px-3 py-2 sm:px-4 md:px-6">
          {isMobile ? (
            <>
              <div className="flex w-full items-center justify-between gap-2">
                <Space size={8} align="center">
                  {showMobileBackButton ? (
                    <Button
                      icon={<ArrowLeftOutlined />}
                      onClick={handleMobileBack}
                      type="text"
                      aria-label={t('common.back', { defaultValue: 'Back' })}
                    />
                  ) : null}
                  <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} type="text" />
                  <Typography.Text className="block text-base font-bold tracking-wide text-slate-900">
                    {t('common.appName', { defaultValue: APP_NAME })}
                  </Typography.Text>
                </Space>
                <Space size={4}>
                  <Button type="text" icon={<BellOutlined />} onClick={() => navigate('/app/notifications')} />
                  <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/app/settings/profile')} />
                </Space>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Select
                    size="small"
                    value={locale}
                    style={{ width: 128 }}
                    options={SUPPORTED_LOCALES.map((item) => ({ value: item.code, label: item.label }))}
                    onChange={(value: LocaleCode) => void handleLocaleChange(value)}
                  />
                  <Tag color="red" className="m-0 shrink-0">
                    {t(`role.${primaryRole}`, { defaultValue: ROLE_LABELS[primaryRole] })}
                  </Tag>
                  <Typography.Text className="truncate text-xs text-slate-600">
                    {profile?.full_name ?? profile?.email}
                  </Typography.Text>
                </div>
                <Button
                  icon={<LogoutOutlined />}
                  onClick={() => void handleSignOut()}
                  className="shrink-0 !h-10 rounded-xl px-3 text-sm font-medium"
                >
                  {t('common.logout', { defaultValue: 'Logout' })}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-2 md:gap-3">
              <Space>
                <div>
                  <Typography.Text className="block text-slate-900 font-medium">
                    {profile?.full_name ?? profile?.email}
                  </Typography.Text>
                  <Typography.Text className="hidden text-xs text-slate-500 sm:block">
                    {t('common.timezone', { defaultValue: 'Timezone' })}: {profile?.timezone ?? 'Asia/Jakarta'}
                  </Typography.Text>
                </div>
              </Space>

              <Space size="middle">
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
            </div>
          )}
        </Header>

        <Content className={isMobile ? 'bg-[#f3f4f6] p-3 pb-28 overflow-x-hidden' : 'bg-[#f3f4f6] p-3 sm:p-4 md:p-6 overflow-x-hidden'}>
          <Outlet />
        </Content>

        {isMobile ? (
          <div className="mobile-bottom-nav">
            {mobileQuickNavItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              const icon = iconMap[item.key] ?? <AppstoreOutlined />

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="mobile-bottom-nav-icon">{icon}</span>
                  <span className="mobile-bottom-nav-label">{t(`nav.${item.key}`, { defaultValue: item.label })}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </Layout>

    </Layout>
  )
}
