import { supabase } from '../../../lib/supabase/client'
import type { LeadStatus, StoreTier } from '../../../types/business'

export interface StoreAlertRuleConfig {
  tier: StoreTier
  no_visit_days: number
  no_deal_visit_count: number
}

export interface StoreAlertFilters {
  status?: LeadStatus
  assignedBdId?: string
  city?: string
  keyword?: string
}

export interface StoreAlertRow {
  id: string
  leadCode: string
  companyName: string
  status: LeadStatus
  storeTier: StoreTier
  city: string | null
  assignedBdId: string | null
  assignedBdName: string | null
  lastFollowupAt: string | null
  visitCount: number
  dealAmount: number
  noVisitAlert: boolean
  noVisitDays: number | null
  noDealAlert: boolean
}

export interface StoreAlertSummary {
  totalAlerts: number
  noVisitCount: number
  noDealCount: number
  processedTodayCount: number
}

export interface StoreAlertResult {
  rows: StoreAlertRow[]
  summary: StoreAlertSummary
}

interface LeadAlertCandidateRow {
  id: string
  lead_code: string
  company_name: string
  status: LeadStatus
  store_tier: StoreTier
  city: string | null
  assigned_bd_id: string | null
  last_followup_at: string | null
  assignedBd: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null
}

const LEAD_ID_BATCH_SIZE = 150

function chunkLeadIds(leadIds: string[]): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < leadIds.length; i += LEAD_ID_BATCH_SIZE) {
    chunks.push(leadIds.slice(i, i + LEAD_ID_BATCH_SIZE))
  }
  return chunks
}

const DEFAULT_RULE_BY_TIER: Record<StoreTier, { no_visit_days: number; no_deal_visit_count: number }> = {
  NORMAL: { no_visit_days: 7, no_deal_visit_count: 2 },
  KA: { no_visit_days: 3, no_deal_visit_count: 2 },
}

export async function listStoreAlertRuleConfig(): Promise<StoreAlertRuleConfig[]> {
  const result = await supabase.from('store_alert_rule_config').select('tier, no_visit_days, no_deal_visit_count')

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as StoreAlertRuleConfig[]
}

export async function updateStoreAlertRuleConfig(
  tier: StoreTier,
  payload: { no_visit_days?: number; no_deal_visit_count?: number },
): Promise<StoreAlertRuleConfig> {
  const result = await supabase
    .from('store_alert_rule_config')
    .update(payload)
    .eq('tier', tier)
    .select('tier, no_visit_days, no_deal_visit_count')
    .single<StoreAlertRuleConfig>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export async function fetchStoreAlerts(filters: StoreAlertFilters = {}): Promise<StoreAlertResult> {
  let query = supabase
    .from('leads')
    .select('id, lead_code, company_name, status, store_tier, city, assigned_bd_id, last_followup_at, assignedBd:profiles!assigned_bd_id(id, full_name)')
    .is('deleted_at', null)
    .neq('status', 'SIGNED')
    .neq('status', 'REJECTED')

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.assignedBdId) {
    query = query.eq('assigned_bd_id', filters.assignedBdId)
  }
  if (filters.city) {
    query = query.eq('city', filters.city)
  }
  if (filters.keyword) {
    query = query.or(`company_name.ilike.%${filters.keyword}%,lead_code.ilike.%${filters.keyword}%`)
  }

  const leadsResult = await query

  if (leadsResult.error) {
    throw leadsResult.error
  }

  const leadRows = (leadsResult.data ?? []) as unknown as LeadAlertCandidateRow[]

  if (leadRows.length === 0) {
    return { rows: [], summary: { totalAlerts: 0, noVisitCount: 0, noDealCount: 0, processedTodayCount: 0 } }
  }

  const leadIds = leadRows.map((row) => row.id)
  const leadIdBatches = chunkLeadIds(leadIds)

  const [rulesResult, visitsBatchResults, ordersBatchResults] = await Promise.all([
    supabase.from('store_alert_rule_config').select('tier, no_visit_days, no_deal_visit_count'),
    Promise.all(
      leadIdBatches.map((batch) =>
        supabase.from('lead_followups').select('lead_id').eq('followup_type', 'VISIT').in('lead_id', batch),
      ),
    ),
    Promise.all(
      leadIdBatches.map((batch) =>
        supabase
          .from('sales_orders')
          .select('lead_id, items:sales_order_items(quantity, unit_price)')
          .in('lead_id', batch)
          .is('deleted_at', null),
      ),
    ),
  ])

  if (rulesResult.error) {
    throw rulesResult.error
  }
  for (const batchResult of visitsBatchResults) {
    if (batchResult.error) {
      throw batchResult.error
    }
  }
  for (const batchResult of ordersBatchResults) {
    if (batchResult.error) {
      throw batchResult.error
    }
  }

  const visitsResult = { data: visitsBatchResults.flatMap((batchResult) => batchResult.data ?? []) }
  const ordersResult = { data: ordersBatchResults.flatMap((batchResult) => batchResult.data ?? []) }

  const rulesByTier = new Map(((rulesResult.data ?? []) as StoreAlertRuleConfig[]).map((item) => [item.tier, item]))

  const visitCountByLeadId = new Map<string, number>()
  for (const row of (visitsResult.data ?? []) as Array<{ lead_id: string }>) {
    visitCountByLeadId.set(row.lead_id, (visitCountByLeadId.get(row.lead_id) ?? 0) + 1)
  }

  const dealAmountByLeadId = new Map<string, number>()
  for (const row of (ordersResult.data ?? []) as Array<{
    lead_id: string | null
    items: Array<{ quantity: number; unit_price: number | null }> | null
  }>) {
    if (!row.lead_id) {
      continue
    }
    const amount = (row.items ?? []).reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)) * Math.max(0, Number(item.unit_price ?? 0)),
      0,
    )
    dealAmountByLeadId.set(row.lead_id, (dealAmountByLeadId.get(row.lead_id) ?? 0) + amount)
  }

  const now = Date.now()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTodayMs = startOfToday.getTime()

  const alertRows: StoreAlertRow[] = []
  let processedTodayCount = 0

  for (const row of leadRows) {
    const rule = rulesByTier.get(row.store_tier) ?? DEFAULT_RULE_BY_TIER[row.store_tier]
    const visitCount = visitCountByLeadId.get(row.id) ?? 0
    const dealAmount = dealAmountByLeadId.get(row.id) ?? 0

    const lastFollowupMs = row.last_followup_at ? new Date(row.last_followup_at).getTime() : null
    if (lastFollowupMs !== null && lastFollowupMs >= startOfTodayMs) {
      processedTodayCount += 1
    }

    const noVisitDays = lastFollowupMs !== null ? Math.floor((now - lastFollowupMs) / (24 * 60 * 60 * 1000)) : null
    const noVisitAlert = lastFollowupMs === null || (noVisitDays !== null && noVisitDays >= rule.no_visit_days)
    const noDealAlert = visitCount >= rule.no_deal_visit_count && dealAmount === 0

    if (!noVisitAlert && !noDealAlert) {
      continue
    }

    const assignedBd = Array.isArray(row.assignedBd) ? row.assignedBd[0] : row.assignedBd

    alertRows.push({
      id: row.id,
      leadCode: row.lead_code,
      companyName: row.company_name,
      status: row.status,
      storeTier: row.store_tier,
      city: row.city,
      assignedBdId: row.assigned_bd_id,
      assignedBdName: assignedBd?.full_name ?? null,
      lastFollowupAt: row.last_followup_at,
      visitCount,
      dealAmount,
      noVisitAlert,
      noVisitDays,
      noDealAlert,
    })
  }

  alertRows.sort((a, b) => {
    const aScore = (a.noVisitDays ?? 9999) + (a.noDealAlert ? 1000 : 0)
    const bScore = (b.noVisitDays ?? 9999) + (b.noDealAlert ? 1000 : 0)
    return bScore - aScore
  })

  return {
    rows: alertRows,
    summary: {
      totalAlerts: alertRows.length,
      noVisitCount: alertRows.filter((item) => item.noVisitAlert).length,
      noDealCount: alertRows.filter((item) => item.noDealAlert).length,
      processedTodayCount,
    },
  }
}
