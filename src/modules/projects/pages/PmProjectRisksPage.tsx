import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Table, message } from 'antd'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      message.success(t('page.projectRisks.updated', { defaultValue: 'Project risk status updated' }))
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
        title={
          project
            ? `${t('page.projectRisks.title', { defaultValue: 'Risk & Exceptions' })} · ${project.project_code}`
            : t('page.projectRisks.title', { defaultValue: 'Risk & Exceptions' })
        }
        description={t('page.projectRisks.desc', {
          defaultValue: 'Monitor delay risks and apply controlled project status interventions.',
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
        {project ? (
          <div className="mb-4 flex items-center gap-4">
            <span>{t('page.projectRisks.currentStatus', { defaultValue: 'Current Status:' })}</span>
            <StatusTag value={project.status} />
            {project.is_delayed ? <StatusTag value="DELAYED" /> : null}
          </div>
        ) : null}

        <Form<RiskFormValues> form={form} layout="vertical" onFinish={handleChangeStatus} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="to_status"
              label={t('page.onboarding.targetStatus', { defaultValue: 'Target Status' })}
              rules={[{ required: true, message: t('page.projectRisks.selectStatus', { defaultValue: 'Select status' }) }]}
            >
              <Select
                options={[
                  { label: t('status.IN_PROGRESS', { defaultValue: 'In Progress' }), value: 'IN_PROGRESS' },
                  { label: t('status.ON_HOLD', { defaultValue: 'On Hold' }), value: 'ON_HOLD' },
                  { label: t('status.DELAYED', { defaultValue: 'Delayed' }), value: 'DELAYED' },
                  { label: t('status.COMPLETED', { defaultValue: 'Completed' }), value: 'COMPLETED' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item name="reason" label={t('page.onboarding.reason', { defaultValue: 'Reason' })}>
            <Input.TextArea rows={3} placeholder={t('page.projectRisks.reasonPlaceholder', { defaultValue: 'Describe root cause and mitigation plan.' })} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            {t('page.projectRisks.updateStatus', { defaultValue: 'Update Risk Status' })}
          </Button>
        </Form>
      </Card>

      {overdueTasks.length > 0 ? (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={t('page.projectRisks.overdueMessage', {
            defaultValue: '{{count}} overdue tasks detected',
            count: overdueTasks.length,
          })}
          description={t('page.projectRisks.overdueDesc', {
            defaultValue: 'Project delay risk is high. Please update timeline or resources.',
          })}
        />
      ) : null}

      {dueSoonTasks.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message={t('page.projectRisks.dueSoonMessage', {
            defaultValue: '{{count}} tasks due within 3 days',
            count: dueSoonTasks.length,
          })}
          description={t('page.projectRisks.dueSoonDesc', { defaultValue: 'Check dependencies and owner readiness.' })}
        />
      ) : null}

      <Table
        rowKey="id"
        loading={loading}
        bordered
        dataSource={overdueTasks.concat(dueSoonTasks.filter((item) => !overdueTasks.some((overdue) => overdue.id === item.id)))}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: t('page.projectTasks.task', { defaultValue: 'Task' }), dataIndex: 'title' },
          { title: t('page.common.status', { defaultValue: 'Status' }), dataIndex: 'status', width: 130, render: (value: string) => <StatusTag value={value} /> },
          { title: t('page.projectTasks.dueDate', { defaultValue: 'Due Date' }), dataIndex: 'due_date', width: 120, render: (value: string | null) => value ?? '-' },
          { title: t('page.projectTasks.priority', { defaultValue: 'Priority' }), dataIndex: 'priority', width: 110 },
        ]}
      />
    </>
  )
}
