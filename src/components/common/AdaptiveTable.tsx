import { Button, Card, Checkbox, Empty, Grid, List, Pagination, Radio, Space, Table, Typography } from 'antd'
import type { TableProps } from 'antd'
import type { ColumnGroupType, ColumnType, ColumnsType, TablePaginationConfig, TableRowSelection } from 'antd/es/table/interface'
import { isValidElement, type Key, type ReactNode, useMemo, useState } from 'react'

interface AdaptiveTableProps<RecordType extends object> extends TableProps<RecordType> {
  mobileCardTitleKey?: string
}

interface CardFieldEntry {
  key: string
  label: ReactNode
  value: ReactNode
}

const MOBILE_FIELD_PREVIEW_COUNT = 6

function isColumnGroup<RecordType extends object>(
  column: ColumnType<RecordType> | ColumnGroupType<RecordType>,
): column is ColumnGroupType<RecordType> {
  return Array.isArray((column as ColumnGroupType<RecordType>).children)
}

function flattenColumns<RecordType extends object>(columns: ColumnsType<RecordType>): Array<ColumnType<RecordType>> {
  const leafColumns: Array<ColumnType<RecordType>> = []

  columns.forEach((column) => {
    if (isColumnGroup(column)) {
      leafColumns.push(...flattenColumns(column.children))
      return
    }

    leafColumns.push(column)
  })

  return leafColumns
}

function getValueByDataIndex<RecordType extends object>(
  record: RecordType,
  dataIndex: ColumnType<RecordType>['dataIndex'],
): unknown {
  if (Array.isArray(dataIndex)) {
    return dataIndex.reduce<unknown>((current, segment) => {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined
      }

      return (current as Record<string, unknown>)[String(segment)]
    }, record)
  }

  if (typeof dataIndex === 'string' || typeof dataIndex === 'number') {
    return (record as Record<string, unknown>)[String(dataIndex)]
  }

  return undefined
}

function normalizeCellContent(content: unknown): ReactNode {
  if (content === null || content === undefined || content === '') {
    return <Typography.Text type="secondary">-</Typography.Text>
  }

  if (isValidElement(content)) {
    return content
  }

  if (typeof content === 'object' && content !== null && 'children' in content) {
    const renderedCell = content as { children?: ReactNode }
    return renderedCell.children ?? <Typography.Text type="secondary">-</Typography.Text>
  }

  return content as ReactNode
}

function resolveRowKey<RecordType extends object>(
  rowKey: TableProps<RecordType>['rowKey'],
  record: RecordType,
  index: number,
): Key {
  if (typeof rowKey === 'function') {
    return rowKey(record)
  }

  if (typeof rowKey === 'string') {
    const value = (record as Record<string, unknown>)[rowKey]
    return (value as Key) ?? index
  }

  const fallbackValue = (record as Record<string, unknown>).key
  return (fallbackValue as Key) ?? index
}

function resolveColumnLabel<RecordType extends object>(column: ColumnType<RecordType>, index: number): ReactNode {
  if (column.title !== undefined && column.title !== null) {
    return typeof column.title === 'function' ? `Field ${index + 1}` : column.title
  }

  if (Array.isArray(column.dataIndex)) {
    return column.dataIndex.join('.')
  }

  if (typeof column.dataIndex === 'string' || typeof column.dataIndex === 'number') {
    return String(column.dataIndex)
  }

  if (typeof column.key === 'string' || typeof column.key === 'number') {
    return String(column.key)
  }

  return `Field ${index + 1}`
}

function resolvePagination(pagination: false | TablePaginationConfig | undefined): TablePaginationConfig | null {
  if (pagination === false) {
    return null
  }

  if (pagination === undefined) {
    return {}
  }

  return pagination
}

function isSameKey(left: Key, right: Key): boolean {
  return String(left) === String(right)
}

function hasKey(keys: Key[], target: Key): boolean {
  return keys.some((key) => isSameKey(key, target))
}

function removeKey(keys: Key[], target: Key): Key[] {
  return keys.filter((key) => !isSameKey(key, target))
}

export function AdaptiveTable<RecordType extends object>(props: AdaptiveTableProps<RecordType>) {
  const {
    columns = [],
    dataSource,
    rowKey,
    onRow,
    pagination,
    loading,
    title,
    bordered,
    scroll,
    expandable,
    rowSelection,
    mobileCardTitleKey,
    ...rest
  } = props

  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const rows = useMemo(() => dataSource ?? [], [dataSource])
  const flatColumns = useMemo(() => flattenColumns(columns), [columns])
  const [mobilePage, setMobilePage] = useState(1)

  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Key[]>(() =>
    rowSelection?.defaultSelectedRowKeys ? [...rowSelection.defaultSelectedRowKeys] : [],
  )
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Key[]>([])
  const [expandedFieldKeys, setExpandedFieldKeys] = useState<Key[]>([])

  const mobilePagination = resolvePagination(pagination)
  const pageSize = mobilePagination?.pageSize ?? 10
  const total = mobilePagination?.total ?? rows.length
  const currentPage = mobilePagination?.current ?? mobilePage

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pageRows = rows.slice(startIndex, endIndex)

  const keyedRows = useMemo(
    () => rows.map((record, index) => ({ index, key: resolveRowKey(rowKey, record, index), record })),
    [rowKey, rows],
  )

  const pageKeyedRows = useMemo(
    () => pageRows.map((record, index) => ({ index: startIndex + index, key: resolveRowKey(rowKey, record, startIndex + index), record })),
    [pageRows, rowKey, startIndex],
  )

  const rowSelectionConfig = rowSelection as TableRowSelection<RecordType> | undefined
  const selectionType = rowSelectionConfig?.type === 'radio' ? 'radio' : 'checkbox'
  const selectedRowKeys = (rowSelectionConfig?.selectedRowKeys as Key[] | undefined) ?? internalSelectedKeys
  const selectedCount = selectedRowKeys.length

  const expandedKeys = (expandable?.expandedRowKeys as Key[] | undefined) ?? internalExpandedKeys

  const useCardMode = isMobile && flatColumns.length > 0

  if (!useCardMode) {
    return (
      <Table<RecordType>
        columns={columns}
        dataSource={rows}
        rowKey={rowKey}
        onRow={onRow}
        pagination={pagination}
        loading={loading}
        title={title}
        bordered={bordered}
        scroll={scroll}
        expandable={expandable}
        rowSelection={rowSelection}
        {...rest}
      />
    )
  }

  function getSelectedRowsFromKeys(keys: Key[]): RecordType[] {
    return keyedRows.filter((item) => hasKey(keys, item.key)).map((item) => item.record)
  }

  function emitSelectionChange(nextKeys: Key[], type: 'single' | 'all' | 'none' = 'single') {
    if (!rowSelectionConfig?.selectedRowKeys) {
      setInternalSelectedKeys(nextKeys)
    }

    rowSelectionConfig?.onChange?.(nextKeys, getSelectedRowsFromKeys(nextKeys), { type })
  }

  function handleToggleSelect(record: RecordType, recordKey: Key, selected: boolean) {
    if (!rowSelectionConfig) {
      return
    }

    const nextKeys =
      selectionType === 'radio'
        ? selected
          ? [recordKey]
          : []
        : selected
          ? [...selectedRowKeys, recordKey]
          : removeKey(selectedRowKeys, recordKey)

    emitSelectionChange(nextKeys, 'single')

    rowSelectionConfig.onSelect?.(record, selected, getSelectedRowsFromKeys(nextKeys), new Event('change'))

    if (selectionType === 'checkbox' && rowSelectionConfig.onSelectAll) {
      const pageRowsSelected = pageKeyedRows
        .filter((item) => hasKey(nextKeys, item.key))
        .map((item) => item.record)
      rowSelectionConfig.onSelectAll(pageRowsSelected.length === pageKeyedRows.length, pageRowsSelected, [record])
    }

    if (!rowSelectionConfig.selectedRowKeys) {
      setInternalSelectedKeys(nextKeys)
    }
  }

  function handleSelectAllCurrentPage() {
    if (!rowSelectionConfig || selectionType !== 'checkbox') {
      return
    }

    const selectableRows = pageKeyedRows.filter((item) => !rowSelectionConfig.getCheckboxProps?.(item.record)?.disabled)
    const nextKeysSet = [...selectedRowKeys]

    selectableRows.forEach((item) => {
      if (!hasKey(nextKeysSet, item.key)) {
        nextKeysSet.push(item.key)
      }
    })

    emitSelectionChange(nextKeysSet, 'all')
    rowSelectionConfig.onSelectAll?.(
      true,
      getSelectedRowsFromKeys(nextKeysSet),
      selectableRows.map((item) => item.record),
    )
  }

  function handleClearSelection() {
    if (!rowSelectionConfig) {
      return
    }

    emitSelectionChange([], 'none')
    rowSelectionConfig.onSelectNone?.()
  }

  function toggleExpanded(key: Key, record: RecordType) {
    const currentlyExpanded = hasKey(expandedKeys, key)
    const nextKeys = currentlyExpanded ? removeKey(expandedKeys, key) : [...expandedKeys, key]

    if (!expandable?.expandedRowKeys) {
      setInternalExpandedKeys(nextKeys)
    }

    expandable?.onExpand?.(!currentlyExpanded, record)
    expandable?.onExpandedRowsChange?.(nextKeys)
  }

  function toggleFieldExpansion(key: Key) {
    setExpandedFieldKeys((current) => (hasKey(current, key) ? removeKey(current, key) : [...current, key]))
  }

  return (
    <div className="adaptive-table-mobile">
      {title ? <div className="adaptive-table-mobile-title">{typeof title === 'function' ? title(pageRows) : title}</div> : null}

      {rowSelectionConfig && selectionType === 'checkbox' ? (
        <div className="adaptive-table-mobile-tools">
          <Space size={8} wrap>
            <Button size="small" onClick={handleSelectAllCurrentPage} disabled={pageRows.length === 0}>
              Select Page
            </Button>
            <Button size="small" onClick={handleClearSelection} disabled={selectedCount === 0}>
              Clear
            </Button>
            <Typography.Text type="secondary" className="text-xs">
              {selectedCount} selected
            </Typography.Text>
          </Space>
        </div>
      ) : null}

      <List
        dataSource={pageKeyedRows}
        loading={loading}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        split={false}
        renderItem={({ key, record, index }) => {
          const rowProps = onRow?.(record, index)
          const checkboxProps = rowSelectionConfig?.getCheckboxProps?.(record)
          const rowDisabled = Boolean(checkboxProps?.disabled)
          const isSelected = hasKey(selectedRowKeys, key)
          const isExpandable = Boolean(expandable?.expandedRowRender && (expandable.rowExpandable?.(record) ?? true))
          const isExpanded = hasKey(expandedKeys, key)
          const isFieldExpanded = hasKey(expandedFieldKeys, key)

          let titleIndex = -1
          let cardTitle: string | null = null

          if (mobileCardTitleKey) {
            const explicitTitle = (record as Record<string, unknown>)[mobileCardTitleKey]
            if (explicitTitle !== undefined && explicitTitle !== null && explicitTitle !== '') {
              cardTitle = String(explicitTitle)
            }
          }

          if (!cardTitle) {
            flatColumns.some((column, columnIndex) => {
              const rawValue = getValueByDataIndex(record, column.dataIndex)
              if (typeof rawValue === 'string' || typeof rawValue === 'number') {
                cardTitle = String(rawValue)
                titleIndex = columnIndex
                return true
              }
              return false
            })
          }

          const fieldEntries: CardFieldEntry[] = flatColumns
            .map((column, columnIndex) => {
              if (columnIndex === titleIndex) {
                return null
              }

              const rawValue = getValueByDataIndex(record, column.dataIndex)
              const renderedValue = column.render ? column.render(rawValue as never, record, index) : (rawValue as ReactNode)
              const isRawEmpty = rawValue === null || rawValue === undefined || rawValue === ''

              if (!column.render && isRawEmpty) {
                return null
              }

              return {
                key: `${String(column.key ?? column.dataIndex ?? columnIndex)}-${columnIndex}`,
                label: resolveColumnLabel(column, columnIndex),
                value: normalizeCellContent(renderedValue),
              }
            })
            .filter((entry): entry is CardFieldEntry => entry !== null)

          const collapsedFields =
            isFieldExpanded || fieldEntries.length <= MOBILE_FIELD_PREVIEW_COUNT
              ? fieldEntries
              : fieldEntries.slice(0, MOBILE_FIELD_PREVIEW_COUNT)

          return (
            <List.Item key={key} className="!px-0">
              <Card
                size="small"
                className={`w-full ${rowProps?.onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
                onClick={rowProps?.onClick}
              >
                <div className="adaptive-table-mobile-card-header">
                  <div className="min-w-0">
                    {cardTitle ? (
                      <Typography.Title level={5} className="!mb-0 !text-base truncate">
                        {cardTitle}
                      </Typography.Title>
                    ) : (
                      <Typography.Text className="text-sm font-semibold text-slate-900">Record #{index + 1}</Typography.Text>
                    )}
                  </div>

                  {rowSelectionConfig ? (
                    <div onClick={(event) => event.stopPropagation()}>
                      {selectionType === 'radio' ? (
                        <Radio
                          checked={isSelected}
                          disabled={rowDisabled}
                          onChange={(event) => handleToggleSelect(record, key, event.target.checked)}
                        />
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          disabled={rowDisabled}
                          onChange={(event) => handleToggleSelect(record, key, event.target.checked)}
                        />
                      )}
                    </div>
                  ) : null}
                </div>

                <Space direction="vertical" size={10} className="w-full">
                  {collapsedFields.map((entry) => (
                    <div key={entry.key} className="rounded-lg bg-slate-50 px-3 py-2">
                      <Typography.Text className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
                        {entry.label}
                      </Typography.Text>
                      <div className="text-sm text-slate-800">{entry.value}</div>
                    </div>
                  ))}
                </Space>

                {fieldEntries.length > MOBILE_FIELD_PREVIEW_COUNT ? (
                  <Button
                    type="link"
                    size="small"
                    className="adaptive-table-mobile-more-btn"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      toggleFieldExpansion(key)
                    }}
                  >
                    {isFieldExpanded
                      ? 'Show less'
                      : `Show ${fieldEntries.length - MOBILE_FIELD_PREVIEW_COUNT} more`}
                  </Button>
                ) : null}

                {isExpandable && expandable?.expandedRowRender ? (
                  <div className="adaptive-table-mobile-expand">
                    <Button
                      size="small"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleExpanded(key, record)
                      }}
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </Button>

                    {isExpanded ? (
                      <div className="adaptive-table-mobile-expand-content">
                        {expandable.expandedRowRender(record, index, 0, isExpanded)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </List.Item>
          )
        }}
      />

      {mobilePagination ? (
        <div className="mt-3 flex justify-end">
          <Pagination
            simple
            size="small"
            current={currentPage}
            pageSize={pageSize}
            total={total}
            onChange={(page) => {
              setMobilePage(page)
              mobilePagination.onChange?.(page, pageSize)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
