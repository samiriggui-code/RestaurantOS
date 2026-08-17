'use client'

import { useEffect, useRef } from 'react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import {
  drainPosPrintJobs,
  handlePosPrintJob,
  type PrintJobPayload,
} from '@/lib/print/print-job-handler'
import { filterRecentPrintBacklog } from '@/lib/print/print-drain-policy'

async function drainPendingPosJobs(token: string) {
  try {
    const jobs = await staffFetch<PrintJobPayload[]>('/print-jobs?status=PENDING&device=1&limit=30', {
      token,
    })
    const posJobs = filterRecentPrintBacklog(
      jobs.filter((j) => j.type === 'RECEIPT' || j.type === 'KITCHEN' || j.type === 'BAG_LABEL'),
    )
    if (posJobs.length) await drainPosPrintJobs(posJobs, token)
  } catch (err) {
    console.warn('[pos-print] drain pending', err)
  }
}

/**
 * Écoute print:job sur caisse (SUNMI / tablette) — relais cuisine + reçu.
 * Au premier chargement (deploy / ouverture app) : pas de réimpression de l'historique PENDING.
 */
export function usePosPrintListener(enabled = true) {
  const skipBacklogOnce = useRef(true)

  useEffect(() => {
    if (!enabled) return

    const session = getStaffSession('device')
    if (!session) return

    skipBacklogOnce.current = true
    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)

    const onPrintJob = (job: PrintJobPayload) => {
      void handlePosPrintJob(job, session.token)
    }

    const onConnect = () => {
      joinBusinessRoom(socket, session.businessId)
      if (skipBacklogOnce.current) {
        skipBacklogOnce.current = false
        return
      }
      void drainPendingPosJobs(session.token)
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
