import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import express from 'express'

let sentryEnabled = false

export function isSentryEnabled(): boolean {
  return sentryEnabled
}

export function initSentry(_app: express.Application): void {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) {
    sentryEnabled = false
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [nodeProfilingIntegration()],
  })
  sentryEnabled = true
}

export function setupSentryErrorHandler(app: express.Application): void {
  if (!sentryEnabled) return
  Sentry.setupExpressErrorHandler(app)
}

export default Sentry
