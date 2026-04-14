export type RoleCode = 'super_admin' | 'bd_user' | 'project_manager'
export type LocaleCode = 'en' | 'zh-CN' | 'zh-HK' | 'id-ID'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  locale: LocaleCode
  timezone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: number
  code: RoleCode
  name: string
  description: string | null
}

export interface Permission {
  id: number
  code: string
  module: string
  action: string
}

export interface UserRoleRelation {
  id: string
  user_id: string
  role_id: number
  assigned_by: string | null
  assigned_at: string
  role?: Role
}

export interface UploadFileRecord {
  id: string
  owner_id: string
  bucket_id: string
  object_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface OperationLogRecord {
  id: string
  actor_id: string | null
  module: string
  entity_type: string
  entity_id: string | null
  action: string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  meta: Record<string, unknown> | null
  created_at: string
}
