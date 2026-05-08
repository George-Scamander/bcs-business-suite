import type { LocaleCode, RoleCode } from '../types/rbac'

export const APP_NAME = 'BCS Business Suite'
export const APP_VERSION = 'V0.9.0'
export const PRIVATE_BUCKET = 'private-documents'

export const SUPPORTED_LOCALES: Array<{ code: LocaleCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-HK', label: '繁體中文（香港）' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'

export const ROLE_LABELS: Record<RoleCode, string> = {
  super_admin: 'Super Admin',
  bd_user: 'BD User',
  project_manager: 'Project Manager',
}

export const NAV_ITEMS_BY_ROLE: Record<RoleCode, Array<{ key: string; label: string; path: string }>> = {
  super_admin: [
    { key: 'admin-dashboard', label: 'Admin Dashboard', path: '/app/admin/dashboard' },
    { key: 'users-roles', label: 'Users & Roles', path: '/app/admin/users-roles' },
    { key: 'lead-pool', label: 'Lead Pool', path: '/app/admin/leads/pool' },
    { key: 'admin-onboard-merchants', label: 'Onboard Merchants', path: '/app/admin/onboarding/merchants' },
    { key: 'onboarding-review', label: 'Onboarding Review', path: '/app/admin/onboarding/review-center' },
    { key: 'project-overview', label: 'Project Overview', path: '/app/admin/projects/overview' },
    { key: 'sales-supervision', label: 'Sales Supervision', path: '/app/admin/sales/supervision' },
    { key: 'recently-deleted', label: 'Recently Deleted', path: '/app/recently-deleted' },
    { key: 'report-export', label: 'Report Export', path: '/app/admin/reports/export' },
    { key: 'system-config', label: 'System Config', path: '/app/admin/system-config' },
    { key: 'logs', label: 'Operation Logs', path: '/app/admin/logs' },
    { key: 'uploads', label: 'File Center', path: '/app/files' },
    { key: 'profile', label: 'Profile', path: '/app/settings/profile' },
    { key: 'notifications', label: 'Notifications', path: '/app/notifications' },
  ],
  bd_user: [
    { key: 'bd-dashboard', label: 'BD Dashboard', path: '/app/bd/dashboard' },
    { key: 'bd-leads', label: 'Leads', path: '/app/bd/leads' },
    { key: 'bd-new-lead', label: 'Create Lead', path: '/app/bd/leads/new' },
    { key: 'bd-sales-new', label: 'Create Sales', path: '/app/bd/sales/new' },
    { key: 'recently-deleted', label: 'Recently Deleted', path: '/app/recently-deleted' },
    { key: 'bd-onboarding', label: 'Onboarding', path: '/app/bd/onboarding' },
    { key: 'bd-projects', label: 'Linked Projects', path: '/app/bd/projects' },
    { key: 'profile', label: 'Profile', path: '/app/settings/profile' },
    { key: 'notifications', label: 'Notifications', path: '/app/notifications' },
  ],
  project_manager: [
    { key: 'pm-dashboard', label: 'Project Dashboard', path: '/app/pm/dashboard' },
    { key: 'pm-lead-pool', label: 'Lead Pool', path: '/app/pm/leads/pool' },
    { key: 'pm-projects', label: 'Projects', path: '/app/pm/projects' },
    { key: 'pm-onboard-merchants', label: 'Onboard Merchants', path: '/app/pm/onboarding/merchants' },
    { key: 'sales-supervision', label: 'Sales Supervision', path: '/app/pm/sales/supervision' },
    { key: 'pm-new-project', label: 'Create Project', path: '/app/pm/projects/new' },
    { key: 'recently-deleted', label: 'Recently Deleted', path: '/app/recently-deleted' },
    { key: 'pm-leads-import', label: 'Lead Template Import', path: '/app/pm/leads/import' },
    { key: 'uploads', label: 'File Center', path: '/app/files' },
    { key: 'profile', label: 'Profile', path: '/app/settings/profile' },
    { key: 'notifications', label: 'Notifications', path: '/app/notifications' },
  ],
}
