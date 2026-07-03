import { supabase } from '../../../lib/supabase/client'

export interface AccurateSalesInvoice {
  id: string
  invoice_no: string
  customer_name: string | null
  branch_name: string | null
  transaction_date: string | null
  due_date: string | null
  total_amount: number | null
  tax_amount: number | null
  paid_amount: number | null
  outstanding_amount: number | null
  status: string | null
  currency_code: string | null
  note: string | null
  synced_at: string
}

export interface AccuratePurchaseInvoice {
  id: string
  invoice_no: string
  vendor_name: string | null
  branch_name: string | null
  transaction_date: string | null
  due_date: string | null
  total_amount: number | null
  tax_amount: number | null
  paid_amount: number | null
  outstanding_amount: number | null
  status: string | null
  currency_code: string | null
  note: string | null
  synced_at: string
}

export interface AccurateInventoryItem {
  id: string
  item_code: string | null
  item_name: string
  category: string | null
  unit: string | null
  stock_quantity: number | null
  min_stock: number | null
  buy_price: number | null
  sell_price: number | null
  warehouse_name: string | null
  branch_name: string | null
  raw_data?: Record<string, unknown> | null   // 列表查詢不含此欄位，僅 detail 查詢包含
  synced_at: string
}

export interface AccurateBackorder {
  id: string
  order_no: string
  customer_name: string | null
  branch_name: string | null
  transaction_date: string | null
  expected_delivery_date: string | null
  item_name: string | null
  item_code: string | null
  ordered_quantity: number | null
  delivered_quantity: number | null
  remaining_quantity: number | null
  unit: string | null
  unit_price: number | null
  total_amount: number | null
  status: string | null
  synced_at: string
}

export interface AccurateCashFlow {
  id: string
  transaction_date: string
  description: string | null
  account_name: string | null
  account_code: string | null
  branch_name: string | null
  debit_amount: number
  credit_amount: number
  balance: number | null
  transaction_type: string | null
  reference_no: string | null
  synced_at: string
}

export interface AccurateSyncLog {
  id: string
  sync_type: string
  status: 'success' | 'error' | 'partial'
  records_synced: number | null
  error_message: string | null
  started_at: string
  finished_at: string | null
}

export interface AccurateFilters {
  keyword?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  branch?: string
  category?: string
}

export async function listAccurateSalesInvoices(filters: AccurateFilters = {}): Promise<AccurateSalesInvoice[]> {
  let query = supabase
    .from('accurate_sales_invoices')
    .select('id,invoice_no,customer_name,branch_name,transaction_date,due_date,total_amount,tax_amount,paid_amount,outstanding_amount,status,currency_code,note,synced_at')
    .order('transaction_date', { ascending: false })
    .limit(500)

  if (filters.keyword) {
    query = query.or(`invoice_no.ilike.%${filters.keyword}%,customer_name.ilike.%${filters.keyword}%`)
  }
  if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.branch) query = query.eq('branch_name', filters.branch)

  const result = await query
  if (result.error) throw result.error
  return (result.data ?? []) as AccurateSalesInvoice[]
}

export async function listAccuratePurchaseInvoices(filters: AccurateFilters = {}): Promise<AccuratePurchaseInvoice[]> {
  let query = supabase
    .from('accurate_purchase_invoices')
    .select('id,invoice_no,vendor_name,branch_name,transaction_date,due_date,total_amount,tax_amount,paid_amount,outstanding_amount,status,currency_code,note,synced_at')
    .order('transaction_date', { ascending: false })
    .limit(500)

  if (filters.keyword) {
    query = query.or(`invoice_no.ilike.%${filters.keyword}%,vendor_name.ilike.%${filters.keyword}%`)
  }
  if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo)
  if (filters.status) query = query.eq('status', filters.status)

  const result = await query
  if (result.error) throw result.error
  return (result.data ?? []) as AccuratePurchaseInvoice[]
}

// Supabase PostgREST 預設每次最多回傳 1000 行，需要用 .range() 分頁取得所有記錄
// 列表查詢不含 raw_data（每筆 JSON 很大），改由 getAccurateInventoryItemDetail 按需加載
export async function listAccurateInventory(filters: AccurateFilters = {}): Promise<AccurateInventoryItem[]> {
  const PAGE = 1000
  const allData: AccurateInventoryItem[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('accurate_inventory_items')
      .select('id,item_code,item_name,category,unit,stock_quantity,min_stock,buy_price,sell_price,warehouse_name,branch_name,synced_at')
      .order('item_name', { ascending: true })
      .range(from, from + PAGE - 1)

    if (filters.keyword) {
      query = query.or(`item_code.ilike.%${filters.keyword}%,item_name.ilike.%${filters.keyword}%`)
    }
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.branch) query = query.eq('branch_name', filters.branch)

    const result = await query
    if (result.error) throw result.error
    const rows = (result.data ?? []) as AccurateInventoryItem[]
    allData.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }

  return allData
}

// 單獨加載含 raw_data（倉庫分布）的品項詳情，供 Drawer 使用
export async function getAccurateInventoryItemDetail(id: string): Promise<AccurateInventoryItem | null> {
  const result = await supabase
    .from('accurate_inventory_items')
    .select('id,item_code,item_name,category,unit,stock_quantity,min_stock,buy_price,sell_price,warehouse_name,branch_name,raw_data,synced_at')
    .eq('id', id)
    .maybeSingle()
  if (result.error) throw result.error
  return result.data as AccurateInventoryItem | null
}

export async function listAccurateInventoryCategories(): Promise<string[]> {
  const result = await supabase
    .from('accurate_inventory_items')
    .select('category')
    .not('category', 'is', null)
    .order('category', { ascending: true })
    .limit(2000)

  if (result.error) throw result.error
  const seen = new Set<string>()
  for (const row of result.data ?? []) {
    if (row.category) seen.add(row.category as string)
  }
  return Array.from(seen).sort()
}

export async function listAccurateBackorders(filters: AccurateFilters = {}): Promise<AccurateBackorder[]> {
  let query = supabase
    .from('accurate_backorders')
    .select('id,order_no,customer_name,branch_name,transaction_date,expected_delivery_date,item_name,item_code,ordered_quantity,delivered_quantity,remaining_quantity,unit,unit_price,total_amount,status,synced_at')
    .order('transaction_date', { ascending: false })
    .limit(500)

  if (filters.keyword) {
    query = query.or(`order_no.ilike.%${filters.keyword}%,customer_name.ilike.%${filters.keyword}%,item_name.ilike.%${filters.keyword}%`)
  }
  if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo)
  if (filters.branch) query = query.eq('branch_name', filters.branch)

  const result = await query
  if (result.error) throw result.error
  return (result.data ?? []) as AccurateBackorder[]
}

export async function listAccurateCashFlow(filters: AccurateFilters = {}): Promise<AccurateCashFlow[]> {
  let query = supabase
    .from('accurate_cash_flow')
    .select('id,transaction_date,description,account_name,account_code,branch_name,debit_amount,credit_amount,balance,transaction_type,reference_no,synced_at')
    .order('transaction_date', { ascending: false })
    .limit(500)

  if (filters.keyword) {
    query = query.or(`description.ilike.%${filters.keyword}%,account_name.ilike.%${filters.keyword}%,reference_no.ilike.%${filters.keyword}%`)
  }
  if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo)
  if (filters.branch) query = query.eq('branch_name', filters.branch)

  const result = await query
  if (result.error) throw result.error
  return (result.data ?? []) as AccurateCashFlow[]
}

export async function getLatestSyncLog(): Promise<AccurateSyncLog | null> {
  const result = await supabase
    .from('accurate_sync_logs')
    .select('*')
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) throw result.error
  return result.data as AccurateSyncLog | null
}
