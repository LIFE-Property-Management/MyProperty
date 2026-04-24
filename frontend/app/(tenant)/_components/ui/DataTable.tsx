'use client'

// Tenant Portal — DataTable primitive.
// Intentionally dumb: renders headers, rows, loading state, and empty state.
// No sorting, no pagination, no internal state — consumers handle all of
// that. Rows become keyboard-activatable buttons when onRowClick is provided.
// Wrapper has overflow-x-auto so wide tables scroll horizontally on mobile
// instead of forcing a responsive column layout.

import { ReactNode, KeyboardEvent } from 'react'
import Spinner from '@/components/ui/Spinner'

export type ColumnAlign = 'left' | 'right' | 'center'

export interface Column<T> {
  key: string
  header: string
  accessor: (row: T) => ReactNode
  align?: ColumnAlign
  width?: string
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  getRowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  caption?: string
  className?: string
}

const WRAPPER_CLASSES =
  'w-full overflow-x-auto ' +
  'rounded-xl border border-[#e5e7eb] dark:border-[#30363d] ' +
  'bg-white dark:bg-[#161b22]'

const TABLE_CLASSES = 'w-full border-collapse text-sm'

const THEAD_ROW_CLASSES =
  'border-b border-[#e5e7eb] dark:border-[#30363d]'

const TH_BASE_CLASSES =
  'px-4 py-3 ' +
  'text-xs font-medium uppercase tracking-wider ' +
  'text-[#4b5563] dark:text-[#8b949e]'

const ROW_BASE_CLASSES =
  'border-b border-[#e5e7eb] dark:border-[#30363d] ' +
  'last:border-b-0 ' +
  'hover:bg-[#fbfbff] dark:hover:bg-[#1c2128] ' +
  'transition-colors duration-100'

const ROW_CLICKABLE_CLASSES =
  'cursor-pointer focus:outline-none ' +
  'focus-visible:bg-[#fbfbff] dark:focus-visible:bg-[#1c2128]'

const TD_BASE_CLASSES = 'px-4 py-3 text-[#111111] dark:text-[#f0f6fc]'

const STATE_CELL_CLASSES =
  'px-4 py-8 text-center text-[#4b5563] dark:text-[#8b949e]'

const ALIGN_CLASSES: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data',
  getRowKey,
  onRowClick,
  caption,
  className,
}: DataTableProps<T>) {
  const wrapperClasses =
    WRAPPER_CLASSES + (className ? ' ' + className : '')

  const renderBody = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={columns.length} className={STATE_CELL_CLASSES}>
            <span className="inline-flex items-center justify-center">
              <Spinner size="md" />
            </span>
          </td>
        </tr>
      )
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className={STATE_CELL_CLASSES}>
            {emptyMessage}
          </td>
        </tr>
      )
    }

    return data.map((row, index) => {
      const rowKey = getRowKey(row, index)
      const rowClasses =
        ROW_BASE_CLASSES + (onRowClick ? ' ' + ROW_CLICKABLE_CLASSES : '')

      const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
        if (!onRowClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onRowClick(row)
        }
      }

      return (
        <tr
          key={rowKey}
          className={rowClasses}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={onRowClick ? handleKeyDown : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          role={onRowClick ? 'button' : undefined}
        >
          {columns.map((column) => {
            const alignClass = ALIGN_CLASSES[column.align ?? 'left']
            const tdClasses =
              TD_BASE_CLASSES +
              ' ' +
              alignClass +
              (column.width ? ' ' + column.width : '') +
              (column.className ? ' ' + column.className : '')
            return (
              <td key={column.key} className={tdClasses}>
                {column.accessor(row)}
              </td>
            )
          })}
        </tr>
      )
    })
  }

  return (
    <div className={wrapperClasses}>
      <table className={TABLE_CLASSES}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className={THEAD_ROW_CLASSES}>
            {columns.map((column) => {
              const alignClass = ALIGN_CLASSES[column.align ?? 'left']
              const thClasses =
                TH_BASE_CLASSES +
                ' ' +
                alignClass +
                (column.width ? ' ' + column.width : '')
              return (
                <th key={column.key} scope="col" className={thClasses}>
                  {column.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>{renderBody()}</tbody>
      </table>
    </div>
  )
}

export { DataTable }
export default DataTable
