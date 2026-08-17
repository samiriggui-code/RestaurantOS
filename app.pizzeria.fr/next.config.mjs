import path from 'path'
import { fileURLToPath } from 'url'
import { withSentryConfig } from '@sentry/nextjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function normalizeApiUpstream(raw) {
  const trimmed = String(raw).replace(/\/$/, '')
  // NEXT_PUBLIC_API_URL se termine souvent par /api — éviter /api/api/... dans les rewrites
  if (trimmed.endsWith('/api')) return trimmed.slice(0, -4)
  return trimmed
}

const API_UPSTREAM = normalizeApiUpstream(
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001',
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${API_UPSTREAM}/api/:path*`,
        },
      ],
    }
  },
  allowedDevOrigins: [
    '192.168.1.6',
    ...(process.env.ALLOWED_DEV_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []),
  ],
  turbopack: {
    root: __dirname,
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
