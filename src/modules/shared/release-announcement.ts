import type { LocaleCode } from '../../types/rbac'

export const RELEASE_ANNOUNCEMENT_ID = 'release-v0.9.0-2026-05-08'
export const RELEASE_ANNOUNCEMENT_TYPE = 'system_announcement'
export const RELEASE_ANNOUNCEMENT_ENTITY_TYPE = 'system_release_note'

interface AnnouncementContent {
  title: string
  body: string
}

const ANNOUNCEMENT_CONTENT_BY_LOCALE: Record<LocaleCode, AnnouncementContent> = {
  en: {
    title: 'System Update Notice V0.9.0 (May 8, 2026)',
    body: [
      'System Version Update Log (V0.8 → V0.9.0)',
      'Before update: V0.8',
      'After update: V0.9.0',
      '',
      'This release improves key modules and resolves workflow issues:',
      '',
      'I. General Modules',
      '- Added Sales Order form to improve sales data entry efficiency.',
      '- Added Auto Lead Creation to simplify lead generation.',
      '- Added Sales Lead Tracking to support full lifecycle follow-up.',
      '- Added Merchant Onboarding and Onboarding Management to strengthen merchant operations.',
      '',
      'II. Admin / PM Modules',
      '- Added dashboard-card click-through navigation for faster access to detail data.',
      '- Removed redundant task status options to simplify task operations.',
      '- Optimized project list status behavior for a clearer viewing and editing experience.',
      '',
      'III. Fixes',
      '- Fixed multiple issues affecting operation logic and overall flow stability.',
      '- Fixed task workflow blockers that could prevent process progression.',
      '- Fixed multilingual text sync gaps across language options to improve localization consistency.',
    ].join('\n'),
  },
  'zh-CN': {
    title: '系统版本更新公告 V0.9.0（2026年5月8日）',
    body: [
      '系统版本更新日志（V0.8 → V0.9.0）',
      '更新前版本号：V0.8',
      '更新后版本号：V0.9.0',
      '',
      '本次版本更新主要优化系统功能、修复操作问题，具体如下：',
      '',
      '一、通用端口',
      '- 新增销售表单功能，提升销售数据录入效率。',
      '- 新增自动创建线索功能，简化线索生成流程。',
      '- 新增销售线索追踪管理功能，便于全程跟进线索状态。',
      '- 新增商家入驻功能及商家入驻管理功能，完善商家管理体系。',
      '',
      '二、管理者/PM端口',
      '- 新增仪表盘模块点击跳转功能，提升操作便捷性。',
      '- 移除任务状态冗余选项，优化界面与流程简洁度。',
      '- 优化项目列表状态使用逻辑，提升查看与操作体验。',
      '',
      '三、问题修复',
      '- 修复若干影响操作逻辑的异常问题，保障系统操作流畅性。',
      '- 修复若干任务流程无法正常推进的问题，确保工作流程顺畅。',
      '- 修复不同语言选项对应文案未同步的问题，提升多语言使用体验。',
    ].join('\n'),
  },
  'zh-HK': {
    title: '系統版本更新公告 V0.9.0（2026年5月8日）',
    body: [
      '系統版本更新日誌（V0.8 → V0.9.0）',
      '更新前版本號：V0.8',
      '更新後版本號：V0.9.0',
      '',
      '今次版本更新主要優化系統功能及修復操作問題，內容如下：',
      '',
      '一、通用端口',
      '- 新增銷售表單功能，提升銷售數據輸入效率。',
      '- 新增自動建立線索功能，簡化線索建立流程。',
      '- 新增銷售線索追蹤管理功能，方便全程跟進線索狀態。',
      '- 新增商家入駐功能及商家入駐管理功能，完善商家管理體系。',
      '',
      '二、管理者/PM端口',
      '- 新增儀表板模組點擊跳轉功能，提升操作便捷性。',
      '- 移除任務狀態冗餘選項，優化介面與流程簡潔度。',
      '- 優化項目列表狀態使用邏輯，提升檢視與操作體驗。',
      '',
      '三、問題修復',
      '- 修復多項影響操作邏輯的異常問題，確保系統操作更流暢。',
      '- 修復多項任務流程未能正常推進的問題，確保工作流程順暢。',
      '- 修復不同語言選項對應文案未同步的問題，提升多語言使用體驗。',
    ].join('\n'),
  },
  'id-ID': {
    title: 'Pengumuman Pembaruan Sistem V0.9.0 (8 Mei 2026)',
    body: [
      'Log Pembaruan Versi Sistem (V0.8 → V0.9.0)',
      'Versi sebelum pembaruan: V0.8',
      'Versi setelah pembaruan: V0.9.0',
      '',
      'Rilis ini berfokus pada peningkatan fitur dan perbaikan alur operasional:',
      '',
      'I. Modul Umum',
      '- Menambahkan formulir Sales Order untuk meningkatkan efisiensi input data penjualan.',
      '- Menambahkan pembuatan lead otomatis untuk menyederhanakan proses lead.',
      '- Menambahkan pelacakan lead penjualan agar status lead dapat dipantau end-to-end.',
      '- Menambahkan onboarding merchant dan manajemen onboarding merchant untuk memperkuat tata kelola merchant.',
      '',
      'II. Modul Admin / PM',
      '- Menambahkan fitur klik modul dashboard untuk langsung membuka data detail.',
      '- Menghapus opsi status task yang redundan agar alur lebih ringkas.',
      '- Mengoptimalkan perilaku status pada daftar proyek untuk pengalaman lihat dan edit yang lebih baik.',
      '',
      'III. Perbaikan',
      '- Memperbaiki berbagai masalah yang memengaruhi logika operasional agar alur lebih stabil.',
      '- Memperbaiki kendala pada alur task yang dapat menghambat progres kerja.',
      '- Memperbaiki ketidaksinkronan konten antar bahasa agar pengalaman multi-bahasa lebih konsisten.',
    ].join('\n'),
  },
}

const NOTIFICATION_MULTILINGUAL_CONTENT: AnnouncementContent = {
  title: 'System Update / 系統更新 / Pembaruan Sistem V0.9.0',
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
