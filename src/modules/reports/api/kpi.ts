import { supabase } from '../../../lib/supabase/client'

export interface BdKpiFilters {
  dateFrom?: string
  dateTo?: string
  keyword?: string
}

export interface BdKpiRow {
  bdUserId: string
  bdName: string
  bdEmail: string
  salesAmount: number
  salesLeadCount: number
  bcsSignedCount: number
}

export interface TeamKpiSummary {
  bdCount: number
  salesAmount: number
  salesLeadCount: number
  bcsSignedCount: number
}

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
}

interface LeadKpiRow {
  assigned_bd_id: string | null
  estimated_value: number | null
  intent_package: string | null
}

interface MerchantKpiRow {
  bd_owner_id: string | null
}

interface BdAggregateRow {
  bdUserId: string
  bdName: string
  bdEmail: string
  salesAmount: number
  salesLeadCount: number
  bcsSignedCount: number
}

export async function queryBdKpiSummary(filters: BdKpiFilters = {}): Promise<{ rows: BdKpiRow[]; team: TeamKpiSummary }> {
  const keyword = filters.keyword?.trim().toLowerCase() ?? ''

  const profileResult = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

  if (profileResult.error) {
    throw profileResult.error
  }

  const activeProfiles = (profileResult.data ?? []) as ProfileRow[]
  const roleChecks = await Promise.all(
    activeProfiles.map(async (profile) => {
      const roleResult = await supabase.rpc('has_role_code', { p_role_code: 'bd_user', target_user_id: profile.id })
      if (roleResult.error) {
        throw roleResult.error
      }
      return roleResult.data === true
    }),
  )

  const bdProfiles = activeProfiles.filter((_, index) => roleChecks[index])
  const aggregateByBdId = new Map<string, BdAggregateRow>(
    bdProfiles.map((profile) => [
      profile.id,
      {
        bdUserId: profile.id,
        bdName: profile.full_name ?? profile.email,
        bdEmail: profile.email,
        salesAmount: 0,
        salesLeadCount: 0,
        bcsSignedCount: 0,
      },
    ]),
  )

  let leadsQuery = supabase
    .from('leads')
    .select('assigned_bd_id, estimated_value, intent_package')
    .is('deleted_at', null)

  if (filters.dateFrom) {
    leadsQuery = leadsQuery.gte('created_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    leadsQuery = leadsQuery.lte('created_at', filters.dateTo)
  }

  const leadsResult = await leadsQuery
  if (leadsResult.error) {
    throw leadsResult.error
  }

  const leadsRows = (leadsResult.data ?? []) as LeadKpiRow[]
  for (const row of leadsRows) {
    const bdUserId = row.assigned_bd_id
    if (!bdUserId) {
      continue
    }

    const intentPackage = row.intent_package
    if (intentPackage !== 'PRODUCTS_SALES' && intentPackage !== 'BOTH') {
      continue
    }

    const targetRow = aggregateByBdId.get(bdUserId)
    if (!targetRow) {
      continue
    }

    const salesLeadAmount = Number(row.estimated_value ?? 0)
    if (salesLeadAmount > 0) {
      targetRow.salesAmount += salesLeadAmount
    }
    targetRow.salesLeadCount += 1
  }

  let merchantQuery = supabase
    .from('onboard_merchants')
    .select('bd_owner_id')
    .is('deleted_at', null)
    .eq('onboarding_type', 'BCS_FRANCHISE')

  if (filters.dateFrom) {
    merchantQuery = merchantQuery.gte('onboarded_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    merchantQuery = merchantQuery.lte('onboarded_at', filters.dateTo)
  }

  const merchantResult = await merchantQuery
  if (merchantResult.error) {
    throw merchantResult.error
  }

  const merchantRows = (merchantResult.data ?? []) as MerchantKpiRow[]
  for (const row of merchantRows) {
    const bdUserId = row.bd_owner_id
    if (!bdUserId) {
      continue
    }

    const targetRow = aggregateByBdId.get(bdUserId)
    if (!targetRow) {
      continue
    }

    targetRow.bcsSignedCount += 1
  }

  const filteredAggregateRows = [...aggregateByBdId.values()].filter((row) => {
    if (!keyword) {
      return true
    }
    const matchedName = row.bdName.toLowerCase().includes(keyword)
    const matchedEmail = row.bdEmail.toLowerCase().includes(keyword)
    return matchedName || matchedEmail
  })

  const rows: BdKpiRow[] = filteredAggregateRows
    .map((row) => ({
      ...row,
    }))
    .sort((a, b) => b.salesAmount + b.bcsSignedCount - (a.salesAmount + a.bcsSignedCount))

  const teamSalesAmount = rows.reduce((sum, row) => sum + row.salesAmount, 0)
  const teamSalesLeadCount = rows.reduce((sum, row) => sum + row.salesLeadCount, 0)
  const teamBcsSignedCount = rows.reduce((sum, row) => sum + row.bcsSignedCount, 0)

  const team: TeamKpiSummary = {
    bdCount: rows.length,
    salesAmount: teamSalesAmount,
    salesLeadCount: teamSalesLeadCount,
    bcsSignedCount: teamBcsSignedCount,
  }

  return { rows, team }
}
