import type {
  SalesOrder,
  SalesOrderItem,
  SalesPaymentMethod,
  SalesProductCategory,
  SalesProductSubcategory,
  SalesTopTerm,
} from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'
import { recordOperationLog } from '../../../lib/supabase/logs'
import { generateUuid } from '../../../lib/uuid'

export interface CreateSalesOrderItemInput {
  category: SalesProductCategory
  subcategory?: SalesProductSubcategory | null
  product_name?: string
  quantity: number
  unit_price?: number
}

export interface CreateSalesOrderInput {
  company_name: string
  sold_at?: string
  note?: string
  payment_method?: SalesPaymentMethod
  payment_top_term?: SalesTopTerm | null
  onboard_merchant_id?: string
  items: CreateSalesOrderItemInput[]
}

export interface CreateSalesOrderWithAssignedBdInput extends CreateSalesOrderInput {
  bd_user_id: string
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
    intent_package: string | null
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
  category?: SalesProductCategory
  brandKeyword?: string
  paymentMethod?: SalesPaymentMethod
  paymentConfirmed?: boolean
}

export interface TirePriceCatalogRow {
  id: number
  sap_code: string | null
  size: string
  description: string
  load_index: string | null
  speed_symbol: string | null
  category: string | null
  price_incl_vat: number
  model_label: string
  is_active: boolean
}

export interface UpdateSalesOrderInput {
  orderId: string
  company_name: string
  sold_at: string
  payment_method?: SalesPaymentMethod
  payment_top_term?: SalesTopTerm | null
  note?: string | null
  items: CreateSalesOrderItemInput[]
}

interface DatabaseErrorPayload {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

function isMissingSalesPaymentColumnsError(error: unknown): boolean {
  const payload = (typeof error === 'object' && error !== null ? error : {}) as DatabaseErrorPayload
  const code = String(payload.code ?? '').trim().toUpperCase()
  const text = `${payload.message ?? ''} ${payload.details ?? ''} ${payload.hint ?? ''}`.toLowerCase()

  if (code === 'PGRST204' || code === '42703') {
    if (text.includes('payment_method') || text.includes('payment_top_term') || text.includes('sales_orders')) {
      return true
    }
  }

  return false
}

function isMissingSalesSubcategoryColumnError(error: unknown): boolean {
  const payload = (typeof error === 'object' && error !== null ? error : {}) as DatabaseErrorPayload
  const code = String(payload.code ?? '').trim().toUpperCase()
  const text = `${payload.message ?? ''} ${payload.details ?? ''} ${payload.hint ?? ''}`.toLowerCase()
  return text.includes('subcategory') && (
    ['PGRST200', 'PGRST204', '42703'].includes(code)
    || text.includes('does not exist')
    || text.includes('schema cache')
  )
}

function withoutSalesSubcategory<T extends { subcategory?: SalesProductSubcategory | null }>(item: T): Omit<T, 'subcategory'> {
  const compatibleItem = { ...item }
  delete compatibleItem.subcategory
  return compatibleItem
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

function normalizeBrandKeyword(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export async function listTirePriceCatalog(keyword?: string, limit = 200): Promise<TirePriceCatalogRow[]> {
  const normalizedKeyword = keyword?.trim()
  let query = supabase
    .from('tire_price_catalog')
    .select('id, sap_code, size, description, load_index, speed_symbol, category, price_incl_vat, model_label, is_active')
    .eq('is_active', true)
    .order('model_label', { ascending: true })
    .limit(Math.min(1000, Math.max(1, limit)))

  if (normalizedKeyword) {
    query = query.or(
      `model_label.ilike.%${normalizedKeyword}%,size.ilike.%${normalizedKeyword}%,description.ilike.%${normalizedKeyword}%,sap_code.ilike.%${normalizedKeyword}%`,
    )
  }

  const result = await query
  if (result.error) {
    throw result.error
  }
  return (result.data ?? []) as TirePriceCatalogRow[]
}

async function resolveSalesOrderIdsByItemFilters(filters: SalesOrderFilters): Promise<string[] | null> {
  const brandKeyword = normalizeBrandKeyword(filters.brandKeyword)
  if (!filters.category && !brandKeyword) {
    return null
  }

  let itemsQuery = supabase.from('sales_order_items').select('sales_order_id')

  if (filters.category) {
    itemsQuery = itemsQuery.eq('category', filters.category)
  }

  if (brandKeyword) {
    itemsQuery = itemsQuery.ilike('product_name', `%${brandKeyword}%`)
  }

  const itemsResult = await itemsQuery
  if (itemsResult.error) {
    throw itemsResult.error
  }

  const ids = Array.from(
    new Set(
      (itemsResult.data ?? [])
        .map((item) => String(item.sales_order_id ?? '').trim())
        .filter(Boolean),
    ),
  )
  return ids
}

function buildSpLeadCode(dateIso: string): string {
  const utcDate = new Date(dateIso)
  const yyyy = utcDate.getUTCFullYear()
  const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utcDate.getUTCDate()).padStart(2, '0')
  const suffix = generateUuid().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `SP-${yyyy}${mm}${dd}-${suffix}`
}

function buildSalesItemSummary(items: CreateSalesOrderItemInput[]): string {
  return items
    .map((item) => `${item.product_name?.trim() || item.category} x${Math.max(1, Number(item.quantity || 1))}`)
    .join(', ')
}

function normalizePaymentTerms(
  paymentMethod?: SalesPaymentMethod,
  paymentTopTerm?: SalesTopTerm | null,
): { paymentMethod: SalesPaymentMethod; paymentTopTerm: SalesTopTerm | null } {
  const normalizedMethod: SalesPaymentMethod =
    paymentMethod === 'TOP' ? 'TOP'
    : paymentMethod === 'CONSIGNMENT' ? 'CONSIGNMENT'
    : 'CASH'

  if (normalizedMethod === 'TOP') {
    return {
      paymentMethod: normalizedMethod,
      paymentTopTerm: paymentTopTerm === '60_DAYS' ? '60_DAYS' : '30_DAYS',
    }
  }

  if (normalizedMethod === 'CONSIGNMENT') {
    return {
      paymentMethod: normalizedMethod,
      paymentTopTerm: '30_DAYS',
    }
  }

  return {
    paymentMethod: normalizedMethod,
    paymentTopTerm: null,
  }
}

async function getCurrentUserId(): Promise<string> {
  const userResult = await supabase.auth.getUser()
  if (userResult.error) {
    throw extractDatabaseError(userResult.error, 'Failed to read current user')
  }

  const userId = userResult.data.user?.id
  if (!userId) {
    throw new Error('Not authenticated')
  }

  return userId
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
  const payment = normalizePaymentTerms(input.payment_method, input.payment_top_term)
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

  const orderInsertPayload = {
    company_name: company,
    lead_id: leadId,
    onboard_merchant_id: onboardMerchantId,
    bd_user_id: userId,
    sold_at: soldAt,
    payment_method: payment.paymentMethod,
    payment_top_term: payment.paymentTopTerm,
    note: input.note ?? null,
    created_by: userId,
    updated_by: userId,
  }

  let orderInsertResult = await supabase
    .from('sales_orders')
    .insert(orderInsertPayload)
    .select('id, order_no')
    .single()

  if (orderInsertResult.error && isMissingSalesPaymentColumnsError(orderInsertResult.error)) {
    const compatPayload = { ...orderInsertPayload } as Record<string, unknown>
    delete compatPayload.payment_method
    delete compatPayload.payment_top_term
    orderInsertResult = await supabase
      .from('sales_orders')
      .insert(compatPayload)
      .select('id, order_no')
      .single()
  }

  if (orderInsertResult.error) {
    throw extractDatabaseError(orderInsertResult.error, 'Failed to create sales order')
  }

  const orderId = orderInsertResult.data.id
  const orderNo = orderInsertResult.data.order_no

  const itemRows = input.items.map((item) => ({
    sales_order_id: orderId,
    category: item.category,
    subcategory: item.subcategory ?? null,
    product_name: item.product_name ?? null,
    quantity: Number(item.quantity || 1),
    unit_price: item.unit_price ?? null,
  }))

  let itemInsertResult = await supabase.from('sales_order_items').insert(itemRows)
  if (itemInsertResult.error && isMissingSalesSubcategoryColumnError(itemInsertResult.error)) {
    itemInsertResult = await supabase.from('sales_order_items').insert(
      itemRows.map(withoutSalesSubcategory),
    )
  }
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
  if (input.items.some((item) => item.subcategory)) {
    return createSalesOrderWithAutoLeadFallback(input)
  }

  const payment = normalizePaymentTerms(input.payment_method, input.payment_top_term)

  const result = await supabase.rpc('create_sales_order_with_auto_lead', {
    p_company_name: input.company_name,
    p_sold_at: input.sold_at ?? null,
    p_note: input.note ?? null,
    p_items: input.items,
    p_onboard_merchant_id: input.onboard_merchant_id ?? null,
    p_payment_method: payment.paymentMethod,
    p_payment_top_term: payment.paymentTopTerm ?? null,
  })

  if (result.error) {
    const rpcError = result.error as DatabaseErrorPayload
    if (rpcError.code === '42883' || rpcError.code === 'PGRST202' || rpcError.code === '42702') {
      return createSalesOrderWithAutoLeadFallback(input)
    }
    if ((rpcError.message ?? '').toLowerCase().includes('unsupported sales category')) {
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

export async function createSalesOrderWithAutoLeadAndAssignBd(
  input: CreateSalesOrderWithAssignedBdInput,
): Promise<CreateSalesOrderResult> {
  const targetBdUserId = input.bd_user_id.trim()
  if (!targetBdUserId) {
    throw new Error('BD owner is required')
  }

  const actorUserId = await getCurrentUserId()
  const payment = normalizePaymentTerms(input.payment_method, input.payment_top_term)
  const orderInput: CreateSalesOrderInput = {
    company_name: input.company_name,
    sold_at: input.sold_at,
    note: input.note,
    onboard_merchant_id: input.onboard_merchant_id,
    items: input.items,
  }
  const result = await createSalesOrderWithAutoLead(orderInput)
  const nowIso = new Date().toISOString()

  const orderUpdatePayload = {
    bd_user_id: targetBdUserId,
    payment_method: payment.paymentMethod,
    payment_top_term: payment.paymentTopTerm,
    updated_by: actorUserId,
    updated_at: nowIso,
  }

  let orderOwnerUpdateResult = await supabase
    .from('sales_orders')
    .update(orderUpdatePayload)
    .eq('id', result.order_id)

  if (orderOwnerUpdateResult.error && isMissingSalesPaymentColumnsError(orderOwnerUpdateResult.error)) {
    const compatPayload = { ...orderUpdatePayload } as Record<string, unknown>
    delete compatPayload.payment_method
    delete compatPayload.payment_top_term
    orderOwnerUpdateResult = await supabase
      .from('sales_orders')
      .update(compatPayload)
      .eq('id', result.order_id)
  }

  if (orderOwnerUpdateResult.error) {
    throw extractDatabaseError(orderOwnerUpdateResult.error, 'Failed to assign BD owner to sales order')
  }

  if (result.lead_id) {
    const leadResult = await supabase
      .from('leads')
      .select('assigned_bd_id')
      .eq('id', result.lead_id)
      .maybeSingle<{ assigned_bd_id: string | null }>()

    if (leadResult.error) {
      throw extractDatabaseError(leadResult.error, 'Failed to load linked lead owner')
    }

    const previousAssignedBdId = leadResult.data?.assigned_bd_id ?? null
    const leadOwnerUpdateResult = await supabase
      .from('leads')
      .update({
        assigned_bd_id: targetBdUserId,
        updated_by: actorUserId,
        updated_at: nowIso,
      })
      .eq('id', result.lead_id)
      .is('deleted_at', null)

    if (leadOwnerUpdateResult.error) {
      throw extractDatabaseError(leadOwnerUpdateResult.error, 'Failed to assign BD owner to linked lead')
    }

    if (previousAssignedBdId !== targetBdUserId) {
      const assignmentLogResult = await supabase.from('lead_assignment_logs').insert({
        lead_id: result.lead_id,
        from_user_id: previousAssignedBdId,
        to_user_id: targetBdUserId,
        action: 'TRANSFER',
        reason: 'sales_supervision_create_assign_bd',
      })

      if (assignmentLogResult.error && !['42501'].includes(assignmentLogResult.error.code ?? '')) {
        throw extractDatabaseError(assignmentLogResult.error, 'Failed to write lead assignment log')
      }
    }
  }

  await recordOperationLog({
    module: 'sales',
    entityType: 'sales_orders',
    entityId: result.order_id,
    action: 'create_sales_order_and_assign_bd',
    afterData: {
      lead_id: result.lead_id,
      lead_code: result.lead_code,
      target_bd_user_id: targetBdUserId,
      payment_method: payment.paymentMethod,
      payment_top_term: payment.paymentTopTerm,
    },
  })

  return result
}

export async function listSalesOrders(filters: SalesOrderFilters = {}): Promise<SalesOrderRow[]> {
  const matchedOrderIds = await resolveSalesOrderIdsByItemFilters(filters)
  if (matchedOrderIds && matchedOrderIds.length === 0) {
    return []
  }

  let query = supabase
    .from('sales_orders')
    .select(
      '*, lead:leads(id, lead_code, company_name, intent_package), onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type), bd_owner:profiles!sales_orders_bd_user_id_fkey(id, email, full_name), items:sales_order_items(*)',
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

  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod)
  }

  if (filters.paymentConfirmed === true) {
    query = query.not('payment_confirmed_at', 'is', null)
  } else if (filters.paymentConfirmed === false) {
    query = query.is('payment_confirmed_at', null)
  }

  if (matchedOrderIds) {
    query = query.in('id', matchedOrderIds)
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
      '*, lead:leads(id, lead_code, company_name, intent_package), onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type), bd_owner:profiles!sales_orders_bd_user_id_fkey(id, email, full_name), items:sales_order_items(*)',
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

export async function generateSalesPaymentDueNotifications(): Promise<number> {
  const result = await supabase.rpc('generate_sales_payment_due_notifications')

  if (result.error) {
    throw result.error
  }

  return Number(result.data ?? 0)
}

export async function listDeletedSalesOrders(filters: SalesOrderFilters = {}): Promise<SalesOrderRow[]> {
  const matchedOrderIds = await resolveSalesOrderIdsByItemFilters(filters)
  if (matchedOrderIds && matchedOrderIds.length === 0) {
    return []
  }

  let query = supabase
    .from('sales_orders')
    .select(
      '*, lead:leads(id, lead_code, company_name, intent_package), onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type), bd_owner:profiles!sales_orders_bd_user_id_fkey(id, email, full_name), items:sales_order_items(*)',
    )
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

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

  if (matchedOrderIds) {
    query = query.in('id', matchedOrderIds)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as SalesOrderRow[]
}

export async function updateSalesOrder(input: UpdateSalesOrderInput): Promise<void> {
  const userId = await getCurrentUserId()
  const companyName = input.company_name.trim()
  const payment = normalizePaymentTerms(input.payment_method, input.payment_top_term)
  if (!companyName) {
    throw new Error('Company name is required')
  }

  if (!input.items.length) {
    throw new Error('At least one sales item is required')
  }

  const orderResult = await supabase
    .from('sales_orders')
    .select('id, order_no, lead_id, onboard_merchant_id')
    .eq('id', input.orderId)
    .single<{ id: string; order_no: string; lead_id: string | null; onboard_merchant_id: string | null }>()

  if (orderResult.error) {
    throw extractDatabaseError(orderResult.error, 'Failed to load sales order')
  }

  const order = orderResult.data
  const normalizedItems = input.items.map((item) => ({
    sales_order_id: input.orderId,
    category: item.category,
    subcategory: item.subcategory ?? null,
    product_name: item.product_name?.trim() || null,
    quantity: Math.max(1, Number(item.quantity || 1)),
    unit_price: item.unit_price ?? null,
  }))

  const nowIso = new Date().toISOString()
  const orderUpdatePayload = {
    company_name: companyName,
    sold_at: input.sold_at,
    payment_method: payment.paymentMethod,
    payment_top_term: payment.paymentTopTerm,
    note: input.note ?? null,
    updated_by: userId,
    updated_at: nowIso,
  }

  let updateResult = await supabase
    .from('sales_orders')
    .update(orderUpdatePayload)
    .eq('id', input.orderId)

  if (updateResult.error && isMissingSalesPaymentColumnsError(updateResult.error)) {
    const compatPayload = { ...orderUpdatePayload } as Record<string, unknown>
    delete compatPayload.payment_method
    delete compatPayload.payment_top_term
    updateResult = await supabase
      .from('sales_orders')
      .update(compatPayload)
      .eq('id', input.orderId)
  }

  if (updateResult.error) {
    throw extractDatabaseError(updateResult.error, 'Failed to update sales order')
  }

  const deleteItemsResult = await supabase.from('sales_order_items').delete().eq('sales_order_id', input.orderId)
  if (deleteItemsResult.error) {
    throw extractDatabaseError(deleteItemsResult.error, 'Failed to reset sales order items')
  }

  let insertItemsResult = await supabase.from('sales_order_items').insert(normalizedItems)
  if (insertItemsResult.error && isMissingSalesSubcategoryColumnError(insertItemsResult.error)) {
    insertItemsResult = await supabase.from('sales_order_items').insert(
      normalizedItems.map(withoutSalesSubcategory),
    )
  }
  if (insertItemsResult.error) {
    throw extractDatabaseError(insertItemsResult.error, 'Failed to update sales order items')
  }

  const summary = buildSalesItemSummary(input.items)

  if (order.lead_id) {
    const leadUpdateResult = await supabase
      .from('leads')
      .update({
        company_name: companyName,
        last_followup_at: input.sold_at,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.lead_id)
      .is('deleted_at', null)

    if (leadUpdateResult.error) {
      throw extractDatabaseError(leadUpdateResult.error, 'Failed to sync lead after sales update')
    }

  }

  if (order.onboard_merchant_id) {
    const activityResult = await supabase
      .from('onboard_merchant_activities')
      .update({
        title: `Sales Order ${order.order_no}`,
        detail: [summary, input.note?.trim()].filter(Boolean).join('\n') || null,
        activity_at: input.sold_at,
        status: 'DONE',
        updated_by: userId,
        updated_at: nowIso,
      })
      .eq('related_sales_order_id', input.orderId)
      .is('deleted_at', null)

    if (activityResult.error) {
      throw extractDatabaseError(activityResult.error, 'Failed to sync merchant activity after sales edit')
    }
  }

  await recordOperationLog({
    module: 'sales',
    entityType: 'sales_orders',
    entityId: input.orderId,
    action: 'update_sales_order',
    afterData: {
      company_name: companyName,
      sold_at: input.sold_at,
      payment_method: payment.paymentMethod,
      payment_top_term: payment.paymentTopTerm,
      item_summary: summary,
    },
  })
}

export async function softDeleteSalesOrder(orderId: string): Promise<void> {
  const userId = await getCurrentUserId()
  const nowIso = new Date().toISOString()

  const orderResult = await supabase
    .from('sales_orders')
    .select('id, order_no, lead_id')
    .eq('id', orderId)
    .single<{ id: string; order_no: string; lead_id: string | null }>()

  if (orderResult.error) {
    throw extractDatabaseError(orderResult.error, 'Failed to load sales order')
  }

  const order = orderResult.data

  const deleteResult = await supabase
    .from('sales_orders')
    .update({
      deleted_at: nowIso,
      deleted_by: userId,
      updated_by: userId,
      updated_at: nowIso,
    })
    .eq('id', orderId)

  if (deleteResult.error) {
    throw extractDatabaseError(deleteResult.error, 'Failed to delete sales order')
  }

  const activityResult = await supabase
    .from('onboard_merchant_activities')
    .update({
      status: 'CANCELLED',
      deleted_at: nowIso,
      deleted_by: userId,
      updated_by: userId,
      updated_at: nowIso,
    })
    .eq('related_sales_order_id', orderId)
    .is('deleted_at', null)

  if (activityResult.error) {
    throw extractDatabaseError(activityResult.error, 'Failed to sync merchant activity after sales delete')
  }

  if (order.lead_id) {
    const leadUpdateResult = await supabase
      .from('leads')
      .update({
        updated_by: userId,
        updated_at: nowIso,
      })
      .eq('id', order.lead_id)
      .is('deleted_at', null)

    if (leadUpdateResult.error) {
      throw extractDatabaseError(leadUpdateResult.error, 'Failed to sync lead after sales delete')
    }

  }

  await recordOperationLog({
    module: 'sales',
    entityType: 'sales_orders',
    entityId: orderId,
    action: 'soft_delete_sales_order',
  })
}

export async function restoreSalesOrder(orderId: string): Promise<void> {
  const userId = await getCurrentUserId()
  const nowIso = new Date().toISOString()

  const orderResult = await supabase
    .from('sales_orders')
    .select('id, order_no, lead_id')
    .eq('id', orderId)
    .single<{ id: string; order_no: string; lead_id: string | null }>()

  if (orderResult.error) {
    throw extractDatabaseError(orderResult.error, 'Failed to load sales order')
  }

  const order = orderResult.data

  const restoreResult = await supabase
    .from('sales_orders')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: userId,
      updated_at: nowIso,
    })
    .eq('id', orderId)

  if (restoreResult.error) {
    throw extractDatabaseError(restoreResult.error, 'Failed to restore sales order')
  }

  const activityRestoreResult = await supabase
    .from('onboard_merchant_activities')
    .update({
      deleted_at: null,
      deleted_by: null,
      status: 'DONE',
      updated_by: userId,
      updated_at: nowIso,
    })
    .eq('related_sales_order_id', orderId)
    .not('deleted_at', 'is', null)

  if (activityRestoreResult.error) {
    throw extractDatabaseError(activityRestoreResult.error, 'Failed to restore merchant activity after sales restore')
  }

  if (order.lead_id) {
    const leadUpdateResult = await supabase
      .from('leads')
      .update({
        updated_by: userId,
        updated_at: nowIso,
      })
      .eq('id', order.lead_id)
      .is('deleted_at', null)

    if (leadUpdateResult.error) {
      throw extractDatabaseError(leadUpdateResult.error, 'Failed to sync lead after sales restore')
    }

  }

  await recordOperationLog({
    module: 'sales',
    entityType: 'sales_orders',
    entityId: orderId,
    action: 'restore_sales_order',
  })
}

export async function restoreSalesOrders(orderIds: string[]): Promise<void> {
  if (!orderIds.length) {
    return
  }

  for (const orderId of orderIds) {
    await restoreSalesOrder(orderId)
  }
}

export async function hardDeleteSalesOrder(orderId: string): Promise<void> {
  const deleteResult = await supabase.from('sales_orders').delete().eq('id', orderId)
  if (deleteResult.error) {
    throw extractDatabaseError(deleteResult.error, 'Failed to permanently delete sales order')
  }

  await recordOperationLog({
    module: 'sales',
    entityType: 'sales_orders',
    entityId: orderId,
    action: 'hard_delete_sales_order',
  })
}

export async function hardDeleteSalesOrders(orderIds: string[]): Promise<void> {
  if (!orderIds.length) {
    return
  }

  const deleteResult = await supabase.from('sales_orders').delete().in('id', orderIds)
  if (deleteResult.error) {
    throw extractDatabaseError(deleteResult.error, 'Failed to permanently delete selected sales orders')
  }

  await recordOperationLog({
    module: 'sales',
    entityType: 'sales_orders',
    action: 'hard_delete_sales_orders_bulk',
    afterData: { order_ids: orderIds },
  })
}

export async function confirmSalesOrderPayment(orderId: string): Promise<void> {
  const result = await supabase.rpc('confirm_sales_order_payment', { p_order_id: orderId })

  if (result.error) {
    throw extractDatabaseError(result.error, 'Failed to confirm sales order payment')
  }
}

export async function fetchProductNameSuggestions(): Promise<Map<SalesProductCategory, string[]>> {
  const result = await supabase
    .from('sales_order_items')
    .select('category, product_name')
    .not('product_name', 'is', null)
    .neq('product_name', '')
    .limit(600)

  if (result.error) {
    throw extractDatabaseError(result.error, 'Failed to load product name suggestions')
  }

  const seen = new Map<SalesProductCategory, Set<string>>()
  for (const row of result.data ?? []) {
    const cat = row.category as SalesProductCategory
    const name = String(row.product_name ?? '').trim()
    if (!name) continue
    if (!seen.has(cat)) seen.set(cat, new Set())
    seen.get(cat)!.add(name)
  }

  const map = new Map<SalesProductCategory, string[]>()
  for (const [cat, names] of seen.entries()) {
    map.set(cat, [...names].sort((a, b) => a.localeCompare(b)))
  }
  return map
}
