import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Descriptions, Space, Table, Timeline, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import {
  getProjectById,
  listProjectMilestones,
  listProjectTasks,
  listProjectUpdates,
} from '../api'
import type { Project, ProjectMilestone, ProjectTask, ProjectUpdate } from '../../../types/business'

export function BdProjectDetailPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      const [projectRow, milestoneRows, taskRows, updateRows] = await Promise.all([
        getProjectById(projectId),
        listProjectMilestones(projectId),
        listProjectTasks(projectId),
        listProjectUpdates(projectId),
      ])

      setProject(projectRow)
      setMilestones(milestoneRows)
      setTasks(taskRows)
      setUpdates(updateRows.filter((item) => item.shared_with_bd))
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load project detail'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <>
      <PageTitleBar
        title={project ? `Project Detail · ${project.project_code}` : 'Project Detail'}
        description="BD-facing read-only execution view for customer communication and expectation management."
        extra={
          <Space>
            <Button onClick={() => navigate('/app/bd/projects')}>Back to Projects</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card loading={loading} className="mb-5">
        {project ? (
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, lg: 3 }}>
            <Descriptions.Item label="Project Code">{project.project_code}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <StatusTag value={project.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Completion">{Number(project.completion_rate).toFixed(1)}%</Descriptions.Item>
            <Descriptions.Item label="Start Date">{project.start_date ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Target End">{project.target_end_date ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Actual End">{project.actual_end_date ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Description" span={3}>
              {project.description ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Milestones">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={milestones}
            columns={[
              { title: 'Milestone', dataIndex: 'title' },
              { title: 'Planned Date', dataIndex: 'planned_date', width: 140, render: (value: string | null) => value ?? '-' },
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
            ]}
          />
        </Card>

        <Card title="Task Snapshot">
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            dataSource={tasks}
            columns={[
              { title: 'Task', dataIndex: 'title' },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 130,
                render: (value: string) => <StatusTag value={value} />,
              },
              { title: 'Due Date', dataIndex: 'due_date', width: 130, render: (value: string | null) => value ?? '-' },
            ]}
          />
        </Card>
      </div>

      <Card title="Updates Shared To BD">
        <Timeline
          items={updates.map((item) => ({
            children: (
              <div>
                <p className="mb-1 font-medium">{item.summary}</p>
                <p className="mb-0 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ),
          }))}
        />
      </Card>
    </>
  )
}
