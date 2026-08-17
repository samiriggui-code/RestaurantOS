import type { PaginationState } from '@tanstack/react-table'

/** Aligné sur le pattern gsms-school (module landing tables). */
export const PAGE_SIZES = [10, 20, 50] as const

export function createDefaultPagination(pageSize = 10): PaginationState {
  return { pageIndex: 0, pageSize }
}

export const PIZZERIA_TABLE_LAYOUT = {
  dense: false,
  rowBorder: true,
  headerBorder: true,
  headerBackground: true,
  headerSticky: false,
} as const
