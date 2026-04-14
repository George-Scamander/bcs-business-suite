import { supabase } from '../../../lib/supabase/client'

export interface UserOption {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
}

export async function listActiveUsers(): Promise<UserOption[]> {
  const result = await supabase
    .from('profiles')
    .select('id, email, full_name, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as UserOption[]
}
