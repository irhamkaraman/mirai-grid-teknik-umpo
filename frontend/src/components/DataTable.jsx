import React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Loader2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'

/**
 * Reusable DataTable component for Miraigrid SaaS V2.
 * Clean, lightweight, supporting dynamic headers, sorting, row selection, actions column, and empty state.
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  selectable = false,
  selectedKeys = [],
  onSelectRow,
  onSelectAll,
  sortColumn,
  sortDirection = 'asc',
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = 'Belum ada data yang tersedia.',
  emptyIcon: EmptyIcon = Inbox,
  actions,
  className = '',
  tableClassName = '',
}) {
  const getRowId = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row)
    return row[rowKey] !== undefined ? row[rowKey] : index
  }

  const allSelected =
    data.length > 0 &&
    data.every((row, idx) => selectedKeys.includes(getRowId(row, idx)))

  const isSomeSelected =
    data.some((row, idx) => selectedKeys.includes(getRowId(row, idx))) && !allSelected

  const handleToggleAll = () => {
    if (onSelectAll) {
      onSelectAll(!allSelected)
    }
  }

  const handleToggleRow = (e, row, idx) => {
    e.stopPropagation()
    const id = getRowId(row, idx)
    const isSelected = selectedKeys.includes(id)
    if (onSelectRow) {
      onSelectRow(id, row, !isSelected)
    }
  }

  const renderSortIndicator = (col) => {
    if (!col.sortable) return null
    const isActive = sortColumn === col.key
    if (!isActive) {
      return (
        <ArrowUpDown className="h-3 w-3 text-slate-400 group-hover:text-slate-600 ml-1.5 transition-colors" />
      )
    }
    return sortDirection === 'desc' ? (
      <ArrowDown className="h-3 w-3 text-emerald-600 ml-1.5" />
    ) : (
      <ArrowUp className="h-3 w-3 text-emerald-600 ml-1.5" />
    )
  }

  return (
    <div
      className={twMerge(
        'w-full overflow-hidden bg-white border border-slate-200/90 rounded-xl shadow-xs font-sans',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className={twMerge('w-full text-left border-collapse', tableClassName)}>
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200/80">
              {selectable && (
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected
                    }}
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer transition"
                    aria-label="Pilih semua baris"
                  />
                </th>
              )}

              {columns.map((col) => {
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left'

                return (
                  <th
                    key={col.key || col.label}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => col.sortable && onSort && onSort(col.key)}
                    className={twMerge(
                      clsx(
                        'px-4 py-3 select-none font-semibold text-slate-600',
                        alignClass,
                        col.sortable && 'cursor-pointer group hover:bg-slate-100/70 transition-colors',
                        col.headerClassName
                      )
                    )}
                  >
                    <div
                      className={clsx(
                        'inline-flex items-center',
                        col.align === 'center' && 'justify-center',
                        col.align === 'right' && 'justify-end'
                      )}
                    >
                      <span>{col.label}</span>
                      {renderSortIndicator(col)}
                    </div>
                  </th>
                )
              })}

              {actions && (
                <th className="px-4 py-3 text-right font-semibold text-slate-600 w-24">
                  Aksi
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center space-y-2.5">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium text-slate-500">Memuat data...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <EmptyIcon className="h-8 w-8 text-slate-300" />
                    <p className="text-xs text-slate-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const id = getRowId(row, idx)
                const isSelected = selectedKeys.includes(id)

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={clsx(
                      'border-b border-slate-100 hover:bg-slate-50/70 transition-colors',
                      isSelected && 'bg-emerald-50/40 hover:bg-emerald-50/60',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleRow(e, row, idx)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer transition"
                          aria-label={`Pilih baris ${id}`}
                        />
                      </td>
                    )}

                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                          ? 'text-right'
                          : 'text-left'

                      const val = col.key ? row[col.key] : undefined
                      const cellContent = col.render ? col.render(val, row, idx) : val

                      return (
                        <td
                          key={col.key || col.label}
                          className={twMerge(
                            clsx('px-4 py-3.5 text-slate-700 text-xs sm:text-sm', alignClass, col.className)
                          )}
                        >
                          {cellContent}
                        </td>
                      )
                    })}

                    {actions && (
                      <td
                        className="px-4 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions(row, idx)}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
