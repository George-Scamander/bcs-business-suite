import type { IntentPackage, LeadStatus, OnboardingStatus, ProjectStatus, TaskPriority, TaskStatus } from '../types/business'
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
