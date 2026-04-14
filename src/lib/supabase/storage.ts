import { PRIVATE_BUCKET } from '../constants'
import type { UploadFileRecord } from '../../types/rbac'
import { recordOperationLog } from './logs'
import { supabase } from './client'

export async function uploadPrivateDocument(file: File, ownerId: string): Promise<UploadFileRecord> {
  const fileExt = file.name.split('.').pop() ?? 'bin'
  const objectPath = `${ownerId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`

  const uploadResult = await supabase.storage.from(PRIVATE_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const metadataResult = await supabase
    .from('app_uploaded_files')
    .insert({
      owner_id: ownerId,
      bucket_id: PRIVATE_BUCKET,
      object_path: objectPath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select('*')
    .single<UploadFileRecord>()

  if (metadataResult.error) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([objectPath])
    throw metadataResult.error
  }

  await recordOperationLog({
    module: 'file_center',
    entityType: 'app_uploaded_files',
    entityId: metadataResult.data.id,
    action: 'upload',
    afterData: {
      file_name: metadataResult.data.file_name,
      object_path: metadataResult.data.object_path,
      size_bytes: metadataResult.data.size_bytes,
    },
  })

  return metadataResult.data
}

export async function listMyUploadedFiles(ownerId: string): Promise<UploadFileRecord[]> {
  const result = await supabase
    .from('app_uploaded_files')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return result.data as UploadFileRecord[]
}

export async function createSignedFileUrl(objectPath: string, expiresInSeconds = 120): Promise<string> {
  const result = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(objectPath, expiresInSeconds)

  if (result.error) {
    throw result.error
  }

  return result.data.signedUrl
}

export async function deleteUploadedFile(record: UploadFileRecord): Promise<void> {
  const removeResult = await supabase.storage.from(record.bucket_id).remove([record.object_path])

  if (removeResult.error) {
    throw removeResult.error
  }

  const rowResult = await supabase.from('app_uploaded_files').delete().eq('id', record.id)

  if (rowResult.error) {
    throw rowResult.error
  }

  await recordOperationLog({
    module: 'file_center',
    entityType: 'app_uploaded_files',
    entityId: record.id,
    action: 'delete',
    beforeData: {
      file_name: record.file_name,
      object_path: record.object_path,
    },
  })
}
