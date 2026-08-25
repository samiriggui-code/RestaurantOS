'use client'

import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { apiUrl } from '@/lib/api'

type LoyaltyBalance = {
  enabled: boolean
  points: number
  freePizzasAvailable: number
  pointsUntilNextFree: number
  pointsForFreePizza: number
}

/** 1 pt / pizza commandée — à la Nème pizza (réglage programme), une pizza est offerte. */
export function LoyaltyBalanceHint({ phone }: { phone: string }) {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null)

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setBalance(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetch(apiUrl(`/public/loyalty/balance?phone=${encodeURIComponent(digits)}`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data: LoyaltyBalance | null) => {
          if (!cancelled) setBalance(data)
        })
        .catch(() => {
          if (!cancelled) setBalance(null)
        })
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [phone])

  if (!balance?.enabled) return null

  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
      <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {balance.freePizzasAvailable > 0 ? (
        <span>
          <strong>{balance.freePizzasAvailable} pizza(s) offerte(s)</strong> disponible(s) — dites-le au
          moment de la remise/livraison ({balance.points} pts).
        </span>
      ) : (
        <span>
          {balance.points} pt(s) fidélité — encore {balance.pointsUntilNextFree} pizza(s) avant votre
          prochaine pizza offerte.
        </span>
      )}
    </div>
  )
}
