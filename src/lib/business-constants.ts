import type { LeadStatus, OnboardingStatus, ProjectStatus, TaskPriority, TaskStatus } from '../types/business'

export const LEAD_STATUS_OPTIONS: Array<{ label: string; value: LeadStatus }> = [
  { label: 'New', value: 'NEW' },
  { label: 'To Follow', value: 'TO_FOLLOW' },
  { label: 'Following', value: 'FOLLOWING' },
  { label: 'Negotiating', value: 'NEGOTIATING' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Lost', value: 'LOST' },
  { label: 'Signed', value: 'SIGNED' },
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
