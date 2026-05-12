import type { LocaleCode } from '../../types/rbac'

export const RELEASE_ANNOUNCEMENT_ID = 'release-v1.1.2-2026-05-12'
export const RELEASE_ANNOUNCEMENT_TYPE = 'system_announcement'
export const RELEASE_ANNOUNCEMENT_ENTITY_TYPE = 'system_release_note'

interface AnnouncementContent {
  title: string
  body: string
}

const ANNOUNCEMENT_CONTENT_BY_LOCALE: Record<LocaleCode, AnnouncementContent> = {
  en: {
    title: 'System Version Update V1.1.2',
    body: [
      'I. Admin Portal',
      '- Added subordinate BD visibility and filtering under lead supervision.',
      '- Added homepage dashboard filtering.',
      '',
      'II. Common Features',
      '- Optimized four-language synchronization.',
      '- Clicking "BCS Business Suite" now returns to homepage and refreshes.',
      '- Fixed incomplete date-time display on mobile.',
      '- Added dark mode.',
      '',
      'III. PM Portal',
      '- Optimized BD owner auto-assignment logic during lead upload.',
    ].join('\n'),
  },
  'zh-CN': {
    title: '系统版本更新 V1.1.2',
    body: [
      '一、管理员端口',
      '- 新增线索监督下属BD查看及筛选功能',
      '- 新增主页看板筛选功能',
      '',
      '二、通用功能',
      '- 优化四种语言同步机制',
      '- 点击「BCS业务系统」可返回主页并重新整理页面',
      '- 修复手机版输入日期时间时显示不完整问题',
      '- 新增夜间模式',
      '',
      '三、PM端口',
      '- 优化线索上传时BD负责人自动分配逻辑',
    ].join('\n'),
  },
  'zh-HK': {
    title: '系統版本更新 V1.1.2',
    body: [
      '一、管理員端口',
      '- 新增線索監督下屬BD查看及篩選功能',
      '- 新增主頁看板篩選功能',
      '',
      '二、通用功能',
      '- 優化四種語言同步機制',
      '- 點擊「BCS業務系統」可返回主頁並重新整理頁面',
      '- 修復手機版輸入日期時間時顯示不完整問題',
      '- 新增夜間模式',
      '',
      '三、PM端口',
      '- 優化線索上傳時BD負責人自動分配邏輯',
    ].join('\n'),
  },
  'id-ID': {
    title: 'Pembaruan Sistem V1.1.2',
    body: [
      'I. Portal Admin',
      '- Menambahkan fitur lihat dan filter BD bawahan pada pengawasan lead.',
      '- Menambahkan fitur filter pada dashboard beranda.',
      '',
      'II. Fitur Umum',
      '- Mengoptimalkan sinkronisasi empat bahasa.',
      '- Klik "BCS Business Suite" kini kembali ke beranda dan memuat ulang halaman.',
      '- Memperbaiki tampilan tanggal-waktu yang tidak lengkap di versi mobile.',
      '- Menambahkan mode gelap.',
      '',
      'III. Portal PM',
      '- Mengoptimalkan logika auto-assign PIC BD saat unggah lead.',
    ].join('\n'),
  },
}

const NOTIFICATION_MULTILINGUAL_CONTENT: AnnouncementContent = {
  title: 'System Update / 系統更新 / Pembaruan Sistem V1.1.2',
  body: [
    '[English]',
    ANNOUNCEMENT_CONTENT_BY_LOCALE.en.body,
    '',
    '[简体中文]',
    ANNOUNCEMENT_CONTENT_BY_LOCALE['zh-CN'].body,
    '',
    '[繁體中文（香港）]',
    ANNOUNCEMENT_CONTENT_BY_LOCALE['zh-HK'].body,
    '',
    '[Bahasa Indonesia]',
    ANNOUNCEMENT_CONTENT_BY_LOCALE['id-ID'].body,
  ].join('\n'),
}

export function getReleaseAnnouncementContent(locale?: LocaleCode | null): AnnouncementContent {
  if (!locale) {
    return ANNOUNCEMENT_CONTENT_BY_LOCALE.en
  }

  return ANNOUNCEMENT_CONTENT_BY_LOCALE[locale] ?? ANNOUNCEMENT_CONTENT_BY_LOCALE.en
}

export function getReleaseAnnouncementNotificationContent(): AnnouncementContent {
  return NOTIFICATION_MULTILINGUAL_CONTENT
}
