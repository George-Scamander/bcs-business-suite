import type {
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
  ownerUserId?: string
  reviewerUserId?: string
  keyword?: string
}

export async function listOnboardingCases(filters: OnboardingFilters = {}): Promise<OnboardingCase[]> {
  let query = supabase.from('onboarding_cases').select('*').is('deleted_at', null).order('updated_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.ownerUserId) {
    query = query.eq('owner_user_id', filters.ownerUserId)
  }

  if (filters.reviewerUserId) {
    query = query.eq('reviewer_user_id', filters.reviewerUserId)
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
