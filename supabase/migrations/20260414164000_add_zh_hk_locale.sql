begin;

alter type public.app_locale add value if not exists 'zh-HK';

commit;
