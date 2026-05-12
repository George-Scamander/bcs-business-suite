import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  useTranslation,
} from 'react-i18next'
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import {
  createOnboardMerchantActivity,
  getOnboardMerchant,
  listOnboardMerchantActivities,
  softDeleteOnboardMerchantActivity,
  updateOnboardMerchantActivity,
} from '../api'
import type {
  MerchantActivityStatus,
  MerchantActivityType,
  OnboardMerchant,
  OnboardMerchantActivity,
} from '../../../types/business'
import {
  supabase,
} from '../../../lib/supabase/client'

interface MerchantActivityFormValues {
  activity_type: MerchantActivityType
  status: MerchantActivityStatus
  title: string
  detail?: string
  activity_at: dayjs.Dayjs
  scheduled_at?: dayjs.Dayjs
  assignee_id?: string
}

function getActivityTypeColor(type: MerchantActivityType): string {
  if (type === 'RENOVATION_TASK') return 'orange'
  if (type === 'DELIVERY') return 'blue'
  if (type === 'SALES_ORDER') return 'purple'
  if (type === 'NOTE') return 'default'
  return 'geekblue'
}

function getActivityStatusColor(status: MerchantActivityStatus): string {
  if (status === 'DONE') return 'green'
  if (status === 'IN_PROGRESS') return 'processing'
  if (status === 'CANCELLED') return 'error'
  return 'default'
}

export function OnboardMerchantDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { merchantId } = useParams<{ merchantId: string }>()
  const { user, roles, hasPermission } = useAuth()
  const [form] = Form.useForm<MerchantActivityFormValues>()

  const [merchant, setMerchant] = useState<OnboardMerchant | null>(null)
  const [activities, setActivities] = useState<OnboardMerchantActivity[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [leadCode, setLeadCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<OnboardMerchantActivity | null>(null)

  const isSuperAdmin = roles.includes('super_admin')
  const isProjectManager = roles.includes('project_manager')

  const canManage = useMemo(() => {
    if (!user || !merchant) {
      return false
    }

    return (
      isSuperAdmin ||
      isProjectManager ||
      hasPermission('onboarding.write') ||
      merchant.bd_owner_id === user.id ||
      merchant.created_by === user.id
    )
  }, [hasPermission, isProjectManager, isSuperAdmin, merchant, user])

  const userNameById = useMemo(
    () =>
      new Map(users.map((item) => [item.id, item.full_name ? `${item.full_name} (${item.email})` : item.email])),
    [users],
  )

  const activityTypeOptions = useMemo(
    () => [
      {
        value: 'RENOVATION_TASK',
        label: t('merchantActivityType.RENOVATION_TASK', { defaultValue: 'Renovation Task' }),
      },
      {
        value: 'DELIVERY',
        label: t('merchantActivityType.DELIVERY', { defaultValue: 'Delivery' }),
      },
      {
        value: 'NOTE',
        label: t('merchantActivityType.NOTE', { defaultValue: 'Note' }),
      },
      {
        value: 'OTHER',
        label: t('merchantActivityType.OTHER', { defaultValue: 'Other' }),
      },
      {
        value: 'SALES_ORDER',
        label: t('merchantActivityType.SALES_ORDER', { defaultValue: 'Sales Order' }),
      },
    ],
    [t],
  )

  const activityStatusOptions = useMemo(
    () => [
      { value: 'PLANNED', label: t('merchantActivityStatus.PLANNED', { defaultValue: 'Planned' }) },
      { value: 'IN_PROGRESS', label: t('merchantActivityStatus.IN_PROGRESS', { defaultValue: 'In Progress' }) },
      { value: 'DONE', label: t('merchantActivityStatus.DONE', { defaultValue: 'Done' }) },
      { value: 'CANCELLED', label: t('merchantActivityStatus.CANCELLED', { defaultValue: 'Cancelled' }) },
    ],
    [t],
  )

  const portalPrefix = useMemo(() => {
    if (location.pathname.includes('/app/admin/')) {
      return 'admin'
    }
    if (location.pathname.includes('/app/pm/')) {
      return 'pm'
    }
    return 'bd'
  }, [location.pathname])

  const assigneeOptions = useMemo(
    () =>
      users.map((item) => ({
        value: item.id,
        label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
      })),
    [users],
  )

  const loadData = useCallback(async () => {
    if (!merchantId) {
      return
    }

    setLoading(true)
    try {
      const merchantRow = await getOnboardMerchant(merchantId)
      setMerchant(merchantRow)

      const [activityResult, userResult] = await Promise.allSettled([
        listOnboardMerchantActivities(merchantId),
        listActiveUsers(),
      ])

      if (activityResult.status === 'fulfilled') {
        setActivities(activityResult.value)
      } else {
        const reason = activityResult.reason as { code?: string; message?: string } | Error
        const code = typeof reason === 'object' && reason !== null && 'code' in reason ? String(reason.code ?? '') : ''
        if (code === '42P01' || code === '42501') {
          setActivities([])
        } else {
          throw activityResult.reason
        }
      }

      if (userResult.status === 'fulfilled') {
        setUsers(userResult.value)
      } else {
        setUsers([])
      }

      if (merchantRow.lead_id) {
        const leadResult = await supabase
          .from('leads')
          .select('lead_code')
          .eq('id', merchantRow.lead_id)
          .is('deleted_at', null)
          .maybeSingle()

        if (leadResult.error) {
          throw leadResult.error
        }

        setLeadCode((leadResult.data?.lead_code as string | undefined) ?? null)
      } else {
        setLeadCode(null)
      }
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchantDetail.loadFail', { defaultValue: 'Failed to load merchant detail' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [merchantId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openCreateModal(defaultType: MerchantActivityType) {
    setEditingActivity(null)
    form.resetFields()
    form.setFieldsValue({
      activity_type: defaultType,
      status: defaultType === 'NOTE' ? 'DONE' : 'PLANNED',
      activity_at: dayjs(),
      scheduled_at: undefined,
      assignee_id: undefined,
    })
    setModalOpen(true)
  }

  function openEditModal(row: OnboardMerchantActivity) {
    setEditingActivity(row)
    form.setFieldsValue({
      activity_type: row.activity_type,
      status: row.status,
      title: row.title,
      detail: row.detail ?? undefined,
      activity_at: dayjs(row.activity_at),
      scheduled_at: row.scheduled_at ? dayjs(row.scheduled_at) : undefined,
      assignee_id: row.assignee_id ?? undefined,
    })
    setModalOpen(true)
  }

  async function handleSubmit(values: MerchantActivityFormValues) {
    if (!merchantId) {
      return
    }

    setSaving(true)
    try {
      if (editingActivity) {
        await updateOnboardMerchantActivity({
          id: editingActivity.id,
          activity_at: values.activity_at.toISOString(),
          activity_type: values.activity_type,
          status: values.status,
          title: values.title.trim(),
          detail: values.detail?.trim() || null,
          scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
          assignee_id: values.assignee_id || null,
        })
        message.success(
          t('pages.onboardMerchantDetail.updateSuccess', {
            defaultValue: 'Merchant activity updated',
          }),
        )
      } else {
        await createOnboardMerchantActivity({
          merchant_id: merchantId,
          activity_type: values.activity_type,
          status: values.status,
          title: values.title.trim(),
          detail: values.detail?.trim() || null,
          activity_at: values.activity_at.toISOString(),
          scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
          assignee_id: values.assignee_id || null,
        })
        message.success(
          t('pages.onboardMerchantDetail.createSuccess', {
            defaultValue: 'Merchant activity created',
          }),
        )
      }

      setModalOpen(false)
      setEditingActivity(null)
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchantDetail.saveFail', { defaultValue: 'Failed to save merchant activity' })
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: OnboardMerchantActivity) {
    try {
      await softDeleteOnboardMerchantActivity(row.id)
      message.success(
        t('pages.onboardMerchantDetail.deleteSuccess', {
          defaultValue: 'Merchant activity deleted',
        }),
      )
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.onboardMerchantDetail.deleteFail', { defaultValue: 'Failed to delete merchant activity' })
      message.error(text)
    }
  }

  return (
    <>
      <PageTitleBar
        title={
          merchant
            ? `${merchant.merchant_no} · ${merchant.company_name}`
            : t('pages.onboardMerchantDetail.title', { defaultValue: 'Onboard Merchant Detail' })
        }
        description={t('pages.onboardMerchantDetail.description', {
          defaultValue: 'Manage merchant operations including renovation task, delivery, and synced sales activities.',
        })}
        extra={
          <Space wrap>
            <Button onClick={() => navigate(`/app/${portalPrefix}/onboarding/merchants`)}>
              {t('pages.onboardMerchantDetail.back', { defaultValue: 'Back to Merchant List' })}
            </Button>
            {canManage ? (
              <>
                <Button onClick={() => openCreateModal('RENOVATION_TASK')}>
                  {t('pages.onboardMerchantDetail.addRenovation', { defaultValue: 'Arrange Renovation Task' })}
                </Button>
                <Button onClick={() => openCreateModal('DELIVERY')}>
                  {t('pages.onboardMerchantDetail.addDelivery', { defaultValue: 'Arrange Delivery' })}
                </Button>
                <Button type="primary" onClick={() => openCreateModal('NOTE')}>
                  {t('pages.onboardMerchantDetail.addNote', { defaultValue: 'Add Merchant Note' })}
                </Button>
              </>
            ) : null}
          </Space>
        }
      />

      <Card className="mb-4" loading={loading}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label={t('pages.onboardMerchant.columns.merchantNo', { defaultValue: 'Merchant No' })}>
            {merchant?.merchant_no ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.columns.type', { defaultValue: 'Type' })}>
            {merchant ? t(`onboardMerchantType.${merchant.onboarding_type}`, { defaultValue: merchant.onboarding_type }) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.columns.company', { defaultValue: 'Company' })}>
            {merchant?.company_name ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.columns.lead', { defaultValue: 'Lead' })}>
            {leadCode ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.fields.contactPerson', { defaultValue: 'Contact Person' })}>
            {merchant?.contact_person ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.fields.contactPhone', { defaultValue: 'Contact Phone' })}>
            {merchant?.contact_phone ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.fields.contactEmail', { defaultValue: 'Contact Email' })}>
            {merchant?.contact_email ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.columns.owner', { defaultValue: 'BD Owner' })}>
            {merchant?.bd_owner_id ? userNameById.get(merchant.bd_owner_id) ?? merchant.bd_owner_id : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.columns.region', { defaultValue: 'Region' })}>
            {merchant?.region ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.onboardMerchant.columns.city', { defaultValue: 'City' })}>
            {merchant?.city ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item span={2} label={t('pages.onboardMerchant.fields.address', { defaultValue: 'Address' })}>
            {merchant?.address ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item span={2} label={t('pages.onboardMerchant.fields.remarks', { defaultValue: 'Remarks' })}>
            {merchant?.remarks ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={t('pages.onboardMerchantDetail.activities', { defaultValue: 'Merchant Activities' })}
        loading={loading}
      >
        <Table
          rowKey="id"
          pagination={{ pageSize: 10 }}
          dataSource={activities}
          scroll={{ x: 1024 }}
          columns={[
            {
              title: t('pages.onboardMerchantDetail.columns.time', { defaultValue: 'Activity Time' }),
              dataIndex: 'activity_at',
              width: 190,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('pages.onboardMerchantDetail.columns.scheduled', { defaultValue: 'Scheduled Time' }),
              dataIndex: 'scheduled_at',
              width: 190,
              render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
            },
            {
              title: t('pages.onboardMerchantDetail.columns.type', { defaultValue: 'Type' }),
              dataIndex: 'activity_type',
              width: 170,
              render: (value: MerchantActivityType) => (
                <Tag color={getActivityTypeColor(value)}>
                  {t(`merchantActivityType.${value}`, { defaultValue: value })}
                </Tag>
              ),
            },
            {
              title: t('pages.onboardMerchantDetail.columns.title', { defaultValue: 'Title' }),
              dataIndex: 'title',
              width: 260,
            },
            {
              title: t('pages.onboardMerchantDetail.columns.assignee', { defaultValue: 'Assignee' }),
              dataIndex: 'assignee_id',
              width: 220,
              render: (value: string | null) => (value ? userNameById.get(value) ?? value : '-'),
            },
            {
              title: t('pages.onboardMerchantDetail.columns.status', { defaultValue: 'Status' }),
              dataIndex: 'status',
              width: 140,
              render: (value: MerchantActivityStatus) => (
                <Tag color={getActivityStatusColor(value)}>
                  {t(`merchantActivityStatus.${value}`, { defaultValue: value })}
                </Tag>
              ),
            },
            {
              title: t('pages.onboardMerchantDetail.columns.detail', { defaultValue: 'Detail' }),
              dataIndex: 'detail',
              render: (value: string | null) => value || '-',
            },
            {
              title: t('pages.onboardMerchant.columns.actions', { defaultValue: 'Actions' }),
              width: 190,
              fixed: 'right',
              render: (_: unknown, row: OnboardMerchantActivity) => {
                if (!canManage || row.activity_type === 'SALES_ORDER') {
                  return '-'
                }

                return (
                  <Space>
                    <Button size="small" onClick={() => openEditModal(row)}>
                      {t('pages.onboardMerchant.edit', { defaultValue: 'Edit' })}
                    </Button>
                    <Popconfirm
                      title={t('pages.onboardMerchantDetail.deleteConfirmTitle', {
                        defaultValue: 'Delete this merchant activity?',
                      })}
                      description={t('pages.onboardMerchantDetail.deleteConfirmDesc', {
                        defaultValue: 'Deleted activity will be hidden from active timeline.',
                      })}
                      okText={t('labels.delete', { defaultValue: 'Delete' })}
                      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                      onConfirm={() => void handleDelete(row)}
                    >
                      <Button size="small" danger>
                        {t('labels.delete', { defaultValue: 'Delete' })}
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              },
            },
          ]}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={
          editingActivity
            ? t('pages.onboardMerchantDetail.editActivity', { defaultValue: 'Edit Merchant Activity' })
            : t('pages.onboardMerchantDetail.newActivity', { defaultValue: 'New Merchant Activity' })
        }
        okText={t('common.save', { defaultValue: 'Save' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        confirmLoading={saving}
        onCancel={() => {
          setModalOpen(false)
          setEditingActivity(null)
        }}
        onOk={() => void form.submit()}
        destroyOnClose
      >
        <Form<MerchantActivityFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          initialValues={{
            activity_type: 'NOTE',
            status: 'DONE',
            activity_at: dayjs(),
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="activity_type"
              label={t('pages.onboardMerchantDetail.fields.type', { defaultValue: 'Activity Type' })}
              rules={[{ required: true }]}
            >
              <Select
                options={activityTypeOptions.filter((option) => option.value !== 'SALES_ORDER')}
                disabled={Boolean(editingActivity && editingActivity.activity_type === 'SALES_ORDER')}
              />
            </Form.Item>
            <Form.Item
              name="status"
              label={t('pages.onboardMerchantDetail.fields.status', { defaultValue: 'Status' })}
              rules={[{ required: true }]}
            >
              <Select options={activityStatusOptions} />
            </Form.Item>
            <Form.Item
              name="activity_at"
              label={t('pages.onboardMerchantDetail.fields.activityAt', { defaultValue: 'Activity Time' })}
              rules={[{ required: true }]}
            >
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item
              name="scheduled_at"
              label={t('pages.onboardMerchantDetail.fields.scheduledAt', { defaultValue: 'Scheduled Time' })}
            >
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item
              name="assignee_id"
              label={t('pages.onboardMerchantDetail.fields.assignee', { defaultValue: 'Assignee' })}
              className="md:col-span-2"
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={assigneeOptions}
                placeholder={t('pages.onboardMerchantDetail.fields.assigneePlaceholder', {
                  defaultValue: 'Select assignee (optional)',
                })}
              />
            </Form.Item>
            <Form.Item
              name="title"
              label={t('pages.onboardMerchantDetail.fields.title', { defaultValue: 'Activity Title' })}
              className="md:col-span-2"
              rules={[
                {
                  required: true,
                  message: t('pages.onboardMerchantDetail.titleRequired', {
                    defaultValue: 'Activity title is required',
                  }),
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="detail"
              label={t('pages.onboardMerchantDetail.fields.detail', { defaultValue: 'Detail' })}
              className="md:col-span-2"
            >
              <Input.TextArea rows={4} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  )
}
