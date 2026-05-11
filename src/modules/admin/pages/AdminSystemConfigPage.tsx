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
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  createDictionaryItem,
  listDictionaryItems,
  updateDictionaryItem,
  type DictionaryItem,
} from '../../shared/api/dictionary'

interface CreateConfigFormValues {
  dictionary_type: string
  code: string
  label: string
  sort_order?: number
}

interface EditState {
  label: string
  sort_order: number
  is_active: boolean
}

export function AdminSystemConfigPage() {
  const { t } = useTranslation()
  const [createForm] = Form.useForm<CreateConfigFormValues>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [rows, setRows] = useState<DictionaryItem[]>([])
  const [dictionaryType, setDictionaryType] = useState<string>()
  const [editStateById, setEditStateById] = useState<Record<number, EditState>>({})

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listDictionaryItems(dictionaryType)
      setRows(result)
      const initialEditState: Record<number, EditState> = {}
      result.forEach((item) => {
        initialEditState[item.id] = {
          label: item.label,
          sort_order: item.sort_order,
          is_active: item.is_active,
        }
      })
      setEditStateById(initialEditState)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminSystemConfig.loadFail', { defaultValue: 'Failed to load system configuration' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [dictionaryType, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSaveRow(itemId: number) {
    const editState = editStateById[itemId]

    if (!editState) {
      return
    }

    setSaving(true)

    try {
      await updateDictionaryItem(itemId, {
        label: editState.label,
        sort_order: editState.sort_order,
        is_active: editState.is_active,
      })
      message.success(t('pages.adminSystemConfig.saveSuccess', { defaultValue: 'Configuration saved' }))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminSystemConfig.saveFail', { defaultValue: 'Failed to save configuration' })
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(values: CreateConfigFormValues) {
    setCreating(true)

    try {
      await createDictionaryItem({
        dictionary_type: values.dictionary_type,
        code: values.code,
        label: values.label,
        sort_order: values.sort_order ?? 0,
        is_active: true,
      })
      message.success(t('pages.adminSystemConfig.createSuccess', { defaultValue: 'Configuration item created' }))
      createForm.resetFields()
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.adminSystemConfig.createFail', { defaultValue: 'Failed to create config item' })
      message.error(text)
    } finally {
      setCreating(false)
    }
  }

  const dictionaryTypeOptions = useMemo(() => {
    const set = new Set(rows.map((item) => item.dictionary_type))
    return Array.from(set).map((item) => ({ label: item, value: item }))
  }, [rows])

  return (
    <>
      <PageTitleBar
        title={t('pages.adminSystemConfig.title', { defaultValue: 'System Configuration' })}
        description={t('pages.adminSystemConfig.description', {
          defaultValue: 'Maintain dictionary-driven business options and operation-level configuration baseline.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <Alert
        className="mb-5"
        type="info"
        showIcon
        message={t('pages.adminSystemConfig.alertTitle', { defaultValue: 'Email reminder and automation hooks' })}
        description={t('pages.adminSystemConfig.alertDescription', {
          defaultValue:
            'Email notifications are designed as configurable extension. MVP stores operational dictionaries here and keeps reminder channels ready for serverless extension.',
        })}
      />

      <Card className="mb-5">
        <Space wrap className="mb-4">
          <Select
            allowClear
            placeholder={t('pages.adminSystemConfig.filterPlaceholder', { defaultValue: 'Filter dictionary type' })}
            style={{ width: 240 }}
            value={dictionaryType}
            options={dictionaryTypeOptions}
            onChange={(value) => setDictionaryType(value)}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          bordered
          dataSource={rows}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: t('pages.adminSystemConfig.columns.type', { defaultValue: 'Type' }), dataIndex: 'dictionary_type', width: 170 },
            { title: t('pages.adminSystemConfig.columns.code', { defaultValue: 'Code' }), dataIndex: 'code', width: 140 },
            {
              title: t('pages.adminSystemConfig.columns.label', { defaultValue: 'Label' }),
              render: (_: unknown, row: DictionaryItem) => (
                <Input
                  value={editStateById[row.id]?.label}
                  onChange={(event) =>
                    setEditStateById((current) => ({
                      ...current,
                      [row.id]: {
                        ...current[row.id],
                        label: event.target.value,
                      },
                    }))
                  }
                />
              ),
            },
            {
              title: t('pages.adminSystemConfig.columns.sort', { defaultValue: 'Sort' }),
              width: 100,
              render: (_: unknown, row: DictionaryItem) => (
                <InputNumber
                  className="w-full"
                  value={editStateById[row.id]?.sort_order}
                  onChange={(value) =>
                    setEditStateById((current) => ({
                      ...current,
                      [row.id]: {
                        ...current[row.id],
                        sort_order: Number(value ?? 0),
                      },
                    }))
                  }
                />
              ),
            },
            {
              title: t('pages.adminSystemConfig.columns.active', { defaultValue: 'Active' }),
              width: 90,
              render: (_: unknown, row: DictionaryItem) => (
                <Switch
                  checked={editStateById[row.id]?.is_active}
                  onChange={(checked) =>
                    setEditStateById((current) => ({
                      ...current,
                      [row.id]: {
                        ...current[row.id],
                        is_active: checked,
                      },
                    }))
                  }
                />
              ),
            },
            {
              title: t('pages.adminSystemConfig.columns.action', { defaultValue: 'Action' }),
              width: 120,
              render: (_: unknown, row: DictionaryItem) => (
                <Button size="small" type="primary" loading={saving} onClick={() => void handleSaveRow(row.id)}>
                  {t('common.save', { defaultValue: 'Save' })}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card title={t('pages.adminSystemConfig.createCardTitle', { defaultValue: 'Create Dictionary Item' })}>
        <Form<CreateConfigFormValues> form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Form.Item
              name="dictionary_type"
              label={t('pages.adminSystemConfig.dictionaryType', { defaultValue: 'Dictionary Type' })}
              rules={[{ required: true, message: t('pages.adminSystemConfig.dictionaryTypeRequired', { defaultValue: 'Type is required' }) }]}
            >
              <Input placeholder={t('pages.adminSystemConfig.dictionaryTypePlaceholder', { defaultValue: 'lead_lost_reason' })} />
            </Form.Item>
            <Form.Item
              name="code"
              label={t('pages.adminSystemConfig.code', { defaultValue: 'Code' })}
              rules={[{ required: true, message: t('pages.adminSystemConfig.codeRequired', { defaultValue: 'Code is required' }) }]}
            >
              <Input placeholder={t('pages.adminSystemConfig.codePlaceholder', { defaultValue: 'PRICE' })} />
            </Form.Item>
            <Form.Item
              name="label"
              label={t('pages.adminSystemConfig.label', { defaultValue: 'Label' })}
              rules={[{ required: true, message: t('pages.adminSystemConfig.labelRequired', { defaultValue: 'Label is required' }) }]}
            >
              <Input placeholder={t('pages.adminSystemConfig.labelPlaceholder', { defaultValue: 'Pricing mismatch' })} />
            </Form.Item>
            <Form.Item name="sort_order" label={t('pages.adminSystemConfig.sortOrder', { defaultValue: 'Sort Order' })}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={creating}>
            {t('pages.adminSystemConfig.createItem', { defaultValue: 'Create Item' })}
          </Button>
        </Form>
      </Card>
    </>
  )
}
