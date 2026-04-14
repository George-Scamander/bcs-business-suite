import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Descriptions, Form, Input, Space, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { changeProjectStatus, getProjectById, listProjectTasks } from '../api'
import type { Project, ProjectTask } from '../../../types/business'

interface ClosureFormValues {
  closure_note?: string
}

export function PmProjectClosurePage() {
  const [form] = Form.useForm<ClosureFormValues>()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [savingComplete, setSavingComplete] = useState(false)
  const [savingClose, setSavingClose] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])

  const [deliveryChecked, setDeliveryChecked] = useState(false)
  const [acceptanceChecked, setAcceptanceChecked] = useState(false)
  const [handoverChecked, setHandoverChecked] = useState(false)

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      const [projectRow, taskRows] = await Promise.all([getProjectById(projectId), listProjectTasks(projectId)])
      setProject(projectRow)
      setTasks(taskRows)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load closure data'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const completion = useMemo(() => {
    if (tasks.length === 0) {
      return 0
    }

    const done = tasks.filter((task) => task.status === 'DONE').length
    return Number(((done / tasks.length) * 100).toFixed(1))
  }, [tasks])

  async function markCompleted(note?: string) {
    if (!projectId) {
      return
    }

    setSavingComplete(true)

    try {
      await changeProjectStatus(projectId, 'COMPLETED', note)
      message.success('Project marked as COMPLETED')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to mark completed'
      message.error(text)
    } finally {
      setSavingComplete(false)
    }
  }

  async function markClosed(note?: string) {
    if (!projectId) {
      return
    }

    setSavingClose(true)

    try {
      await changeProjectStatus(projectId, 'CLOSED', note)
      message.success('Project marked as CLOSED')
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to close project'
      message.error(text)
    } finally {
      setSavingClose(false)
    }
  }

  async function handleSubmit(values: ClosureFormValues) {
    await markCompleted(values.closure_note)
  }

  const closureReady = deliveryChecked && acceptanceChecked && handoverChecked && completion >= 100

  return (
    <>
      <PageTitleBar
        title={project ? `Delivery & Closure · ${project.project_code}` : 'Delivery & Closure'}
        description="Finalize delivery, complete acceptance checks, and close project with auditable notes."
        extra={
          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}`)}>Back to Detail</Button>
            <Button onClick={() => void loadData()}>Refresh</Button>
          </Space>
        }
      />

      <Card className="mb-5" loading={loading}>
        {project ? (
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, lg: 3 }} className="mb-4">
            <Descriptions.Item label="Project Status">
              <StatusTag value={project.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Completion by Tasks">{completion}%</Descriptions.Item>
            <Descriptions.Item label="System Completion">{Number(project.completion_rate).toFixed(1)}%</Descriptions.Item>
          </Descriptions>
        ) : null}

        {completion < 100 ? (
          <Alert
            type="warning"
            showIcon
            className="mb-4"
            message="Task completion is below 100%"
            description="Finish all open tasks before closure to ensure delivery consistency."
          />
        ) : null}

        <Form<ClosureFormValues> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Card size="small" title="Closure Checklist" className="mb-4">
            <Space direction="vertical">
              <Checkbox checked={deliveryChecked} onChange={(event) => setDeliveryChecked(event.target.checked)}>
                Delivery scope completed
              </Checkbox>
              <Checkbox checked={acceptanceChecked} onChange={(event) => setAcceptanceChecked(event.target.checked)}>
                Customer acceptance confirmed
              </Checkbox>
              <Checkbox checked={handoverChecked} onChange={(event) => setHandoverChecked(event.target.checked)}>
                Internal handover package archived
              </Checkbox>
            </Space>
          </Card>

          <Form.Item name="closure_note" label="Closure Note">
            <Input.TextArea rows={4} placeholder="Closure summary and key learnings." />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={savingComplete} disabled={!closureReady}>
              Mark COMPLETED
            </Button>
            <Button
              danger
              onClick={() => void markClosed(form.getFieldValue('closure_note'))}
              loading={savingClose}
              disabled={!closureReady || project?.status !== 'COMPLETED'}
            >
              Mark CLOSED
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  )
}
