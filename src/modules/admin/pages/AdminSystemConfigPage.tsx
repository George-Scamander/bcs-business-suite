import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Switch, Table, message } from 'antd'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
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
      const text = error instanceof Error ? error.message : 'Failed to load system configuration'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [dictionaryType])

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
      message.success('Configuration saved')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to save configuration'
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
      message.success('Configuration item created')
      createForm.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to create config item'
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
        title="System Configuration"
        description="Maintain dictionary-driven business options and operation-level configuration baseline."
        extra={<Button onClick={() => void loadData()}>Refresh</Button>}
      />

      <Alert
        className="mb-5"
        type="info"
        showIcon
        message="Email reminder and automation hooks"
        description="Email notifications are designed as configurable extension. MVP stores operational dictionaries here and keeps reminder channels ready for serverless extension."
      />

      <Card className="mb-5">
        <Space wrap className="mb-4">
          <Select
            allowClear
            placeholder="Filter dictionary type"
            style={{ width: 240 }}
            value={dictionaryType}
            options={dictionaryTypeOptions}
            onChange={(value) => setDictionaryType(value)}
          />
          <Button type="primary" onClick={() => void loadData()}>
            Apply
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          bordered
          dataSource={rows}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: 'Type', dataIndex: 'dictionary_type', width: 170 },
            { title: 'Code', dataIndex: 'code', width: 140 },
            {
              title: 'Label',
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
              title: 'Sort',
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
              title: 'Active',
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
              title: 'Action',
              width: 120,
              render: (_: unknown, row: DictionaryItem) => (
                <Button size="small" type="primary" loading={saving} onClick={() => void handleSaveRow(row.id)}>
                  Save
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Create Dictionary Item">
        <Form<CreateConfigFormValues> form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Form.Item name="dictionary_type" label="Dictionary Type" rules={[{ required: true, message: 'Type is required' }]}>
              <Input placeholder="lead_lost_reason" />
            </Form.Item>
            <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code is required' }]}>
              <Input placeholder="PRICE" />
            </Form.Item>
            <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label is required' }]}>
              <Input placeholder="Pricing mismatch" />
            </Form.Item>
            <Form.Item name="sort_order" label="Sort Order">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={creating}>
            Create Item
          </Button>
        </Form>
      </Card>
    </>
  )
}
