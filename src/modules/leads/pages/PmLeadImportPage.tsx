import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Upload,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import type {
  UploadFile,
} from 'antd'
import {
  UploadOutlined,
} from '@ant-design/icons'
import {
  useNavigate,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getIntentPackageOptions,
} from '../../../lib/business-constants'
import {
  formatUserOptionLabel,
} from '../../../lib/user-display'
import {
  supabase,
} from '../../../lib/supabase/client'
import {
  createLead,
  updateLead,
} from '../api'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  listDictionaryItems,
  type DictionaryItem,
} from '../../shared/api/dictionary'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import {
  buildLeadSourceOptions,
  buildRegionOptions,
  findCitiesByRegion,
  type RegionOption,
} from '../lead-options'
import type {
  IntentPackage,
} from '../../../types/business'

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
  intent_package?: IntentPackage
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
  | 'intent_package_hint'
  | 'submitted_at'
  | 'assigned_bd_hint'

type DuplicateHandlingMode = 'merge_with_followups' | 'keep_earliest'

interface DuplicateGroup {
  companyKey: string
  displayName: string
  rows: ImportLeadRow[]
  sources: string[]
  handlingMode: DuplicateHandlingMode
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
  intent_package_hint: ['expansion type', 'expansion_type', 'expansion'],
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
    'who you are',
    'who you are?',
    'who are you',
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

const BCS_EXPANSION_VALUES = new Set([
  'bcs joining',
  'bosch car service',
])

const PRODUCT_SALES_EXPANSION_VALUES = new Set([
  'x project',
  'product purchase',
])

const BOTH_EXPANSION_VALUES = new Set([
  'both',
  'bosch car service x project',
  'x project bosch car service',
])

const CITY_SYNONYMS: Record<string, string[]> = {
  bekasi: ['bks', 'kota bks', 'kota bekasi'],
  'north jakarta': ['jakarta utara', 'jkt utara'],
  'south jakarta': ['jakarta selatan', 'jkt selatan', 'jaksel'],
  'west jakarta': ['jakarta barat', 'jkt barat', 'jakbar'],
  'east jakarta': ['jakarta timur', 'jkt timur', 'jaktim'],
  'central jakarta': ['jakarta pusat', 'jkt pusat'],
}

const BD_HINT_LABEL_PREFIXES = [
  'who you are',
  'who you are?',
  'who are you',
  'bd owner',
  'assigned bd',
  'sales team',
  'sales',
  'nama bd',
  'nama sales',
  'pic bd',
  'bd pic',
]

const BD_HINT_STOP_WORDS = new Set([
  'who',
  'you',
  'are',
  'assigned',
  'bd',
  'owner',
  'sales',
  'team',
  'pic',
  'followup',
  'follow up',
  'user',
  'name',
  'nama',
])

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

function normalizeCompact(value: string): string {
  return normalizeLookup(value).replace(/\s+/g, '')
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

function resolveIntentPackageByExpansionType(expansionTypeRaw?: string): IntentPackage | undefined {
  const normalized = normalizeLookup(expansionTypeRaw ?? '')
  if (!normalized) {
    return undefined
  }

  if (BOTH_EXPANSION_VALUES.has(normalized)) {
    return 'BOTH'
  }

  if (BCS_EXPANSION_VALUES.has(normalized)) {
    return 'BCS'
  }

  if (PRODUCT_SALES_EXPANSION_VALUES.has(normalized)) {
    return 'PRODUCTS_SALES'
  }

  const tokens = normalized
    .split(/[;,/|&]+/g)
    .map((part) => normalizeLookup(part))
    .filter(Boolean)

  if (tokens.includes('both')) {
    return 'BOTH'
  }

  const hasBcs = tokens.some((token) => BCS_EXPANSION_VALUES.has(token))
  const hasProductSales = tokens.some((token) => PRODUCT_SALES_EXPANSION_VALUES.has(token))

  if (hasBcs && hasProductSales) {
    return 'BOTH'
  }
  if (hasBcs) {
    return 'BCS'
  }
  if (hasProductSales) {
    return 'PRODUCTS_SALES'
  }

  return undefined
}

function mergeIntentPackages(values: Array<IntentPackage | undefined>): IntentPackage | undefined {
  const normalized = values.filter(Boolean) as IntentPackage[]
  if (normalized.length === 0) {
    return undefined
  }

  if (normalized.includes('BOTH')) {
    return 'BOTH'
  }

  const hasBcs = normalized.includes('BCS')
  const hasProductSales = normalized.includes('PRODUCTS_SALES')
  if (hasBcs && hasProductSales) {
    return 'BOTH'
  }

  return normalized[0]
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
      intent_package: resolveIntentPackageByExpansionType(rowByField.intent_package_hint),
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

function shouldAppendAsFollowup(row: ImportLeadRow): boolean {
  const sourceKind = detectSourceKind(row.source)
  if (sourceKind !== 'cold_visit' && sourceKind !== 'follow_up') {
    return false
  }

  return hasFollowupContent(row)
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

function resolveEffectiveBdId(row: ImportLeadRow, defaultBdId?: string): string | undefined {
  return row.assigned_bd_id ?? defaultBdId
}

function parseRowSequence(row: ImportLeadRow): number {
  const parsed = Number.parseInt(row.rowKey, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  return Number.MAX_SAFE_INTEGER
}

function parseRowSubmittedAtMs(row: ImportLeadRow): number | undefined {
  const submitted = normalizeText(row.submitted_at)
  if (!submitted) {
    return undefined
  }

  const timestamp = Date.parse(submitted)
  return Number.isNaN(timestamp) ? undefined : timestamp
}

function compareRowsByEarliest(left: ImportLeadRow, right: ImportLeadRow): number {
  const leftSubmittedAtMs = parseRowSubmittedAtMs(left)
  const rightSubmittedAtMs = parseRowSubmittedAtMs(right)

  if (typeof leftSubmittedAtMs === 'number' && typeof rightSubmittedAtMs === 'number' && leftSubmittedAtMs !== rightSubmittedAtMs) {
    return leftSubmittedAtMs - rightSubmittedAtMs
  }

  if (typeof leftSubmittedAtMs === 'number' && typeof rightSubmittedAtMs !== 'number') {
    return -1
  }

  if (typeof leftSubmittedAtMs !== 'number' && typeof rightSubmittedAtMs === 'number') {
    return 1
  }

  return parseRowSequence(left) - parseRowSequence(right)
}

function sortRowsByEarliest(rows: ImportLeadRow[]): ImportLeadRow[] {
  return [...rows].sort(compareRowsByEarliest)
}

function hasMultipleBdOwners(rows: ImportLeadRow[], defaultBdId?: string): boolean {
  const bdOwnerSet = new Set(rows.map((row) => resolveEffectiveBdId(row, defaultBdId) ?? '__unassigned__'))
  return bdOwnerSet.size > 1
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
  const sortedRows = sortRowsByEarliest(rows)
  const baseRow = pickPreferredBaseRow(sortedRows)

  let intentLevel = sanitizeIntentLevel(baseRow.intent_level)
  let estimatedValue = baseRow.estimated_value
  let preferredSource = normalizeText(baseRow.source)

  for (const row of sortedRows) {
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
      contact_person: coalesceText(...sortedRows.map((row) => row.contact_person)),
      contact_phone: coalesceText(...sortedRows.map((row) => row.contact_phone)),
      contact_email: coalesceText(...sortedRows.map((row) => row.contact_email)),
      industry: coalesceText(...sortedRows.map((row) => row.industry)),
      region: coalesceText(...sortedRows.map((row) => row.region)),
      city: coalesceText(...sortedRows.map((row) => row.city)),
      address: coalesceText(...sortedRows.map((row) => row.address)),
      source: preferredSource,
      intent_level: intentLevel,
      estimated_value: estimatedValue,
      intent_package: mergeIntentPackages(sortedRows.map((row) => row.intent_package)),
      submitted_at: coalesceText(...sortedRows.map((row) => row.submitted_at)),
      assigned_bd_id: coalesceBdOwnerId(...sortedRows.map((row) => row.assigned_bd_id)),
    },
  }
}

function buildDuplicateGroups(rows: ImportLeadRow[], defaultBdId?: string): DuplicateGroup[] {
  const grouped = groupRowsByCompany(rows)
  const groups: DuplicateGroup[] = []

  grouped.forEach((bucket, companyKey) => {
    if (bucket.length <= 1) {
      return
    }

    const sources = Array.from(new Set(bucket.map((row) => normalizeText(row.source)).filter(Boolean) as string[]))

    groups.push({
      companyKey,
      displayName: normalizeText(bucket[0]?.company_name) ?? '(Unnamed)',
      rows: sortRowsByEarliest(bucket),
      sources,
      handlingMode: hasMultipleBdOwners(bucket, defaultBdId) ? 'keep_earliest' : 'merge_with_followups',
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

interface BdUserSearchCandidate {
  user: UserOption
  email: string
  fullName: string
  localPart: string
  emailCompact: string
  fullNameCompact: string
  localPartCompact: string
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripBdHintLabelPrefix(value: string): string {
  let stripped = value.trim()

  for (const prefix of BD_HINT_LABEL_PREFIXES) {
    const pattern = new RegExp(`^${escapeRegExp(prefix)}\\s*[:：\\-]\\s*`, 'i')
    stripped = stripped.replace(pattern, '').trim()
  }

  return stripped
}

function removeBdHintStopWords(value: string): string {
  const tokens = normalizeLookup(value)
    .split(' ')
    .filter((token) => token && !BD_HINT_STOP_WORDS.has(token))

  return tokens.join(' ')
}

function tokenizeBdHint(hint: string): string[] {
  const rawHint = normalizeText(hint)
  if (!rawHint) {
    return []
  }

  const strippedHint = stripBdHintLabelPrefix(rawHint)
  const segmentedCandidates = strippedHint
    .split(/[\n\r\t;,/|&]+/g)
    .map((part) => part.trim())
    .filter(Boolean)

  const baseCandidates = segmentedCandidates.length > 0 ? segmentedCandidates : [strippedHint]
  const unique = new Set<string>()
  const result: string[] = []

  for (const candidate of baseCandidates) {
    const normalizedCandidate = normalizeText(stripBdHintLabelPrefix(candidate))
    if (!normalizedCandidate) {
      continue
    }

    const withoutStopWords = normalizeText(removeBdHintStopWords(normalizedCandidate))
    if (!withoutStopWords) {
      continue
    }

    if (unique.has(withoutStopWords)) {
      continue
    }

    unique.add(withoutStopWords)
    result.push(withoutStopWords)
  }

  return result
}

function buildBdUserSearchCandidates(users: UserOption[]): BdUserSearchCandidate[] {
  return users.map((user) => {
    const email = normalizeLookup(user.email)
    const fullName = normalizeLookup(user.full_name ?? '')
    const localPart = normalizeLookup(user.email.split('@')[0] ?? '')

    return {
      user,
      email,
      fullName,
      localPart,
      emailCompact: normalizeCompact(email),
      fullNameCompact: normalizeCompact(fullName),
      localPartCompact: normalizeCompact(localPart),
    }
  })
}

function scoreBdHintAgainstUser(
  normalizedCandidate: string,
  compactCandidate: string,
  candidate: BdUserSearchCandidate,
): number {
  if (!normalizedCandidate) {
    return 0
  }

  if (
    normalizedCandidate === candidate.email ||
    normalizedCandidate === candidate.fullName ||
    normalizedCandidate === candidate.localPart ||
    (compactCandidate.length > 0 &&
      (compactCandidate === candidate.emailCompact ||
        compactCandidate === candidate.fullNameCompact ||
        compactCandidate === candidate.localPartCompact))
  ) {
    return 120
  }

  let score = 0

  if (normalizedCandidate.includes('@') && candidate.email.includes(normalizedCandidate)) {
    score = Math.max(score, 105)
  }

  const isCjkCandidate = /[\u3400-\u9FFF]/u.test(compactCandidate)
  const minLength = isCjkCandidate ? 2 : 3

  if (normalizedCandidate.length >= minLength) {
    if (candidate.fullName.includes(normalizedCandidate)) {
      score = Math.max(score, 90 + Math.min(normalizedCandidate.length, 10))
    }

    if (candidate.localPart.includes(normalizedCandidate)) {
      score = Math.max(score, 86 + Math.min(normalizedCandidate.length, 10))
    }

    if (normalizedCandidate.includes(candidate.fullName) && candidate.fullName.length >= minLength) {
      score = Math.max(score, 80 + Math.min(candidate.fullName.length, 10))
    }

    if (normalizedCandidate.includes(candidate.localPart) && candidate.localPart.length >= minLength) {
      score = Math.max(score, 76 + Math.min(candidate.localPart.length, 10))
    }
  }

  if (compactCandidate.length >= minLength) {
    if (candidate.fullNameCompact.includes(compactCandidate)) {
      score = Math.max(score, 98 + Math.min(compactCandidate.length, 10))
    }

    if (candidate.localPartCompact.includes(compactCandidate)) {
      score = Math.max(score, 93 + Math.min(compactCandidate.length, 10))
    }

    if (compactCandidate.includes(candidate.fullNameCompact) && candidate.fullNameCompact.length >= minLength) {
      score = Math.max(score, 84 + Math.min(candidate.fullNameCompact.length, 10))
    }

    if (compactCandidate.includes(candidate.localPartCompact) && candidate.localPartCompact.length >= minLength) {
      score = Math.max(score, 82 + Math.min(candidate.localPartCompact.length, 10))
    }
  }

  return score
}

function matchBdUser(hint: string | undefined, users: UserOption[]): UserOption | undefined {
  const rawHint = normalizeText(hint)
  if (!rawHint) {
    return undefined
  }

  const candidateHints = tokenizeBdHint(rawHint)
  if (candidateHints.length === 0) {
    return undefined
  }

  const userCandidates = buildBdUserSearchCandidates(users)
  const bestScoreByUserId = new Map<string, number>()

  for (const candidateHint of candidateHints) {
    const normalizedCandidate = normalizeLookup(candidateHint)
    const compactCandidate = normalizeCompact(candidateHint)
    if (!normalizedCandidate || !compactCandidate) {
      continue
    }

    for (const candidate of userCandidates) {
      const score = scoreBdHintAgainstUser(normalizedCandidate, compactCandidate, candidate)
      if (score <= 0) {
        continue
      }

      const currentScore = bestScoreByUserId.get(candidate.user.id) ?? 0
      if (score > currentScore) {
        bestScoreByUserId.set(candidate.user.id, score)
      }
    }
  }

  if (bestScoreByUserId.size === 0) {
    return undefined
  }

  let bestUserId: string | undefined
  let bestScore = 0
  let hasTie = false

  bestScoreByUserId.forEach((score, userId) => {
    if (score > bestScore) {
      bestScore = score
      bestUserId = userId
      hasTie = false
      return
    }

    if (score === bestScore && userId !== bestUserId) {
      hasTie = true
    }
  })

  if (!bestUserId || bestScore < 90 || hasTie) {
    return undefined
  }

  return users.find((item) => item.id === bestUserId)
}

function hydrateBdAssignments(rows: ImportLeadRow[], users: UserOption[]): ImportLeadRow[] {
  if (rows.length === 0 || users.length === 0) {
    return rows
  }

  return rows.map((row) => {
    if (row.assigned_bd_id) {
      return row
    }

    const matchedBdUser = matchBdUser(row.assigned_bd_hint, users)
    if (!matchedBdUser) {
      return row
    }

    return {
      ...row,
      assigned_bd_id: matchedBdUser.id,
      assigned_bd_hint: matchedBdUser.email,
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

  const regionOptions = useMemo(() => buildRegionOptions(dictionaryItems), [dictionaryItems])
  const sourceOptions = useMemo(() => buildLeadSourceOptions(dictionaryItems), [dictionaryItems])
  const intentPackageOptions = useMemo(() => getIntentPackageOptions(t), [t])

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

  const duplicateGroups = useMemo(() => buildDuplicateGroups(rows, assignBdId), [assignBdId, rows])

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

  useEffect(() => {
    if (bdUserOptions.length === 0) {
      return
    }

    setRows((current) => hydrateBdAssignments(current, bdUserOptions))
  }, [bdUserOptions])

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
      intent_package: row.intent_package,
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
      let conflictingBdGroupCount = 0
      let conflictingBdSkippedRows = 0

      for (const companyRows of grouped.values()) {
        const sortedCompanyRows = sortRowsByEarliest(companyRows)

        if (sortedCompanyRows.length === 1) {
          await createLeadFromRow(sortedCompanyRows[0])
          leadCount += 1
          continue
        }

        if (hasMultipleBdOwners(sortedCompanyRows, assignBdId)) {
          conflictingBdGroupCount += 1
          conflictingBdSkippedRows += sortedCompanyRows.length - 1

          await createLeadFromRow(sortedCompanyRows[0])
          leadCount += 1
          continue
        }

        mergedGroupCount += 1

        const { baseRow, merged } = buildMergedLeadRow(sortedCompanyRows)
        const leadId = await createLeadFromRow(merged)
        leadCount += 1

        for (const row of sortedCompanyRows) {
          if (row === baseRow) {
            continue
          }
          if (!shouldAppendAsFollowup(row)) {
            continue
          }
          await appendFollowupFromRow(leadId, row)
          followupCount += 1
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
        conflictingBdGroupCount > 0
          ? t('pages.pmLeadImport.importSummaryConflictingBd', {
              defaultValue: '{{groupCount}} duplicate group(s) kept earliest due to BD owner mismatch; {{rowCount}} row(s) skipped',
              groupCount: conflictingBdGroupCount,
              rowCount: conflictingBdSkippedRows,
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
      label: formatUserOptionLabel(item),
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

        <p className="mb-0 mt-3 text-xs app-text-soft">
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
                  'Duplicate handling is now automatic: if BD owner mismatches, only the earliest row is kept; if BD owner matches, rows are merged into one lead and cold visit/follow-up rows become follow-up records.',
              })}
            />
            {duplicateGroups.map((group) => (
              <div key={group.companyKey} className="flex flex-wrap items-center gap-3 rounded border app-border p-3">
                <div className="min-w-[240px] font-medium">{group.displayName}</div>
                <div className="app-text-soft">
                  {t('pages.pmLeadImport.duplicateRowsCount', { defaultValue: '{{count}} row(s)', count: group.rows.length })}
                </div>
                <div className="app-text-soft">
                  {group.sources.length > 0 ? group.sources.join(', ') : t('pages.pmLeadImport.noSource', { defaultValue: 'No source' })}
                </div>
                <div className="app-text-soft">
                  {group.handlingMode === 'keep_earliest'
                    ? t('pages.pmLeadImport.keepEarliestWhenBdMismatch', {
                        defaultValue: 'BD owner mismatch: keep earliest row only',
                      })
                    : t('pages.pmLeadImport.mergeWithFollowupsWhenBdMatch', {
                        defaultValue: 'Same BD owner: merge into one lead and append follow-up records',
                      })}
                </div>
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
        scroll={{ x: 1760 }}
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
            title: t('pages.pmLeadImport.columns.intentPackage', { defaultValue: 'Business Segment' }),
            dataIndex: 'intent_package',
            width: 190,
            render: (value: IntentPackage | undefined, row: ImportLeadRow) => (
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={value}
                options={intentPackageOptions}
                onChange={(nextValue) => updateRow(row.rowKey, { intent_package: nextValue })}
                optionFilterProp="label"
                placeholder={t('pages.pmLeadImport.columns.intentPackage', { defaultValue: 'Business Segment' })}
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
