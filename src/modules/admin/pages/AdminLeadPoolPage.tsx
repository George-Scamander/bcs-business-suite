import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Popconfirm, Select, Space, Table, message } from 'antd'
import { useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { LEAD_STATUS_OPTIONS } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import { assignLead, listLeads, softDeleteLeads, type LeadFilters } from '../../leads/api'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import type { Lead } from '../../../types/business'

export function AdminLeadPoolPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [filters, setFilters] = useState<LeadFilters>({})
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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
      setSelectedIds([])
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
      message.warning('Select target user')
      return
    }

    try {
      await assignLead(selectedLead.id, selectedUserId, 'admin_pool_assignment')
      message.success('Lead assigned from pool')
      setAssignModalOpen(false)
      setSelectedLead(null)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to assign lead'
      message.error(text)
    }
  }

  async function handleBatchDelete(ids: string[]) {
    if (ids.length === 0) {
      message.warning('Please select at least one lead')
      return
    }

    try {
      await softDeleteLeads(ids)
      message.success(`Deleted ${ids.length} lead(s)`)
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to delete selected leads'
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
        title="Lead Pool Management"
        description="Operate common lead pool, triage opportunities, and dispatch to responsible BD owners."
        extra={
          <Space wrap>
            <Popconfirm
              title="Delete selected leads?"
              description="Selected leads will be moved to Recently Deleted."
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => void handleBatchDelete(selectedIds)}
            >
              <Button danger disabled={selectedIds.length === 0}>
                Delete Selected
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Delete all filtered leads?"
              description="All currently filtered leads will be moved to Recently Deleted."
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => void handleBatchDelete(rows.map((item) => item.id))}
            >
              <Button danger disabled={rows.length === 0}>
                Delete All Filtered
              </Button>
            </Popconfirm>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder="Status"
            options={LEAD_STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <Input
            placeholder="Region"
            style={{ width: 180 }}
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value || undefined }))}
          />
          <Input.Search
            allowClear
            style={{ width: 280 }}
            placeholder="Lead code / company"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
          />
          <Button type="primary" onClick={() => void loadData()}>
            Apply
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={rows}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'Lead Code', dataIndex: 'lead_code', width: 170 },
          { title: 'Company', dataIndex: 'company_name' },
          { title: 'Region', dataIndex: 'region', width: 140 },
          { title: 'Industry', dataIndex: 'industry', width: 170 },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Actions',
            width: 260,
            render: (_: unknown, row: Lead) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/app/bd/leads/${row.id}`)}>
                  View
                </Button>
                <Button size="small" onClick={() => openAssignModal(row)}>
                  Assign
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Assign from Lead Pool"
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedLead(null)
        }}
        onOk={() => void handleAssign()}
        okText="Assign"
      >
        <Space direction="vertical" className="w-full">
          <p className="mb-0 text-sm text-slate-600">Lead: {selectedLead?.lead_code}</p>
          <Select
            showSearch
            optionFilterProp="label"
            value={selectedUserId}
            options={userOptions}
            onChange={(value) => setSelectedUserId(value)}
            placeholder="Select user"
          />
        </Space>
      </Modal>
    </>
  )
}
