do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'app_locale'
      and e.enumlabel = 'zh-HK'
  ) then
    alter type public.app_locale add value 'zh-HK';
  end if;
end;
$$;
