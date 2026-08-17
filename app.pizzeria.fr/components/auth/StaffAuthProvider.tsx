'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearCrmSession,
  clearDeviceSession,
  clearStaffSession,
  getCrmSession,
  getDeviceSession,
  getStaffUser,
  type StaffSession,
  type StaffUser,
} from '@/lib/staff-auth'

type StaffAuthContextValue = {
  crmUser: StaffUser | null
  deviceUser: StaffUser | null
  crmSession: StaffSession | null
  deviceSession: StaffSession | null
  refresh: () => void
  signOutCrm: () => void
  signOutDevice: () => void
  signOutAll: () => void
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null)

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    function onChange() {
      refresh()
    }
    window.addEventListener('staff-auth-changed', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('staff-auth-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [refresh])

  const value = useMemo<StaffAuthContextValue>(() => {
    void tick
    return {
      crmUser: getStaffUser('crm'),
      deviceUser: getStaffUser('device'),
      crmSession: getCrmSession(),
      deviceSession: getDeviceSession(),
      refresh,
      signOutCrm: () => {
        clearCrmSession()
        refresh()
      },
      signOutDevice: () => {
        clearDeviceSession()
        refresh()
      },
      signOutAll: () => {
        clearStaffSession()
        refresh()
      },
    }
  }, [tick, refresh])

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>
}

export function useStaffAuth(): StaffAuthContextValue {
  const ctx = useContext(StaffAuthContext)
  if (!ctx) {
    throw new Error('useStaffAuth must be used within StaffAuthProvider')
  }
  return ctx
}
