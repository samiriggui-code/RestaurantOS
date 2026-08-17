'use client'

import { useCallback, useState } from 'react'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'

/**
 * État erreur / succès local + toast + son automatiques.
 * Remplace `useState` pour `error` et `message` dans les vues.
 */
export function useFeedbackState() {
  const { notifyError, notifySuccess, notifyWarning } = useAppFeedback()
  const [error, setErrorRaw] = useState<string | null>(null)
  const [message, setMessageRaw] = useState<string | null>(null)

  const setError = useCallback(
    (msg: string | null) => {
      setErrorRaw(msg)
      if (msg) notifyError(msg)
    },
    [notifyError],
  )

  const setMessage = useCallback(
    (msg: string | null) => {
      setMessageRaw(msg)
      if (msg) notifySuccess(msg)
    },
    [notifySuccess],
  )

  const setWarning = useCallback(
    (msg: string | null) => {
      setErrorRaw(msg)
      if (msg) notifyWarning(msg)
    },
    [notifyWarning],
  )

  const clearError = useCallback(() => setErrorRaw(null), [])
  const clearMessage = useCallback(() => setMessageRaw(null), [])

  return { error, message, setError, setMessage, setWarning, clearError, clearMessage }
}
