export type LeadStatus = 'NEW' | 'TO_FOLLOW' | 'FOLLOWING' | 'NEGOTIATING' | 'ON_HOLD' | 'LOST' | 'SIGNED'

export type OnboardingStatus =
  | 'NOT_STARTED'
  | 'INFO_PENDING'
  | 'DOCUMENT_PENDING'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUIRED'
  | 'CONTRACT_CONFIRMED'
  | 'SERVICE_ACTIVATING'
  | 'COMPLETED'
  | 'REJECTED'

export type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'DELAYED' | 'COMPLETED' | 'CLOSED'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Lead {
  id: string
  lead_code: string
  company_name: string
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  industry: string | null
  region: string | null
  city: string | null
  address: string | null
  source: string | null
  intent_level: number | null
  estimated_value: number | null
  status: LeadStatus
  lost_reason_code: string | null
  lost_reason_note: string | null
  status_reason: string | null
  assigned_bd_id: string | null
  next_followup_at: string | null
  last_followup_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface LeadFollowup {
  id: string
  lead_id: string
  followup_type: string
  summary: string
  followup_at: string
  next_followup_at: string | null
  status_snapshot: LeadStatus | null
  created_by: string | null
  created_at: string
}

export interface LeadStatusLog {
  id: string
  lead_id: string
  from_status: LeadStatus | null
  to_status: LeadStatus
  reason: string | null
  lost_reason_code: string | null
  changed_by: string | null
  changed_at: string
}

export interface SignedRecord {
  id: string
  lead_id: string
  contract_no: string
  contract_date: string | null
  contract_value: number | null
  contract_currency: string
  contract_file_id: string | null
  signed_by: string | null
  signed_at: string
  created_at: string
  updated_at: string
}

export interface OnboardingCase {
  id: string
  case_no: string
  signed_record_id: string
  status: OnboardingStatus
  owner_user_id: string | null
  reviewer_user_id: string | null
  sla_due_at: string | null
  started_at: string
  completed_at: string | null
  rejected_at: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface OnboardingStep {
  id: string
  onboarding_case_id: string
  step_code: string
  step_name: string
  step_order: number
  status: string
  assignee_id: string | null
  due_at: string | null
  completed_at: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface OnboardingDocument {
  id: string
  onboarding_case_id: string
  doc_type: string
  file_record_id: string | null
  file_name: string | null
  object_path: string | null
  version_no: number
  is_latest: boolean
  submitted_by: string | null
  submitted_at: string
  review_status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_comment: string | null
}

export interface OnboardingReview {
  id: string
  onboarding_case_id: string
  document_id: string | null
  decision: string
  comment: string | null
  reviewer_id: string | null
  reviewed_at: string
  created_at: string
}

export interface OnboardingStatusLog {
  id: string
  onboarding_case_id: string
  from_status: OnboardingStatus | null
  to_status: OnboardingStatus
  reason: string | null
  changed_by: string | null
  changed_at: string
}

export interface Project {
  id: string
  project_code: string
  onboarding_case_id: string
  signed_record_id: string | null
  lead_id: string | null
  name: string
  description: string | null
  status: ProjectStatus
  pm_owner_id: string | null
  bd_owner_id: string | null
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  completion_rate: number
  is_delayed: boolean
  delay_reason: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role_in_project: string
  is_active: boolean
  joined_at: string
  left_at: string | null
}

export interface ProjectMilestone {
  id: string
  project_id: string
  title: string
  description: string | null
  planned_date: string | null
  actual_date: string | null
  owner_id: string | null
  status: TaskStatus
  progress: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProjectTask {
  id: string
  project_id: string
  milestone_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  progress: number
  created_at: string
  updated_at: string
}

export interface ProjectStatusLog {
  id: string
  project_id: string
  from_status: ProjectStatus | null
  to_status: ProjectStatus
  reason: string | null
  changed_by: string | null
  changed_at: string
}

export interface ProjectUpdate {
  id: string
  project_id: string
  summary: string
  detail: Record<string, unknown> | null
  shared_with_bd: boolean
  created_by: string | null
  created_at: string
}

export interface ReportExport {
  id: string
  module: string
  filters: Record<string, unknown> | null
  status: string
  requested_by: string | null
  file_record_id: string | null
  requested_at: string
  completed_at: string | null
}

export interface DashboardMetric {
  label: string
  value: number
  unit?: string
}
