import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  message,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { getTaskPriorityOptions, getTaskStatusOptions } from '../../../lib/business-constants'
import { StatusTag } from '../../../components/common/StatusTag'
import {
  getProjectById,
  listProjectMembers,
  listProjectTasks,
  softDeleteProjectTask,
  upsertProjectTask,
} from '../api'
import type { Project, ProjectMember, ProjectTask, TaskPriority, TaskStatus } from '../../../types/business'

interface TaskFormValues {
  title: string
  description?: string
  assignee_id?: string
  status: TaskStatus
  priority: TaskPriority
  start_date?: dayjs.Dayjs
  due_date?: dayjs.Dayjs
}

export function PmProjectTasksPage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<TaskFormValues>()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      const [projectRow, taskRows, memberRows] = await Promise.all([
        getProjectById(projectId),
        listProjectTasks(projectId),
        listProjectMembers(projectId),
      ])
      setProject(projectRow)
      setTasks(taskRows)
      setMembers(memberRows.filter((item) => item.is_active))
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load project tasks'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAddTask(values: TaskFormValues) {
    if (!projectId) {
      return
    }

    setSaving(true)

    try {
      await upsertProjectTask({
        projectId,
        title: values.title,
        description: values.description,
        assigneeId: values.assignee_id,
        status: values.status,
        priority: values.priority,
        startDate: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        dueDate: values.due_date ? values.due_date.format('YYYY-MM-DD') : undefined,
        progress: values.status === 'DONE' ? 100 : undefined,
      })
      message.success(t('page.projectTasks.taskAdded', { defaultValue: 'Task added' }))
      form.resetFields()
      form.setFieldsValue({
        status: 'TODO',
        priority: 'MEDIUM',
      })
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to add task'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function quickUpdateTaskStatus(task: ProjectTask, status: TaskStatus) {
    if (!projectId) {
      return
    }

    try {
      await upsertProjectTask({
        id: task.id,
        projectId,
        title: task.title,
        description: task.description ?? undefined,
        assigneeId: task.assignee_id ?? undefined,
        status,
        priority: task.priority,
        startDate: task.start_date ?? undefined,
        dueDate: task.due_date ?? undefined,
        progress: status === 'DONE' ? 100 : task.progress,
      })
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to update task status'
      message.error(text)
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!projectId) {
      return
    }

    try {
      await softDeleteProjectTask(taskId, projectId)
      message.success(t('page.projectTasks.taskRemoved', { defaultValue: 'Task removed' }))
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to remove task'
      message.error(text)
    }
  }

  const memberOptions = useMemo(() => {
    return members.map((item) => ({
      value: item.user_id,
      label: `${item.user_id} · ${item.role_in_project}`,
    }))
  }, [members])

  return (
    <>
      <PageTitleBar
        title={
          project
            ? `${t('page.projectTasks.title', { defaultValue: 'Task Management' })} · ${project.project_code}`
            : t('page.projectTasks.title', { defaultValue: 'Task Management' })
        }
        description={t('page.projectTasks.desc', {
          defaultValue: 'Break project scope into accountable tasks with deadline control.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}`)}>
              {t('page.common.backToDetail', { defaultValue: 'Back to Detail' })}
            </Button>
            <Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        <Form<TaskFormValues>
          form={form}
          layout="vertical"
          onFinish={handleAddTask}
          requiredMark={false}
          initialValues={{ status: 'TODO', priority: 'MEDIUM' }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Form.Item
              name="title"
              label={t('page.projectTasks.taskTitle', { defaultValue: 'Task Title' })}
              rules={[{ required: true, message: t('page.projectTasks.taskTitleRequired', { defaultValue: 'Task title is required' }) }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name="assignee_id" label={t('page.projectTasks.assignee', { defaultValue: 'Assignee' })}>
              <Select allowClear options={memberOptions} placeholder={t('page.projectTasks.selectMember', { defaultValue: 'Select member' })} />
            </Form.Item>

            <Form.Item name="status" label={t('page.common.status', { defaultValue: 'Status' })}>
              <Select options={getTaskStatusOptions(t)} />
            </Form.Item>

            <Form.Item name="priority" label={t('page.projectTasks.priority', { defaultValue: 'Priority' })}>
              <Select options={getTaskPriorityOptions(t)} />
            </Form.Item>

            <Form.Item name="start_date" label={t('page.projectDetail.startDate', { defaultValue: 'Start Date' })}>
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="due_date" label={t('page.projectTasks.dueDate', { defaultValue: 'Due Date' })}>
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="description" label={t('page.projectDetail.descriptionField', { defaultValue: 'Description' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            {t('page.projectTasks.addTask', { defaultValue: 'Add Task' })}
          </Button>
        </Form>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={tasks}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: t('page.projectTasks.task', { defaultValue: 'Task' }), dataIndex: 'title' },
          {
            title: t('page.common.status', { defaultValue: 'Status' }),
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: t('page.projectTasks.priority', { defaultValue: 'Priority' }),
            dataIndex: 'priority',
            width: 110,
            render: (value: string) => t(`taskPriority.${value}`, { defaultValue: value }),
          },
          {
            title: t('page.projectTasks.dueDate', { defaultValue: 'Due Date' }),
            dataIndex: 'due_date',
            width: 130,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            width: 260,
            render: (_: unknown, row: ProjectTask) => (
              <Space wrap>
                {row.status !== 'DONE' ? (
                  <Button size="small" onClick={() => void quickUpdateTaskStatus(row, 'DONE')}>
                    {t('page.projectTasks.markDone', { defaultValue: 'Mark Done' })}
                  </Button>
                ) : null}
                {row.status !== 'IN_PROGRESS' ? (
                  <Button size="small" onClick={() => void quickUpdateTaskStatus(row, 'IN_PROGRESS')}>
                    {t('status.IN_PROGRESS', { defaultValue: 'In Progress' })}
                  </Button>
                ) : null}
                <Popconfirm
                  title={t('page.projectTasks.deleteConfirm', { defaultValue: 'Delete this task?' })}
                  onConfirm={() => void handleDeleteTask(row.id)}
                >
                  <Button size="small" danger>
                    {t('page.projectTasks.delete', { defaultValue: 'Delete' })}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
