import { Tag } from 'antd'

const statusColorMap: Record<string, string> = {
  NEW: 'default',
  TO_FOLLOW: 'gold',
  FOLLOWING: 'blue',
  NEGOTIATING: 'orange',
  ON_HOLD: 'warning',
  LOST: 'error',
  SIGNED: 'success',
  NOT_STARTED: 'default',
  INFO_PENDING: 'gold',
  DOCUMENT_PENDING: 'orange',
  UNDER_REVIEW: 'blue',
  REVISION_REQUIRED: 'volcano',
  CONTRACT_CONFIRMED: 'geekblue',
  SERVICE_ACTIVATING: 'cyan',
  COMPLETED: 'success',
  REJECTED: 'error',
  IN_PROGRESS: 'processing',
  DELAYED: 'error',
  CLOSED: 'purple',
  TODO: 'default',
  DONE: 'success',
  CANCELLED: 'error',
}

export function StatusTag({ value }: { value: string }) {
  const color = statusColorMap[value] ?? 'default'

  return <Tag color={color}>{value}</Tag>
}
