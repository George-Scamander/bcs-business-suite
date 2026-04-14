import { supabase } from './client'

type LoginResult = 'success' | 'failed'

interface RecordOperationLogInput {
  module: string
  entityType: string
  entityId?: string
  action: string
  beforeData?: unknown
  afterData?: unknown
  meta?: unknown
}

export async function recordLogin(result: LoginResult, email?: string): Promise<void> {
  await supabase.rpc('record_login', {
    p_result: result,
    p_email: email ?? null,
    p_user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
  })
}

export async function recordOperationLog(input: RecordOperationLogInput): Promise<void> {
  await supabase.rpc('record_operation_log', {
    p_module: input.module,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_action: input.action,
    p_before_data: input.beforeData ?? null,
    p_after_data: input.afterData ?? null,
    p_meta: input.meta ?? null,
  })
}
