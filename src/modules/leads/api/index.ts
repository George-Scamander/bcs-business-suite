import type { IntentPackage, Lead, LeadFollowup, LeadStatus, LeadStatusLog, SignedRecord } from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'
import { recordOperationLog } from '../../../lib/supabase/logs'

export interface LeadAttachment {
  id: string
  lead_id: string
  file_record_id: string | null
  file_name: string
  object_path: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface LeadFilters {
  status?: LeadStatus
  region?: string
  industry?: string
  assignedBdId?: string
  keyword?: string
}

export interface CreateLeadInput {
  company_name: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  industry?: string
  region?: string
  city?: string
  address?: string
  source?: string
  intent_package?: IntentPackage
  intent_level?: number
  estimated_value?: number
  bd_notes?: string
  team_attention_note?: string
  duplicate_note?: string
  assigned_bd_id?: string
  next_followup_at?: string
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {
  id: string
}

export interface ChangeLeadStatusInput {
  leadId: string
  toStatus: LeadStatus
  reason?: string
  lostReasonCode?: string
  contractNo?: string
  contractDate?: string
  contractValue?: number
  contractPackage?: IntentPackage
}

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  let query = supabase.from('leads').select('*').is('deleted_at', null).order('updated_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.region) {
    query = query.ilike('region', `%${filters.region}%`)
  }

  if (filters.industry) {
    query = query.ilike('industry', `%${filters.industry}%`)
  }

  if (filters.assignedBdId) {
    query = query.eq('assigned_bd_id', filters.assignedBdId)
  }

  if (filters.keyword) {
    query = query.or(`company_name.ilike.%${filters.keyword}%,lead_code.ilike.%${filters.keyword}%,contact_person.ilike.%${filters.keyword}%`)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as Lead[]
}

export async function getLeadById(leadId: string): Promise<Lead> {
  const result = await supabase.from('leads').select('*').eq('id', leadId).single<Lead>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const insertResult = await supabase
    .from('leads')
    .insert({
      ...input,
      status: 'NEW',
    })
    .select('*')
    .single<Lead>()

  if (insertResult.error) {
    throw insertResult.error
  }

  await recordOperationLog({
    module: 'leads',
    entityType: 'leads',
    entityId: insertResult.data.id,
    action: 'create_lead',
    afterData: insertResult.data,
  })

  return insertResult.data
}

export async function updateLead(input: UpdateLeadInput): Promise<Lead> {
  const { id, ...data } = input

  const result = await supabase.from('leads').update(data).eq('id', id).select('*').single<Lead>()

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'leads',
    entityType: 'leads',
    entityId: id,
    action: 'update_lead',
    afterData: data,
  })

  return result.data
}

export async function softDeleteLead(leadId: string): Promise<void> {
  const result = await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', leadId)

  if (result.error) {
    throw result.error
  }

  await recordOperationLog({
    module: 'leads',
    entityType: 'leads',
    entityId: leadId,
    action: 'soft_delete_lead',
  })
}

export async function assignLead(leadId: string, toUserId: string, reason?: string): Promise<void> {
  const currentLead = await getLeadById(leadId)

  const updateResult = await supabase.from('leads').update({ assigned_bd_id: toUserId }).eq('id', leadId)

  if (updateResult.error) {
    throw updateResult.error
  }

  const logResult = await supabase.from('lead_assignment_logs').insert({
    lead_id: leadId,
    from_user_id: currentLead.assigned_bd_id,
    to_user_id: toUserId,
    action: 'TRANSFER',
    reason: reason ?? null,
  })

  if (logResult.error) {
    throw logResult.error
  }

  await recordOperationLog({
    module: 'leads',
    entityType: 'lead_assignment_logs',
    entityId: leadId,
    action: 'assign_lead',
    afterData: {
      from_user_id: currentLead.assigned_bd_id,
      to_user_id: toUserId,
      reason,
    },
  })
}

export async function addFollowup(input: {
  leadId: string
  followupType: string
  summary: string
  followupAt?: string
  nextFollowupAt?: string
  bdNotes?: string
  teamAttentionNote?: string
}): Promise<LeadFollowup> {
  const lead = await getLeadById(input.leadId)

  const result = await supabase
    .from('lead_followups')
    .insert({
      lead_id: input.leadId,
      followup_type: input.followupType,
      summary: input.summary,
      followup_at: input.followupAt ?? new Date().toISOString(),
      next_followup_at: input.nextFollowupAt ?? null,
      bd_notes: input.bdNotes ?? null,
      team_attention_note: input.teamAttentionNote ?? null,
      status_snapshot: lead.status,
    })
    .select('*')
    .single<LeadFollowup>()

  if (result.error) {
    throw result.error
  }

  const updateLeadResult = await supabase
    .from('leads')
    .update({
      last_followup_at: input.followupAt ?? new Date().toISOString(),
      next_followup_at: input.nextFollowupAt ?? null,
      bd_notes: input.bdNotes ?? lead.bd_notes ?? null,
      team_attention_note: input.teamAttentionNote ?? lead.team_attention_note ?? null,
    })
    .eq('id', input.leadId)

  if (updateLeadResult.error) {
    throw updateLeadResult.error
  }

  return result.data
}

export async function listLeadFollowups(leadId: string): Promise<LeadFollowup[]> {
  const result = await supabase
    .from('lead_followups')
    .select('*')
    .eq('lead_id', leadId)
    .order('followup_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as LeadFollowup[]
}

export async function listLeadStatusLogs(leadId: string): Promise<LeadStatusLog[]> {
  const result = await supabase
    .from('lead_status_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('changed_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as LeadStatusLog[]
}

export async function listSignedRecords(filters: { leadId?: string } = {}): Promise<SignedRecord[]> {
  let query = supabase.from('signed_records').select('*').order('created_at', { ascending: false })

  if (filters.leadId) {
    query = query.eq('lead_id', filters.leadId)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as SignedRecord[]
}

export async function changeLeadStatus(input: ChangeLeadStatusInput): Promise<{ signedRecordId: string | null }> {
  const result = await supabase.rpc('change_lead_status', {
    p_lead_id: input.leadId,
    p_to_status: input.toStatus,
    p_reason: input.reason ?? null,
    p_lost_reason_code: input.lostReasonCode ?? null,
    p_contract_no: input.contractNo ?? null,
    p_contract_date: input.contractDate ?? null,
    p_contract_value: input.contractValue ?? null,
  })

  if (result.error) {
    throw result.error
  }

  if (input.toStatus === 'SIGNED' && input.contractPackage) {
    const updatePackageResult = await supabase
      .from('signed_records')
      .update({
        contract_package: input.contractPackage,
      })
      .eq('lead_id', input.leadId)

    if (updatePackageResult.error) {
      throw updatePackageResult.error
    }
  }

  return {
    signedRecordId: (result.data as string | null) ?? null,
  }
}

export async function checkDuplicateLeadByCompanyName(companyName: string, excludeLeadId?: string): Promise<Lead[]> {
  const normalized = companyName.trim()

  if (!normalized) {
    return []
  }

  let query = supabase
    .from('leads')
    .select('*')
    .is('deleted_at', null)
    .ilike('company_name', normalized)
    .order('updated_at', { ascending: false })

  if (excludeLeadId) {
    query = query.neq('id', excludeLeadId)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as Lead[]
}

export async function createLeadAttachment(leadId: string, fileRecordId: string, fileName: string, objectPath: string): Promise<void> {
  const result = await supabase.from('lead_attachments').insert({
    lead_id: leadId,
    file_record_id: fileRecordId,
    file_name: fileName,
    object_path: objectPath,
  })

  if (result.error) {
    throw result.error
  }
}

export async function listLeadAttachments(leadId: string): Promise<LeadAttachment[]> {
  const result = await supabase
    .from('lead_attachments')
    .select('*')
    .eq('lead_id', leadId)
    .order('uploaded_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as LeadAttachment[]
}
