import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Select, Space, Table, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { createLead } from '../api'
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
}

type ImportFieldKey = Exclude<keyof ImportLeadRow, 'rowKey'>

const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  company_name: ['company_name', 'company name', 'workshop name', 'nama perusahaan', 'nama bengkel', 'client name'],
  contact_person: ['contact_person', 'contact person', 'pic', 'owner', 'sales team', 'nama pic', 'pic name'],
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
      intent_level: parseNumber(rowByField.intent_level),
      estimated_value: parseNumber(rowByField.estimated_value),
    })
  })

  return parsedRows
}

function normalizeText(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  const text = value.trim()
  return text.length > 0 ? text : undefined
}

export function PmLeadImportPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()

  const [importing, setImporting] = useState(false)
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])
  const [rows, setRows] = useState<ImportLeadRow[]>([])
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [assignBdId, setAssignBdId] = useState<string>()

  const regionOptions = useMemo(() => buildRegionOptions(dictionaryItems), [dictionaryItems])
  const sourceOptions = useMemo(() => buildLeadSourceOptions(dictionaryItems), [dictionaryItems])

  const loadReferenceData = useCallback(async () => {
    try {
      const [dictionaryRows, users] = await Promise.all([listDictionaryItems(), listActiveUsers()])
      setDictionaryItems(dictionaryRows)
      setUserOptions(users)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmLeadImport.loadReferencesFail', { defaultValue: 'Failed to load import references' })
      message.error(text)
    }
  }, [t])

  useEffect(() => {
    void loadReferenceData()
  }, [loadReferenceData])

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

  function validateRows(data: ImportLeadRow[]): Array<{ rowKey: string; reason: string }> {
    const errors: Array<{ rowKey: string; reason: string }> = []

    for (const row of data) {
      if (!normalizeText(row.company_name)) {
        errors.push({
          rowKey: row.rowKey,
          reason: t('pages.pmLeadImport.validateCompanyRequired', { defaultValue: 'company_name is required' }),
        })
      }

      if (!normalizeText(row.region)) {
        errors.push({ rowKey: row.rowKey, reason: t('pages.pmLeadImport.validateRegionRequired', { defaultValue: 'region is required' }) })
      }

      if (!normalizeText(row.city)) {
        errors.push({ rowKey: row.rowKey, reason: t('pages.pmLeadImport.validateCityRequired', { defaultValue: 'city is required' }) })
      }

      if (!normalizeText(row.source)) {
        errors.push({ rowKey: row.rowKey, reason: t('pages.pmLeadImport.validateSourceRequired', { defaultValue: 'source is required' }) })
      }
    }

    return errors
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

      if (parsedRows.length === 0) {
        message.warning(t('pages.pmLeadImport.noRowsInTemplate', { defaultValue: 'No data rows found in template' }))
        return
      }

      setRows(parsedRows)
      message.success(
        t('pages.pmLeadImport.loadRowsSuccess', {
          defaultValue: `Loaded ${parsedRows.length} row(s) from template`,
          count: parsedRows.length,
        }),
      )
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmLeadImport.parseTemplateFail', { defaultValue: 'Failed to parse template' })
      message.error(text)
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

    const errors = validateRows(rows)

    if (errors.length > 0) {
      message.error(
        t('pages.pmLeadImport.missingRequiredFields', {
          defaultValue: `Template has ${errors.length} missing required field(s). Please complete the highlighted columns manually.`,
          count: errors.length,
        }),
      )
      return
    }

    setImporting(true)

    try {
      for (const row of rows) {
        await createLead({
          company_name: normalizeText(row.company_name) ?? '',
          contact_person: normalizeText(row.contact_person),
          contact_phone: normalizeText(row.contact_phone),
          contact_email: normalizeText(row.contact_email),
          industry: normalizeText(row.industry),
          region: normalizeText(row.region),
          city: normalizeText(row.city),
          address: normalizeText(row.address),
          source: normalizeText(row.source),
          intent_level: row.intent_level,
          estimated_value: row.estimated_value,
          assigned_bd_id: assignBdId,
        })
      }

      message.success(
        t('pages.pmLeadImport.importSuccess', {
          defaultValue: `Imported ${rows.length} lead(s) successfully`,
          count: rows.length,
        }),
      )
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
    return userOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [userOptions])

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
          />

          <Button type="primary" loading={importing} onClick={() => void handleImport()}>
            {t('pages.pmLeadImport.importLeads', { defaultValue: 'Import Leads' })}
          </Button>
        </Space>

        <p className="mb-0 mt-3 text-xs text-slate-500">
          {t('pages.pmLeadImport.requiredHeaderHint', {
            defaultValue:
              'Required template headers: company_name, region, city, source. Optional headers: contact_person, contact_phone, contact_email, industry, intent_level, estimated_value.',
          })}
        </p>
      </Card>

      <Table
        rowKey="rowKey"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 10 }}
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
              <Input value={value} status={!normalizeText(value) ? 'error' : ''} onChange={(event) => updateRow(row.rowKey, { company_name: event.target.value })} />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.region', { defaultValue: 'Region *' }),
            dataIndex: 'region',
            width: 200,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Select
                showSearch
                value={value}
                status={!normalizeText(value) ? 'error' : ''}
                options={regionOptions.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(nextValue) => updateRow(row.rowKey, { region: nextValue, city: undefined })}
                optionFilterProp="label"
              />
            ),
          },
          {
            title: t('pages.pmLeadImport.columns.city', { defaultValue: 'City *' }),
            dataIndex: 'city',
            width: 200,
            render: (value: string | undefined, row: ImportLeadRow) => {
              const cityOptions = findCitiesByRegion(regionOptions, row.region).map((item) => ({ value: item, label: item }))

              return (
                <Select
                  showSearch
                  value={value}
                  status={!normalizeText(value) ? 'error' : ''}
                  disabled={!row.region}
                  options={cityOptions}
                  onChange={(nextValue) => updateRow(row.rowKey, { city: nextValue })}
                  optionFilterProp="label"
                />
              )
            },
          },
          {
            title: t('pages.pmLeadImport.columns.source', { defaultValue: 'Lead Source *' }),
            dataIndex: 'source',
            width: 180,
            render: (value: string | undefined, row: ImportLeadRow) => (
              <Select
                showSearch
                value={value}
                status={!normalizeText(value) ? 'error' : ''}
                options={sourceOptions}
                onChange={(nextValue) => updateRow(row.rowKey, { source: nextValue })}
                optionFilterProp="label"
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
