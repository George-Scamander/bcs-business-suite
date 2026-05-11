-- Allow users with onboarding.review permission to update onboarding document review fields.
-- This unblocks admin review center actions (approve / request files / reject)
-- without requiring full onboarding.write permission.

DROP POLICY IF EXISTS onboarding_documents_review_update_policy ON public.onboarding_documents;

create policy onboarding_documents_review_update_policy
on public.onboarding_documents
for update to authenticated
using (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and (public.has_permission('onboarding.review', auth.uid()) or public.has_permission('onboarding.write', auth.uid()))
)
with check (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and (public.has_permission('onboarding.review', auth.uid()) or public.has_permission('onboarding.write', auth.uid()))
);
