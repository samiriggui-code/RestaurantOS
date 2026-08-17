'use client'

import { useCallback, useEffect, useState } from 'react'

export function useFullscreen() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement))
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const enter = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      /* navigateur a bloqué — bouton utilisateur requis */
    }
  }, [])

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  }, [])

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) await exit()
    else await enter()
  }, [enter, exit])

  return { active, enter, exit, toggle }
}
