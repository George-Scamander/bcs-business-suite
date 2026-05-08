import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { useAuth } from '../../auth/auth-context'
import { listActiveUsers, type UserOption } from '../../shared/api/users'
import {
  createOnboardMerchant,
  listOnboardMerchants,
  searchLeadLookup,
  softDeleteOnboardMerchant,
  updateOnboardMerchant,
  type LeadLookupRow,
} from '../api'
import type { OnboardMerchant, OnboardMerchantType } from '../../../types/business'
import { supabase } from '../../../lib/supabase/client'

interface MerchantFormValues {
  lead_id?: string
  company_name: string
  onboarding_type: OnboardMerchantType
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  region?: string
  city?: string
  address?: string
  bd_owner_id?: string
  remarks?: string
}

function getTypeTagColor(type: OnboardMerchantType): string {
  if (type === 'BCS_FRANCHISE') {
    return 'red'
  }
  return 'blue'
}

export function OnboardMerchantManagementPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, roles, hasPermission } = useAuth()
  const [form] = Form.useForm<MerchantFormValues>()

  const [rows, setRows] = useState<OnboardMerchant[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [leadById, setLeadById] = useState<Record<string, { lead_code: string; company_name: string }>>({})
  const [leadOptions, setLeadOptions] = useState<LeadLookupRow[]>([])
  const [searchingLead, setSearchingLead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<OnboardMerchant | null>(null)

  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<OnboardMerchantType>()
  const [bdOwnerFilter, setBdOwnerFilter] = useState<string>()

  const isSuperAdmin = roles.includes('super_admin')
  const isProjectManager = roles.includes('project_manager')
  const canGlobalManage = isSuperAdmin || isProjectManager
  const canManage = canGlobalManage || hasPermission('onboarding.write')
  const canViewOnboardingCases = roles.includes('bd_user') || roles.includes('super_admin')
  const portalPrefix = useMemo(() => {
    if (location.pathname.includes('/app/admin/')) {
      return 'admin'
    }
    if (location.pathname.includes('/app/pm/')) {
      return 'pm'
    }
    return 'bd'
  }, [location.pathname])

  const typeOptions = useMemo(
    () => [
      {
        value: 'BCS_FRANCHISE',
        label: t('onboardMerchantType.BCS_FRANCHISE', { defaultValue: 'BCS Franchise' }),
      },
      {
        value: 'NON_BCS_PARTNER',
        label: t('onboardMerchantType.NON_BCS_PARTNER', { defaultValue: 'Non-BCS Partner' }),
      },
    ],
    [t],
  )

  const userOptions = useMemo(
    () =>
      users.map((item) => ({
        value: item.id,
        label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
      })),
    [users],
  )

  const userNameById = useMemo(
    () =>
      new Map(
        users.map((item) => [item.id, item.full_name ? `${item.full_name} (${item.email})` : item.email]),
      ),
    [users],
  )

  const leadOptionsForSelect = useMemo(
    () =>
      leadOptions.map((item) => ({
        value: item.id,
        label: `${item.lead_code} · ${item.company_name}`,
      })),
    [leadOptions],
  )

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)
    try {
      const [merchantRows, userRows] = await Promise.all([
        listOnboardMerchants({
          keyword: keyword.trim() || undefined,
          onboardingType: typeFilter,
          bdOwnerId: canGlobalManage ? bdOwnerFilter : user.id,
        }),
        listActiveUsers(),
      ])

      setRows(merchantRows)
      setUsers(userRows)

      const leadIds = [...new Set(merchantRows.map((item) => item.lead_id).filter(Boolean) as string[])]
      if (leadIds.length === 0) {
        setLeadById({})
        return
      }

      const leadResult = await supabase.from('leads').select('id, lead_code, company_name').in('id', leadIds)
      if (leadResult.error) {
        throw leadResult.error
      }

      const map: Record<string, { lead_code: string; company_name: string }> = {}
      ;(leadResult.data ?? []).forEach((row) => {
        const rowId = String(row.id)
        map[rowId] = {
          lead_code: String(row.lead_code ?? ''),
          company_name: String(row.company_name ?? ''),
        }
      })
      setLeadById(map)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchant.loadFail', { defaultValue: 'Failed to load onboard merchants' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [bdOwnerFilter, canGlobalManage, keyword, t, typeFilter, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleLeadSearch = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setLeadOptions([])
        return
      }

      setSearchingLead(true)
      try {
        const result = await searchLeadLookup(value, 20)
        setLeadOptions(result)
      } catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : t('pages.onboardMerchant.leadSearchFail', { defaultValue: 'Failed to search lead pool' })
        message.error(text)
      } finally {
        setSearchingLead(false)
      }
    },
    [t],
  )

  function openCreateModal() {
    setEditingRow(null)
    form.resetFields()
    form.setFieldsValue({
      onboarding_type: 'BCS_FRANCHISE',
      bd_owner_id: canGlobalManage ? undefined : user?.id,
    })
    setLeadOptions([])
    setModalOpen(true)
  }

  function openEditModal(row: OnboardMerchant) {
    setEditingRow(row)
    form.setFieldsValue({
      lead_id: row.lead_id ?? undefined,
      company_name: row.company_name,
      onboarding_type: row.onboarding_type,
      contact_person: row.contact_person ?? undefined,
      contact_phone: row.contact_phone ?? undefined,
      contact_email: row.contact_email ?? undefined,
      region: row.region ?? undefined,
      city: row.city ?? undefined,
      address: row.address ?? undefined,
      bd_owner_id: row.bd_owner_id ?? undefined,
      remarks: row.remarks ?? undefined,
    })

    if (row.lead_id && leadById[row.lead_id]) {
      setLeadOptions([
        {
          id: row.lead_id,
          lead_code: leadById[row.lead_id].lead_code,
          company_name: leadById[row.lead_id].company_name,
          region: row.region,
          city: row.city,
          contact_person: row.contact_person,
          contact_phone: row.contact_phone,
          contact_email: row.contact_email,
        },
      ])
    } else {
      setLeadOptions([])
    }

    setModalOpen(true)
  }

  async function handleLeadSelect(leadId: string) {
    const picked = leadOptions.find((item) => item.id === leadId)
    if (!picked) {
      return
    }

    form.setFieldsValue({
      company_name: picked.company_name,
      region: picked.region ?? undefined,
      city: picked.city ?? undefined,
      contact_person: picked.contact_person ?? undefined,
      contact_phone: picked.contact_phone ?? undefined,
      contact_email: picked.contact_email ?? undefined,
      bd_owner_id: canGlobalManage ? form.getFieldValue('bd_owner_id') : user?.id,
    })
  }

  async function handleSubmit(values: MerchantFormValues) {
    if (!user) {
      return
    }

    setSaving(true)
    try {
      if (editingRow) {
        await updateOnboardMerchant({
          id: editingRow.id,
          lead_id: values.lead_id ?? null,
          company_name: values.company_name.trim(),
          onboarding_type: values.onboarding_type,
          contact_person: values.contact_person?.trim() || null,
          contact_phone: values.contact_phone?.trim() || null,
          contact_email: values.contact_email?.trim() || null,
          region: values.region?.trim() || null,
          city: values.city?.trim() || null,
          address: values.address?.trim() || null,
          bd_owner_id: canGlobalManage ? values.bd_owner_id || null : user.id,
          remarks: values.remarks?.trim() || null,
        })

        message.success(
          t('pages.onboardMerchant.updateSuccess', {
            defaultValue: 'Onboard merchant updated successfully',
          }),
        )
      } else {
        await createOnboardMerchant({
          lead_id: values.lead_id ?? null,
          company_name: values.company_name.trim(),
          onboarding_type: values.onboarding_type,
          contact_person: values.contact_person?.trim() || null,
          contact_phone: values.contact_phone?.trim() || null,
          contact_email: values.contact_email?.trim() || null,
          region: values.region?.trim() || null,
          city: values.city?.trim() || null,
          address: values.address?.trim() || null,
          bd_owner_id: canGlobalManage ? values.bd_owner_id || null : user.id,
          remarks: values.remarks?.trim() || null,
        })

        message.success(
          t('pages.onboardMerchant.createSuccess', {
            defaultValue: 'Onboard merchant created successfully',
          }),
        )
      }

      setModalOpen(false)
      setEditingRow(null)
      form.resetFields()
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchant.saveFail', { defaultValue: 'Failed to save onboard merchant' })
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: OnboardMerchant) {
    try {
      await softDeleteOnboardMerchant(row.id)
      message.success(
        t('pages.onboardMerchant.deleteSuccess', {
          defaultValue: 'Onboard merchant deleted',
        }),
      )
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchant.deleteFail', { defaultValue: 'Failed to delete onboard merchant' })
      message.error(text)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.onboardMerchant.title', { defaultValue: 'Onboard Merchant Management' })}
        description={t('pages.onboardMerchant.description', {
          defaultValue: 'Search from lead pool or manual input to onboard BCS franchise / non-BCS partner merchants.',
        })}
        extra={
          <Space wrap>
            {canManage ? (
              <Button type="primary" onClick={openCreateModal}>
                {t('pages.onboardMerchant.new', { defaultValue: 'New Onboard Merchant' })}
              </Button>
            ) : null}
            {canViewOnboardingCases ? (
              <Button onClick={() => navigate('/app/bd/onboarding/cases')}>
                {t('pages.onboardMerchant.onboardingCases', { defaultValue: 'Onboarding Cases' })}
              </Button>
            ) : null}
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <Space wrap>
          <Input.Search
            allowClear
            style={{ width: 320 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData()}
            placeholder={t('pages.onboardMerchant.keyword', {
              defaultValue: 'Keyword (merchant no/company/region/city)',
            })}
          />
          <Select
            allowClear
            style={{ width: 220 }}
            value={typeFilter}
            options={typeOptions}
            onChange={(value) => setTypeFilter(value as OnboardMerchantType | undefined)}
            placeholder={t('pages.onboardMerchant.typeFilter', { defaultValue: 'Onboarding Type' })}
          />
          {canGlobalManage ? (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 320 }}
              value={bdOwnerFilter}
              options={userOptions}
              onChange={(value) => setBdOwnerFilter(value || undefined)}
              placeholder={t('pages.onboardMerchant.ownerFilter', { defaultValue: 'BD Owner' })}
            />
          ) : null}
          <Button type="primary" onClick={() => void loadData()}>
            {t('labels.apply', { defaultValue: 'Apply' })}
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        bordered
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          {
            title: t('pages.onboardMerchant.columns.merchantNo', { defaultValue: 'Merchant No' }),
            dataIndex: 'merchant_no',
            width: 190,
          },
          {
            title: t('pages.onboardMerchant.columns.company', { defaultValue: 'Company' }),
            dataIndex: 'company_name',
            width: 220,
          },
          {
            title: t('pages.onboardMerchant.columns.type', { defaultValue: 'Type' }),
            dataIndex: 'onboarding_type',
            width: 180,
            render: (value: OnboardMerchantType) => (
              <Tag color={getTypeTagColor(value)}>{t(`onboardMerchantType.${value}`, { defaultValue: value })}</Tag>
            ),
          },
          {
            title: t('pages.onboardMerchant.columns.lead', { defaultValue: 'Lead' }),
            dataIndex: 'lead_id',
            width: 170,
            render: (value: string | null) => {
              if (!value) {
                return '-'
              }
              const lead = leadById[value]
              return lead ? `${lead.lead_code}` : value
            },
          },
          {
            title: t('pages.onboardMerchant.columns.owner', { defaultValue: 'BD Owner' }),
            dataIndex: 'bd_owner_id',
            width: 250,
            render: (value: string | null) => (value ? userNameById.get(value) ?? value : '-'),
          },
          {
            title: t('pages.onboardMerchant.columns.region', { defaultValue: 'Region' }),
            dataIndex: 'region',
            width: 150,
            render: (value: string | null) => value || '-',
          },
          {
            title: t('pages.onboardMerchant.columns.city', { defaultValue: 'City' }),
            dataIndex: 'city',
            width: 140,
            render: (value: string | null) => value || '-',
          },
          {
            title: t('pages.onboardMerchant.columns.onboardedAt', { defaultValue: 'Onboarded At' }),
            dataIndex: 'onboarded_at',
            width: 190,
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: t('pages.onboardMerchant.columns.actions', { defaultValue: 'Actions' }),
            width: 260,
            render: (_: unknown, row: OnboardMerchant) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/app/${portalPrefix}/onboarding/merchants/${row.id}`)}>
                  {t('common.view', { defaultValue: 'View' })}
                </Button>
                {canManage ? (
                  <Button size="small" onClick={() => openEditModal(row)}>
                    {t('pages.onboardMerchant.edit', { defaultValue: 'Edit' })}
                  </Button>
                ) : null}
                {canManage ? (
                  <Popconfirm
                    title={t('pages.onboardMerchant.deleteConfirmTitle', { defaultValue: 'Delete this onboard merchant?' })}
                    description={t('pages.onboardMerchant.deleteConfirmDesc', {
                      defaultValue: 'This merchant will be hidden from active list.',
                    })}
                    okText={t('labels.delete', { defaultValue: 'Delete' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={() => void handleDelete(row)}
                  >
                    <Button size="small" danger>
                      {t('labels.delete', { defaultValue: 'Delete' })}
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={
          editingRow
            ? t('pages.onboardMerchant.editTitle', { defaultValue: 'Edit Onboard Merchant' })
            : t('pages.onboardMerchant.createTitle', { defaultValue: 'Create Onboard Merchant' })
        }
        okText={t('common.save', { defaultValue: 'Save' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        confirmLoading={saving}
        onCancel={() => {
          setModalOpen(false)
          setEditingRow(null)
        }}
        onOk={() => void form.submit()}
        width={760}
      >
        <Form<MerchantFormValues>
          layout="vertical"
          form={form}
          requiredMark={false}
          onFinish={handleSubmit}
          initialValues={{ onboarding_type: 'BCS_FRANCHISE' }}
        >
          <Form.Item name="lead_id" label={t('pages.onboardMerchant.fields.lead', { defaultValue: 'Lead from Pool' })}>
            <Select
              showSearch
              allowClear
              filterOption={false}
              options={leadOptionsForSelect}
              onSearch={(value) => void handleLeadSearch(value)}
              onChange={(value) => {
                if (typeof value === 'string') {
                  void handleLeadSelect(value)
                }
              }}
              notFoundContent={
                searchingLead
                  ? t('common.loading', { defaultValue: 'Loading...' })
                  : t('pages.onboardMerchant.leadSearchEmpty', { defaultValue: 'No lead result' })
              }
              placeholder={t('pages.onboardMerchant.fields.leadPlaceholder', {
                defaultValue: 'Search lead code / company / contact',
              })}
            />
          </Form.Item>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="company_name"
              label={t('pages.onboardMerchant.fields.company', { defaultValue: 'Company Name' })}
              rules={[
                {
                  required: true,
                  message: t('pages.onboardMerchant.companyRequired', { defaultValue: 'Company name is required' }),
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="onboarding_type"
              label={t('pages.onboardMerchant.fields.type', { defaultValue: 'Onboarding Type' })}
              rules={[
                {
                  required: true,
                  message: t('pages.onboardMerchant.typeRequired', { defaultValue: 'Onboarding type is required' }),
                },
              ]}
            >
              <Select options={typeOptions} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="contact_person" label={t('pages.onboardMerchant.fields.contactPerson', { defaultValue: 'Contact Person' })}>
              <Input />
            </Form.Item>
            <Form.Item name="contact_phone" label={t('pages.onboardMerchant.fields.contactPhone', { defaultValue: 'Contact Phone' })}>
              <Input />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="contact_email" label={t('pages.onboardMerchant.fields.contactEmail', { defaultValue: 'Contact Email' })}>
              <Input />
            </Form.Item>
            <Form.Item name="bd_owner_id" label={t('pages.onboardMerchant.fields.owner', { defaultValue: 'BD Owner' })}>
              <Select
                allowClear={canGlobalManage}
                disabled={!canGlobalManage}
                showSearch
                optionFilterProp="label"
                options={userOptions}
                placeholder={t('pages.onboardMerchant.fields.ownerPlaceholder', { defaultValue: 'Select BD owner' })}
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="region" label={t('pages.onboardMerchant.fields.region', { defaultValue: 'Region' })}>
              <Input />
            </Form.Item>
            <Form.Item name="city" label={t('pages.onboardMerchant.fields.city', { defaultValue: 'City' })}>
              <Input />
            </Form.Item>
          </div>

          <Form.Item name="address" label={t('pages.onboardMerchant.fields.address', { defaultValue: 'Address' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="remarks" label={t('pages.onboardMerchant.fields.remarks', { defaultValue: 'Remarks' })}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
