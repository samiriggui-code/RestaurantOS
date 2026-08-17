'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { LovableMenuCatalog } from '@/components/menu/LovableMenuCatalog'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { fetchPublicMenu } from '@/lib/menu-api'
import type { CatalogCategory } from '@/lib/menu-types'

export function PublicMenuShowcase() {
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

  return (
    <section id="carte" className="border-t border-white/5 bg-charcoal py-20">
      {error ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-tomato-light" />
          <p className="text-cream/70">{error}</p>
        </div>
      ) : !categories ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <LovableMenuCatalog categories={categories} showHero />
      )}
    </section>
  )
}
