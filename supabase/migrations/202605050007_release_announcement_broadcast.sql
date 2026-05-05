-- Broadcast V0.6 system release announcement to all existing users
-- Idempotent by user_id + announcement identity tuple.

with localized_content as (
  select
    p.id as user_id,
    case p.locale
      when 'zh-CN' then '系统更新公告 V0.6（2026年5月5日）'
      when 'zh-HK' then '系統更新公告 V0.6（2026年5月5日）'
      when 'id-ID' then 'Pengumuman Pembaruan Sistem V0.6 (5 Mei 2026)'
      else 'System Update Notice V0.6 (May 5, 2026)'
    end as title,
    case p.locale
      when 'zh-CN' then
        $zh_cn$
版本信息：
- 更新前：V0.5.1
- 更新后：V0.6

一、BD用户端口
- 修复线索建立后无法提交的问题。
- 优化线索提交交互逻辑，提升操作流畅度。
- 新增线索来源下拉选单与区域-城市级联选择。
- 移除“Assign BD”选项。

二、PMO用户端口
- 新增线索模板上传并自动解析至线索池。
- 修复项目建立失败与文件中心问题。
- 优化专案建立流程与任务填写体验。

三、通用功能
- 完成手机端Web UI适配。
- 新增印尼语与繁体中文（香港）。
- 修复部分语言未同步显示问题。
- 新增最近删除、永久删除、多选、全选与撤回功能。
$zh_cn$
      when 'zh-HK' then
        $zh_hk$
版本資訊：
- 更新前：V0.5.1
- 更新後：V0.6

一、BD用戶端口
- 修復線索建立後無法提交的問題。
- 優化線索提交互動邏輯，提升操作流暢度。
- 新增線索來源下拉選單與區域-城市連鎖選擇。
- 移除「Assign BD」選項。

二、PMO用戶端口
- 新增線索模板上傳並自動解析至線索池。
- 修復項目建立失敗與文件中心問題。
- 優化專案建立流程及任務填寫體驗。

三、通用功能
- 完成手機端Web UI適配。
- 新增印尼文及繁體中文（香港）。
- 修復部分語言未同步顯示問題。
- 新增最近刪除、永久刪除、多選、全選及撤回功能。
$zh_hk$
      when 'id-ID' then
        $id$
Informasi versi:
- Sebelum pembaruan: V0.5.1
- Setelah pembaruan: V0.6

I. Port Pengguna BD
- Memperbaiki kegagalan submit saat pembuatan lead.
- Mengoptimalkan alur submit lead.
- Menambahkan dropdown sumber lead dan pilihan berantai wilayah-kota.
- Menghapus opsi Assign BD.

II. Port Pengguna PMO
- Menambahkan upload template lead dengan parsing otomatis ke Lead Pool.
- Memperbaiki kegagalan pembuatan proyek dan masalah Pusat File.
- Mengoptimalkan alur pembuatan proyek serta input tugas.

III. Fitur Umum
- Menyesuaikan UI Web untuk perangkat mobile.
- Menambahkan bahasa Indonesia dan Tradisional Tionghoa (Hong Kong).
- Memperbaiki konten yang belum sinkron saat ganti bahasa.
- Menambahkan Recently Deleted, permanent delete, multi-select, select all, dan restore.
$id$
      else
        $en$
Version:
- Before: V0.5.1
- After: V0.6

BD Updates:
- Fixed lead creation submission failures.
- Improved lead submission flow and usability.
- Added lead source dropdown and region-city cascading selector.
- Removed Assign BD option.

PMO Updates:
- Added lead template upload with automatic parsing to Lead Pool.
- Fixed project creation failures and File Center issues.
- Improved project creation and task input experience.

General Updates:
- Improved mobile web UI adaptation.
- Added Indonesian and Traditional Chinese (Hong Kong) locales.
- Fixed incomplete language synchronization in several modules.
- Added Recently Deleted, permanent delete, multi-select, select-all, and restore features.
$en$
    end as body
  from public.profiles p
)
insert into public.notifications (
  user_id,
  type,
  title,
  body,
  entity_type,
  entity_id,
  is_read
)
select
  lc.user_id,
  'system_announcement',
  lc.title,
  lc.body,
  'system_release_note',
  'release-v0.6-2026-05-05',
  false
from localized_content lc
where not exists (
  select 1
  from public.notifications n
  where n.user_id = lc.user_id
    and n.type = 'system_announcement'
    and n.entity_type = 'system_release_note'
    and n.entity_id = 'release-v0.6-2026-05-05'
);
