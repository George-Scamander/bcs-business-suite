import { useCallback, useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { DeleteOutlined, EyeOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

import { PageTitleBar } from '../../../components/common/PageTitleBar'
import type { UploadFileRecord } from '../../../types/rbac'
import { createSignedFileUrl, deleteUploadedFile, listMyUploadedFiles, uploadPrivateDocument } from '../../../lib/supabase/storage'
import { useAuth } from '../../auth/auth-context'

function formatFileSize(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function FileCenterPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [rows, setRows] = useState<UploadFileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<UploadFile[]>([])

  const loadRows = useCallback(async () => {
    if (!user) {
      return
    }

    setLoading(true)
    try {
      const result = await listMyUploadedFiles(user.id)
      setRows(result)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load files'
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [user])

  async function handleUploadNow() {
    if (!user) {
      return
    }

    if (stagedFiles.length === 0) {
      message.warning(t('page.files.selectAtLeastOne', { defaultValue: 'Select at least one file' }))
      return
    }

    setUploading(true)
    try {
      for (const item of stagedFiles) {
        if (item.originFileObj) {
          await uploadPrivateDocument(item.originFileObj, user.id)
        }
      }

      message.success(t('page.files.uploadSuccess', { defaultValue: 'Files uploaded successfully' }))
      setStagedFiles([])
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Upload failed'
      message.error(text)
    } finally {
      setUploading(false)
    }
  }

  async function handlePreview(row: UploadFileRecord) {
    try {
      const signedUrl = await createSignedFileUrl(row.object_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to preview file'
      message.error(text)
    }
  }

  async function handleDelete(row: UploadFileRecord) {
    try {
      await deleteUploadedFile(row)
      message.success('File deleted')
      await loadRows()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Delete failed'
      message.error(text)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  return (
    <>
      <PageTitleBar
        title={t('page.files.title', { defaultValue: 'File Center' })}
        description={t('page.files.desc', {
          defaultValue: 'Upload private business documents with row-level and storage-level access control.',
        })}
        extra={
          <Button type="primary" icon={<UploadOutlined />} onClick={() => void handleUploadNow()} loading={uploading}>
            {t('page.files.uploadSelected', { defaultValue: 'Upload Selected' })}
          </Button>
        }
      />

      <div className="mb-5 rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <Upload.Dragger
          multiple
          fileList={stagedFiles}
          beforeUpload={() => false}
          onChange={(info) => setStagedFiles(info.fileList)}
          onRemove={(file) => {
            setStagedFiles((current) => current.filter((item) => item.uid !== file.uid))
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('page.files.dropHint', { defaultValue: 'Drop files here or click to select' })}</p>
          <p className="ant-upload-hint">
            {t('page.files.policyHint', {
              defaultValue: 'Files are uploaded to private Supabase storage bucket with access policies.',
            })}
          </p>
        </Upload.Dragger>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        bordered
        dataSource={rows}
        pagination={{ pageSize: 8 }}
        columns={[
          { title: t('page.files.fileName', { defaultValue: 'File Name' }), dataIndex: 'file_name' },
          {
            title: t('page.files.fileType', { defaultValue: 'Type' }),
            dataIndex: 'mime_type',
            render: (value: string | null) => <Tag>{value ?? t('page.files.unknown', { defaultValue: 'unknown' })}</Tag>,
          },
          {
            title: t('page.files.fileSize', { defaultValue: 'Size' }),
            dataIndex: 'size_bytes',
            render: (value: number | null) => formatFileSize(value),
          },
          {
            title: t('page.files.uploadedAt', { defaultValue: 'Uploaded At' }),
            dataIndex: 'created_at',
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: t('page.common.actions', { defaultValue: 'Actions' }),
            key: 'actions',
            render: (_value: unknown, row: UploadFileRecord) => (
              <Space>
                <Button icon={<EyeOutlined />} onClick={() => void handlePreview(row)} />
                <Button icon={<DeleteOutlined />} danger onClick={() => void handleDelete(row)} />
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
