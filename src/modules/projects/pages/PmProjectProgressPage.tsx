import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Form, Input, InputNumber, Progress, Space, Table, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import {
  getProjectById,
  listProjectMilestones,
  refreshProjectProgress,
  upsertProjectMilestone,
} from '../api'
import type { Project, ProjectMilestone } from '../../../types/business'

interface MilestoneFormValues {
  title: string
  description?: string
  planned_date?: dayjs.Dayjs
  progress?: number
}

export function PmProjectProgressPage() {
  const [form] = Form.useForm<MilestoneFormValues>()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      await refreshProjectProgress(projectId)
      const [projectRow, milestoneRows] = await Promise.all([getProjectById(projectId), listProjectMilestones(projectId)])
      setProject(projectRow)
      setMilestones(milestoneRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load progress data'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAddMilestone(values: MilestoneFormValues) {
    if (!projectId) {
      return
    }

    setSaving(true)

    try {
      await upsertProjectMilestone({
        projectId,
        title: values.title,
        description: values.description,
        plannedDate: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined,
        progress: values.progress ?? 0,
        sortOrder: milestones.length + 1,
      })
      message.success('Milestone added')
      form.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to add milestone'
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={project ? `Project Progress · ${project.project_code}` : 'Project Progress'}
        description="Maintain milestone trajectory and completion curve for active delivery."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {project ? (
          <div>
            <div className="mb-3 flex items-center gap-4">
              <StatusTag value={project.status} />
              <span className="text-sm text-slate-600">Completion: {Number(project.completion_rate).toFixed(1)}%</span>
            </div>
            <Progress percent={Number(Number(project.completion_rate).toFixed(1))} />
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Add Milestone">
          <Form<MilestoneFormValues> form={form} layout="vertical" onFinish={handleAddMilestone} requiredMark={false}>
            <Form.Item name="title" label="Milestone Title" rules={[{ required: true, message: 'Title is required' }]}>
              <Input />
            </Form.Item>

            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} />
            </Form.Item>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Form.Item name="planned_date" label="Planned Date">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item name="progress" label="Initial Progress">
                <InputNumber min={0} max={100} className="w-full" />
              </Form.Item>
            </div>

            <Button type="primary" htmlType="submit" loading={saving}>
              Add Milestone
            </Button>
          </Form>
        </Card>

        <Card title="Milestone Timeline">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={milestones}
            columns={[
              { title: 'Order', dataIndex: 'sort_order', width: 70 },
              { title: 'Milestone', dataIndex: 'title' },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 130,
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: 'Progress',
                dataIndex: 'progress',
                width: 110,
                render: (value: number) => `${Number(value ?? 0).toFixed(0)}%`,
              },
              { title: 'Planned', dataIndex: 'planned_date', width: 120, render: (value: string | null) => value ?? '-' },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
