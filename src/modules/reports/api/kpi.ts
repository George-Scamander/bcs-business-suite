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
  tireSalesQuantity: number
  accessorySalesAmount: number
  salesRecordCount: number
  bcsSignedCount: number
  isBcsTargetExempt: boolean
}

export interface TeamKpiSummary {
  bdCount: number
  salesAmount: number
  tireSalesQuantity: number
  accessorySalesAmount: number
  salesRecordCount: number
  bcsSignedCount: number
  exemptBdCount: number
}

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
}

interface SalesOrderItemKpiRow {
  category: string | null
  quantity: number | null
  unit_price: number | null
}

interface SalesOrderKpiRow {
  bd_user_id: string | null
  items: SalesOrderItemKpiRow[] | null
}

interface MerchantKpiRow {
  bd_owner_id: string | null
}

interface BdAggregateRow {
  bdUserId: string
  bdName: string
  bdEmail: string
  salesAmount: number
  tireSalesQuantity: number
  accessorySalesAmount: number
  salesRecordCount: number
  bcsSignedCount: number
  isBcsTargetExempt: boolean
}

export async function queryBdKpiSummary(filters: BdKpiFilters = {}): Promise<{ rows: BdKpiRow[]; team: TeamKpiSummary }> {
  const BCS_EXEMPTION_THRESHOLD = 5_000_000
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
        tireSalesQuantity: 0,
        accessorySalesAmount: 0,
        salesRecordCount: 0,
        bcsSignedCount: 0,
        isBcsTargetExempt: false,
      },
    ]),
  )

  let salesQuery = supabase
    .from('sales_orders')
    .select('bd_user_id, items:sales_order_items(category, quantity, unit_price)')
    .is('deleted_at', null)

  if (filters.dateFrom) {
    salesQuery = salesQuery.gte('sold_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    salesQuery = salesQuery.lte('sold_at', filters.dateTo)
  }

  const salesResult = await salesQuery
  if (salesResult.error) {
    throw salesResult.error
  }

  const salesRows = (salesResult.data ?? []) as SalesOrderKpiRow[]
  for (const row of salesRows) {
    const bdUserId = row.bd_user_id
    if (!bdUserId) {
      continue
    }

    const targetRow = aggregateByBdId.get(bdUserId)
    if (!targetRow) {
      continue
    }

    targetRow.salesRecordCount += 1

    for (const item of row.items ?? []) {
      const unitPrice = Number(item.unit_price ?? 0)
      const quantity = Math.max(0, Number(item.quantity ?? 0))
      const amount = unitPrice > 0 && quantity > 0 ? unitPrice * quantity : 0

      if (item.category === 'TIRE') {
        targetRow.tireSalesQuantity += quantity
      } else {
        if (amount > 0) {
          targetRow.accessorySalesAmount += amount
        }
      }

      if (amount > 0) {
        targetRow.salesAmount += amount
      }
    }
  }

  for (const aggregateRow of aggregateByBdId.values()) {
    aggregateRow.isBcsTargetExempt = aggregateRow.salesAmount > BCS_EXEMPTION_THRESHOLD
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
  const teamTireSalesQuantity = rows.reduce((sum, row) => sum + row.tireSalesQuantity, 0)
  const teamAccessorySalesAmount = rows.reduce((sum, row) => sum + row.accessorySalesAmount, 0)
  const teamSalesRecordCount = rows.reduce((sum, row) => sum + row.salesRecordCount, 0)
  const teamBcsSignedCount = rows.reduce((sum, row) => sum + row.bcsSignedCount, 0)
  const teamExemptBdCount = rows.reduce((sum, row) => sum + (row.isBcsTargetExempt ? 1 : 0), 0)

  const team: TeamKpiSummary = {
    bdCount: rows.length,
    salesAmount: teamSalesAmount,
    tireSalesQuantity: teamTireSalesQuantity,
    accessorySalesAmount: teamAccessorySalesAmount,
    salesRecordCount: teamSalesRecordCount,
    bcsSignedCount: teamBcsSignedCount,
    exemptBdCount: teamExemptBdCount,
  }

  return { rows, team }
}
