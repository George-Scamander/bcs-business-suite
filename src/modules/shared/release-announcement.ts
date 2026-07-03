import type { LocaleCode } from '../../types/rbac'

export const RELEASE_ANNOUNCEMENT_ID = 'release-v1.5.0-2026-07-03'
export const RELEASE_ANNOUNCEMENT_TYPE = 'system_announcement'
export const RELEASE_ANNOUNCEMENT_ENTITY_TYPE = 'system_release_note'

interface AnnouncementContent {
  title: string
  body: string
}

const ANNOUNCEMENT_CONTENT_BY_LOCALE: Record<LocaleCode, AnnouncementContent> = {
  en: {
    title: 'System Version Update V1.5.0',
    body: [
      'I. Accurate Finance Dashboard',
      '- Full inventory sync: now fetches all 5,000+ SKUs across all categories.',
      '- Inventory quantities now display correctly (previously showed 0).',
      '- Added category filter dropdown for inventory.',
      '- Fixed display flickering, animation stuttering, and incomplete rendering.',
      '- Fixed horizontal scroll and sticky column behaviour in all data tables.',
      '- Warehouse breakdown now loads on demand when opening item detail.',
    ].join('\n'),
  },
  'zh-CN': {
    title: '系统版本更新 V1.5.0',
    body: [
      '一、Accurate 财务看板',
      '- 库存全量同步：现已抓取所有品类 5000+ 个 SKU。',
      '- 库存数量显示正确（此前显示为 0）。',
      '- 新增库存品类筛选下拉选框。',
      '- 修复页面闪烁、动画卡顿及显示不完整问题。',
      '- 修复所有数据表格横向滚动及固定列显示异常。',
      '- 仓库分布现在按需加载（打开品项详情时加载）。',
    ].join('\n'),
  },
  'zh-HK': {
    title: '系統版本更新 V1.5.0',
    body: [
      '一、Accurate 財務看板',
      '- 庫存全量同步：現已抓取所有品類 5000+ 個 SKU。',
      '- 庫存數量顯示正確（此前顯示為 0）。',
      '- 新增庫存品類篩選下拉選單。',
      '- 修復頁面閃爍、動畫卡頓及顯示不完整問題。',
      '- 修復所有資料表格橫向滾動及固定欄顯示異常。',
      '- 倉庫分布現在按需加載（打開品項詳情時加載）。',
    ].join('\n'),
  },
  'id-ID': {
    title: 'Pembaruan Sistem V1.5.0',
    body: [
      'I. Dasbor Keuangan Accurate',
      '- Sinkronisasi inventaris penuh: sekarang mengambil semua 5.000+ SKU di semua kategori.',
      '- Kuantitas inventaris kini ditampilkan dengan benar (sebelumnya menampilkan 0).',
      '- Menambahkan dropdown filter kategori untuk inventaris.',
      '- Memperbaiki kedipan tampilan, animasi tersendat, dan rendering tidak lengkap.',
      '- Memperbaiki scroll horizontal dan perilaku kolom tetap di semua tabel data.',
      '- Distribusi gudang kini dimuat sesuai kebutuhan saat membuka detail item.',
    ].join('\n'),
  },
}

const NOTIFICATION_MULTILINGUAL_CONTENT: AnnouncementContent = {
  title: 'System Update / 系統更新 / Pembaruan Sistem V1.5.0',
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
