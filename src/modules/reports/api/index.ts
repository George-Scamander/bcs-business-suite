import { supabase } from '../../../lib/supabase/client'
import type { ReportExport } from '../../../types/business'

export async function listReportExports(): Promise<ReportExport[]> {
  const result = await supabase.from('report_exports').select('*').order('requested_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []) as ReportExport[]
}

export async function requestReportExport(moduleName: string, filters?: Record<string, unknown>): Promise<ReportExport> {
  const result = await supabase
    .from('report_exports')
    .insert({
      module: moduleName,
      filters: filters ?? null,
      status: 'PENDING',
    })
    .select('*')
    .single<ReportExport>()

  if (result.error) {
    throw result.error
  }

  return result.data
}

export function exportRowsToCsv<T extends Record<string, unknown>>(fileName: string, rows: T[]): void {
  if (rows.length === 0) {
    return
  }

  const keys = Object.keys(rows[0])
  const lines = [keys.join(',')]

  for (const row of rows) {
    const values = keys.map((key) => {
      const raw = row[key]
      const value = raw === null || raw === undefined ? '' : String(raw)
      const escaped = value.replaceAll('"', '""')
      return `"${escaped}"`
    })

    lines.push(values.join(','))
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.setAttribute('download', fileName)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
