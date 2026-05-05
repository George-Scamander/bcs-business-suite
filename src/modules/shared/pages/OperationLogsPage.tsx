import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Space, Table, Tag, message } from 'antd'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import type { OperationLogRecord } from '../../../types/rbac'
import { supabase } from '../../../lib/supabase/client'

interface OperationLogWithActor extends OperationLogRecord {
  actor?: {
    full_name: string | null
    email: string
  } | null
}

export function OperationLogsPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<OperationLogWithActor[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  const loadRows = useCallback(async () => {
    setLoading(true)

    const result = await supabase
      .from('operation_logs')
      .select('*, actor:profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(200)

    setLoading(false)

    if (result.error) {
      message.error(result.error.message || t('pages.operationLogs.loadFail', { defaultValue: 'Failed to load operation logs' }))
      return
    }

    setRows((result.data ?? []) as OperationLogWithActor[])
  }, [t])

  const filtered = useMemo(() => {
    const value = keyword.trim().toLowerCase()
    if (value.length === 0) {
      return rows
    }

    return rows.filter((row) => {
      const fulltext = `${row.module} ${row.action} ${row.entity_type} ${row.actor?.email ?? ''}`.toLowerCase()
      return fulltext.includes(value)
    })
  }, [keyword, rows])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  return (
    <>
      <PageTitleBar
        title={t('pages.operationLogs.title', { defaultValue: 'Operation Logs' })}
        description={t('pages.operationLogs.description', {
          defaultValue: 'Track high-risk actions for audit and compliance verification.',
        })}
        extra={
          <Space>
            <Input.Search
              placeholder={t('pages.operationLogs.searchPlaceholder', {
                defaultValue: 'Search by module/action/email',
              })}
              allowClear
              style={{ width: 280 }}
              onSearch={(value) => setKeyword(value)}
              onChange={(event) => setKeyword(event.target.value)}
              value={keyword}
            />
            <Button onClick={() => void loadRows()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={filtered}
        pagination={{ pageSize: 12 }}
        columns={[
          {
            title: t('pages.operationLogs.columns.time', { defaultValue: 'Time' }),
            dataIndex: 'created_at',
            width: 210,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: t('pages.operationLogs.columns.actor', { defaultValue: 'Actor' }),
            dataIndex: 'actor',
            width: 220,
            render: (value: OperationLogWithActor['actor']) =>
              value?.full_name ?? value?.email ?? t('pages.operationLogs.systemActor', { defaultValue: 'System' }),
          },
          {
            title: t('pages.operationLogs.columns.module', { defaultValue: 'Module' }),
            dataIndex: 'module',
            width: 140,
            render: (value: string) => <Tag color="blue">{value}</Tag>,
          },
          {
            title: t('pages.operationLogs.columns.action', { defaultValue: 'Action' }),
            dataIndex: 'action',
            width: 160,
            render: (value: string) => <Tag>{value}</Tag>,
          },
          {
            title: t('pages.operationLogs.columns.entity', { defaultValue: 'Entity' }),
            key: 'entity',
            render: (_: unknown, row: OperationLogWithActor) => `${row.entity_type}:${row.entity_id ?? '-'}`,
          },
        ]}
      />
    </>
  )
}
