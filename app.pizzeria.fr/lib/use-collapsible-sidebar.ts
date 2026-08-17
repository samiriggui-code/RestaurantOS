'use client'

import { useCallback, useState } from 'react'

function readCollapsed(storageKey: string, defaultCollapsed: boolean): boolean {
  if (typeof window === 'undefined') return defaultCollapsed
  try {
    const raw = localStorage.getItem(`lz_sidebar_${storageKey}`)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    /* ignore */
  }
  return defaultCollapsed
}

export function useCollapsibleSidebar(storageKey: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey, defaultCollapsed))

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(`lz_sidebar_${storageKey}`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [storageKey])

  const setCollapsedPersisted = useCallback(
    (value: boolean) => {
      setCollapsed(value)
      try {
        localStorage.setItem(`lz_sidebar_${storageKey}`, value ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  return { collapsed, toggle, setCollapsed: setCollapsedPersisted }
}
