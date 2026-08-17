'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { canAccessAdmin, homeRouteForRole } from '@/lib/roles'
import { clearCrmSession, getStaffSession, getStaffUser } from '@/lib/staff-auth'

/** Back-office CRM — ADMIN et MANAGER uniquement (session CRM dédiée). */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    function verify(): boolean {
      const session = getStaffSession('crm')
      const user = getStaffUser('crm')

      if (!session || !user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/admin')}`)
        return false
      }

      if (!canAccessAdmin(user.role)) {
        clearCrmSession()
        router.replace(homeRouteForRole(user.role))
        return false
      }

      return true
    }

    if (!verify()) {
      setOk(false)
      return
    }

    setOk(true)

    function onAuthChange() {
      if (!verify()) setOk(false)
    }

    window.addEventListener('staff-auth-changed', onAuthChange)
    window.addEventListener('storage', onAuthChange)
    return () => {
      window.removeEventListener('staff-auth-changed', onAuthChange)
      window.removeEventListener('storage', onAuthChange)
    }
  }, [router, pathname])

  if (!ok) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return <>{children}</>
}
