'use client'

import { flexRender, type Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDataGrid } from './DataGrid'

type DataGridColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function DataGridColumnHeader<TData extends object, TValue>({
  column,
  title,
  className,
}: DataGridColumnHeaderProps<TData, TValue>) {
  const { isLoading, recordCount } = useDataGrid<TData>()

  if (!column.getCanSort()) {
    return (
      <span className={cn('text-xs font-medium uppercase tracking-wide text-cream/45', className)}>
        {title}
      </span>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <button
      type="button"
      disabled={isLoading || recordCount === 0}
      onClick={() => {
        if (sorted === 'asc') column.toggleSorting(true)
        else if (sorted === 'desc') column.clearSorting()
        else column.toggleSorting(false)
      }}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-cream/45 hover:text-cream/70 disabled:opacity-40',
        className
      )}
    >
      {title}
      {sorted === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : sorted === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  )
}
