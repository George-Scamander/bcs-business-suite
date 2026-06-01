import type { IntentPackage, LeadStatus, OnboardingStatus, ProjectStatus, SalesProductCategory, SalesProductSubcategory, TaskPriority, TaskStatus } from '../types/business'
import type { TFunction } from 'i18next'

export const LEAD_STATUS_OPTIONS: Array<{ label: string; value: LeadStatus }> = [
  { label: 'New', value: 'NEW' },
  { label: 'To Follow', value: 'TO_FOLLOW' },
  { label: 'Following', value: 'FOLLOWING' },
  { label: 'Negotiating', value: 'NEGOTIATING' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Lost', value: 'LOST' },
  { label: 'Signed', value: 'SIGNED' },
  { label: 'Rejected', value: 'REJECTED' },
]

export const INTENT_PACKAGE_OPTIONS: Array<{ label: string; value: IntentPackage }> = [
  { label: 'BCS', value: 'BCS' },
  { label: 'Products Sales', value: 'PRODUCTS_SALES' },
  { label: 'Both', value: 'BOTH' },
]

export const NEXT_FOLLOWUP_ARRANGEMENT_OPTIONS: Array<{ label: string; value: 'YES' | 'NO' }> = [
  { label: 'Yes', value: 'YES' },
  { label: 'No', value: 'NO' },
]

export const INDUSTRY_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Repair Workshop', value: 'Repair Workshop' },
  { label: 'Parts Sales', value: 'Parts Sales' },
  { label: 'Car Wash', value: 'Car Wash' },
  { label: 'Car Beauty', value: 'Car Beauty' },
  { label: 'Body & Paint Specialist', value: 'Body & Paint Specialist' },
  { label: 'Other', value: 'Other' },
]

export const ONBOARDING_STATUS_OPTIONS: Array<{ label: string; value: OnboardingStatus }> = [
  { label: 'Not Started', value: 'NOT_STARTED' },
  { label: 'Info Pending', value: 'INFO_PENDING' },
  { label: 'Document Pending', value: 'DOCUMENT_PENDING' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Revision Required', value: 'REVISION_REQUIRED' },
  { label: 'Contract Confirmed', value: 'CONTRACT_CONFIRMED' },
  { label: 'Service Activating', value: 'SERVICE_ACTIVATING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Rejected', value: 'REJECTED' },
]

export const PROJECT_STATUS_OPTIONS: Array<{ label: string; value: ProjectStatus }> = [
  { label: 'Not Started', value: 'NOT_STARTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Delayed', value: 'DELAYED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Closed', value: 'CLOSED' },
]

export const TASK_STATUS_OPTIONS: Array<{ label: string; value: TaskStatus }> = [
  { label: 'To Do', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Done', value: 'DONE' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export const TASK_PRIORITY_OPTIONS: Array<{ label: string; value: TaskPriority }> = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Critical', value: 'CRITICAL' },
]

export const SALES_PRODUCT_CATEGORY_OPTIONS: Array<{ label: string; value: SalesProductCategory }> = [
  { label: 'Engine Oil', value: 'ENGINE_OIL' },
  { label: 'Chemicals', value: 'CHEMICAL' },
  { label: 'Tires', value: 'TIRE' },
  { label: 'Wiper', value: 'WIPER' },
  { label: 'Three Filters', value: 'THREE_FILTERS' },
  { label: 'Battery', value: 'BATTERY' },
  { label: 'Brake Pad', value: 'BRAKE_PAD' },
  { label: 'Car Beauty', value: 'CAR_BEAUTY' },
  { label: 'Window Film', value: 'WINDOW_FILM' },
  { label: 'Bosch Accessories', value: 'BOSCH_ACCESSORY' },
  { label: 'X-OWL', value: 'X_OWL' },
]

export const SALES_PRODUCT_ENTRY_CATEGORY_OPTIONS: Array<{ label: string; value: SalesProductCategory }> = [
  { label: 'Engine Oil', value: 'ENGINE_OIL' },
  { label: 'Chemicals', value: 'CHEMICAL' },
  { label: 'Tires', value: 'TIRE' },
  { label: 'Car Beauty', value: 'CAR_BEAUTY' },
  { label: 'Window Film', value: 'WINDOW_FILM' },
  { label: 'Bosch Accessories', value: 'BOSCH_ACCESSORY' },
  { label: 'X-OWL', value: 'X_OWL' },
]

export const SALES_PRODUCT_SUBCATEGORY_OPTIONS: Record<'CHEMICAL' | 'BOSCH_ACCESSORY' | 'X_OWL', Array<{ label: string; value: SalesProductSubcategory }>> = {
  CHEMICAL: [
    { label: 'T1', value: 'CHEMICAL_T1' },
    { label: 'T3', value: 'CHEMICAL_T3' },
    { label: 'Other', value: 'CHEMICAL_OTHER' },
  ],
  BOSCH_ACCESSORY: [
    { label: 'Three Filters', value: 'BOSCH_THREE_FILTERS' },
    { label: 'Wiper', value: 'BOSCH_WIPER' },
    { label: 'Battery', value: 'BOSCH_BATTERY' },
    { label: 'Brake Pad', value: 'BOSCH_BRAKE_PAD' },
    { label: 'Spark Plug', value: 'BOSCH_SPARK_PLUG' },
    { label: 'Other', value: 'BOSCH_OTHER' },
  ],
  X_OWL: [
    { label: 'Brake Pad', value: 'X_OWL_BRAKE_PAD' },
    { label: 'Other', value: 'X_OWL_OTHER' },
  ],
}

const LEGACY_BOSCH_SUBCATEGORY_BY_CATEGORY: Partial<Record<SalesProductCategory, SalesProductSubcategory>> = {
  THREE_FILTERS: 'BOSCH_THREE_FILTERS',
  WIPER: 'BOSCH_WIPER',
  BATTERY: 'BOSCH_BATTERY',
  BRAKE_PAD: 'BOSCH_BRAKE_PAD',
  BOSCH_ACCESSORY: 'BOSCH_OTHER',
}

export const LOST_REASON_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Pricing mismatch', value: 'PRICE' },
  { label: 'Location not suitable', value: 'LOCATION' },
  { label: 'Chose competitor', value: 'COMPETITOR' },
  { label: 'Budget constraints', value: 'BUDGET' },
  { label: 'Other', value: 'OTHER' },
]

export const FOLLOWUP_TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Call', value: 'CALL' },
  { label: 'Visit', value: 'VISIT' },
  { label: 'Meeting', value: 'MEETING' },
  { label: 'Chat', value: 'CHAT' },
  { label: 'Email', value: 'EMAIL' },
]

function localizeByValue<T extends string>(
  options: Array<{ label: string; value: T }>,
  namespace: string,
  t: TFunction,
) {
  return options.map((item) => ({
    value: item.value,
    label: t(`${namespace}.${item.value}`, { defaultValue: item.label }),
  }))
}

export function getLeadStatusOptions(t: TFunction) {
  return localizeByValue(LEAD_STATUS_OPTIONS, 'status', t)
}

export function getOnboardingStatusOptions(t: TFunction) {
  return localizeByValue(ONBOARDING_STATUS_OPTIONS, 'status', t)
}

export function getProjectStatusOptions(t: TFunction) {
  return localizeByValue(PROJECT_STATUS_OPTIONS, 'status', t)
}

export function getTaskStatusOptions(t: TFunction) {
  return localizeByValue(TASK_STATUS_OPTIONS, 'status', t)
}

export function getTaskPriorityOptions(t: TFunction) {
  return localizeByValue(TASK_PRIORITY_OPTIONS, 'taskPriority', t)
}

export function getSalesProductCategoryOptions(t: TFunction) {
  return localizeByValue(SALES_PRODUCT_CATEGORY_OPTIONS, 'salesCategory', t)
}

export function getSalesProductEntryCategoryOptions(t: TFunction) {
  return localizeByValue(SALES_PRODUCT_ENTRY_CATEGORY_OPTIONS, 'salesCategory', t)
}

export function getSalesProductCategoryGroup(category: SalesProductCategory): SalesProductCategory {
  return LEGACY_BOSCH_SUBCATEGORY_BY_CATEGORY[category] ? 'BOSCH_ACCESSORY' : category
}

export function getSalesProductSubcategory(category: SalesProductCategory, subcategory?: SalesProductSubcategory | null): SalesProductSubcategory | null {
  if (subcategory) {
    return subcategory
  }
  if (category === 'CHEMICAL') {
    return 'CHEMICAL_OTHER'
  }
  if (category === 'X_OWL') {
    return 'X_OWL_OTHER'
  }
  return LEGACY_BOSCH_SUBCATEGORY_BY_CATEGORY[category] ?? null
}

export function getSalesProductSubcategoryOptions(category: SalesProductCategory, t: TFunction) {
  const categoryGroup = getSalesProductCategoryGroup(category)
  if (categoryGroup !== 'CHEMICAL' && categoryGroup !== 'BOSCH_ACCESSORY' && categoryGroup !== 'X_OWL') {
    return []
  }
  return localizeByValue(SALES_PRODUCT_SUBCATEGORY_OPTIONS[categoryGroup], 'salesSubcategory', t)
}

export function getSalesProductSubcategoryLabel(category: SalesProductCategory, subcategory: SalesProductSubcategory | null | undefined, t: TFunction): string | null {
  const resolved = getSalesProductSubcategory(category, subcategory)
  if (!resolved) {
    return null
  }
  const option = [...SALES_PRODUCT_SUBCATEGORY_OPTIONS.CHEMICAL, ...SALES_PRODUCT_SUBCATEGORY_OPTIONS.BOSCH_ACCESSORY, ...SALES_PRODUCT_SUBCATEGORY_OPTIONS.X_OWL]
    .find((item) => item.value === resolved)
  return t(`salesSubcategory.${resolved}`, { defaultValue: option?.label ?? resolved })
}

export function getLostReasonOptions(t: TFunction) {
  return localizeByValue(LOST_REASON_OPTIONS, 'lostReason', t)
}

export function getFollowupTypeOptions(t: TFunction) {
  return localizeByValue(FOLLOWUP_TYPE_OPTIONS, 'followupType', t)
}

export function getIntentPackageOptions(t: TFunction) {
  return localizeByValue(INTENT_PACKAGE_OPTIONS, 'intentPackage', t)
}

export function getNextFollowupArrangementOptions(t: TFunction) {
  return NEXT_FOLLOWUP_ARRANGEMENT_OPTIONS.map((item) => ({
    value: item.value,
    label: item.value === 'YES' ? t('common.yes', { defaultValue: item.label }) : t('common.no', { defaultValue: item.label }),
  }))
}

export function getIndustryOptions(t: TFunction) {
  const keyMap: Record<string, string> = {
    'Repair Workshop': 'page.leads.industryRepairWorkshop',
    'Parts Sales': 'page.leads.industryPartsSales',
    'Car Wash': 'page.leads.industryCarWash',
    'Car Beauty': 'page.leads.industryCarBeauty',
    'Body & Paint Specialist': 'page.leads.industryBodyPaint',
    Other: 'page.leads.industryOther',
  }

  return INDUSTRY_OPTIONS.map((item) => ({
    value: item.value,
    label: t(keyMap[item.value] ?? '', { defaultValue: item.label }),
  }))
}
