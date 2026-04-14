import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_LOCALE } from './constants'

const resources = {
  en: {
    translation: {
      common: {
        appName: 'BCS Business Suite',
        loading: 'Loading...',
        save: 'Save',
        cancel: 'Cancel',
        logout: 'Logout',
        timezone: 'Timezone',
        loadingPermissions: 'Loading permissions...',
      },
      role: {
        super_admin: 'Super Admin',
        bd_user: 'BD User',
        project_manager: 'Project Manager',
      },
      nav: {
        'admin-dashboard': 'Admin Dashboard',
        'users-roles': 'Users & Roles',
        'lead-pool': 'Lead Pool',
        'onboarding-review': 'Onboarding Review',
        'project-overview': 'Project Overview',
        'report-export': 'Report Export',
        'system-config': 'System Config',
        logs: 'Operation Logs',
        uploads: 'File Center',
        profile: 'Profile',
        notifications: 'Notifications',
        'bd-dashboard': 'BD Dashboard',
        'bd-leads': 'Leads',
        'bd-new-lead': 'Create Lead',
        'bd-onboarding': 'Onboarding',
        'bd-projects': 'Linked Projects',
        'pm-dashboard': 'Project Dashboard',
        'pm-projects': 'Projects',
      },
    },
  },
  'zh-CN': {
    translation: {
      common: {
        appName: 'BCS业务系统',
        loading: '加载中...',
        save: '保存',
        cancel: '取消',
        logout: '退出登录',
        timezone: '时区',
        loadingPermissions: '正在加载权限...',
      },
      role: {
        super_admin: '超级管理员',
        bd_user: 'BD用户',
        project_manager: '项目经理',
      },
      nav: {
        'admin-dashboard': '管理员看板',
        'users-roles': '用户与角色',
        'lead-pool': '线索池',
        'onboarding-review': '入驻审核',
        'project-overview': '项目总览',
        'report-export': '报表导出',
        'system-config': '系统配置',
        logs: '操作日志',
        uploads: '文件中心',
        profile: '个人设置',
        notifications: '通知',
        'bd-dashboard': 'BD看板',
        'bd-leads': '线索列表',
        'bd-new-lead': '新增线索',
        'bd-onboarding': '入驻管理',
        'bd-projects': '关联项目',
        'pm-dashboard': '项目看板',
        'pm-projects': '项目列表',
      },
    },
  },
  'id-ID': {
    translation: {
      common: {
        appName: 'Sistem Bisnis BCS',
        loading: 'Memuat...',
        save: 'Simpan',
        cancel: 'Batal',
        logout: 'Keluar',
        timezone: 'Zona waktu',
        loadingPermissions: 'Memuat izin...',
      },
      role: {
        super_admin: 'Admin Super',
        bd_user: 'Pengguna BD',
        project_manager: 'Manajer Proyek',
      },
      nav: {
        'admin-dashboard': 'Dashboard Admin',
        'users-roles': 'Pengguna & Peran',
        'lead-pool': 'Kolam Lead',
        'onboarding-review': 'Tinjauan Onboarding',
        'project-overview': 'Ringkasan Proyek',
        'report-export': 'Ekspor Laporan',
        'system-config': 'Konfigurasi Sistem',
        logs: 'Log Operasi',
        uploads: 'Pusat Berkas',
        profile: 'Profil',
        notifications: 'Notifikasi',
        'bd-dashboard': 'Dashboard BD',
        'bd-leads': 'Lead',
        'bd-new-lead': 'Buat Lead',
        'bd-onboarding': 'Onboarding',
        'bd-projects': 'Proyek Terkait',
        'pm-dashboard': 'Dashboard Proyek',
        'pm-projects': 'Proyek',
      },
    },
  },
}

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
