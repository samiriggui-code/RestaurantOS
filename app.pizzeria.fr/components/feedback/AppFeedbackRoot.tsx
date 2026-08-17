'use client'

import type { ReactNode } from 'react'
import { AppFeedbackProvider } from '@/components/feedback/AppFeedbackProvider'

export function AppFeedbackRoot({ children }: { children: ReactNode }) {
  return <AppFeedbackProvider>{children}</AppFeedbackProvider>
}
