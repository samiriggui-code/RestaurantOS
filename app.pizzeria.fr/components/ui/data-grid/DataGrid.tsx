'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Row, Table } from '@tanstack/react-table'

export type DataGridContextValue<TData extends object> = {
  table: Table<TData>
  recordCount: number
  isLoading?: boolean
  emptyMessage?: string
  expandedRowId?: string | null
  renderSubRow?: (row: TData) => ReactNode
  getRowClassName?: (row: Row<TData>) => string | undefined
}

const DataGridContext = createContext<DataGridContextValue<object> | null>(null)

export function DataGrid<TData extends object>({
  table,
  recordCount,
  isLoading,
  emptyMessage = 'Aucune donnée',
  expandedRowId,
  renderSubRow,
  getRowClassName,
  children,
  className,
}: DataGridContextValue<TData> & { children: ReactNode; className?: string }) {
  return (
    <DataGridContext.Provider
      value={{
        table: table as unknown as Table<object>,
        recordCount,
        isLoading,
        emptyMessage,
        expandedRowId,
        renderSubRow: renderSubRow as ((row: object) => ReactNode) | undefined,
        getRowClassName: getRowClassName as ((row: Row<object>) => string | undefined) | undefined,
      }}
    >
      <div className={className}>{children}</div>
    </DataGridContext.Provider>
  )
}

export function useDataGrid<TData extends object = Record<string, unknown>>() {
  const ctx = useContext(DataGridContext)
  if (!ctx) throw new Error('useDataGrid must be used within DataGrid')
  return ctx as unknown as DataGridContextValue<TData>
}
