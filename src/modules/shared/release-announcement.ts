import type { LocaleCode } from '../../types/rbac'

export const RELEASE_ANNOUNCEMENT_ID = 'release-v1.4.2-2026-06-30'
export const RELEASE_ANNOUNCEMENT_TYPE = 'system_announcement'
export const RELEASE_ANNOUNCEMENT_ENTITY_TYPE = 'system_release_note'

interface AnnouncementContent {
  title: string
  body: string
}

const ANNOUNCEMENT_CONTENT_BY_LOCALE: Record<LocaleCode, AnnouncementContent> = {
  en: {
    title: 'System Version Update V1.4.2',
    body: [
      'I. PM Portal — Sales Management',
      '- Added "Consignment" payment method with a fixed 30-day consignment period.',
      '- Added payment method filter (TOP / Cash / Consignment).',
      '- Added payment status filter (Paid / Unpaid).',
      '- Widened the quantity input field in the sales item table.',
    ].join('\n'),
  },
  'zh-CN': {
    title: '系统版本更新 V1.4.2',
    body: [
      '一、PM端口 — 销售管理',
      '- 新增「寄售（Consignment）」付款方式，固定30天寄售周期。',
      '- 新增付款方式筛选（TOP / 现金 / 寄售）。',
      '- 新增付款状态筛选（已付款 / 未付款）。',
      '- 销售项目表格中的数量输入框已加宽。',
    ].join('\n'),
  },
  'zh-HK': {
    title: '系統版本更新 V1.4.2',
    body: [
      '一、PM端口 — 銷售管理',
      '- 新增「寄售（Consignment）」付款方式，固定30天寄售周期。',
      '- 新增付款方式篩選（TOP / 現金 / 寄售）。',
      '- 新增付款狀態篩選（已付款 / 未付款）。',
      '- 銷售項目表格中的數量輸入欄已加寬。',
    ].join('\n'),
  },
  'id-ID': {
    title: 'Pembaruan Sistem V1.4.2',
    body: [
      'I. Portal PM — Manajemen Penjualan',
      '- Menambahkan metode pembayaran "Konsinyasi" dengan periode konsinyasi tetap 30 hari.',
      '- Menambahkan filter metode pembayaran (TOP / Tunai / Konsinyasi).',
      '- Menambahkan filter status pembayaran (Lunas / Belum Lunas).',
      '- Kolom input jumlah pada tabel item penjualan diperlebar.',
    ].join('\n'),
  },
}

const NOTIFICATION_MULTILINGUAL_CONTENT: AnnouncementContent = {
  title: 'System Update / 系統更新 / Pembaruan Sistem V1.4.2',
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
