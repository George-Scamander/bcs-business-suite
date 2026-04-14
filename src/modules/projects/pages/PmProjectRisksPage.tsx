import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Table, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import {
  changeProjectStatus,
  getProjectById,
  listProjectTasks,
  markDelayedProjects,
} from '../api'
import type { Project, ProjectStatus, ProjectTask } from '../../../types/business'

interface RiskFormValues {
  to_status: ProjectStatus
  reason?: string
}

export function PmProjectRisksPage() {
  const [form] = Form.useForm<RiskFormValues>()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      await markDelayedProjects()
      const [projectRow, taskRows] = await Promise.all([getProjectById(projectId), listProjectTasks(projectId)])
      setProject(projectRow)
      setTasks(taskRows)
      form.setFieldsValue({
        to_status: projectRow.status,
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load risk data'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [form, projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleChangeStatus(values: RiskFormValues) {
    if (!projectId) {
      return
    }

    setSaving(true)

    try {
      await changeProjectStatus(projectId, values.to_status, values.reason)
      message.success('Project risk status updated')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to update risk status'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return tasks.filter((task) => task.status !== 'DONE' && task.due_date !== null && task.due_date < today)
  }, [tasks])

  const dueSoonTasks = useMemo(() => {
    const in3Days = new Date()
    in3Days.setDate(in3Days.getDate() + 3)
    const date = in3Days.toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    return tasks.filter((task) => task.status !== 'DONE' && task.due_date !== null && task.due_date >= today && task.due_date <= date)
  }, [tasks])

  return (
    <>
      <PageTitleBar
        title={project ? `Risk & Exceptions · ${project.project_code}` : 'Risk & Exceptions'}
        description="Monitor delay risks and apply controlled project status interventions."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {project ? (
          <div className="mb-4 flex items-center gap-4">
            <span>Current Status:</span>
            <StatusTag value={project.status} />
            {project.is_delayed ? <StatusTag value="DELAYED" /> : null}
          </div>
        ) : null}

        <Form<RiskFormValues> form={form} layout="vertical" onFinish={handleChangeStatus} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="to_status" label="Target Status" rules={[{ required: true, message: 'Select status' }]}>
              <Select
                options={[
                  { label: 'In Progress', value: 'IN_PROGRESS' },
                  { label: 'On Hold', value: 'ON_HOLD' },
                  { label: 'Delayed', value: 'DELAYED' },
                  { label: 'Completed', value: 'COMPLETED' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Describe root cause and mitigation plan." />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            Update Risk Status
          </Button>
        </Form>
      </Card>

      {overdueTasks.length > 0 ? (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={`${overdueTasks.length} overdue tasks detected`}
          description="Project delay risk is high. Please update timeline or resources."
        />
      ) : null}

      {dueSoonTasks.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message={`${dueSoonTasks.length} tasks due within 3 days`}
          description="Check dependencies and owner readiness."
        />
      ) : null}

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={overdueTasks.concat(dueSoonTasks.filter((item) => !overdueTasks.some((overdue) => overdue.id === item.id)))}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: 'Task', dataIndex: 'title' },
          { title: 'Status', dataIndex: 'status', width: 130, render: (value: string) => <StatusTag value={value} /> },
          { title: 'Due Date', dataIndex: 'due_date', width: 120, render: (value: string | null) => value ?? '-' },
          { title: 'Priority', dataIndex: 'priority', width: 110 },
        ]}
      />
    </>
  )
}
