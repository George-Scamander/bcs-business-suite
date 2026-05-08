import type { SalesOrder, SalesOrderItem, SalesProductCategory } from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'

export interface CreateSalesOrderItemInput {
  category: SalesProductCategory
  product_name?: string
  quantity: number
  unit_price?: number
}

export interface CreateSalesOrderInput {
  company_name: string
  sold_at?: string
  note?: string
  onboard_merchant_id?: string
  items: CreateSalesOrderItemInput[]
}

export interface CreateSalesOrderResult {
  order_id: string
  order_no: string
  lead_id: string | null
  lead_code: string | null
  lead_created: boolean
}

export interface SalesOrderRow extends SalesOrder {
  lead: {
    id: string
    lead_code: string
    company_name: string
  } | null
  onboard_merchant: {
    id: string
    merchant_no: string
    company_name: string
    onboarding_type: string
  } | null
  bd_owner: {
    id: string
    email: string
    full_name: string | null
  } | null
  items: SalesOrderItem[]
}

export interface SalesOrderFilters {
  bdUserId?: string
  leadId?: string
  keyword?: string
  soldFrom?: string
  soldTo?: string
}

interface DatabaseErrorPayload {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

function extractDatabaseError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error
  }

  const payload = (typeof error === 'object' && error !== null ? error : {}) as DatabaseErrorPayload
  const code = payload.code?.trim()
  const message = payload.message?.trim() || fallback
  const details = payload.details?.trim()
  const hint = payload.hint?.trim()
  const pieces = [message]

  if (code) {
    pieces.push(`(code: ${code})`)
  }
  if (details) {
    pieces.push(details)
  }
  if (hint) {
    pieces.push(`hint: ${hint}`)
  }

  return new Error(pieces.join(' | '))
}

function normalizeCompanyName(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}_]+/gu, '').trim()
}

function buildSpLeadCode(dateIso: string): string {
  const utcDate = new Date(dateIso)
  const yyyy = utcDate.getUTCFullYear()
  const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utcDate.getUTCDate()).padStart(2, '0')
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `SP-${yyyy}${mm}${dd}-${suffix}`
}

async function createSalesOrderWithAutoLeadFallback(input: CreateSalesOrderInput): Promise<CreateSalesOrderResult> {
  const userResult = await supabase.auth.getUser()
  if (userResult.error) {
    throw extractDatabaseError(userResult.error, 'Failed to read current user')
  }

  const userId = userResult.data.user?.id
  if (!userId) {
    throw new Error('Not authenticated')
  }

  const soldAt = input.sold_at ?? new Date().toISOString()
  let company = input.company_name.trim()
  let onboardMerchantLeadId: string | null = null
  let onboardMerchantId: string | null = input.onboard_merchant_id ?? null

  if (onboardMerchantId) {
    const merchantResult = await supabase
      .from('onboard_merchants')
      .select('id, company_name, lead_id')
      .eq('id', onboardMerchantId)
      .is('deleted_at', null)
      .single()

    if (merchantResult.error) {
      throw extractDatabaseError(merchantResult.error, 'Failed to query onboard merchant')
    }

    company = company || String(merchantResult.data.company_name ?? '').trim()
    onboardMerchantLeadId = (merchantResult.data.lead_id as string | null) ?? null
  } else {
    const matchedMerchantResult = await supabase
      .from('onboard_merchants')
      .select('id, company_name, lead_id, bd_owner_id')
      .is('deleted_at', null)
      .ilike('company_name', `%${company}%`)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (matchedMerchantResult.error) {
      throw extractDatabaseError(matchedMerchantResult.error, 'Failed to query onboard merchants')
    }

    const exactMerchants = (matchedMerchantResult.data ?? []).filter(
      (row) => normalizeCompanyName(String(row.company_name ?? '')) === normalizeCompanyName(company),
    )

    if (exactMerchants.length > 0) {
      const preferred = exactMerchants.find((row) => row.bd_owner_id === userId) ?? exactMerchants[0]
      onboardMerchantId = String(preferred.id)
      onboardMerchantLeadId = (preferred.lead_id as string | null) ?? null
      company = String(preferred.company_name ?? company).trim() || company
    }
  }

  const normalizedCompany = normalizeCompanyName(company)

  const leadQueryResult = await supabase
    .from('leads')
    .select('id, lead_code, company_name')
    .is('deleted_at', null)
    .ilike('company_name', `%${company}%`)
    .limit(100)

  if (leadQueryResult.error) {
    throw extractDatabaseError(leadQueryResult.error, 'Failed to query leads')
  }

  const matchedLead = (leadQueryResult.data ?? []).find(
    (row) => normalizeCompanyName(String(row.company_name ?? '')) === normalizedCompany,
  )

  let leadId = onboardMerchantLeadId ?? matchedLead?.id ?? null
  let leadCode = matchedLead?.lead_code ?? null
  let leadCreated = false

  if (leadId && !leadCode) {
    const leadByIdResult = await supabase.from('leads').select('lead_code').eq('id', leadId).maybeSingle()
    if (leadByIdResult.error) {
      throw extractDatabaseError(leadByIdResult.error, 'Failed to query linked lead')
    }
    leadCode = (leadByIdResult.data?.lead_code as string | undefined) ?? null
  }

  if (!leadId) {
    leadCreated = true
    leadCode = buildSpLeadCode(soldAt)

    const leadInsertResult = await supabase
      .from('leads')
      .insert({
        lead_code: leadCode,
        company_name: company,
        source: 'SALES_ORDER',
        status: 'NEW',
        assigned_bd_id: userId,
        created_by: userId,
        updated_by: userId,
        created_at: soldAt,
        updated_at: new Date().toISOString(),
      })
      .select('id, lead_code')
      .single()

    if (leadInsertResult.error) {
      throw extractDatabaseError(leadInsertResult.error, 'Failed to auto-create lead for sales order')
    }

    leadId = leadInsertResult.data.id
    leadCode = leadInsertResult.data.lead_code
  }

  if (onboardMerchantId && leadId) {
    const merchantUpdateResult = await supabase
      .from('onboard_merchants')
      .update({
        lead_id: leadId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardMerchantId)

    if (merchantUpdateResult.error) {
      throw extractDatabaseError(merchantUpdateResult.error, 'Failed to sync onboard merchant lead')
    }
  }

  const orderInsertResult = await supabase
    .from('sales_orders')
    .insert({
      company_name: company,
      lead_id: leadId,
      onboard_merchant_id: onboardMerchantId,
      bd_user_id: userId,
      sold_at: soldAt,
      note: input.note ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id, order_no')
    .single()

  if (orderInsertResult.error) {
    throw extractDatabaseError(orderInsertResult.error, 'Failed to create sales order')
  }

  const orderId = orderInsertResult.data.id
  const orderNo = orderInsertResult.data.order_no

  const itemRows = input.items.map((item) => ({
    sales_order_id: orderId,
    category: item.category,
    product_name: item.product_name ?? null,
    quantity: Number(item.quantity || 1),
    unit_price: item.unit_price ?? null,
  }))

  const itemInsertResult = await supabase.from('sales_order_items').insert(itemRows)
  if (itemInsertResult.error) {
    throw extractDatabaseError(itemInsertResult.error, 'Failed to create sales order items')
  }

  if (onboardMerchantId) {
    const itemSummary = itemRows
      .map((item) => `${item.product_name || item.category} x${item.quantity}`)
      .join(', ')
    const activityNote = [itemSummary, input.note?.trim()].filter(Boolean).join('\n')

    const activityInsertResult = await supabase.from('onboard_merchant_activities').insert({
      merchant_id: onboardMerchantId,
      activity_type: 'SALES_ORDER',
      status: 'DONE',
      title: `Sales Order ${orderNo}`,
      detail: activityNote || null,
      activity_at: soldAt,
      related_sales_order_id: orderId,
      created_by: userId,
      updated_by: userId,
    })

    if (activityInsertResult.error && !['42P01', '42501'].includes(activityInsertResult.error.code ?? '')) {
      throw extractDatabaseError(activityInsertResult.error, 'Failed to sync merchant activity')
    }
  }

  return {
    order_id: orderId,
    order_no: orderNo,
    lead_id: leadId,
    lead_code: leadCode,
    lead_created: leadCreated,
  }
}

export async function createSalesOrderWithAutoLead(input: CreateSalesOrderInput): Promise<CreateSalesOrderResult> {
  const result = await supabase.rpc('create_sales_order_with_auto_lead', {
    p_company_name: input.company_name,
    p_sold_at: input.sold_at ?? null,
    p_note: input.note ?? null,
    p_items: input.items,
    p_onboard_merchant_id: input.onboard_merchant_id ?? null,
  })

  if (result.error) {
    const rpcError = result.error as DatabaseErrorPayload
    if (rpcError.code === '42883' || rpcError.code === 'PGRST202' || rpcError.code === '42702') {
      return createSalesOrderWithAutoLeadFallback(input)
    }

    throw extractDatabaseError(result.error, 'Failed to create sales order')
  }

  const row = Array.isArray(result.data) ? result.data[0] : null
  if (!row) {
    throw new Error('Sales order creation returned empty result')
  }

  return row as CreateSalesOrderResult
}

export async function listSalesOrders(filters: SalesOrderFilters = {}): Promise<SalesOrderRow[]> {
  let query = supabase
    .from('sales_orders')
    .select(
      '*, lead:leads(id, lead_code, company_name), onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type), bd_owner:profiles!sales_orders_bd_user_id_fkey(id, email, full_name), items:sales_order_items(*)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters.bdUserId) {
    query = query.eq('bd_user_id', filters.bdUserId)
  }

  if (filters.leadId) {
    query = query.eq('lead_id', filters.leadId)
  }

  if (filters.keyword) {
    query = query.or(`order_no.ilike.%${filters.keyword}%,company_name.ilike.%${filters.keyword}%`)
  }

  if (filters.soldFrom) {
    query = query.gte('sold_at', filters.soldFrom)
  }

  if (filters.soldTo) {
    query = query.lte('sold_at', filters.soldTo)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as SalesOrderRow[]
}

export async function listSalesOrderTemplatesByOwner(ownerId: string): Promise<SalesOrderRow[]> {
  const result = await supabase
    .from('sales_orders')
    .select(
      '*, lead:leads(id, lead_code, company_name), onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type), bd_owner:profiles!sales_orders_bd_user_id_fkey(id, email, full_name), items:sales_order_items(*)',
    )
    .eq('bd_user_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(15)

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as SalesOrderRow[]
}
