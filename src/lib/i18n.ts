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
