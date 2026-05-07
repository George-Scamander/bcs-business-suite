import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Select, Space, Table, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { supabase } from '../../../lib/supabase/client'
import { createLead, updateLead } from '../api'
import { useAuth } from '../../auth/auth-context'
import { listDictionaryItems, type DictionaryItem } from '../../shared/api/dictionary'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import { buildLeadSourceOptions, buildRegionOptions, findCitiesByRegion, type RegionOption } from '../lead-options'

interface ImportLeadRow {
  rowKey: string
  company_name: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  industry?: string
  region?: string
  city?: string
  address?: string
  source?: string
  intent_level?: number
  estimated_value?: number
  submitted_at?: string
  assigned_bd_hint?: string
  assigned_bd_id?: string
}

type ImportFieldKey =
  | 'company_name'
  | 'contact_person'
  | 'contact_phone'
  | 'contact_email'
  | 'industry'
  | 'region'
  | 'city'
  | 'address'
  | 'source'
  | 'intent_level'
  | 'estimated_value'
  | 'submitted_at'
  | 'assigned_bd_hint'

type DuplicateStrategy = 'merge' | 'separate'

interface DuplicateGroup {
  companyKey: string
  displayName: string
  rows: ImportLeadRow[]
  sources: string[]
  suggestedStrategy: DuplicateStrategy
}

interface RoleMappingRow {
  user_id: string
  role: { code: string } | Array<{ code: string }> | null
}

const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  company_name: ['company_name', 'company name', 'workshop name', 'nama perusahaan', 'nama bengkel', 'client name'],
  contact_person: ['contact_person', 'contact person', 'pic', 'owner', 'nama pic', 'pic name'],
  contact_phone: [
    'contact_phone',
    'contact phone',
    'phone',
    'contact number',
    'nomor kontak',
    'no hp',
    'pic contact (whatsapp)',
    'pic contact whatsapp',
  ],
  contact_email: ['contact_email', 'contact email', 'email'],
  industry: ['industry', 'bcs type', 'business type', 'tipe bcs', 'jenis usaha', 'workshop type'],
  region: ['region', 'provinsi', 'province', 'wilayah', 'area', 'city/region'],
  city: ['city', 'kota', 'kabupaten', 'city/region'],
  address: ['address', 'alamat', 'location', 'lokasi'],
  source: ['source', 'lead source', 'sumber lead', 'source channel', 'channel', 'visiting type', 'visit type', 'visiting type2'],
  intent_level: ['intent_level', 'intent level', 'minat', 'level minat'],
  estimated_value: ['estimated_value', 'estimated value', 'nilai estimasi', 'contract value'],
  submitted_at: [
    'submitted_at',
    'submission_date',
    'submitted date',
    'submitted at',
    'created_at',
    'created date',
    'date',
    'visit date',
    'visiting date',
    'tanggal',
    'tanggal kunjungan',
    'waktu',
    'time',
  ],
  assigned_bd_hint: [
    'assigned bd',
    'assigned_bd',
    'bd',
    'bd owner',
    'bd_owner',
    'followup bd',
    'sales team',
    'sales',
    'pic bd',
    'bd pic',
    'bd name',
    'nama bd',
    'nama sales',
  ],
}

const CITY_SYNONYMS: Record<string, string[]> = {
  bekasi: ['bks', 'kota bks', 'kota bekasi'],
  'north jakarta': ['jakarta utara', 'jkt utara'],
  'south jakarta': ['jakarta selatan', 'jkt selatan', 'jaksel'],
  'west jakarta': ['jakarta barat', 'jkt barat', 'jakbar'],
  'east jakarta': ['jakarta timur', 'jkt timur', 'jaktim'],
  'central jakarta': ['jakarta pusat', 'jkt pusat'],
}

function normalizeLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\uFEFF]/g, '')
    .replace(/[_-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  const text = value.trim()
  return text.length > 0 ? text : undefined
}

function normalizeCompanyKey(value?: string): string {
  return normalizeLookup(value ?? '')
}

function sanitizeIntentLevel(value?: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }

  if (value < 0 || value > 5) {
    return undefined
  }

  return Math.round(value)
}

function parseTemplateDate(value?: string): string | undefined {
  const raw = normalizeText(value)
  if (!raw) {
    return undefined
  }

  const nativeParsed = new Date(raw)
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed.toISOString()
  }

  const compact = raw.replace(/\./g, '/').replace(/-/g, '/')
  const match = compact.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (!match) {
    return undefined
  }

  let year = Number(match[1])
  let month = Number(match[2])
  let day = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)

  if (year < 1000) {
    year = Number(match[3])
    month = Number(match[2])
    day = Number(match[1])
  }

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined
  }

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.toISOString()
}

function parseIntentLevelValue(value?: string): number | undefined {
  const normalized = normalizeText(value)
  if (!normalized) {
    return undefined
  }

  const hMatch = normalized.match(/^h\s*([0-5])$/i)
  if (hMatch) {
    return Number(hMatch[1])
  }

  const numeric = parseNumber(normalized)
  return sanitizeIntentLevel(numeric)
}

function parseDelimitedContent(content: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }

    if (char === '\n' && !inQuotes) {
      row.push(current.trim())
      rows.push(row)
      row = []
      current = ''
      continue
    }

    current += char
  }

  row.push(current.trim())
  rows.push(row)

  return rows.filter((item) => item.some((cell) => cell.trim().length > 0))
}

function detectDelimiter(content: string): string {
  const sample = content
    .split(/\r?\n/)
    .slice(0, 8)
    .join('\n')

  const semicolons = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  const tabs = (sample.match(/\t/g) ?? []).length

  if (semicolons >= commas && semicolons >= tabs) {
    return ';'
  }

  if (tabs >= commas) {
    return '\t'
  }

  return ','
}

function resolveHeaderField(rawHeader: string): ImportFieldKey | null {
  const normalized = normalizeLookup(rawHeader)
  if (!normalized) {
    return null
  }

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[ImportFieldKey, string[]]>) {
    if (aliases.some((alias) => normalizeLookup(alias) === normalized)) {
      return field
    }
  }

  return null
}

function buildHeaderMapping(rows: string[][]): { headerRowIndex: number; columnToField: Map<number, ImportFieldKey> } | null {
  let bestIndex = -1
  let bestScore = 0
  let bestMapping: Map<number, ImportFieldKey> | null = null

  rows.forEach((row, rowIndex) => {
    const map = new Map<number, ImportFieldKey>()
    const usedFields = new Set<ImportFieldKey>()

    row.forEach((cell, cellIndex) => {
      const field = resolveHeaderField(cell)
      if (!field || usedFields.has(field)) {
        return
      }
      map.set(cellIndex, field)
      usedFields.add(field)
    })

    const score = map.size
    if (score > bestScore) {
      bestScore = score
      bestIndex = rowIndex
      bestMapping = map
    }
  })

  if (!bestMapping || bestScore === 0) {
    return null
  }

  return { headerRowIndex: bestIndex, columnToField: bestMapping }
}

function inferRegionCityFromAddress(
  address: string | undefined,
  regionOptions: RegionOption[],
): { region?: string; city?: string } {
  const text = normalizeLookup(address ?? '')
  if (!text) {
    return {}
  }

  let bestMatch: { region: string; city: string; score: number } | null = null

  for (const region of regionOptions) {
    for (const city of region.cities) {
      const variants = [city, ...(CITY_SYNONYMS[normalizeLookup(city)] ?? [])]

      for (const variant of variants) {
        const candidate = normalizeLookup(variant)
        if (!candidate || !text.includes(candidate)) {
          continue
        }

        const score = candidate.length
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { region: region.value, city, score }
        }
      }
    }
  }

  if (bestMatch) {
    return { region: bestMatch.region, city: bestMatch.city }
  }

  return {}
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) {
    return undefined
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : undefined
}

function resolveSourceValue(
  sourceRaw: string | undefined,
  sourceOptions: Array<{ label: string; value: string }>,
  defaultSource?: string,
): string | undefined {
  const sourceText = normalizeText(sourceRaw)
  if (!sourceText) {
    return defaultSource
  }

  const normalizedSource = normalizeLookup(sourceText)
  const matched = sourceOptions.find(
    (option) =>
      normalizeLookup(option.value) === normalizedSource ||
      normalizeLookup(option.label) === normalizedSource ||
      normalizedSource.includes(normalizeLookup(option.label)),
  )

  return matched?.value ?? sourceText
}

function parseCsvTemplate(
  content: string,
  regionOptions: RegionOption[],
  sourceOptions: Array<{ label: string; value: string }>,
): ImportLeadRow[] {
  const delimiter = detectDelimiter(content)
  const rows = parseDelimitedContent(content, delimiter)

  if (rows.length <= 1) {
    return []
  }

  const header = buildHeaderMapping(rows)
  if (!header) {
    return []
  }

  const defaultSource =
    sourceOptions.find((option) => normalizeLookup(option.value) === 'cold visit' || normalizeLookup(option.label) === 'cold visit')
      ?.value ?? sourceOptions[0]?.value

  const parsedRows: ImportLeadRow[] = []

  rows.slice(header.headerRowIndex + 1).forEach((cells, index) => {
    const rowByField: Partial<Record<ImportFieldKey, string>> = {}

    header.columnToField.forEach((field, columnIndex) => {
      rowByField[field] = cells[columnIndex]?.trim() ?? ''
    })

    const companyName = normalizeText(rowByField.company_name)
    const address = normalizeText(rowByField.address)
    const regionText = normalizeText(rowByField.region)
    const cityText = normalizeText(rowByField.city)
    const locationHint = normalizeText([cityText, regionText, address].filter(Boolean).join(' '))
    const inferred = inferRegionCityFromAddress(locationHint, regionOptions)

    const regionValue = regionText ?? inferred.region
    const cityValue = cityText ?? inferred.city

    if (!companyName && !regionValue && !cityValue && !normalizeText(rowByField.contact_phone)) {
      return
    }

    parsedRows.push({
      rowKey: `${index + 1}`,
      company_name: companyName ?? '',
      contact_person: normalizeText(rowByField.contact_person),
      contact_phone: normalizeText(rowByField.contact_phone),
      contact_email: normalizeText(rowByField.contact_email),
      industry: normalizeText(rowByField.industry),
      region: regionValue,
      city: cityValue,
      address,
      source: resolveSourceValue(rowByField.source, sourceOptions, defaultSource),
      intent_level: parseIntentLevelValue(rowByField.intent_level),
      estimated_value: parseNumber(rowByField.estimated_value),
      submitted_at: parseTemplateDate(rowByField.submitted_at),
      assigned_bd_hint: normalizeText(rowByField.assigned_bd_hint),
    })
  })

  return parsedRows
}

function detectSourceKind(source?: string): 'cold_visit' | 'follow_up' | 'other' | 'empty' {
  const normalized = normalizeLookup(source ?? '')
  if (!normalized) {
    return 'empty'
  }

  if (normalized.includes('cold visit')) {
    return 'cold_visit'
  }

  if (
    normalized.includes('follow up') ||
    normalized.includes('followup') ||
    normalized.includes('floow up') ||
    normalized.includes('floowup')
  ) {
    return 'follow_up'
  }

  return 'other'
}

function followupTypeFromSource(source?: string): string {
  const kind = detectSourceKind(source)
  if (kind === 'cold_visit') {
    return 'VISIT'
  }
  if (kind === 'follow_up') {
    return 'CALL'
  }
  return 'CHAT'
}

function hasFollowupContent(row: ImportLeadRow): boolean {
  return Boolean(
    normalizeText(row.source) ||
      normalizeText(row.contact_person) ||
      normalizeText(row.contact_phone) ||
      normalizeText(row.contact_email) ||
      normalizeText(row.address),
  )
}

function buildFollowupSummary(row: ImportLeadRow): string {
  const fragments = [
    normalizeText(row.source) ? `Source: ${normalizeText(row.source)}` : null,
    normalizeText(row.contact_person) ? `Contact: ${normalizeText(row.contact_person)}` : null,
    normalizeText(row.contact_phone) ? `Phone: ${normalizeText(row.contact_phone)}` : null,
    normalizeText(row.contact_email) ? `Email: ${normalizeText(row.contact_email)}` : null,
    normalizeText(row.address) ? `Address: ${normalizeText(row.address)}` : null,
  ].filter(Boolean)

  if (fragments.length === 0) {
    return `Imported follow-up from template row ${row.rowKey}`
  }

  return `Imported follow-up from template row ${row.rowKey}. ${fragments.join(' | ')}`
}

function groupRowsByCompany(rows: ImportLeadRow[]): Map<string, ImportLeadRow[]> {
  const grouped = new Map<string, ImportLeadRow[]>()

  for (const row of rows) {
    const key = normalizeCompanyKey(row.company_name)
    if (!key) {
      continue
    }

    const bucket = grouped.get(key) ?? []
    bucket.push(row)
    grouped.set(key, bucket)
  }

  return grouped
}

function pickPreferredBaseRow(rows: ImportLeadRow[]): ImportLeadRow {
  const coldVisitRow = rows.find((row) => detectSourceKind(row.source) === 'cold_visit')
  return coldVisitRow ?? rows[0]
}

function coalesceText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = normalizeText(value)
    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function coalesceBdOwnerId(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value) {
      return value
    }
  }

  return undefined
}

function buildMergedLeadRow(rows: ImportLeadRow[]): { baseRow: ImportLeadRow; merged: ImportLeadRow } {
  const baseRow = pickPreferredBaseRow(rows)

  let intentLevel = sanitizeIntentLevel(baseRow.intent_level)
  let estimatedValue = baseRow.estimated_value
  let preferredSource = normalizeText(baseRow.source)

  for (const row of rows) {
    if (typeof row.intent_level === 'number' && row.intent_level >= 0 && row.intent_level <= 5) {
      intentLevel = Math.max(intentLevel ?? row.intent_level, row.intent_level)
    }
    if (typeof row.estimated_value === 'number') {
      estimatedValue = Math.max(estimatedValue ?? row.estimated_value, row.estimated_value)
    }
    if (detectSourceKind(preferredSource) !== 'cold_visit' && detectSourceKind(row.source) === 'cold_visit') {
      preferredSource = normalizeText(row.source)
    }
  }

  return {
    baseRow,
    merged: {
      rowKey: baseRow.rowKey,
      company_name: baseRow.company_name,
      contact_person: coalesceText(...rows.map((row) => row.contact_person)),
      contact_phone: coalesceText(...rows.map((row) => row.contact_phone)),
      contact_email: coalesceText(...rows.map((row) => row.contact_email)),
      industry: coalesceText(...rows.map((row) => row.industry)),
      region: coalesceText(...rows.map((row) => row.region)),
      city: coalesceText(...rows.map((row) => row.city)),
      address: coalesceText(...rows.map((row) => row.address)),
      source: preferredSource,
      intent_level: intentLevel,
      estimated_value: estimatedValue,
      submitted_at: coalesceText(...rows.map((row) => row.submitted_at)),
      assigned_bd_id: coalesceBdOwnerId(...rows.map((row) => row.assigned_bd_id)),
    },
  }
}

function buildDuplicateGroups(rows: ImportLeadRow[]): DuplicateGroup[] {
  const grouped = groupRowsByCompany(rows)
  const groups: DuplicateGroup[] = []

  grouped.forEach((bucket, companyKey) => {
    if (bucket.length <= 1) {
      return
    }

    const sources = Array.from(new Set(bucket.map((row) => normalizeText(row.source)).filter(Boolean) as string[]))
    const hasColdVisit = bucket.some((row) => detectSourceKind(row.source) === 'cold_visit')
    const hasFollowup = bucket.some((row) => detectSourceKind(row.source) === 'follow_up')

    groups.push({
      companyKey,
      displayName: normalizeText(bucket[0]?.company_name) ?? '(Unnamed)',
      rows: bucket,
      sources,
      suggestedStrategy: hasColdVisit && hasFollowup ? 'merge' : 'separate',
    })
  })

  return groups
}

function ensureCurrentOption(
  options: Array<{ label: string; value: string }>,
  value?: string,
): Array<{ label: string; value: string }> {
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) {
    return options
  }

  const exists = options.some((option) => option.value === normalizedValue)
  if (exists) {
    return options
  }

  return [{ label: normalizedValue, value: normalizedValue }, ...options]
}

function matchBdUserId(hint: string | undefined, users: UserOption[]): string | undefined {
  const normalizedHint = normalizeLookup(hint ?? '')
  if (!normalizedHint) {
    return undefined
  }

  const exact = users.find((user) => {
    const email = normalizeLookup(user.email)
    const fullName = normalizeLookup(user.full_name ?? '')
    return email === normalizedHint || fullName === normalizedHint
  })
  if (exact) {
    return exact.id
  }

  const partial = users.find((user) => {
    const email = normalizeLookup(user.email)
    const fullName = normalizeLookup(user.full_name ?? '')
    return email.includes(normalizedHint) || fullName.includes(normalizedHint) || normalizedHint.includes(fullName)
  })

  return partial?.id
}

function hydrateBdAssignments(rows: ImportLeadRow[], users: UserOption[]): ImportLeadRow[] {
  if (rows.length === 0 || users.length === 0) {
    return rows
  }

  return rows.map((row) => {
    if (row.assigned_bd_id) {
      return row
    }

    const matchedBdId = matchBdUserId(row.assigned_bd_hint, users)
    if (!matchedBdId) {
      return row
    }

    return {
      ...row,
      assigned_bd_id: matchedBdId,
    }
  })
}

function extractRoleCode(role: RoleMappingRow['role']): string | null {
  if (!role) {
    return null
  }

  if (Array.isArray(role)) {
    return role[0]?.code ?? null
  }

  return role.code
}

export function PmLeadImportPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()

  const [importing, setImporting] = useState(false)
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])
  const [rows, setRows] = useState<ImportLeadRow[]>([])
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])
  const [bdUserOptions, setBdUserOptions] = useState<UserOption[]>([])
  const [assignBdId, setAssignBdId] = useState<string>()
  const [duplicateStrategyByCompany, setDuplicateStrategyByCompany] = useState<Record<string, DuplicateStrategy>>({})

  const regionOptions = useMemo(() => buildRegionOptions(dictionaryItems), [dictionaryItems])
  const sourceOptions = useMemo(() => buildLeadSourceOptions(dictionaryItems), [dictionaryItems])

  const regionSelectOptions = useMemo(
    () =>
      regionOptions.map((item) => ({
        value: item.value,
        label: item.label,
      })),
    [regionOptions],
  )

  const allCityOptions = useMemo(() => {
    const citySet = new Set<string>()
    for (const region of regionOptions) {
      for (const city of region.cities) {
        const normalized = normalizeText(city)
        if (normalized) {
          citySet.add(normalized)
        }
      }
    }

    return Array.from(citySet).map((city) => ({ label: city, value: city }))
  }, [regionOptions])

  const duplicateGroups = useMemo(() => buildDuplicateGroups(rows), [rows])

  useEffect(() => {
    if (duplicateGroups.length === 0) {
      setDuplicateStrategyByCompany({})
      return
    }

    setDuplicateStrategyByCompany((current) => {
      const next: Record<string, DuplicateStrategy> = {}
      for (const group of duplicateGroups) {
        next[group.companyKey] = current[group.companyKey] ?? group.suggestedStrategy
      }
      return next
    })
  }, [duplicateGroups])

  const loadReferenceData = useCallback(async () => {
    try {
      const [dictionaryRows, users, roleMappingsResult] = await Promise.all([
        listDictionaryItems(),
        listActiveUsers(),
        supabase
          .from('user_role_relations')
          .select('user_id, role:roles(code)')
          .returns<RoleMappingRow[]>(),
      ])

      setDictionaryItems(dictionaryRows)

      if (roleMappingsResult.error) {
        setBdUserOptions(users)
      } else {
        const bdIdSet = new Set(
          (roleMappingsResult.data ?? [])
            .filter((row) => extractRoleCode(row.role) === 'bd_user')
            .map((row) => row.user_id),
        )

        const bdUsers = users.filter((item) => bdIdSet.has(item.id))
        setBdUserOptions(bdUsers.length > 0 ? bdUsers : users)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmLeadImport.loadReferencesFail', { defaultValue: 'Failed to load import references' })
      message.error(text)
    }
  }, [t])

  useEffect(() => {
    void loadReferenceData()
  }, [loadReferenceData])

  const getPopupContainer = useCallback((trigger: HTMLElement) => trigger.parentElement ?? trigger, [])

  function updateRow(rowKey: string, patch: Partial<ImportLeadRow>) {
    setRows((current) =>
      current.map((item) => {
        if (item.rowKey !== rowKey) {
          return item
        }

        const next = { ...item, ...patch }
        if (patch.region && patch.region !== item.region) {
          next.city = undefined
        }

        return next
      }),
    )
  }

  async function handleParseTemplate() {
    const file = uploadFileList[0]?.originFileObj

    if (!file) {
      message.warning(t('pages.pmLeadImport.selectTemplateFirst', { defaultValue: 'Please select a template CSV file first' }))
      return
    }

    try {
      const content = await file.text()
      const parsedRows = parseCsvTemplate(content, regionOptions, sourceOptions)
      const hydratedRows = hydrateBdAssignments(parsedRows, bdUserOptions)

      if (hydratedRows.length === 0) {
        message.warning(t('pages.pmLeadImport.noRowsInTemplate', { defaultValue: 'No data rows found in template' }))
        return
      }

      setRows(hydratedRows)
      setDuplicateStrategyByCompany(
        buildDuplicateGroups(hydratedRows).reduce<Record<string, DuplicateStrategy>>((acc, group) => {
          acc[group.companyKey] = group.suggestedStrategy
          return acc
        }, {}),
      )

      const hintedCount = hydratedRows.filter((row) => Boolean(normalizeText(row.assigned_bd_hint))).length
      const matchedCount = hydratedRows.filter((row) => Boolean(row.assigned_bd_id)).length

      message.success(
        t('pages.pmLeadImport.loadRowsSuccess', {
          defaultValue: 'Loaded {{count}} row(s) from template',
          count: hydratedRows.length,
        }),
      )

      if (hintedCount > 0) {
        message.info(
          t('pages.pmLeadImport.bdOwnerMappingDetected', {
            defaultValue:
              'Detected BD owner mapping: {{matched}}/{{hinted}} row(s) matched. You can manually adjust unmatched rows in the BD Owner column.',
            matched: matchedCount,
            hinted: hintedCount,
          }),
        )
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmLeadImport.parseTemplateFail', { defaultValue: 'Failed to parse template' })
      message.error(text)
    }
  }

  async function createLeadFromRow(row: ImportLeadRow): Promise<string> {
    if (!user) {
      throw new Error('Unauthorized')
    }

    const targetBdId = row.assigned_bd_id ?? assignBdId

    const createResult = await createLead({
      company_name: normalizeText(row.company_name) ?? '',
      contact_person: normalizeText(row.contact_person),
      contact_phone: normalizeText(row.contact_phone),
      contact_email: normalizeText(row.contact_email),
      industry: normalizeText(row.industry),
      region: normalizeText(row.region),
      city: normalizeText(row.city),
      address: normalizeText(row.address),
      source: normalizeText(row.source),
      intent_level: sanitizeIntentLevel(row.intent_level),
      estimated_value: row.estimated_value,
      created_at: row.submitted_at,
      assigned_bd_id: targetBdId === user.id ? targetBdId : undefined,
    })

    const leadId = createResult.id
    if (!leadId) {
      throw new Error('Lead ID missing after create')
    }

    if (targetBdId && targetBdId !== user.id) {
      await updateLead({
        id: leadId,
        assigned_bd_id: targetBdId,
      })
    }

    return leadId
  }

  async function appendFollowupFromRow(leadId: string, row: ImportLeadRow): Promise<void> {
    const followupAt = new Date().toISOString()
    const summary = buildFollowupSummary(row)
    const followupType = followupTypeFromSource(row.source)

    const insertResult = await supabase.from('lead_followups').insert({
      lead_id: leadId,
      followup_type: followupType,
      summary,
      followup_at: followupAt,
      next_followup_at: null,
      status_snapshot: 'NEW',
    })

    if (insertResult.error) {
      throw insertResult.error
    }
  }

  async function handleImport() {
    if (!user) {
      return
    }

    if (rows.length === 0) {
      message.warning(t('pages.pmLeadImport.parseTemplateFirst', { defaultValue: 'Please upload and parse a template first' }))
      return
    }

    const rowsWithCompany = rows.filter((row) => Boolean(normalizeText(row.company_name)))
    if (rowsWithCompany.length === 0) {
      message.error(t('pages.pmLeadImport.validateCompanyRequired', { defaultValue: 'company_name is required' }))
      return
    }

    const skippedRows = rows.length - rowsWithCompany.length
    setImporting(true)

    try {
      const grouped = groupRowsByCompany(rowsWithCompany)
      let leadCount = 0
      let followupCount = 0
      let mergedGroupCount = 0

      for (const [companyKey, companyRows] of grouped.entries()) {
        const strategy = duplicateStrategyByCompany[companyKey] ?? 'separate'

        if (companyRows.length > 1 && strategy === 'merge') {
          mergedGroupCount += 1

          const { baseRow, merged } = buildMergedLeadRow(companyRows)
          const leadId = await createLeadFromRow(merged)
          leadCount += 1

          for (const row of companyRows) {
            if (row.rowKey === baseRow.rowKey) {
              continue
            }
            if (!hasFollowupContent(row)) {
              continue
            }
            await appendFollowupFromRow(leadId, row)
            followupCount += 1
          }

          continue
        }

        for (const row of companyRows) {
          await createLeadFromRow(row)
          leadCount += 1
        }
      }

      const summaryParts = [
        t('pages.pmLeadImport.importSummaryLeads', { defaultValue: 'Imported {{count}} lead(s)', count: leadCount }),
        mergedGroupCount > 0
          ? t('pages.pmLeadImport.importSummaryMergedGroups', {
              defaultValue: '{{count}} duplicate group(s) merged',
              count: mergedGroupCount,
            })
          : null,
        followupCount > 0
          ? t('pages.pmLeadImport.importSummaryFollowups', {
              defaultValue: '{{count}} follow-up record(s) appended',
              count: followupCount,
            })
          : null,
        skippedRows > 0
          ? t('pages.pmLeadImport.importSummarySkippedRows', {
              defaultValue: '{{count}} row(s) skipped due to empty company name',
              count: skippedRows,
            })
          : null,
      ].filter(Boolean)

      message.success(summaryParts.join(' · '))
      setRows([])
      setUploadFileList([])
      setDuplicateStrategyByCompany({})
      navigate('/app/pm/dashboard')
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmLeadImport.importFail', { defaultValue: 'Failed to import template rows' })
      message.error(text)
    } finally {
      setImporting(false)
    }
  }

  const assignBdOptions = useMemo(() => {
    return bdUserOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [bdUserOptions])

  return (
    <>
      <PageTitleBar
        title={t('pages.pmLeadImport.title', { defaultValue: 'Template Lead Import' })}
        description={t('pages.pmLeadImport.description', {
          defaultValue: 'Upload the lead template, auto-parse rows, and manually complete missing fields before bulk creation.',
        })}
        extra={<Button onClick={() => navigate('/app/pm/dashboard')}>{t('pages.pmLeadImport.back', { defaultValue: 'Back' })}</Button>}
      />

      <Card className="mb-5">
        <Space wrap>
          <Upload
            maxCount={1}
            accept=".csv"
            beforeUpload={() => false}
            fileList={uploadFileList}
            onChange={(info) => setUploadFileList(info.fileList)}
            onRemove={(file) => {
              setUploadFileList((current) => current.filter((item) => item.uid !== file.uid))
            }}
          >
            <Button icon={<UploadOutlined />}>{t('pages.pmLeadImport.selectTemplateCsv', { defaultValue: 'Select Template CSV' })}</Button>
          </Upload>

          <Button onClick={() => void handleParseTemplate()}>{t('pages.pmLeadImport.parseTemplate', { defaultValue: 'Parse Template' })}</Button>

          <Select
            allowClear
            showSearch
            placeholder={t('pages.pmLeadImport.assignImportedLeads', { defaultValue: 'Assign imported leads to BD' })}
            style={{ width: 320 }}
            value={assignBdId}
            options={assignBdOptions}
            onChange={(value) => setAssignBdId(value)}
            optionFilterProp="label"
            getPopupContainer={getPopupContainer}
          />

          <Button type="primary" loading={importing} onClick={() => void handleImport()}>
            {t('pages.pmLeadImport.importLeads', { defaultValue: 'Import Leads' })}
          </Button>
        </Space>

        <p className="mb-0 mt-3 text-xs text-slate-500">
          {t('pages.pmLeadImport.requiredHeaderHint', {
            defaultValue:
              'Template headers recommendation: company_name, region, city, source. For BD ownership analysis, provide assigned_bd / sales team columns. Other fields can be blank and still imported.',
          })}
        </p>
      </Card>

      {duplicateGroups.length > 0 ? (
        <Card className="mb-5">
          <Space direction="vertical" size={12} className="w-full">
            <Alert
              type="warning"
              showIcon
              message={t('pages.pmLeadImport.duplicateTitle', { defaultValue: 'Duplicate company names detected in template' })}
              description={t('pages.pmLeadImport.duplicateHint', {
                defaultValue:
                  'Please decide for each duplicate group: merge into one lead, or keep as separate leads. If cold visit and follow-up exist under the same company, merge is recommended.',
              })}
            />
            {duplicateGroups.map((group) => (
              <div key={group.companyKey} className="flex flex-wrap items-center gap-3 rounded border border-slate-200 p-3">
                <div className="min-w-[240px] font-medium">{group.displayName}</div>
                <div className="text-slate-500">
                  {t('pages.pmLeadImport.duplicateRowsCount', { defaultValue: '{{count}} row(s)', count: group.rows.length })}
                </div>
                <div className="text-slate-500">
                  {group.sources.length > 0 ? group.sources.join(', ') : t('pages.pmLeadImport.noSource', { defaultValue: 'No source' })}
                </div>
                <Select
                  style={{ width: 240 }}
                  value={duplicateStrategyByCompany[group.companyKey] ?? group.suggestedStrategy}
                  options={[
                    { label: t('pages.pmLeadImport.mergeIntoOne', { defaultValue: 'Merge into one lead' }), value: 'merge' },
                    { label: t('pages.pmLeadImport.createSeparately', { defaultValue: 'Create separately' }), value: 'separate' },
                  ]}
                  onChange={(nextValue: DuplicateStrategy) =>
                    setDuplicateStrategyByCompany((current) => ({
                      ...current,
                      [group.companyKey]: nextValue,
                    }))
                  }
                  getPopupContainer={getPopupContainer}
                />
              </div>
            ))}
          </Space>
        </Card>
      ) : null}

      <Table
        rowKey="rowKey"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1560 }}
        locale={{ emptyText: t('pages.pmLeadImport.emptyHint', { defaultValue: 'Upload and parse a template to preview rows' }) }}
        columns={[
          {
            title: t('pages.pmLeadImport.columns.row', { defaultValue: 'Row' }),
            dataIndex: 'rowKey',
            width: 70,
          },
          {
            title: t('pages.pmLeadImport.columns.companyName', { defaultValue: 'Company Name *' }),
            dataIndex: 'company_name',
            width: 220,
            render: (value: string, row: ImportLeadRow) => (
              <Input
                value={value}
                status={!normalizeText(value) ? 'error' : ''}
                onChange={(event) => updateRow(row.rowKey, { company_name: event.target.value })}
              />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.region', { defaultValue: 'Region' }),
            dataIndex: 'region',
            width: 200,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={value}
                options={ensureCurrentOption(regionSelectOptions, value)}
                onChange={(nextValue) => updateRow(row.rowKey, { region: nextValue, city: undefined })}
                optionFilterProp="label"
                getPopupContainer={getPopupContainer}
              />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.city', { defaultValue: 'City' }),
            dataIndex: 'city',
            width: 200,
            render: (value: string | undefined, row: ImportLeadRow) => {
              const scopedOptions = findCitiesByRegion(regionOptions, row.region).map((item) => ({ value: item, label: item }))
              const mergedCityOptions = ensureCurrentOption(scopedOptions.length > 0 ? scopedOptions : allCityOptions, value)

              return (
                <Select
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                  value={value}
                  options={mergedCityOptions}
                  onChange={(nextValue) => updateRow(row.rowKey, { city: nextValue })}
                  optionFilterProp="label"
                  getPopupContainer={getPopupContainer}
                />
              )
            },
          },
          {
            title: t('pages.pmLeadImport.columns.source', { defaultValue: 'Lead Source' }),
            dataIndex: 'source',
            width: 180,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={value}
                options={ensureCurrentOption(sourceOptions, value)}
                onChange={(nextValue) => updateRow(row.rowKey, { source: nextValue })}
                optionFilterProp="label"
                getPopupContainer={getPopupContainer}
              />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.bdOwner', { defaultValue: 'BD Owner' }),
            dataIndex: 'assigned_bd_id',
            width: 240,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={value}
                options={assignBdOptions}
                onChange={(nextValue) => updateRow(row.rowKey, { assigned_bd_id: nextValue })}
                optionFilterProp="label"
                placeholder={row.assigned_bd_hint || t('pages.pmLeadImport.columns.bdOwner', { defaultValue: 'BD Owner' })}
                getPopupContainer={getPopupContainer}
              />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.industry', { defaultValue: 'Industry' }),
            dataIndex: 'industry',
            width: 160,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Input value={value} onChange={(event) => updateRow(row.rowKey, { industry: event.target.value })} />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.contact', { defaultValue: 'Contact' }),
            dataIndex: 'contact_person',
            width: 160,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Input value={value} onChange={(event) => updateRow(row.rowKey, { contact_person: event.target.value })} />
            ),
          },
        ]}
      />
    </>
  )
}
