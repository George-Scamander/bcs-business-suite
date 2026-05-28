import type {
  Lead,
  MerchantActivityStatus,
  MerchantActivityType,
  OnboardMerchant,
  OnboardMerchantActivity,
  OnboardMerchantType,
  OnboardingCase,
  OnboardingDocument,
  OnboardingReview,
  OnboardingStatus,
  OnboardingStatusLog,
  OnboardingStep,
} from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'
import { recordOperationLog } from '../../../lib/supabase/logs'

export interface OnboardingFilters {
  status?: OnboardingStatus
  activeOnly?: boolean
  ownerUserId?: string
  reviewerUserId?: string
  createdFrom?: string
  createdTo?: string
  keyword?: string
}

export interface OnboardMerchantFilters {
  keyword?: string
  onboardingType?: OnboardMerchantType
  bdOwnerId?: string
}

export interface CreateOnboardMerchantInput {
  lead_id?: string | null
  company_name: string
  onboarding_type: OnboardMerchantType
  contact_person?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  region?: string | null
  city?: string | null
  address?: string | null
  bd_owner_id?: string | null
  remarks?: string | null
}

export interface UpdateOnboardMerchantInput extends Partial<CreateOnboardMerchantInput> {
  id: string
}

export interface CreateOnboardMerchantActivityInput {
  merchant_id: string
  activity_type: MerchantActivityType
  status?: MerchantActivityStatus
  title: string
  detail?: string | null
  activity_at?: string
  scheduled_at?: string | null
  assignee_id?: string | null
  related_sales_order_id?: string | null
}

export interface UpdateOnboardMerchantActivityInput {
  id: string
  activity_type?: MerchantActivityType
  status?: MerchantActivityStatus
  title?: string
  detail?: string | null
  activity_at?: string
  scheduled_at?: string | null
  assignee_id?: string | null
}

export type LeadLookupRow = Pick<Lead, 'id' | 'lead_code' | 'company_name' | 'region' | 'city' | 'contact_person' | 'contact_phone' | 'contact_email'>

export async function listOnboardingCases(filters: OnboardingFilters = {}): Promise<OnboardingCase[]> {
  let query = supabase.from('onboarding_cases').select('*').is('deleted_at', null).order('updated_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  } else if (filters.activeOnly) {
    query = query.neq('status', 'COMPLETED').neq('status', 'REJECTED')
  }

  if (filters.ownerUserId) {
    query = query.eq('owner_user_id', filters.ownerUserId)
  }

  if (filters.reviewerUserId) {
    query = query.eq('reviewer_user_id', filters.reviewerUserId)
  }

  if (filters.createdFrom) {
    query = query.gte('created_at', filters.createdFrom)
  }

  if (filters.createdTo) {
    query = query.lte('created_at', filters.createdTo)
  }

  if (filters.keyword) {
    query = query.ilike('case_no', `%${filters.keyword}%`)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardingCase[]
}

export async function getOnboardingCase(caseId: string): Promise<OnboardingCase> {
  const result = await supabase.from('onboarding_cases').select('*').eq('id', caseId).single<OnboardingCase>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function listOnboardingSteps(caseId: string): Promise<OnboardingStep[]> {
  const result = await supabase
    .from('onboarding_steps')
    .select('*')
    .eq('onboarding_case_id', caseId)
    .order('step_order', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardingStep[]
}

export async function listOnboardingDocuments(caseId: string): Promise<OnboardingDocument[]> {
  const result = await supabase
    .from('onboarding_documents')
    .select('*')
    .eq('onboarding_case_id', caseId)
    .order('submitted_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardingDocument[]
}

export async function submitOnboardingDocument(input: {
  caseId: string
  docType: string
  fileRecordId?: string
  fileName?: string
  objectPath?: string
}): Promise<OnboardingDocument> {
  const result = await supabase
    .from('onboarding_documents')
    .insert({
      onboarding_case_id: input.caseId,
      doc_type: input.docType,
      file_record_id: input.fileRecordId ?? null,
      file_name: input.fileName ?? null,
      object_path: input.objectPath ?? null,
      review_status: 'PENDING',
    })
    .select('*')
    .single<OnboardingDocument>()

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'onboarding',
    entityType: 'onboarding_documents',
    entityId: result.data.id,
    action: 'submit_document',
    afterData: {
      onboarding_case_id: input.caseId,
      doc_type: input.docType,
    },
  })

  return result.data
}

export async function reviewOnboardingDocument(input: {
  documentId: string
  caseId: string
  decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'
  comment?: string
}): Promise<void> {
  const updateResult = await supabase
    .from('onboarding_documents')
    .update({
      review_status: input.decision,
      reviewed_at: new Date().toISOString(),
      review_comment: input.comment ?? null,
    })
    .eq('id', input.documentId)

  if (updateResult.error) {
    throw updateResult.error
  }

  const reviewResult = await supabase.from('onboarding_reviews').insert({
    onboarding_case_id: input.caseId,
    document_id: input.documentId,
    decision: input.decision,
    comment: input.comment ?? null,
  })

  if (reviewResult.error) {
    throw reviewResult.error
  }
}

export async function listOnboardingReviews(caseId: string): Promise<OnboardingReview[]> {
  const result = await supabase
    .from('onboarding_reviews')
    .select('*')
    .eq('onboarding_case_id', caseId)
    .order('reviewed_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardingReview[]
}

export async function listOnboardingStatusLogs(caseId: string): Promise<OnboardingStatusLog[]> {
  const result = await supabase
    .from('onboarding_status_logs')
    .select('*')
    .eq('onboarding_case_id', caseId)
    .order('changed_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardingStatusLog[]
}

export async function changeOnboardingStatus(input: {
  caseId: string
  toStatus: OnboardingStatus
  reason?: string
  pmOwnerId?: string
}): Promise<{ projectId: string | null }> {
  const result = await supabase.rpc('change_onboarding_status', {
    p_onboarding_case_id: input.caseId,
    p_to_status: input.toStatus,
    p_reason: input.reason ?? null,
    p_pm_owner_id: input.pmOwnerId ?? null,
  })

  if (result.error) {
    throw result.error
  }

  return {
    projectId: (result.data as string | null) ?? null,
  }
}

export async function createOnboardingFromSigned(signedRecordId: string, ownerUserId?: string, reviewerUserId?: string): Promise<string> {
  const result = await supabase.rpc('create_onboarding_case_from_signed', {
    p_signed_record_id: signedRecordId,
    p_owner_user_id: ownerUserId ?? null,
    p_reviewer_user_id: reviewerUserId ?? null,
    p_sla_days: 14,
  })

  if (result.error) {
    throw result.error
  }

  return result.data as string
}

export async function listOnboardMerchants(filters: OnboardMerchantFilters = {}): Promise<OnboardMerchant[]> {
  let query = supabase.from('onboard_merchants').select('*').is('deleted_at', null).order('updated_at', { ascending: false })

  if (filters.onboardingType) {
    query = query.eq('onboarding_type', filters.onboardingType)
  }

  if (filters.bdOwnerId) {
    query = query.eq('bd_owner_id', filters.bdOwnerId)
  }

  if (filters.keyword?.trim()) {
    const value = filters.keyword.trim()
    query = query.or(`merchant_no.ilike.%${value}%,company_name.ilike.%${value}%,region.ilike.%${value}%,city.ilike.%${value}%`)
  }

  const result = await query
  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardMerchant[]
}

export async function getOnboardMerchant(merchantId: string): Promise<OnboardMerchant> {
  const result = await supabase
    .from('onboard_merchants')
    .select('*')
    .eq('id', merchantId)
    .is('deleted_at', null)
    .single<OnboardMerchant>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function createOnboardMerchant(input: CreateOnboardMerchantInput): Promise<OnboardMerchant> {
  const result = await supabase.from('onboard_merchants').insert(input).select('*').single<OnboardMerchant>()
  if (result.error) {
    throw result.error
  }
  return result.data
}

export async function updateOnboardMerchant(input: UpdateOnboardMerchantInput): Promise<OnboardMerchant> {
  const { id, ...patch } = input
  const result = await supabase
    .from('onboard_merchants')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single<OnboardMerchant>()
  if (result.error) {
    throw result.error
  }
  return result.data
}

export async function softDeleteOnboardMerchant(merchantId: string): Promise<void> {
  const userResult = await supabase.auth.getUser()
  const userId = userResult.data.user?.id ?? null
  const result = await supabase
    .from('onboard_merchants')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', merchantId)

  if (result.error) {
    throw result.error
  }
}

export async function listDeletedOnboardMerchants(filters: OnboardMerchantFilters = {}): Promise<OnboardMerchant[]> {
  let query = supabase.from('onboard_merchants').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })

  if (filters.onboardingType) {
    query = query.eq('onboarding_type', filters.onboardingType)
  }

  if (filters.bdOwnerId) {
    query = query.eq('bd_owner_id', filters.bdOwnerId)
  }

  if (filters.keyword?.trim()) {
    const value = filters.keyword.trim()
    query = query.or(`merchant_no.ilike.%${value}%,company_name.ilike.%${value}%,region.ilike.%${value}%,city.ilike.%${value}%`)
  }

  const result = await query
  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardMerchant[]
}

export async function restoreOnboardMerchant(merchantId: string): Promise<void> {
  const userResult = await supabase.auth.getUser()
  const userId = userResult.data.user?.id ?? null
  const result = await supabase
    .from('onboard_merchants')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', merchantId)

  if (result.error) {
    throw result.error
  }
}

export async function restoreOnboardMerchants(merchantIds: string[]): Promise<void> {
  if (merchantIds.length === 0) {
    return
  }

  const userResult = await supabase.auth.getUser()
  const userId = userResult.data.user?.id ?? null
  const result = await supabase
    .from('onboard_merchants')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .in('id', merchantIds)

  if (result.error) {
    throw result.error
  }
}

export async function hardDeleteOnboardMerchant(merchantId: string): Promise<void> {
  const result = await supabase.from('onboard_merchants').delete().eq('id', merchantId)
  if (result.error) {
    throw result.error
  }
}

export async function hardDeleteOnboardMerchants(merchantIds: string[]): Promise<void> {
  if (merchantIds.length === 0) {
    return
  }

  const result = await supabase.from('onboard_merchants').delete().in('id', merchantIds)
  if (result.error) {
    throw result.error
  }
}

export async function searchLeadLookup(keyword: string, limit = 20): Promise<LeadLookupRow[]> {
  const value = keyword.trim()
  let query = supabase
    .from('leads')
    .select('id, lead_code, company_name, region, city, contact_person, contact_phone, contact_email')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (value) {
    query = query.or(`lead_code.ilike.%${value}%,company_name.ilike.%${value}%,contact_person.ilike.%${value}%`)
  }

  const result = await query
  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as LeadLookupRow[]
}

export async function listOnboardMerchantActivities(merchantId: string): Promise<OnboardMerchantActivity[]> {
  const result = await supabase
    .from('onboard_merchant_activities')
    .select('*')
    .eq('merchant_id', merchantId)
    .is('deleted_at', null)
    .order('activity_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as OnboardMerchantActivity[]
}

export async function createOnboardMerchantActivity(input: CreateOnboardMerchantActivityInput): Promise<OnboardMerchantActivity> {
  const result = await supabase
    .from('onboard_merchant_activities')
    .insert({
      merchant_id: input.merchant_id,
      activity_type: input.activity_type,
      status: input.status ?? 'PLANNED',
      title: input.title,
      detail: input.detail ?? null,
      activity_at: input.activity_at ?? new Date().toISOString(),
      scheduled_at: input.scheduled_at ?? null,
      assignee_id: input.assignee_id ?? null,
      related_sales_order_id: input.related_sales_order_id ?? null,
    })
    .select('*')
    .single<OnboardMerchantActivity>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function updateOnboardMerchantActivity(input: UpdateOnboardMerchantActivityInput): Promise<OnboardMerchantActivity> {
  const { id, ...patch } = input
  const result = await supabase
    .from('onboard_merchant_activities')
    .update({
      ...patch,
      detail: patch.detail === undefined ? undefined : patch.detail ?? null,
      scheduled_at: patch.scheduled_at === undefined ? undefined : patch.scheduled_at ?? null,
      assignee_id: patch.assignee_id === undefined ? undefined : patch.assignee_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single<OnboardMerchantActivity>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function softDeleteOnboardMerchantActivity(activityId: string): Promise<void> {
  const userResult = await supabase.auth.getUser()
  const userId = userResult.data.user?.id ?? null

  const result = await supabase
    .from('onboard_merchant_activities')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', activityId)

  if (result.error) {
    throw result.error
  }
}
