'use client'

import type { ReactNode } from 'react'
import type { Row, Table } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DataGrid } from './DataGrid'
import { DataGridPagination } from './DataGridPagination'
import { DataGridTable } from './DataGridTable'

type AdminDataGridShellProps<TData extends object> = {
  title: string
  subtitle?: string
  table: Table<TData>
  recordCount: number
  isLoading?: boolean
  emptyMessage?: string
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  headerExtra?: ReactNode
  className?: string
  expandedRowId?: string | null
  renderSubRow?: (row: TData) => ReactNode
  getRowClassName?: (row: Row<TData>) => string | undefined
  /** Tailles de page proposées dans le sélecteur — défaut PAGE_SIZES (10/20/50). */
  paginationSizes?: readonly number[]
}

export function AdminDataGridShell<TData extends object>({
  title,
  subtitle,
  table,
  recordCount,
  isLoading,
  emptyMessage,
  search,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  headerExtra,
  className,
  expandedRowId,
  renderSubRow,
  getRowClassName,
  paginationSizes,
}: AdminDataGridShellProps<TData>) {
  return (
    <DataGrid
      table={table}
      recordCount={recordCount}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      expandedRowId={expandedRowId}
      renderSubRow={renderSubRow}
      getRowClassName={getRowClassName}
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-[#1A1412] shadow-[0_8px_32px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-cream">
            {title}
          </h2>
          {recordCount > 0 && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tabular-nums text-cream/55">
              {recordCount}
            </span>
          )}
          {subtitle ? (
            <span className="hidden truncate text-xs text-cream/40 lg:inline">{subtitle}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange && (
            <div className="relative w-[min(100%,220px)]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
              <input
                type="search"
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-white/15 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-cream outline-none focus:border-tomato/40"
              />
            </div>
          )}
          {headerExtra}
        </div>
      </div>
      <DataGridTable />
      <DataGridPagination sizes={paginationSizes} />
    </DataGrid>
  )
}
