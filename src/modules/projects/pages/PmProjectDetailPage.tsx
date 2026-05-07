import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Descriptions, Form, Input, Popconfirm, Space, Timeline, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { addProjectUpdate, getProjectById, listProjectUpdates, softDeleteProject, updateProject } from '../api'
import type { Project, ProjectUpdate } from '../../../types/business'

interface DetailFormValues {
  name: string
  description?: string
  target_end_date?: dayjs.Dayjs
  delay_reason?: string
}

interface UpdateFormValues {
  summary: string
}

export function PmProjectDetailPage() {
  const [detailForm] = Form.useForm<DetailFormValues>()
  const [updateForm] = Form.useForm<UpdateFormValues>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])

  const loadData = useCallback(async () => {
    if (!projectId) {
      return
    }

    setLoading(true)

    try {
      const [projectRow, updateRows] = await Promise.all([getProjectById(projectId), listProjectUpdates(projectId)])
      setProject(projectRow)
      setUpdates(updateRows)
      detailForm.setFieldsValue({
        name: projectRow.name,
        description: projectRow.description ?? undefined,
        target_end_date: projectRow.target_end_date ? dayjs(projectRow.target_end_date) : undefined,
        delay_reason: projectRow.delay_reason ?? undefined,
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjectDetail.loadFail', { defaultValue: 'Failed to load project detail' })
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [detailForm, projectId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSaveDetail(values: DetailFormValues) {
    if (!projectId) {
      return
    }

    setSaving(true)

    try {
      await updateProject({
        id: projectId,
        name: values.name,
        description: values.description,
        target_end_date: values.target_end_date ? values.target_end_date.format('YYYY-MM-DD') : null,
        delay_reason: values.delay_reason ?? null,
      })
      message.success(t('pages.pmProjectDetail.updateSuccess', { defaultValue: 'Project detail updated' }))
      await loadData()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t('pages.pmProjectDetail.updateFail', { defaultValue: 'Failed to update project detail' })
      message.error(text)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddUpdate(values: UpdateFormValues) {
    if (!projectId) {
      return
    }

    setUpdating(true)

    try {
      await addProjectUpdate(projectId, values.summary)
      message.success(t('pages.pmProjectDetail.addUpdateSuccess', { defaultValue: 'Project update added and shared to BD' }))
      updateForm.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjectDetail.addUpdateFail', { defaultValue: 'Failed to add project update' })
      message.error(text)
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteProject() {
    if (!projectId) {
      return
    }

    try {
      await softDeleteProject(projectId)
      message.success(t('pages.pmProjectDetail.deleteSuccess', { defaultValue: 'Project moved to Recently Deleted' }))
      navigate('/app/pm/projects')
    } catch (error) {
      const text = error instanceof Error ? error.message : t('pages.pmProjectDetail.deleteFail', { defaultValue: 'Failed to delete project' })
      message.error(text)
    }
  }

  return (
    <>
      <PageTitleBar
        title={
          project
            ? `${t('pages.pmProjectDetail.title', { defaultValue: 'Project Detail' })} · ${project.project_code}`
            : t('pages.pmProjectDetail.title', { defaultValue: 'Project Detail' })
        }
        description={t('pages.pmProjectDetail.description', {
          defaultValue: 'Maintain project base profile and publish progress summaries for BD sync.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate('/app/pm/projects')}>
              {t('pages.pmProjectDetail.backToList', { defaultValue: 'Back to List' })}
            </Button>
            <Button onClick={() => void loadData()}>{t('labels.refresh', { defaultValue: 'Refresh' })}</Button>
            <Popconfirm
              title={t('pages.pmProjectDetail.deleteConfirmTitle', { defaultValue: 'Delete this project?' })}
              description={t('pages.pmProjectDetail.deleteConfirmDesc', { defaultValue: 'The project will be moved to Recently Deleted.' })}
              okText={t('labels.delete', { defaultValue: 'Delete' })}
              cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
              onConfirm={() => void handleDeleteProject()}
            >
              <Button danger>{t('labels.delete', { defaultValue: 'Delete' })}</Button>
            </Popconfirm>
          </Space>
        }
      />

      <Card loading={loading} className="mb-5">
        {project ? (
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, lg: 3 }} className="mb-4">
            <Descriptions.Item label={t('pages.pmProjectDetail.projectCode', { defaultValue: 'Project Code' })}>
              {project.project_code}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.pmProjectDetail.status', { defaultValue: 'Status' })}>
              <StatusTag value={project.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.pmProjectDetail.completion', { defaultValue: 'Completion' })}>
              {Number(project.completion_rate).toFixed(1)}%
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.pmProjectDetail.startDate', { defaultValue: 'Start Date' })}>
              {project.start_date ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.pmProjectDetail.targetEnd', { defaultValue: 'Target End' })}>
              {project.target_end_date ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.pmProjectDetail.actualEnd', { defaultValue: 'Actual End' })}>
              {project.actual_end_date ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        <Form<DetailFormValues> form={detailForm} layout="vertical" onFinish={handleSaveDetail} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label={t('pages.pmProjectDetail.projectName', { defaultValue: 'Project Name' })}
              rules={[{ required: true, message: t('pages.pmProjectDetail.projectNameRequired', { defaultValue: 'Project name is required' }) }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="target_end_date" label={t('pages.pmProjectDetail.targetEndDate', { defaultValue: 'Target End Date' })}>
              <DatePicker className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="description" label={t('pages.pmProjectDetail.descriptionLabel', { defaultValue: 'Description' })}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="delay_reason" label={t('pages.pmProjectDetail.delayReason', { defaultValue: 'Delay Reason' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}/progress`)}>
              {t('pages.pmProjectDetail.goToProgress', { defaultValue: 'Go to Progress' })}
            </Button>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}/tasks`)}>
              {t('pages.pmProjects.actionTasks', { defaultValue: 'Tasks' })}
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('pages.pmProjectDetail.saveDetail', { defaultValue: 'Save Detail' })}
            </Button>
          </Space>
        </Form>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('pages.pmProjectDetail.publishUpdateToBd', { defaultValue: 'Publish Update to BD' })}>
          <Form<UpdateFormValues> form={updateForm} layout="vertical" onFinish={handleAddUpdate} requiredMark={false}>
            <Form.Item
              name="summary"
              label={t('pages.pmProjectDetail.summary', { defaultValue: 'Summary' })}
              rules={[{ required: true, message: t('pages.pmProjectDetail.summaryRequired', { defaultValue: 'Summary is required' }) }]}
            >
              <Input.TextArea
                rows={4}
                placeholder={t('pages.pmProjectDetail.summaryPlaceholder', {
                  defaultValue: 'Site readiness reached 70%; equipment installation starts next Monday.',
                })}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={updating}>
              {t('pages.pmProjectDetail.publishUpdate', { defaultValue: 'Publish Update' })}
            </Button>
          </Form>
        </Card>

        <Card title={t('pages.pmProjectDetail.publishedUpdates', { defaultValue: 'Published Updates' })}>
          <Timeline
            items={updates.map((item) => ({
              color: item.shared_with_bd ? 'blue' : 'gray',
              children: (
                <div>
                  <p className="mb-1 font-medium">{item.summary}</p>
                  <p className="mb-0 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              ),
            }))}
          />
        </Card>
      </div>
    </>
  )
}
