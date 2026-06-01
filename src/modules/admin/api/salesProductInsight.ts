import type {
  IntentPackage,
  LeadStatus,
  OnboardMerchantType,
  SalesOrderItem,
  SalesPaymentMethod,
  SalesTopTerm,
} from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'

export type AdminInsightBusinessScope = 'BCS' | 'BOTH' | 'NON_BCS'
export type AdminInsightSystemStage = 'LEAD' | 'SALES' | 'SIGNED' | 'ONBOARDING' | 'ONBOARDED'

export interface AdminInsightLeadRow {
  id: string
  lead_code: string
  company_name: string
  status: LeadStatus
  intent_package: IntentPackage | null
  assigned_bd_id: string | null
  industry: string | null
  region: string | null
  city: string | null
  created_at: string
  updated_at: string
}

export interface AdminInsightSignedRecordRow {
  id: string
  lead_id: string
  contract_package: IntentPackage | null
  contract_value: number | null
  signed_at: string
  created_at: string
}

export interface AdminInsightOnboardingCaseRow {
  id: string
  case_no: string
  signed_record_id: string
  status: string
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export interface AdminInsightMerchantRow {
  id: string
  merchant_no: string
  lead_id: string | null
  company_name: string
  onboarding_type: OnboardMerchantType
  bd_owner_id: string | null
  onboarded_at: string
  created_at: string
  updated_at: string
}

export interface AdminInsightSalesOrderRow {
  id: string
  order_no: string
  company_name: string
  lead_id: string | null
  onboard_merchant_id: string | null
  bd_user_id: string
  sold_at: string
  payment_method: SalesPaymentMethod
  payment_top_term: SalesTopTerm | null
  created_at: string
  updated_at: string
  lead: {
    id: string
    lead_code: string
    company_name: string
    status: LeadStatus
    intent_package: IntentPackage | null
    assigned_bd_id: string | null
    created_at: string
  } | null
  onboard_merchant: {
    id: string
    merchant_no: string
    company_name: string
    onboarding_type: OnboardMerchantType
    lead_id: string | null
    bd_owner_id: string | null
  } | null
  items: Array<Pick<SalesOrderItem, 'id' | 'sales_order_id' | 'category' | 'subcategory' | 'product_name' | 'quantity' | 'unit_price' | 'created_at' | 'updated_at'>>
}

export interface AdminSalesProductInsightDataset {
  leads: AdminInsightLeadRow[]
  signedRecords: AdminInsightSignedRecordRow[]
  onboardingCases: AdminInsightOnboardingCaseRow[]
  onboardMerchants: AdminInsightMerchantRow[]
  salesOrders: AdminInsightSalesOrderRow[]
}

export async function listAdminSalesProductInsightDataset(): Promise<AdminSalesProductInsightDataset> {
  const [leadsResult, signedResult, onboardingResult, merchantsResult, salesOrdersResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id, lead_code, company_name, status, intent_package, assigned_bd_id, industry, region, city, created_at, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('signed_records').select('id, lead_id, contract_package, contract_value, signed_at, created_at').order('created_at', { ascending: false }),
    supabase
      .from('onboarding_cases')
      .select('id, case_no, signed_record_id, status, owner_user_id, created_at, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('onboard_merchants')
      .select('id, merchant_no, lead_id, company_name, onboarding_type, bd_owner_id, onboarded_at, created_at, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('sales_orders')
      .select(
        [
          'id, order_no, company_name, lead_id, onboard_merchant_id, bd_user_id, sold_at, payment_method, payment_top_term, created_at, updated_at',
          'lead:leads(id, lead_code, company_name, status, intent_package, assigned_bd_id, created_at)',
          'onboard_merchant:onboard_merchants(id, merchant_no, company_name, onboarding_type, lead_id, bd_owner_id)',
          'items:sales_order_items(id, sales_order_id, category, subcategory, product_name, quantity, unit_price, created_at, updated_at)',
        ].join(', '),
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  if (leadsResult.error) {
    throw leadsResult.error
  }
  if (signedResult.error) {
    throw signedResult.error
  }
  if (onboardingResult.error) {
    throw onboardingResult.error
  }
  if (merchantsResult.error) {
    throw merchantsResult.error
  }
  if (salesOrdersResult.error) {
    throw salesOrdersResult.error
  }

  return {
    leads: (leadsResult.data ?? []) as AdminInsightLeadRow[],
    signedRecords: (signedResult.data ?? []) as AdminInsightSignedRecordRow[],
    onboardingCases: (onboardingResult.data ?? []) as AdminInsightOnboardingCaseRow[],
    onboardMerchants: (merchantsResult.data ?? []) as AdminInsightMerchantRow[],
    salesOrders: ((salesOrdersResult.data ?? []) as unknown) as AdminInsightSalesOrderRow[],
  }
}
