'use client'

// Shared DataTable primitive.
//
// Intentionally dumb: renders headers, rows, loading state, and empty state.
// No sorting, no pagination, no internal state — consumers handle all of that.
// Rows become keyboard-activatable buttons when onRowClick is provided.
// Wrapper has overflow-x-auto so wide tables scroll horizontally on mobile
// instead of forcing a responsive column layout.
//
// Loading state diverges from the standard overlay pattern by design:
// the spinner replaces the tbody contents in a single full-width cell.
// When isLoading is true there is typically nothing to overlay. Background
// refetches should be driven by TanStack Query's isFetching at the consumer
// level (e.g. via keepPreviousData), not by toggling isLoading.

import { ReactNode, KeyboardEvent } from 'react'
import Spinner from '@/components/ui/Spinner'

export type ColumnAlign = 'left' | 'right' | 'center'

export interface Column<T> {
    key: string
    header: string
    accessor: (row: T) => ReactNode
    align?: ColumnAlign
    /**
     * Tailwind width class (e.g. "w-32", "w-1/4"). Concatenated into the cell's
     * className. CSS values like "120px" will NOT work — pass a Tailwind class.
     */
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
    'rounded-xl border border-border ' +
    'bg-surface'

const TABLE_CLASSES = 'w-full border-collapse text-sm'

const THEAD_ROW_CLASSES = 'border-b border-border'

const TH_BASE_CLASSES =
    'px-4 py-3 ' +
    'text-xs font-medium uppercase tracking-wider ' +
    'text-muted-text'

const ROW_BASE_CLASSES =
    'border-b border-border last:border-b-0 ' +
    'transition-colors duration-150'

const ROW_CLICKABLE_CLASSES =
    'cursor-pointer ' +
    'hover:bg-neutral-light ' +
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

const TD_BASE_CLASSES = 'px-4 py-3 text-primary-text'

const STATE_CELL_CLASSES = 'px-4 py-8 text-center text-muted-text'

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
