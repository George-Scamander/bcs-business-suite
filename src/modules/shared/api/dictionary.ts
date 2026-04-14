import { supabase } from '../../../lib/supabase/client'

export interface DictionaryItem {
  id: number
  dictionary_type: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function listDictionaryItems(dictionaryType?: string): Promise<DictionaryItem[]> {
  let query = supabase.from('dictionary_items').select('*').order('dictionary_type', { ascending: true }).order('sort_order', { ascending: true })

  if (dictionaryType && dictionaryType.trim().length > 0) {
    query = query.eq('dictionary_type', dictionaryType)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as DictionaryItem[]
}

export async function updateDictionaryItem(itemId: number, payload: Partial<DictionaryItem>): Promise<void> {
  const result = await supabase.from('dictionary_items').update(payload).eq('id', itemId)

  if (result.error) {
    throw result.error
  }
}

export async function createDictionaryItem(payload: {
  dictionary_type: string
  code: string
  label: string
  sort_order?: number
  is_active?: boolean
}): Promise<void> {
  const result = await supabase.from('dictionary_items').insert({
    dictionary_type: payload.dictionary_type,
    code: payload.code,
    label: payload.label,
    sort_order: payload.sort_order ?? 0,
    is_active: payload.is_active ?? true,
  })

  if (result.error) {
    throw result.error
  }
}
