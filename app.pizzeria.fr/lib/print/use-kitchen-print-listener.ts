'use client'

import { useEffect, useRef } from 'react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import {
  drainKitchenPrintJobs,
  handleKitchenPrintJob,
  type PrintJobPayload,
} from '@/lib/print/print-job-handler'
import { filterRecentPrintBacklog } from '@/lib/print/print-drain-policy'

async function drainPendingKitchenJobs(token: string) {
  try {
    const jobs = await staffFetch<PrintJobPayload[]>('/print-jobs?status=PENDING&device=1&limit=30', {
      token,
    })
    const kitchenJobs = filterRecentPrintBacklog(
      jobs.filter((j) => j.type === 'KITCHEN' || j.type === 'BAG_LABEL'),
    )
    if (kitchenJobs.length) await drainKitchenPrintJobs(kitchenJobs, token)
  } catch (err) {
    console.warn('[kds-print] drain pending', err)
  }
}

/**
 * Impression auto cuisine — KDS : Epson cuisine → caisse, relais POS si HS.
 * Premier chargement : pas de réimpression de toute la file PENDING.
 */
export function useKitchenPrintListener(enabled = true) {
  const skipBacklogOnce = useRef(true)

  useEffect(() => {
    if (!enabled) return

    const session = getStaffSession()
    if (!session) return

    skipBacklogOnce.current = true
    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)

    const onPrintJob = (job: PrintJobPayload) => {
      void handleKitchenPrintJob(job, session.token)
    }

    const onConnect = () => {
      joinBusinessRoom(socket, session.businessId)
      if (skipBacklogOnce.current) {
        skipBacklogOnce.current = false
        return
      }
      void drainPendingKitchenJobs(session.token)
    }

    socket.on('connect', onConnect)
    socket.on('print:job', onPrintJob)
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('print:job', onPrintJob)
      releaseKitchenSocket()
    }
  }, [enabled])
}
