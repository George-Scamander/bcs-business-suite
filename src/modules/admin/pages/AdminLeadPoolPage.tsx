import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getLeadStatusOptions } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { assignLead, listLeads, type LeadFilters } from '../../leads/api'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import type { Lead } from '../../../types/business'

export function AdminLeadPoolPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [filters, setFilters] = useState<LeadFilters>({})
  const [keyword, setKeyword] = useState('')

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>()

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [leadRows, userRows] = await Promise.all([
        listLeads({
          ...filters,
          keyword: keyword.trim() || undefined,
        }),
        listActiveUsers(),
      ])

      setRows(leadRows)
      setUsers(userRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load lead pool'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [filters, keyword])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openAssignModal(row: Lead) {
    setSelectedLead(row)
    setSelectedUserId(row.assigned_bd_id ?? undefined)
    setAssignModalOpen(true)
  }

  async function handleAssign() {
    if (!selectedLead || !selectedUserId) {
      message.warning(t('page.admin.selectTargetUser', { defaultValue: 'Select target user' }))
      return
    }

    try {
      await assignLead(selectedLead.id, selectedUserId, 'admin_pool_assignment')
      message.success(t('page.admin.leadAssignedFromPool', { defaultValue: 'Lead assigned from pool' }))
      setAssignModalOpen(false)
      setSelectedLead(null)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to assign lead'
      message.error(text)
    }
  }

  const userOptions = useMemo(() => {
    return users.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [users])

  return (
    <>
      <PageTitleBar
        title={t('page.admin.leadPoolTitle', { defaultValue: 'Lead Pool Management' })}
        description={t('page.admin.leadPoolDesc', {
          defaultValue: 'Operate common lead pool, triage opportunities, and dispatch to responsible BD owners.',
        })}
        extra={<Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder={t('page.common.status', { defaultValue: 'Status' })}
            options={getLeadStatusOptions(t)}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder={t('page.common.region', { defaultValue: 'Region' })}
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Input.Search
            allowClear
            style={{ width: 280 }}
            placeholder={t('page.admin.keywordPlaceholder', { defaultValue: 'Lead code / company' })}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            {t('page.common.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('page.admin.leadCode', { defaultValue: 'Lead Code' }), dataIndex: 'lead_code', width: 170 },
          { title: t('page.common.company', { defaultValue: 'Company' }), dataIndex: 'company_name' },
          { title: t('page.common.region', { defaultValue: 'Region' }), dataIndex: 'region', width: 140 },
          { title: t('page.common.industry', { defaultValue: 'Industry' }), dataIndex: 'industry', width: 170 },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            width: 260,
            render: (_: unknown, row: Lead) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}`)}>
                  {t('page.common.view', { defaultValue: 'View' })}
                </Button>
                <Button size="small" onClick={() => openAssignModal(row)}>
                  {t('page.common.assign', { defaultValue: 'Assign' })}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={t('page.admin.assignFromPool', { defaultValue: 'Assign from Lead Pool' })}
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedLead(null)
        }}
        onOk={() => void handleAssign()}
        okText={t('page.common.assign', { defaultValue: 'Assign' })}
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">
            {t('page.admin.leadLabel', { defaultValue: 'Lead' })}: {selectedLead?.lead_code}
          </p>
          <Select
            showSearch
            optionFilterProp="label"
            value={selectedUserId}
            options={userOptions}
            onChange={(value) => setSelectedUserId(value)}
            placeholder={t('page.admin.selectUser', { defaultValue: 'Select user' })}
          />
        </Space>
      </Modal>
    </>
  )
}
