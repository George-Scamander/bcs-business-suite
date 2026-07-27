import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import {
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Upload,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getSalesProductCategoryGroup,
  getSalesProductEntryCategoryOptions,
  getSalesProductSubcategory,
  getSalesProductSubcategoryOptions,
  SALES_PRODUCT_CATEGORY_OPTIONS,
} from '../../../lib/business-constants'
import {
  generateUuid,
} from '../../../lib/uuid'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  createSalesOrderWithAutoLead,
  fetchProductNameSuggestions,
  listTirePriceCatalog,
  listSalesOrderTemplatesByOwner,
  type SalesOrderRow,
  type TirePriceCatalogRow,
} from '../api'
import {
  listOnboardMerchants,
} from '../../onboarding/api'
import type {
  OnboardMerchant,
  SalesProductCategory,
  SalesProductSubcategory,
} from '../../../types/business'

interface DraftSalesItem {
  key: string
  category: SalesProductCategory
  subcategory: SalesProductSubcategory | null
  product_name: string
  quantity: number
  unit_price?: number
}

interface SalesFormValues {
  onboard_merchant_id?: string
  company_name: string
  sold_at: dayjs.Dayjs
  note?: string
}

interface ParsedTemplateResult {
  companyName: string | null
  soldAt: dayjs.Dayjs | null
  salesName: string | null
  gpsLink: string | null
  items: DraftSalesItem[]
}

const CATEGORY_DETECTORS: Array<{ category: SalesProductCategory; keywords: string[] }> = [
  { category: 'ENGINE_OIL', keywords: ['oil', 'engine oil', '机油', '機油', 'oli'] },
  { category: 'CHEMICAL', keywords: ['chemical', 'chemicals', 'additive', 'coolant', 'chem', '化学品', '化學品', '化工', 'kimia'] },
  { category: 'TIRE', keywords: ['tire', 'tyre', '轮胎', '輪胎', 'ban'] },
  { category: 'WIPER', keywords: ['wiper', '雨刮', '雨刷'] },
  { category: 'THREE_FILTERS', keywords: ['filter', 'three filter', '三滤', '三濾', 'air filter', 'oil filter', 'ac filter'] },
  { category: 'BATTERY', keywords: ['battery', 'accu', '电池', '電池'] },
  { category: 'X_OWL', keywords: ['x-owl', 'x owl', 'x_owl'] },
  { category: 'BRAKE_PAD', keywords: ['brake pad', 'brake', '刹车片', '煞車片'] },
  { category: 'BOSCH_ACCESSORY', keywords: ['spark plug', '火花塞', 'busi'] },
  { category: 'CAR_BEAUTY', keywords: ['detailing', 'car beauty', 'coating', '洗美', '美容', 'cuci', 'polish'] },
  { category: 'WINDOW_FILM', keywords: ['window film', 'film', '窗膜', 'kaca film'] },
  { category: 'BOSCH_ACCESSORY', keywords: ['bosch', 'accessory', '配件', 'aksesoris'] },
]
const TEMPLATE_TEXT_DRAFT_KEY = 'bd-sales-template-text-draft'

function newDraftItem(): DraftSalesItem {
  return {
    key: generateUuid(),
    category: 'TIRE',
    subcategory: null,
    product_name: '',
    quantity: 1,
  }
}

function detectCategory(line: string): SalesProductCategory | null {
  const normalized = line.toLowerCase()
  for (const entry of CATEGORY_DETECTORS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.category
    }
  }
  return null
}

function detectSubcategory(line: string, category: SalesProductCategory): SalesProductSubcategory | null {
  const normalized = line.toLowerCase()
  if (category === 'CHEMICAL') {
    if (/\bt1\b/i.test(normalized)) {
      return 'CHEMICAL_T1'
    }
    if (/\bt3\b/i.test(normalized)) {
      return 'CHEMICAL_T3'
    }
  }
  if (category === 'BOSCH_ACCESSORY' && ['spark plug', '火花塞', 'busi'].some((keyword) => normalized.includes(keyword))) {
    return 'BOSCH_SPARK_PLUG'
  }
  if (category === 'X_OWL' && ['brake pad', 'brake', '刹车片', '煞車片', 'kampas rem'].some((keyword) => normalized.includes(keyword))) {
    return 'X_OWL_BRAKE_PAD'
  }
  return getSalesProductSubcategory(category)
}

function detectQuantity(line: string): number {
  const cleaned = line.replace(/^\s*\d+\s*[.)]\s*/, '').trim()
  const explicitMatched =
    cleaned.match(/(?:qty|quantity|jumlah)\s*[:=]?\s*(\d{1,4})/i) ??
    cleaned.match(/(?:x|×)\s*(\d{1,4})\b/i) ??
    cleaned.match(/\b(\d{1,4})\s*(?:pcs?|pc|set|ltr|liter|L)\b/i)

  if (explicitMatched) {
    const quantity = Number(explicitMatched[1])
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  }

  const tailMatched = cleaned.match(/(\d{1,4})\s*$/)
  if (!tailMatched) {
    return 1
  }

  const quantity = Number(tailMatched[1])
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function detectSoldAt(source: string): dayjs.Dayjs | null {
  const fullMatched = source.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?/)
  if (fullMatched) {
    const datePart = fullMatched[1].replace(/\//g, '-')
    const timePart = fullMatched[2] ?? '00:00:00'
    const value = dayjs(`${datePart} ${timePart}`)
    if (value.isValid()) {
      return value
    }
  }

  const fallback = dayjs(source)
  return fallback.isValid() ? fallback : null
}

function detectCompany(source: string): string | null {
  const lines = source
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return null
  }

  const keyedLine = lines.find((line) =>
    /company|company name|store|shop|nama toko|nama bengkel|workshop|店铺|店舖|公司/i.test(line),
  )
  if (keyedLine) {
    const value = keyedLine.split(/[:：]/).slice(1).join(':').trim()
    if (value) {
      return value
    }
  }

  return lines[0] || null
}

function escapeRegexToken(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pickFieldValue(line: string, labels: string[]): string | null {
  const pattern = new RegExp(`^(?:${labels.map(escapeRegexToken).join('|')})\\s*[:：]\\s*(.+)$`, 'i')
  const matched = line.match(pattern)
  if (!matched) {
    return null
  }
  const value = matched[1]?.trim()
  return value ? value : null
}

function stripListPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*]|\d+\s*[.)])\s*/, '').trim()
}

function stripQuantityHint(line: string): string {
  return line
    .replace(/(?:qty|quantity|jumlah)\s*[:=]?\s*\d{1,4}/gi, '')
    .replace(/(?:x|×)\s*\d{1,4}\b/gi, '')
    .replace(/\b\d{1,4}\s*(?:pcs?|pc|set|ltr|liter|L)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isPlainNumberRow(line: string): boolean {
  return /^\s*\d+\s*[.)]?\s*$/.test(line)
}

function parseTemplateInput(source: string): ParsedTemplateResult {
  const companyLabels = [
    'nama toko',
    'nama bengkel',
    'store name',
    'shop name',
    'company name',
    'workshop',
    '店舖名稱',
    '店铺名称',
    '公司名稱',
    '公司名称',
    '公司',
  ]
  const gpsLabels = ['link gps', 'gps link', 'gps連結', 'gps链接', '定位链接']
  const salesLabels = ['nama sales', 'sales name', '销售姓名', '銷售姓名', 'bd name', 'bd姓名']
  const itemHeaderLabels = ['item', 'items', '项目', '項目']

  const rawLines = source
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)

  const lines = rawLines.flatMap((line) => {
    const isFieldLine =
      pickFieldValue(line, companyLabels) ||
      pickFieldValue(line, gpsLabels) ||
      pickFieldValue(line, salesLabels) ||
      new RegExp(`^(?:${itemHeaderLabels.map(escapeRegexToken).join('|')})\\s*[:：]?$`, 'i').test(line)
    if (!isFieldLine && /[,，]/.test(line) && !/https?:\/\//i.test(line)) {
      return line
        .split(/[,，]/)
        .map((segment) => segment.trim())
        .filter(Boolean)
    }
    return [line]
  })

  let companyName: string | null = null
  let gpsLink: string | null = null
  let salesName: string | null = null
  let inItemSection = false
  const items: DraftSalesItem[] = []

  for (const line of lines) {
    const company = pickFieldValue(line, companyLabels)
    if (company) {
      companyName = company
      continue
    }

    const gps = pickFieldValue(line, gpsLabels)
    if (gps) {
      gpsLink = gps
      continue
    }

    const sales = pickFieldValue(line, salesLabels)
    if (sales) {
      salesName = sales
      continue
    }

    if (new RegExp(`^(?:${itemHeaderLabels.map(escapeRegexToken).join('|')})\\s*[:：]?$`, 'i').test(line)) {
      inItemSection = true
      continue
    }

    if (isPlainNumberRow(line)) {
      continue
    }

    const stripped = stripListPrefix(line)
    if (!stripped) {
      continue
    }

    const category = detectCategory(stripped)
    const quantity = detectQuantity(stripped)
    const productName = stripQuantityHint(stripped)

    if (category) {
      items.push({
        key: generateUuid(),
        category: getSalesProductCategoryGroup(category),
        subcategory: detectSubcategory(stripped, category),
        product_name: productName || stripped,
        quantity,
      })
      continue
    }

    if (inItemSection && productName) {
      items.push({
        key: generateUuid(),
        category: 'TIRE',
        subcategory: null,
        product_name: productName,
        quantity,
      })
    }
  }

  if (!companyName) {
    companyName = detectCompany(source)
  }

  return {
    companyName,
    soldAt: detectSoldAt(source),
    salesName,
    gpsLink,
    items,
  }
}

function buildTemplateSkeleton(t: (key: string, options?: Record<string, unknown>) => string): string {
  return [
    `${t('pages.bdSalesCreate.templateFields.storeName', { defaultValue: 'Store Name' })} :`,
    `${t('pages.bdSalesCreate.templateFields.gpsLink', { defaultValue: 'GPS Link' })} :`,
    `${t('pages.bdSalesCreate.templateFields.salesName', { defaultValue: 'Sales Name' })} :`,
    `${t('pages.bdSalesCreate.templateFields.item', { defaultValue: 'Item' })} :`,
    '1.',
    '2.',
    '3.',
    '4.',
    '5.',
  ].join('\n')
}

export function BdSalesCreatePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const templateNoticeShownRef = useRef(false)
  const [form] = Form.useForm<SalesFormValues>()
  const [items, setItems] = useState<DraftSalesItem[]>([newDraftItem()])
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<SalesOrderRow[]>([])
  const [onboardMerchants, setOnboardMerchants] = useState<OnboardMerchant[]>([])
  const [loadingOnboardMerchants, setLoadingOnboardMerchants] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  const [templateText, setTemplateText] = useState('')
  const [tireCatalogRows, setTireCatalogRows] = useState<TirePriceCatalogRow[]>([])
  const [productSuggestions, setProductSuggestions] = useState<Map<SalesProductCategory, string[]>>(new Map())

  const categoryOptions = useMemo(() => getSalesProductEntryCategoryOptions(t), [t])
  const templateSkeleton = useMemo(() => buildTemplateSkeleton(t), [t])
  const onboardMerchantOptions = useMemo(
    () =>
      onboardMerchants.map((item) => ({
        value: item.id,
        label: `${item.merchant_no} · ${item.company_name} · ${t(`onboardMerchantType.${item.onboarding_type}`, {
          defaultValue: item.onboarding_type,
        })}`,
      })),
    [onboardMerchants, t],
  )

  const onboardMerchantById = useMemo(() => {
    return new Map(onboardMerchants.map((item) => [item.id, item]))
  }, [onboardMerchants])

  const tireModelOptions = useMemo(
    () =>
      tireCatalogRows.map((row) => ({
        value: row.model_label,
        label: `${row.model_label} · IDR ${new Intl.NumberFormat().format(Number(row.price_incl_vat ?? 0))}`,
      })),
    [tireCatalogRows],
  )

  const loadTemplates = useCallback(async () => {
    if (!user) {
      return
    }
    try {
      const rows = await listSalesOrderTemplatesByOwner(user.id)
      setTemplates(rows)
    } catch (error) {
      setTemplates([])
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code ?? '') : ''
      if (!templateNoticeShownRef.current && ['42P01', 'PGRST205', '42501'].includes(code)) {
        templateNoticeShownRef.current = true
        message.warning(
          t('pages.bdSalesCreate.templateFeatureUnavailable', {
            defaultValue: 'Sales template history is unavailable now. You can still create sales orders manually.',
          }),
        )
        return
      }
      if (!templateNoticeShownRef.current) {
        templateNoticeShownRef.current = true
        message.error(t('pages.bdSalesCreate.loadTemplateFail', { defaultValue: 'Failed to load sales templates' }))
      }
    }
  }, [t, user])

  useEffect(() => {
    form.setFieldsValue({ sold_at: dayjs() })
    void loadTemplates()
    fetchProductNameSuggestions()
      .then(setProductSuggestions)
      .catch(() => {})
  }, [form, loadTemplates])

  useEffect(() => {
    try {
      const cachedText = sessionStorage.getItem(TEMPLATE_TEXT_DRAFT_KEY)
      if (!cachedText) {
        return
      }
      setTemplateText(cachedText)
    } catch {
      // ignore storage read failure
    }
  }, [])

  useEffect(() => {
    try {
      if (!templateText.trim()) {
        sessionStorage.removeItem(TEMPLATE_TEXT_DRAFT_KEY)
        return
      }
      sessionStorage.setItem(TEMPLATE_TEXT_DRAFT_KEY, templateText)
    } catch {
      // ignore storage write failure
    }
  }, [templateText])

  useEffect(() => {
    let cancelled = false
    async function loadTireCatalog() {
      try {
        const rows = await listTirePriceCatalog(undefined, 600)
        if (!cancelled) {
          setTireCatalogRows(rows)
        }
      } catch {
        if (!cancelled) {
          setTireCatalogRows([])
        }
      }
    }
    void loadTireCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadOnboardMerchants() {
      if (!user) {
        return
      }

      setLoadingOnboardMerchants(true)
      try {
        const rows = await listOnboardMerchants()
        if (!cancelled) {
          setOnboardMerchants(rows)
        }
      } catch {
        if (!cancelled) {
          setOnboardMerchants([])
        }
      } finally {
        if (!cancelled) {
          setLoadingOnboardMerchants(false)
        }
      }
    }

    void loadOnboardMerchants()
    return () => {
      cancelled = true
    }
  }, [user])

  function addItem() {
    setItems((current) => [...current, newDraftItem()])
  }

  function removeItem(key: string) {
    setItems((current) => {
      if (current.length <= 1) {
        return [newDraftItem()]
      }
      return current.filter((item) => item.key !== key)
    })
  }

  function updateItem(key: string, patch: Partial<DraftSalesItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = templates.find((item) => item.id === templateId)
    if (!template) {
      return
    }

    form.setFieldsValue({
      company_name: template.company_name,
      sold_at: dayjs(template.sold_at),
      note: template.note ?? undefined,
    })

    const mappedItems = (template.items ?? []).map((item) => ({
      key: generateUuid(),
      category: getSalesProductCategoryGroup(item.category),
      subcategory: getSalesProductSubcategory(item.category, item.subcategory),
      product_name: item.product_name ?? '',
      quantity: Number(item.quantity ?? 1),
      unit_price: item.unit_price ?? undefined,
    }))
    setItems(mappedItems.length > 0 ? mappedItems : [newDraftItem()])
  }

  function handleParseTemplateText() {
    const source = templateText.trim()
    if (!source) {
      message.warning(t('pages.bdSalesCreate.templateTextRequired', { defaultValue: 'Please paste template text first' }))
      return
    }

    const parsed = parseTemplateInput(source)
    if (parsed.companyName) {
      form.setFieldValue('company_name', parsed.companyName)
    }
    if (parsed.soldAt) {
      form.setFieldValue('sold_at', parsed.soldAt)
    }
    if (parsed.items.length > 0) {
      setItems(parsed.items)
    }

    const noteLines: string[] = []
    if (parsed.salesName) {
      noteLines.push(`${t('pages.bdSalesCreate.templateFields.salesName', { defaultValue: 'Sales Name' })}: ${parsed.salesName}`)
    }
    if (parsed.gpsLink) {
      noteLines.push(`${t('pages.bdSalesCreate.templateFields.gpsLink', { defaultValue: 'GPS Link' })}: ${parsed.gpsLink}`)
    }
    if (noteLines.length > 0) {
      const existingNote = form.getFieldValue('note')
      const mergedNote = [existingNote, ...noteLines].filter(Boolean).join('\n')
      form.setFieldValue('note', mergedNote)
    }

    const parsedCount = parsed.items.length
    if (!parsed.companyName && !parsed.soldAt && parsedCount === 0 && noteLines.length === 0) {
      message.warning(
        t('pages.bdSalesCreate.templateParsedNoMatch', {
          defaultValue: 'No recognizable fields found. Please include store name and item lines with category keywords.',
        }),
      )
      return
    }

    message.success(
      t('pages.bdSalesCreate.templateParsed', {
        defaultValue: 'Template parsed: {{count}} item(s) detected',
        count: parsedCount,
      }),
    )
  }

  function fillTemplateSkeleton() {
    setTemplateText(templateSkeleton)
  }

  function downloadExcelTemplate() {
    const headers = [
      t('pages.bdSalesCreate.columns.category', { defaultValue: 'Category' }),
      t('pages.bdSalesCreate.columns.productName', { defaultValue: 'Product / Description' }),
      t('pages.bdSalesCreate.columns.quantity', { defaultValue: 'Quantity' }),
      t('pages.bdSalesCreate.columns.unitPrice', { defaultValue: 'Unit Price' }),
    ]
    const sampleRows = [
      ['Engine Oil', '5W-30 4L', 2, 150000],
      ['Tire', '185/65R15', 4, 850000],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
    XLSX.writeFile(workbook, 'sales-order-template.xlsx')
  }

  function parseExcelDataRows(rows: unknown[][]): { items: DraftSalesItem[]; unmatchedCount: number } {
    const parsedItems: DraftSalesItem[] = []
    let unmatchedCount = 0

    for (const row of rows) {
      if (!row || row.length === 0) {
        continue
      }
      const [categoryRaw, productNameRaw, quantityRaw, unitPriceRaw] = row
      const categoryText = categoryRaw != null ? String(categoryRaw).trim() : ''
      const productName = productNameRaw != null ? String(productNameRaw).trim() : ''
      if (!categoryText && !productName) {
        continue
      }

      const category = detectCategory(categoryText) || detectCategory(productName)
      const quantityNumber = Number(quantityRaw)
      const quantity = Number.isFinite(quantityNumber) && quantityNumber > 0 ? quantityNumber : 1
      const unitPriceNumber = Number(unitPriceRaw)
      const unitPrice = Number.isFinite(unitPriceNumber) && unitPriceNumber > 0 ? unitPriceNumber : undefined

      if (!category) {
        unmatchedCount += 1
      }

      const resolvedCategory = category ?? 'TIRE'
      parsedItems.push({
        key: generateUuid(),
        category: resolvedCategory,
        subcategory: category ? detectSubcategory(categoryText || productName, category) : null,
        product_name: productName || categoryText,
        quantity,
        unit_price: unitPrice,
      })
    }

    return { items: parsedItems, unmatchedCount }
  }

  async function handleExcelUpload(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
      if (!sheet) {
        message.warning(t('pages.bdSalesCreate.excelNoRows', { defaultValue: 'No recognizable item rows found in the file' }))
        return false
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
      const dataRows = rows.slice(1)
      const { items: parsedItems, unmatchedCount } = parseExcelDataRows(dataRows)

      if (parsedItems.length === 0) {
        message.warning(t('pages.bdSalesCreate.excelNoRows', { defaultValue: 'No recognizable item rows found in the file' }))
        return false
      }

      setItems(parsedItems)

      if (unmatchedCount > 0) {
        message.warning(
          t('pages.bdSalesCreate.excelParsedSummaryPartial', {
            defaultValue: 'Imported {{count}} item(s), {{unmatched}} need category confirmation',
            count: parsedItems.length,
            unmatched: unmatchedCount,
          }),
        )
      } else {
        message.success(
          t('pages.bdSalesCreate.excelParsedSummary', {
            defaultValue: 'Imported {{count}} item(s) from Excel',
            count: parsedItems.length,
          }),
        )
      }
    } catch {
      message.error(t('pages.bdSalesCreate.excelParseFail', { defaultValue: 'Failed to parse the uploaded Excel file' }))
    }
    return false
  }

  async function handleSubmit(values: SalesFormValues) {
    const allowedCategories: SalesProductCategory[] = SALES_PRODUCT_CATEGORY_OPTIONS.map((item) => item.value)
    const validItems = items
      .map((item) => ({
        category:
          (allowedCategories.includes(item.category)
            ? item.category
            : detectCategory(item.product_name || '') || 'TIRE') as SalesProductCategory,
        subcategory: item.subcategory,
        product_name: item.product_name.trim() || undefined,
        quantity: Number(item.quantity ?? 0),
        unit_price: item.unit_price,
      }))
      .filter((item) => item.quantity > 0)

    if (validItems.length === 0) {
      message.warning(t('pages.bdSalesCreate.itemsRequired', { defaultValue: 'At least one sales item is required' }))
      return
    }

    setSaving(true)
    try {
      const result = await createSalesOrderWithAutoLead({
        company_name: values.company_name.trim(),
        sold_at: values.sold_at.toISOString(),
        note: values.note,
        onboard_merchant_id: values.onboard_merchant_id,
        items: validItems,
      })

      message.success(
        result.lead_created
          ? t('pages.bdSalesCreate.createSuccessWithLead', {
              defaultValue: 'Sales order created. New lead {{leadCode}} has been added to lead pool.',
              leadCode: result.lead_code ?? 'SP',
            })
          : t('pages.bdSalesCreate.createSuccess', { defaultValue: 'Sales order created successfully' }),
      )

      form.resetFields()
      form.setFieldsValue({ sold_at: dayjs() })
      setItems([newDraftItem()])
      setSelectedTemplateId(undefined)
      setTemplateText('')
      try {
        sessionStorage.removeItem(TEMPLATE_TEXT_DRAFT_KEY)
      } catch {
        // ignore storage write failure
      }
      await loadTemplates()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.bdSalesCreate.createFail', { defaultValue: 'Failed to create sales order' })
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.bdSalesCreate.title', { defaultValue: 'Create Sales Order' })}
        description={t('pages.bdSalesCreate.description', {
          defaultValue: 'Create a sales order for tire, oil, window film, and Bosch accessories. Missing companies will auto-create SP leads.',
        })}
      />

      <Card className="mb-4">
        <Space direction="vertical" className="w-full" size={12}>
          <Select
            allowClear
            value={selectedTemplateId}
            onChange={(value) => {
              if (value) {
                applyTemplate(value)
              } else {
                setSelectedTemplateId(undefined)
              }
            }}
            placeholder={t('pages.bdSalesCreate.templatePicker', { defaultValue: 'Copy from previous sales template' })}
            options={templates.map((item) => ({
              value: item.id,
              label: `${item.order_no} · ${item.company_name}`,
            }))}
          />

          <div className="text-sm font-medium">
            {t('pages.bdSalesCreate.templateTextLabel', { defaultValue: 'Template Text Quick Fill' })}
          </div>
          <div className="rounded-md border border-dashed app-border p-3" style={{ backgroundColor: 'var(--app-surface-muted)' }}>
            <div className="mb-2 text-xs font-medium app-text-soft">
              {t('pages.bdSalesCreate.templateFormatTitle', { defaultValue: 'Recommended Template Format' })}
            </div>
            <pre className="m-0 whitespace-pre-wrap text-xs leading-5 app-text-soft">{templateSkeleton}</pre>
          </div>
          <Input.TextArea
            rows={4}
            value={templateText}
            onChange={(event) => setTemplateText(event.target.value)}
            placeholder={t('pages.bdSalesCreate.templateTextPlaceholder', {
              defaultValue: 'Paste a template text block to auto-detect category, quantity, sold time, and company.',
            })}
          />
          <Space wrap>
            <Button onClick={fillTemplateSkeleton}>
              {t('pages.bdSalesCreate.fillTemplateSkeleton', { defaultValue: 'Insert Template' })}
            </Button>
            <Button onClick={handleParseTemplateText}>{t('pages.bdSalesCreate.parseTemplateText', { defaultValue: 'Parse Template Text' })}</Button>
          </Space>
        </Space>
      </Card>

      <Card className="mb-4">
        <Space direction="vertical" className="w-full" size={12}>
          <div className="text-sm font-medium">
            {t('pages.bdSalesCreate.excelImportLabel', { defaultValue: 'Excel Template Import' })}
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={downloadExcelTemplate}>
              {t('pages.bdSalesCreate.downloadTemplate', { defaultValue: 'Download Excel Template' })}
            </Button>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleExcelUpload}>
              <Button icon={<UploadOutlined />}>
                {t('pages.bdSalesCreate.uploadExcel', { defaultValue: 'Upload Excel' })}
              </Button>
            </Upload>
          </Space>
        </Space>
      </Card>

      <Card>
        <Form<SalesFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          initialValues={{ sold_at: dayjs() }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Form.Item
              name="onboard_merchant_id"
              label={t('pages.bdSalesCreate.onboardMerchant', { defaultValue: 'Onboard Merchant' })}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={loadingOnboardMerchants}
                options={onboardMerchantOptions}
                placeholder={t('pages.bdSalesCreate.onboardMerchantPlaceholder', {
                  defaultValue: 'Select onboard merchant (optional)',
                })}
                onChange={(value) => {
                  if (!value) {
                    return
                  }

                  const merchant = onboardMerchantById.get(String(value))
                  if (!merchant) {
                    return
                  }

                  form.setFieldValue('company_name', merchant.company_name)
                }}
              />
            </Form.Item>

            <Form.Item
              name="company_name"
              label={t('pages.bdSalesCreate.companyName', { defaultValue: 'Store / Company Name' })}
              rules={[{ required: true, message: t('pages.bdSalesCreate.companyNameRequired', { defaultValue: 'Company name is required' }) }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="sold_at"
              label={t('pages.bdSalesCreate.soldAt', { defaultValue: 'Sold Time' })}
              rules={[{ required: true, message: t('pages.bdSalesCreate.soldAtRequired', { defaultValue: 'Sold time is required' }) }]}
            >
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="note" label={t('pages.bdSalesCreate.note', { defaultValue: 'Remark' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Card
            size="small"
            title={t('pages.bdSalesCreate.itemsTitle', { defaultValue: 'Sales Items' })}
            extra={
              <Button icon={<PlusOutlined />} onClick={addItem}>
                {t('pages.bdSalesCreate.addItem', { defaultValue: 'Add Item' })}
              </Button>
            }
          >
            <Table
              rowKey="key"
              pagination={false}
              dataSource={items}
              scroll={{ x: 960 }}
              columns={[
                {
                  title: t('pages.bdSalesCreate.columns.category', { defaultValue: 'Category' }),
                  width: 240,
                  render: (_: unknown, row: DraftSalesItem) => (
                    <Select
                      value={row.category}
                      options={categoryOptions}
                      style={{ width: '100%', minWidth: 180 }}
                      popupMatchSelectWidth={false}
                      dropdownStyle={{ minWidth: 240 }}
                      onChange={(value) => {
                        const category = value as SalesProductCategory
                        updateItem(row.key, { category, subcategory: getSalesProductSubcategory(category) })
                      }}
                    />
                  ),
                },
                {
                  title: t('pages.bdSalesCreate.columns.subcategory', { defaultValue: 'Subcategory' }),
                  width: 220,
                  render: (_: unknown, row: DraftSalesItem) => {
                    const options = getSalesProductSubcategoryOptions(row.category, t)
                    return options.length > 0 ? (
                      <Select
                        value={row.subcategory ?? undefined}
                        options={options}
                        style={{ width: '100%', minWidth: 160 }}
                        onChange={(value) => updateItem(row.key, { subcategory: value as SalesProductSubcategory })}
                      />
                    ) : '-'
                  },
                },
                {
                  title: t('pages.bdSalesCreate.columns.productName', { defaultValue: 'Product / Description' }),
                  render: (_: unknown, row: DraftSalesItem) => (
                    row.category === 'TIRE' ? (
                      <AutoComplete
                        value={row.product_name}
                        options={tireModelOptions}
                        filterOption={(inputValue, option) =>
                          String(option?.value ?? '')
                            .toLowerCase()
                            .includes(inputValue.toLowerCase())
                        }
                        onChange={(value) => updateItem(row.key, { product_name: value })}
                        placeholder={t('pages.bdSalesCreate.tireModelHint', {
                          defaultValue: 'Type tire model keywords; suggestions are optional',
                        })}
                      />
                    ) : (
                      <AutoComplete
                        value={row.product_name}
                        options={(productSuggestions.get(row.category) ?? [])
                          .filter((name) =>
                            !row.product_name || name.toLowerCase().includes(row.product_name.toLowerCase()),
                          )
                          .map((name) => ({ value: name, label: name }))}
                        onChange={(value) => updateItem(row.key, { product_name: value })}
                        className="w-full"
                      />
                    )
                  ),
                },
                {
                  title: t('pages.bdSalesCreate.columns.quantity', { defaultValue: 'Quantity' }),
                  width: 100,
                  render: (_: unknown, row: DraftSalesItem) => (
                    <InputNumber
                      min={1}
                      value={row.quantity}
                      onChange={(value) => updateItem(row.key, { quantity: Number(value ?? 1) })}
                      className="w-full"
                    />
                  ),
                },
                {
                  title: t('pages.bdSalesCreate.columns.unitPrice', { defaultValue: 'Unit Price' }),
                  width: 130,
                  render: (_: unknown, row: DraftSalesItem) => (
                    <InputNumber
                      min={0}
                      value={row.unit_price}
                      onChange={(value) => updateItem(row.key, { unit_price: value === null ? undefined : Number(value) })}
                      className="w-full"
                    />
                  ),
                },
                {
                  title: t('pages.bdSalesCreate.columns.action', { defaultValue: 'Action' }),
                  width: 90,
                  render: (_: unknown, row: DraftSalesItem) => (
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeItem(row.key)}
                    />
                  ),
                },
              ]}
            />
          </Card>

          <div className="mt-4">
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('pages.bdSalesCreate.submit', { defaultValue: 'Create Sales Order' })}
            </Button>
          </div>
        </Form>
      </Card>
    </>
  )
}
