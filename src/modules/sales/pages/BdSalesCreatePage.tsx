import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getSalesProductCategoryOptions,
} from '../../../lib/business-constants'
import {
  generateUuid,
} from '../../../lib/uuid'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  createSalesOrderWithAutoLead,
  listSalesOrderTemplatesByOwner,
  type SalesOrderRow,
} from '../api'
import {
  listOnboardMerchants,
} from '../../onboarding/api'
import type {
  OnboardMerchant,
  SalesProductCategory,
} from '../../../types/business'

interface DraftSalesItem {
  key: string
  category: SalesProductCategory
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
  { category: 'TIRE', keywords: ['tire', 'tyre', '轮胎', '輪胎', 'ban'] },
  { category: 'ENGINE_OIL', keywords: ['oil', 'engine oil', '机油', '機油', 'oli'] },
  { category: 'WINDOW_FILM', keywords: ['window film', 'film', '窗膜', 'kaca film'] },
  { category: 'BOSCH_ACCESSORY', keywords: ['bosch', 'accessory', '配件', 'aksesoris'] },
]
const TEMPLATE_TEXT_DRAFT_KEY = 'bd-sales-template-text-draft'

function newDraftItem(): DraftSalesItem {
  return {
    key: generateUuid(),
    category: 'TIRE',
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

function detectQuantity(line: string): number {
  const cleaned = line.replace(/^\s*\d+\s*[\.\)]\s*/, '').trim()
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
  return line.replace(/^\s*(?:[-*]|\d+\s*[\.\)])\s*/, '').trim()
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
  return /^\s*\d+\s*[\.\)]?\s*$/.test(line)
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
        category,
        product_name: productName || stripped,
        quantity,
      })
      continue
    }

    if (inItemSection && productName) {
      items.push({
        key: generateUuid(),
        category: 'TIRE',
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

  const categoryOptions = useMemo(() => getSalesProductCategoryOptions(t), [t])
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
      category: item.category,
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

  async function handleSubmit(values: SalesFormValues) {
    const allowedCategories: SalesProductCategory[] = ['TIRE', 'ENGINE_OIL', 'WINDOW_FILM', 'BOSCH_ACCESSORY']
    const validItems = items
      .map((item) => ({
        category:
          (allowedCategories.includes(item.category)
            ? item.category
            : detectCategory(item.product_name || '') || 'TIRE') as SalesProductCategory,
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
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-medium text-slate-600">
              {t('pages.bdSalesCreate.templateFormatTitle', { defaultValue: 'Recommended Template Format' })}
            </div>
            <pre className="m-0 whitespace-pre-wrap text-xs leading-5 text-slate-700">{templateSkeleton}</pre>
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
                      onChange={(value) => updateItem(row.key, { category: value as SalesProductCategory })}
                    />
                  ),
                },
                {
                  title: t('pages.bdSalesCreate.columns.productName', { defaultValue: 'Product / Description' }),
                  render: (_: unknown, row: DraftSalesItem) => (
                    <Input
                      value={row.product_name}
                      onChange={(event) => updateItem(row.key, { product_name: event.target.value })}
                    />
                  ),
                },
                {
                  title: t('pages.bdSalesCreate.columns.quantity', { defaultValue: 'Quantity' }),
                  width: 140,
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
                  width: 180,
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
