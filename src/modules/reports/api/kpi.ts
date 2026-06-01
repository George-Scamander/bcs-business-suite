import { supabase } from '../../../lib/supabase/client'
import { getSalesProductCategoryGroup } from '../../../lib/business-constants'
import type { SalesProductCategory } from '../../../types/business'

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

interface SalesOrderDetailRow {
  id: string
  bd_user_id: string | null
  sold_at: string
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

export interface BdKpiTargetSettings {
  teamTireTarget: number
  teamAccessoryTarget: number
  teamBcsTarget: number
  defaultPersonalTireTarget: number
  defaultPersonalAccessoryTarget: number
  defaultPersonalBcsTarget: number
}

export interface BdKpiSalesOrderDetailItem {
  category: SalesProductCategory | string
  quantity: number
  amount: number
}

export interface BdKpiSalesOrderDetail {
  orderId: string
  bdUserId: string
  soldAt: string
  salesAmount: number
  items: BdKpiSalesOrderDetailItem[]
}

const KPI_TARGET_DICTIONARY_TYPE = 'bd_kpi_target'

const KPI_TARGET_CODE_MAP: Record<keyof BdKpiTargetSettings, string> = {
  teamTireTarget: 'team_tire_target',
  teamAccessoryTarget: 'team_accessory_target',
  teamBcsTarget: 'team_bcs_target',
  defaultPersonalTireTarget: 'default_personal_tire_target',
  defaultPersonalAccessoryTarget: 'default_personal_accessory_target',
  defaultPersonalBcsTarget: 'default_personal_bcs_target',
}

function normalizeSettingValue(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

export async function getBdKpiTargetSettings(): Promise<Partial<BdKpiTargetSettings>> {
  const codes = Object.values(KPI_TARGET_CODE_MAP)
  const result = await supabase
    .from('dictionary_items')
    .select('code, label, is_active')
    .eq('dictionary_type', KPI_TARGET_DICTIONARY_TYPE)
    .in('code', codes)

  if (result.error) {
    throw result.error
  }

  const rowByCode = new Map(
    (result.data ?? [])
      .filter((item) => item.is_active !== false)
      .map((item) => [String(item.code), normalizeSettingValue(item.label)]),
  )

  const settings: Partial<BdKpiTargetSettings> = {}
  for (const [key, code] of Object.entries(KPI_TARGET_CODE_MAP) as Array<[keyof BdKpiTargetSettings, string]>) {
    const value = rowByCode.get(code)
    if (value !== null && value !== undefined) {
      settings[key] = value
    }
  }

  return settings
}

export async function saveBdKpiTargetSettings(settings: BdKpiTargetSettings): Promise<void> {
  const rows = (Object.entries(KPI_TARGET_CODE_MAP) as Array<[keyof BdKpiTargetSettings, string]>).map(([key, code], index) => ({
    dictionary_type: KPI_TARGET_DICTIONARY_TYPE,
    code,
    label: String(Math.max(0, Number(settings[key] ?? 0))),
    sort_order: (index + 1) * 10,
    is_active: true,
  }))

  const result = await supabase.from('dictionary_items').upsert(rows, {
    onConflict: 'dictionary_type,code',
  })

  if (result.error) {
    throw result.error
  }
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

export async function queryBdKpiSalesOrderDetails(
  filters: BdKpiFilters & { bdUserIds?: string[] } = {},
): Promise<BdKpiSalesOrderDetail[]> {
  const cleanBdUserIds = Array.from(
    new Set(
      (filters.bdUserIds ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )

  if (filters.bdUserIds && cleanBdUserIds.length === 0) {
    return []
  }

  let salesQuery = supabase
    .from('sales_orders')
    .select('id, bd_user_id, sold_at, items:sales_order_items(category, quantity, unit_price)')
    .is('deleted_at', null)

  if (filters.dateFrom) {
    salesQuery = salesQuery.gte('sold_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    salesQuery = salesQuery.lte('sold_at', filters.dateTo)
  }
  if (cleanBdUserIds.length > 0) {
    salesQuery = salesQuery.in('bd_user_id', cleanBdUserIds)
  }

  const salesResult = await salesQuery
  if (salesResult.error) {
    throw salesResult.error
  }

  const salesRows = (salesResult.data ?? []) as SalesOrderDetailRow[]
  const details: BdKpiSalesOrderDetail[] = []

  for (const row of salesRows) {
    if (!row.bd_user_id || !row.sold_at) {
      continue
    }

    const mappedItems: BdKpiSalesOrderDetailItem[] = (row.items ?? []).map((item) => {
      const quantity = Math.max(0, Number(item.quantity ?? 0))
      const unitPrice = Math.max(0, Number(item.unit_price ?? 0))
      return {
        category: item.category ? getSalesProductCategoryGroup(item.category as SalesProductCategory) : 'UNKNOWN',
        quantity,
        amount: quantity > 0 && unitPrice > 0 ? quantity * unitPrice : 0,
      }
    })

    const salesAmount = mappedItems.reduce((sum, item) => sum + item.amount, 0)
    details.push({
      orderId: row.id,
      bdUserId: row.bd_user_id,
      soldAt: row.sold_at,
      salesAmount,
      items: mappedItems,
    })
  }

  return details
}
