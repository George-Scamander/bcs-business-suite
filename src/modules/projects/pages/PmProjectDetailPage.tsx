import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Descriptions, Form, Input, Space, Timeline, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import { StatusTag } from '../../../components/common/StatusTag'
import { addProjectUpdate, getProjectById, listProjectUpdates, updateProject } from '../api'
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
  const { t } = useTranslation()
  const [detailForm] = Form.useForm<DetailFormValues>()
  const [updateForm] = Form.useForm<UpdateFormValues>()
  const navigate = useNavigate()
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
      const text = error instanceof Error ? error.message : 'Failed to load project detail'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [detailForm, projectId])

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
      message.success(t('page.projectDetail.updated', { defaultValue: 'Project detail updated' }))
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to update project detail'
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
      message.success(t('page.projectDetail.updatePublished', { defaultValue: 'Project update added and shared to BD' }))
      updateForm.resetFields()
      await loadData()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to add project update'
      message.error(text)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <PageTitleBar
        title={
          project
            ? `${t('page.projectDetail.title', { defaultValue: 'Project Detail' })} · ${project.project_code}`
            : t('page.projectDetail.title', { defaultValue: 'Project Detail' })
        }
        description={t('page.projectDetail.desc', {
          defaultValue: 'Maintain project base profile and publish progress summaries for BD sync.',
        })}
        extra={
          <Space>
            <Button onClick={() => navigate('/app/pm/projects')}>
              {t('page.common.backToList', { defaultValue: 'Back to List' })}
            </Button>
            <Button onClick={() => void loadData()}>{t('page.common.refresh', { defaultValue: 'Refresh' })}</Button>
          </Space>
        }
      />

      <Card loading={loading} className="mb-5">
        {project ? (
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, lg: 3 }} className="mb-4">
            <Descriptions.Item label={t('page.pm.projectCode', { defaultValue: 'Project Code' })}>{project.project_code}</Descriptions.Item>
            <Descriptions.Item label={t('page.common.status', { defaultValue: 'Status' })}>
              <StatusTag value={project.status} />
            </Descriptions.Item>
            <Descriptions.Item label={t('page.projectOverview.completion', { defaultValue: 'Completion' })}>
              {Number(project.completion_rate).toFixed(1)}%
            </Descriptions.Item>
            <Descriptions.Item label={t('page.projectDetail.startDate', { defaultValue: 'Start Date' })}>{project.start_date ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('page.projectOverview.targetEnd', { defaultValue: 'Target End' })}>{project.target_end_date ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('page.projectDetail.actualEnd', { defaultValue: 'Actual End' })}>{project.actual_end_date ?? '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}

        <Form<DetailFormValues> form={detailForm} layout="vertical" onFinish={handleSaveDetail} requiredMark={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label={t('page.pm.projectName', { defaultValue: 'Project Name' })}
              rules={[{ required: true, message: t('page.projectDetail.nameRequired', { defaultValue: 'Project name is required' }) }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="target_end_date" label={t('page.projectDetail.targetEndDate', { defaultValue: 'Target End Date' })}>
              <DatePicker className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="description" label={t('page.projectDetail.descriptionField', { defaultValue: 'Description' })}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="delay_reason" label={t('page.projectDetail.delayReason', { defaultValue: 'Delay Reason' })}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Space>
            <Button onClick={() => navigate(`/app/pm/projects/${projectId}/progress`)}>
              {t('page.projectDetail.goToProgress', { defaultValue: 'Go to Progress' })}
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('page.projectDetail.saveDetail', { defaultValue: 'Save Detail' })}
            </Button>
          </Space>
        </Form>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('page.projectDetail.publishUpdate', { defaultValue: 'Publish Update to BD' })}>
          <Form<UpdateFormValues> form={updateForm} layout="vertical" onFinish={handleAddUpdate} requiredMark={false}>
            <Form.Item
              name="summary"
              label={t('page.leads.summary', { defaultValue: 'Summary' })}
              rules={[{ required: true, message: t('page.leads.summaryRequired', { defaultValue: 'Summary is required' }) }]}
            >
              <Input.TextArea
                rows={4}
                placeholder={t('page.projectDetail.updatePlaceholder', {
                  defaultValue: 'Site readiness reached 70%; equipment installation starts next Monday.',
                })}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={updating}>
              {t('page.projectDetail.publish', { defaultValue: 'Publish Update' })}
            </Button>
          </Form>
        </Card>

        <Card title={t('page.projectDetail.publishedUpdates', { defaultValue: 'Published Updates' })}>
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
