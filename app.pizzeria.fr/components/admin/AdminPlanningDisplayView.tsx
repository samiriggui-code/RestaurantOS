'use client'

import Link from 'next/link'
import { KitchenTeamBoard } from '@/components/kitchen/KitchenTeamBoard'

/** Écran mural TV — planning semaine (sans boutons pointage) */
export function AdminPlanningDisplayView() {
  return (
    <div className="flex min-h-screen flex-col bg-[#1a1410]">
      <KitchenTeamBoard variant="mural" className="min-h-screen" />
      <footer className="border-t border-white/10 py-4 text-center">
        <Link href="/admin/planning" className="text-sm text-cream/40 underline hover:text-cream/70">
          Retour édition planning
        </Link>
      </footer>
    </div>
  )
}
