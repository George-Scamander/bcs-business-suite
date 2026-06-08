begin;

revoke execute on function public.list_lead_merchant_health() from public;
revoke execute on function public.list_lead_merchant_health() from anon;
grant execute on function public.list_lead_merchant_health() to authenticated;

commit;
