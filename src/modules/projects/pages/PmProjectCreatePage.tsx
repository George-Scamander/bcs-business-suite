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
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import {
  AdaptiveTable as Table,
} from '../../../components/common/AdaptiveTable'
import {
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import {
  useNavigate,
} from 'react-router-dom'
import {
  useTranslation,
} from 'react-i18next'

import {
  PageTitleBar,
} from '../../../components/common/PageTitleBar'
import {
  getTaskPriorityOptions,
  getTaskStatusOptions,
} from '../../../lib/business-constants'
import {
  useAuth,
} from '../../auth/auth-context'
import {
  listActiveUsers,
  type UserOption,
} from '../../shared/api/users'
import {
  createProject,
  listOnboardingCasesWithoutProject,
  upsertProjectTask,
} from '../api'
import type {
  OnboardingCase,
  TaskPriority,
  TaskStatus,
} from '../../../types/business'

interface CreateProjectFormValues {
  onboarding_case_id?: string
  name: string
  description?: string
  bd_owner_id?: string
  start_date?: dayjs.Dayjs
  target_end_date?: dayjs.Dayjs
}

interface DraftTask {
  key: string
  title: string
  description?: string
  assignee_id?: string
  start_date?: dayjs.Dayjs
  due_date?: dayjs.Dayjs
  priority: TaskPriority
  status: TaskStatus
  progress: number
}

interface PersistedProjectFormValues {
  onboarding_case_id?: string
  name?: string
  description?: string
  bd_owner_id?: string
  start_date?: string
  target_end_date?: string
}

interface PersistedDraftTask {
  key: string
  title: string
  description?: string
  assignee_id?: string
  start_date?: string
  due_date?: string
  priority: TaskPriority
  status: TaskStatus
  progress: number
}

interface PersistedProjectDraft {
  form: PersistedProjectFormValues
  tasks: PersistedDraftTask[]
}

interface SupabaseLikeError {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

function buildEmptyTask(index: number): DraftTask {
  return {
    key: `${Date.now()}-${index}`,
    title: '',
    description: '',
    assignee_id: undefined,
    start_date: undefined,
    due_date: undefined,
    priority: 'MEDIUM',
    status: 'TODO',
    progress: 0,
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as SupabaseLikeError

    if (supabaseError.message && supabaseError.message.trim().length > 0) {
      return supabaseError.message
    }
  }

  return fallback
}

function buildDraftStorageKey(userId: string) {
  return `pm-project-create-draft:${userId}`
}

function serializeFormValues(values: CreateProjectFormValues): PersistedProjectFormValues {
  return {
    onboarding_case_id: values.onboarding_case_id,
    name: values.name,
    description: values.description,
    bd_owner_id: values.bd_owner_id,
    start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
    target_end_date: values.target_end_date ? values.target_end_date.format('YYYY-MM-DD') : undefined,
  }
}

function serializeTasks(tasks: DraftTask[]): PersistedDraftTask[] {
  return tasks.map((task) => ({
    key: task.key,
    title: task.title,
    description: task.description,
    assignee_id: task.assignee_id,
    start_date: task.start_date ? task.start_date.format('YYYY-MM-DD') : undefined,
    due_date: task.due_date ? task.due_date.format('YYYY-MM-DD') : undefined,
    priority: task.priority,
    status: task.status,
    progress: task.progress,
  }))
}

function deserializeFormValues(values: PersistedProjectFormValues): Partial<CreateProjectFormValues> {
  return {
    onboarding_case_id: values.onboarding_case_id,
    name: values.name,
    description: values.description,
    bd_owner_id: values.bd_owner_id,
    start_date: values.start_date ? dayjs(values.start_date) : undefined,
    target_end_date: values.target_end_date ? dayjs(values.target_end_date) : undefined,
  }
}

function deserializeTasks(tasks: PersistedDraftTask[] | undefined): DraftTask[] {
  if (!tasks || tasks.length === 0) {
    return [buildEmptyTask(0)]
  }

  return tasks.map((task, index) => ({
    key: task.key || `${Date.now()}-${index}`,
    title: task.title ?? '',
    description: task.description ?? '',
    assignee_id: task.assignee_id,
    start_date: task.start_date ? dayjs(task.start_date) : undefined,
    due_date: task.due_date ? dayjs(task.due_date) : undefined,
    priority: task.priority ?? 'MEDIUM',
    status: task.status ?? 'TODO',
    progress: Number.isFinite(task.progress) ? task.progress : 0,
  }))
}

export function PmProjectCreatePage() {
  const [form] = Form.useForm<CreateProjectFormValues>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [caseOptions, setCaseOptions] = useState<OnboardingCase[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [tasks, setTasks] = useState<DraftTask[]>([buildEmptyTask(0)])
  const [draftHydrated, setDraftHydrated] = useState(false)
  const watchedFormValues = Form.useWatch([], form)

  const loadOptions = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const [cases, users] = await Promise.all([listOnboardingCasesWithoutProject(), listActiveUsers()])
      setCaseOptions(cases)
      setUserOptions(users)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmProjectCreate.loadOptionsFail', { defaultValue: 'Failed to load project creation options' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [t, user])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (!user) {
      return
    }

    const storageKey = buildDraftStorageKey(user.id)
    const rawDraft = localStorage.getItem(storageKey)

    if (!rawDraft) {
      setDraftHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(rawDraft) as PersistedProjectDraft
      form.setFieldsValue(deserializeFormValues(parsed.form ?? {}))
      setTasks(deserializeTasks(parsed.tasks))
    } catch (error) {
      console.error('Failed to parse PM project create draft', error)
      localStorage.removeItem(storageKey)
      setTasks([buildEmptyTask(0)])
    } finally {
      setDraftHydrated(true)
    }
  }, [form, user])

  useEffect(() => {
    if (!user || !draftHydrated) {
      return
    }

    const storageKey = buildDraftStorageKey(user.id)
    const payload: PersistedProjectDraft = {
      form: serializeFormValues((watchedFormValues ?? {}) as CreateProjectFormValues),
      tasks: serializeTasks(tasks),
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [draftHydrated, tasks, user, watchedFormValues])

  const caseSelectOptions = useMemo(() => {
    return caseOptions.map((item) => ({
      value: item.id,
      label: `${item.case_no} (${item.status})`,
    }))
  }, [caseOptions])

  const userSelectOptions = useMemo(() => {
    return userOptions.map((item) => ({
      value: item.id,
      label: item.full_name ? `${item.full_name} (${item.email})` : item.email,
    }))
  }, [userOptions])
  const taskPriorityOptions = useMemo(() => getTaskPriorityOptions(t), [t])
  const taskStatusOptions = useMemo(() => getTaskStatusOptions(t), [t])

  function addTaskRow() {
    setTasks((current) => [...current, buildEmptyTask(current.length)])
  }

  function removeTaskRow(key: string) {
    setTasks((current) => {
      if (current.length === 1) {
        return [buildEmptyTask(0)]
      }

      return current.filter((item) => item.key !== key)
    })
  }

  function updateTask(key: string, patch: Partial<DraftTask>) {
    setTasks((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function validateTasks(): string | null {
    const filledTasks = tasks.filter((task) => task.title.trim().length > 0)

    if (filledTasks.length === 0) {
      return null
    }

    const invalidTask = filledTasks.find((task) => task.progress < 0 || task.progress > 100)
    if (invalidTask) {
      return t('pages.pmProjectCreate.progressRangeError', { defaultValue: 'Task progress must be between 0 and 100' })
    }

    return null
  }

  async function handleSubmit(values: CreateProjectFormValues) {
    if (!user) {
      return
    }

    const taskValidationMessage = validateTasks()
    if (taskValidationMessage) {
      message.error(taskValidationMessage)
      return
    }

    setSaving(true)

    try {
      const project = await createProject({
        onboarding_case_id: values.onboarding_case_id,
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        pm_owner_id: user.id,
        bd_owner_id: values.bd_owner_id,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        target_end_date: values.target_end_date ? values.target_end_date.format('YYYY-MM-DD') : undefined,
      })

      const filledTasks = tasks.filter((task) => task.title.trim().length > 0)

      for (const task of filledTasks) {
        await upsertProjectTask({
          projectId: project.id,
          title: task.title.trim(),
          description: task.description?.trim() || undefined,
          assigneeId: task.assignee_id,
          startDate: task.start_date ? task.start_date.format('YYYY-MM-DD') : undefined,
          dueDate: task.due_date ? task.due_date.format('YYYY-MM-DD') : undefined,
          priority: task.priority,
          status: task.status,
          progress: task.progress,
        })
      }

      localStorage.removeItem(buildDraftStorageKey(user.id))
      message.success(t('pages.pmProjectCreate.createSuccess', { defaultValue: 'Project created successfully' }))
      navigate(`/app/pm/projects/${project.id}`)
    } catch (error) {
      const fallback =
        typeof error === 'object' &&
        error !== null &&
        ((error as SupabaseLikeError).message?.includes('onboarding_case_id') ||
          (error as SupabaseLikeError).details?.includes('onboarding_case_id'))
          ? t('pages.pmProjectCreate.onboardingCaseRequiredByDb', {
              defaultValue:
                'Onboarding Case is required by current database schema. Please select one, or apply the latest DB migration.',
            })
          : t('pages.pmProjectCreate.createFail', { defaultValue: 'Failed to create project' })

      message.error(extractErrorMessage(error, fallback))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={t('pages.pmProjectCreate.title', { defaultValue: 'Create Project' })}
        description={t('pages.pmProjectCreate.description', {
          defaultValue: 'PMO can create projects, assign task owners, and initialize execution tracking in one flow.',
        })}
        extra={
          <Button onClick={() => navigate('/app/pm/projects')}>
            {t('pages.pmProjectCreate.backToProjects', { defaultValue: 'Back to Projects' })}
          </Button>
        }
      />

      <Card loading={loading} className="mb-5">
        <Form<CreateProjectFormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label={t('pages.pmProjectCreate.projectName', { defaultValue: 'Project Name' })}
              rules={[{ required: true, message: t('pages.pmProjectCreate.projectNameRequired', { defaultValue: 'Project name is required' }) }]}
            >
              <Input
                placeholder={t('pages.pmProjectCreate.projectNamePlaceholder', {
                  defaultValue: 'Onboarding Delivery - PT Example Motor',
                })}
              />
            </Form.Item>

            <Form.Item
              name="onboarding_case_id"
              label={t('pages.pmProjectCreate.onboardingCaseOptional', { defaultValue: 'Onboarding Case (Optional)' })}
            >
              <Select
                showSearch
                allowClear
                placeholder={t('pages.pmProjectCreate.onboardingCasePlaceholder', {
                  defaultValue: 'Link onboarding case if available',
                })}
                options={caseSelectOptions}
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item name="bd_owner_id" label={t('pages.pmProjectCreate.linkedBdOwner', { defaultValue: 'Linked BD Owner' })}>
              <Select
                showSearch
                allowClear
                placeholder={t('pages.pmProjectCreate.selectBdOwner', { defaultValue: 'Select BD owner' })}
                options={userSelectOptions}
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item name="start_date" label={t('pages.pmProjectCreate.startDate', { defaultValue: 'Start Date' })}>
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="target_end_date" label={t('pages.pmProjectCreate.targetEndDate', { defaultValue: 'Target End Date' })}>
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="description" label={t('pages.pmProjectCreate.projectDescription', { defaultValue: 'Project Description' })}>
            <Input.TextArea
              rows={4}
              placeholder={t('pages.pmProjectCreate.projectDescriptionPlaceholder', {
                defaultValue: 'Describe scope, deliverables, and dependencies...',
              })}
            />
          </Form.Item>

          <Space wrap>
            <Button onClick={() => navigate('/app/pm/projects')}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('pages.pmProjectCreate.title', { defaultValue: 'Create Project' })}
            </Button>
          </Space>
        </Form>
      </Card>

      <Card
        title={t('pages.pmProjectCreate.initialTasksOptional', { defaultValue: 'Initial Tasks (Optional)' })}
        extra={
          <Button icon={<PlusOutlined />} onClick={addTaskRow}>
            {t('pages.pmProjectCreate.addTask', { defaultValue: 'Add Task' })}
          </Button>
        }
      >
        <Table
          rowKey="key"
          pagination={false}
          dataSource={tasks}
          locale={{ emptyText: t('pages.pmProjectCreate.noTaskDraft', { defaultValue: 'No task draft' }) }}
          scroll={{ x: 1800 }}
          columns={[
            {
              title: t('pages.pmProjectCreate.taskTitle', { defaultValue: 'Task Title' }),
              dataIndex: 'title',
              width: 260,
              render: (value: string, row: DraftTask) => (
                <Input
                  className="min-w-[220px]"
                  size="large"
                  value={value}
                  onChange={(event) => updateTask(row.key, { title: event.target.value })}
                  placeholder={t('pages.pmProjectCreate.taskTitlePlaceholder', { defaultValue: 'Task title' })}
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.assignee', { defaultValue: 'Assignee' }),
              dataIndex: 'assignee_id',
              width: 240,
              render: (value: string | undefined, row: DraftTask) => (
                <Select
                  className="min-w-[200px]"
                  size="large"
                  showSearch
                  allowClear
                  value={value}
                  options={userSelectOptions}
                  onChange={(nextValue) => updateTask(row.key, { assignee_id: nextValue })}
                  optionFilterProp="label"
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.startDate', { defaultValue: 'Start Date' }),
              dataIndex: 'start_date',
              width: 180,
              render: (value: dayjs.Dayjs | undefined, row: DraftTask) => (
                <DatePicker
                  className="min-w-[150px]"
                  size="large"
                  value={value}
                  onChange={(nextValue) => updateTask(row.key, { start_date: nextValue ?? undefined })}
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.due', { defaultValue: 'Due' }),
              dataIndex: 'due_date',
              width: 180,
              render: (value: dayjs.Dayjs | undefined, row: DraftTask) => (
                <DatePicker
                  className="min-w-[150px]"
                  size="large"
                  value={value}
                  onChange={(nextValue) => updateTask(row.key, { due_date: nextValue ?? undefined })}
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.priority', { defaultValue: 'Priority' }),
              dataIndex: 'priority',
              width: 180,
              render: (value: TaskPriority, row: DraftTask) => (
                <Select
                  className="min-w-[150px]"
                  size="large"
                  value={value}
                  options={taskPriorityOptions}
                  onChange={(nextValue) => updateTask(row.key, { priority: nextValue })}
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.status', { defaultValue: 'Status' }),
              dataIndex: 'status',
              width: 180,
              render: (value: TaskStatus, row: DraftTask) => (
                <Select
                  className="min-w-[150px]"
                  size="large"
                  value={value}
                  options={taskStatusOptions}
                  onChange={(nextValue) => updateTask(row.key, { status: nextValue })}
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.progress', { defaultValue: 'Progress' }),
              dataIndex: 'progress',
              width: 220,
              render: (value: number, row: DraftTask) => (
                <Space>
                  <InputNumber
                    className="min-w-[130px]"
                    size="large"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(nextValue) => updateTask(row.key, { progress: Number(nextValue ?? 0) })}
                  />
                  <Tag>%</Tag>
                </Space>
              ),
            },
            {
              title: t('pages.pmProjectCreate.descriptionLabel', { defaultValue: 'Description' }),
              dataIndex: 'description',
              width: 320,
              render: (value: string | undefined, row: DraftTask) => (
                <Input
                  className="min-w-[260px]"
                  size="large"
                  value={value}
                  onChange={(event) => updateTask(row.key, { description: event.target.value })}
                  placeholder={t('pages.pmProjectCreate.taskDetailPlaceholder', { defaultValue: 'Task detail' })}
                />
              ),
            },
            {
              title: t('pages.pmProjectCreate.action', { defaultValue: 'Action' }),
              width: 110,
              render: (_: unknown, row: DraftTask) => (
                <Button danger size="large" icon={<DeleteOutlined />} onClick={() => removeTaskRow(row.key)} />
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}
