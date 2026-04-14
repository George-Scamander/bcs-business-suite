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
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '../../../lib/business-constants'
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
      message.success('Task added')
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
      message.success('Task removed')
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
        title={project ? `Task Management · ${project.project_code}` : 'Task Management'}
        description="Break project scope into accountable tasks with deadline control."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
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
            <Form.Item name="title" label="Task Title" rules={[{ required: true, message: 'Task title is required' }]}>
              <Input />
            </Form.Item>

            <Form.Item name="assignee_id" label="Assignee">
              <Select allowClear options={memberOptions} placeholder="Select member" />
            </Form.Item>

            <Form.Item name="status" label="Status">
              <Select options={TASK_STATUS_OPTIONS} />
            </Form.Item>

            <Form.Item name="priority" label="Priority">
              <Select options={TASK_PRIORITY_OPTIONS} />
            </Form.Item>

            <Form.Item name="start_date" label="Start Date">
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="due_date" label="Due Date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            Add Task
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
          { title: 'Task', dataIndex: 'title' },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 140,
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Priority',
            dataIndex: 'priority',
            width: 110,
          },
          {
            title: 'Due Date',
            dataIndex: 'due_date',
            width: 130,
            render: (value: string | null) => value ?? '-',
          },
          {
            title: 'Actions',
            width: 260,
            render: (_: unknown, row: ProjectTask) => (
              <Space wrap>
                {row.status !== 'DONE' ? (
                  <Button size="small" onClick={() => void quickUpdateTaskStatus(row, 'DONE')}>
                    Mark Done
                  </Button>
                ) : null}
                {row.status !== 'IN_PROGRESS' ? (
                  <Button size="small" onClick={() => void quickUpdateTaskStatus(row, 'IN_PROGRESS')}>
                    In Progress
                  </Button>
                ) : null}
                <Popconfirm title="Delete this task?" onConfirm={() => void handleDeleteTask(row.id)}>
                  <Button size="small" danger>
                    Delete
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
