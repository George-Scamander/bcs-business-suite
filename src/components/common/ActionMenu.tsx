import type { ReactNode } from 'react'
import { Button, Dropdown, Modal, Space } from 'antd'
import type { MenuProps } from 'antd'
import { EllipsisOutlined } from '@ant-design/icons'

export interface ActionMenuItem {
  key: string
  label: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  icon?: ReactNode
  /** When set, clicking this item opens a Modal.confirm before calling onClick */
  confirmTitle?: string
  confirmDescription?: string
  confirmOkText?: string
}

interface ActionMenuProps {
  /** Primary action button always shown (e.g. "Detail") */
  primaryLabel?: ReactNode
  primaryOnClick?: () => void
  primaryDisabled?: boolean
  /** Secondary actions rendered inside the ⋯ Dropdown */
  items: ActionMenuItem[]
  size?: 'small' | 'middle'
}

export function ActionMenu({
  primaryLabel,
  primaryOnClick,
  primaryDisabled,
  items,
  size = 'small',
}: ActionMenuProps) {
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    danger: item.danger,
    disabled: item.disabled,
    icon: item.icon,
    onClick: () => {
      if (item.confirmTitle) {
        Modal.confirm({
          title: item.confirmTitle,
          content: item.confirmDescription,
          okText: item.confirmOkText ?? 'Confirm',
          okButtonProps: { danger: item.danger },
          cancelButtonProps: {},
          onOk: item.onClick,
        })
        return
      }
      item.onClick?.()
    },
  }))

  return (
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      {primaryLabel !== undefined ? (
        <Button size={size} onClick={primaryOnClick} disabled={primaryDisabled}>
          {primaryLabel}
        </Button>
      ) : null}
      {menuItems.length > 0 ? (
        <Dropdown
          menu={{ items: menuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button size={size} icon={<EllipsisOutlined />} aria-label="More actions" />
        </Dropdown>
      ) : null}
    </Space>
  )
}
