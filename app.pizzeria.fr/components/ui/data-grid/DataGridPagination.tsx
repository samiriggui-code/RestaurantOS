'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PAGE_SIZES } from './datagrid-standards'
import { useDataGrid } from './DataGrid'

type DataGridPaginationProps = {
  sizes?: readonly number[]
  className?: string
}

export function DataGridPagination({
  sizes = PAGE_SIZES,
  className,
}: DataGridPaginationProps) {
  const { table, recordCount } = useDataGrid()
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, recordCount)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-cream/45">
        <span>Lignes</span>
        <select
          value={pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="rounded-lg border border-white/15 bg-[#1A1412] px-2 py-1 text-cream outline-none focus:border-tomato/40"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span>par page</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-cream/50">
          <span className="font-medium text-cream/70">{from}–{to}</span> sur {recordCount}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md p-1.5 text-cream/60 hover:bg-white/5 disabled:opacity-30"
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] px-1 text-center text-xs tabular-nums text-cream/65">
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md p-1.5 text-cream/60 hover:bg-white/5 disabled:opacity-30"
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
