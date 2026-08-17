'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'

export function StaffGate({
  children,
  redirectTo = '/admin',
}: {
  children: React.ReactNode
  redirectTo?: string
}) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!getStaffSession()) {
      router.replace(`/login?next=${encodeURIComponent(redirectTo)}`)
      return
    }
    setOk(true)
  }, [router, redirectTo])

  if (!ok) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return <>{children}</>
}
