'use client'

import { Fragment } from 'react'
import { flexRender } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDataGrid } from './DataGrid'

export function DataGridTable() {
  const { table, emptyMessage, isLoading, expandedRowId, renderSubRow, getRowClassName } =
    useDataGrid()

  const colCount = table.getAllColumns().length

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 z-[1] bg-[#221A17] text-cream/45 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-16 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-tomato-light" />
              </td>
            </tr>
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-14 text-center">
                <p className="text-sm text-cream/40">{emptyMessage}</p>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, idx) => {
              const isExpanded = expandedRowId === row.id
              return (
                <Fragment key={row.id}>
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-white/[0.06] transition-colors',
                      idx % 2 === 1 && 'bg-white/[0.015]',
                      'hover:bg-white/[0.04]',
                      isExpanded && 'bg-tomato/[0.06] hover:bg-tomato/[0.08]',
                      getRowClassName?.(row),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 align-middle text-cream/90">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderSubRow ? (
                    <tr key={`${row.id}-sub`} className="border-b border-white/[0.06] bg-[#141010]">
                      <td colSpan={colCount} className="p-0">
                        {renderSubRow(row.original)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
