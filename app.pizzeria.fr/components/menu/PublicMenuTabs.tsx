'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { LovableMenuCatalog } from '@/components/menu/LovableMenuCatalog'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { fetchPublicMenu } from '@/lib/menu-api'
import type { CatalogCategory } from '@/lib/menu-types'

export function PublicMenuTabs() {
  const [categories, setCategories] = useState<CatalogCategory[] | null>(null)
  const { error, setError } = useFeedbackState()

  useEffect(() => {
    let cancelled = false
    void fetchPublicMenu()
      .then((data) => {
        if (!cancelled) setCategories(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setCategories(null)
          setError(e instanceof Error ? e.message : 'Menu indisponible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [setError])

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <AlertCircle className="h-10 w-10 text-tomato-light" />
        <p className="text-cream/70">{error}</p>
        <p className="text-sm text-cream/45">Réessayez dans un instant ou contactez la pizzeria.</p>
      </div>
    )
  }

  if (!categories) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return <LovableMenuCatalog categories={categories} showHero={false} className="py-8" />
}
