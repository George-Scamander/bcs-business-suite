import type { LocaleCode } from '../../types/rbac'

export const RELEASE_ANNOUNCEMENT_ID = 'release-v0.6-2026-05-05'
export const RELEASE_ANNOUNCEMENT_TYPE = 'system_announcement'
export const RELEASE_ANNOUNCEMENT_ENTITY_TYPE = 'system_release_note'

interface AnnouncementContent {
  title: string
  body: string
}

const ANNOUNCEMENT_CONTENT_BY_LOCALE: Record<LocaleCode, AnnouncementContent> = {
  en: {
    title: 'System Update Notice V0.6 (May 5, 2026)',
    body: [
      'Version:',
      '- Before: V0.5.1',
      '- After: V0.6',
      '',
      'BD Updates:',
      '- Fixed lead creation submission failure.',
      '- Optimized lead submission interaction flow.',
      '- Removed File Center interaction module for BD.',
      '- Added lead source dropdown.',
      '- Added cascading region-city dropdown selection.',
      '- Removed "Assign BD" option from lead creation flow.',
      '',
      'PMO Updates:',
      '- Added lead template upload with automatic parsing to Lead Pool.',
      '- Fixed File Center availability issues.',
      '- Fixed project creation failure.',
      '- Added dedicated project creation module and improved flow.',
      '',
      'General Updates:',
      '- Improved mobile web UI adaptation.',
      '- Added Indonesian locale.',
      '- Added Traditional Chinese (Hong Kong) locale.',
      '- Fixed incomplete language switching in some modules.',
      '- Added Recently Deleted and Permanent Delete modules.',
      '- Added multi-select, select-all, and restore actions.',
      '- Improved interaction logic and overall usability.',
    ].join('\n'),
  },
  'zh-CN': {
    title: '系统更新公告 V0.6（2026年5月5日）',
    body: [
      '版本信息：',
      '- 更新前：V0.5.1',
      '- 更新后：V0.6',
      '',
      '一、BD用户端口',
      '- 修复线索建立后无法提交的问题。',
      '- 优化线索提交交互逻辑，提升操作流畅度。',
      '- 移除文件中心互动板块（BD端）。',
      '- 新增线索来源下拉选单。',
      '- 新增区域与城市级联下拉选单，便于快速选择。',
      '- 移除“Assign BD”选项。',
      '',
      '二、PMO用户端口',
      '- 新增线索模板上传，上传后可自动解析并保存到线索池。',
      '- 修复文件中心无法使用的问题。',
      '- 修复无法建立项目的问题。',
      '- 新增专案建立板块，优化项目建立流程。',
      '',
      '三、通用功能',
      '- 完成手机端Web UI适配，提升移动端体验。',
      '- 新增印尼语。',
      '- 新增繁体中文（香港）。',
      '- 修复切换语言后部分内容未同步的问题。',
      '- 新增最近删除与永久删除功能板块。',
      '- 新增多选、全选与撤回功能。',
      '- 修复交互逻辑不完善问题，优化整体体验。',
    ].join('\n'),
  },
  'zh-HK': {
    title: '系統更新公告 V0.6（2026年5月5日）',
    body: [
      '版本資訊：',
      '- 更新前：V0.5.1',
      '- 更新後：V0.6',
      '',
      '一、BD用戶端口',
      '- 修復線索建立後無法提交的問題。',
      '- 優化線索提交互動邏輯，提升操作流暢度。',
      '- 移除文件中心互動板塊（BD端）。',
      '- 新增線索來源下拉選單。',
      '- 新增區域及城市連鎖下拉選單，方便快速選取。',
      '- 移除「Assign BD」選項。',
      '',
      '二、PMO用戶端口',
      '- 新增線索模板上傳，上傳後可自動解析並儲存至線索池。',
      '- 修復文件中心無法使用的問題。',
      '- 修復無法建立項目的問題。',
      '- 新增專案建立板塊，優化建立流程。',
      '',
      '三、程式通用功能',
      '- 完成手機端Web UI適配，提升手機端體驗。',
      '- 新增印尼文語言選項。',
      '- 新增繁體中文（香港）語言選項。',
      '- 修復切換語言後部分內容未同步顯示的問題。',
      '- 新增最近刪除及永久刪除功能板塊。',
      '- 新增多選、全選及撤回功能。',
      '- 修復互動邏輯不足問題，優化整體操作體驗。',
    ].join('\n'),
  },
  'id-ID': {
    title: 'Pengumuman Pembaruan Sistem V0.6 (5 Mei 2026)',
    body: [
      'Informasi versi:',
      '- Sebelum pembaruan: V0.5.1',
      '- Setelah pembaruan: V0.6',
      '',
      'I. Port Pengguna BD',
      '- Memperbaiki kegagalan submit saat pembuatan lead.',
      '- Mengoptimalkan logika interaksi submit lead.',
      '- Menghapus modul interaksi Pusat File untuk BD.',
      '- Menambahkan dropdown sumber lead.',
      '- Menambahkan dropdown berantai wilayah-kota.',
      '- Menghapus opsi "Assign BD".',
      '',
      'II. Port Pengguna PMO',
      '- Menambahkan unggah template lead dengan parsing otomatis ke Lead Pool.',
      '- Memperbaiki masalah Pusat File tidak dapat digunakan.',
      '- Memperbaiki masalah gagal membuat proyek.',
      '- Menambahkan modul pembuatan proyek dan mengoptimalkan alur.',
      '',
      'III. Fitur Umum Program',
      '- Menyesuaikan UI Web untuk perangkat mobile.',
      '- Menambahkan bahasa Indonesia.',
      '- Menambahkan bahasa Tionghoa Tradisional (Hong Kong).',
      '- Memperbaiki masalah sinkronisasi tampilan saat ganti bahasa.',
      '- Menambahkan modul Baru Dihapus dan Hapus Permanen.',
      '- Menambahkan aksi multi-pilih, pilih semua, dan pemulihan.',
      '- Menyempurnakan logika interaksi dan pengalaman penggunaan.',
    ].join('\n'),
  },
}

export function getReleaseAnnouncementContent(locale?: LocaleCode | null): AnnouncementContent {
  if (!locale) {
    return ANNOUNCEMENT_CONTENT_BY_LOCALE.en
  }

  return ANNOUNCEMENT_CONTENT_BY_LOCALE[locale] ?? ANNOUNCEMENT_CONTENT_BY_LOCALE.en
}
