/**
 * Environment variable validation for RestaurantOS server.
 * Run at startup to ensure all required secrets are configured.
 * Exits with code 1 if validation fails.
 */

const REQUIRED_VARS = [
  'JWT_SECRET',
  'REFRESH_SECRET',
  'DATABASE_URL',
] as const

const DEFAULTS_TO_REJECT: Record<string, string[]> = {
  JWT_SECRET: ['change-me', 'change-this-to-a-very-long-random-string', 'your-secret'],
  REFRESH_SECRET: ['change-me', 'change-this-to-another-long-random-string', 'your-refresh-secret'],
  DATABASE_URL: ['file:./dev.db'],
}
const SKIP_DEFAULT_CHECK_FOR_TEST: string[] = ['JWT_SECRET', 'REFRESH_SECRET', 'DATABASE_URL']

export function validateEnv(): void {
  const missing: string[] = []
  const usingDefault: string[] = []

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName]
    if (!value) {
      missing.push(varName)
      continue
    }

    if (process.env.NODE_ENV === 'test' && SKIP_DEFAULT_CHECK_FOR_TEST.includes(varName)) {
      continue
    }

    const rejectValues = DEFAULTS_TO_REJECT[varName]
    if (rejectValues) {
      for (const badValue of rejectValues) {
        if (value.trim() === badValue || value.includes(badValue)) {
          usingDefault.push(varName)
          break
        }
      }
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(v => console.error(`   - ${v}`))
    console.error('\n💡 Set them in your .env file or environment.')
    process.exit(1)
  }

  if (usingDefault.length > 0) {
    console.error('❌ Environment variables still have default/insecure values:')
    usingDefault.forEach(v => console.error(`   - ${v}`))
    console.error('\n💡 Generate strong secrets:')
    console.error('   openssl rand -base64 32')
    console.error('   openssl rand -base64 32')
    process.exit(1)
  }

  // Additional validation
  if (!process.env.DATABASE_URL?.startsWith('postgresql://') && !process.env.DATABASE_URL?.startsWith('file:')) {
    console.error('❌ DATABASE_URL must start with postgresql:// or file:')
    process.exit(1)
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.startsWith('postgresql://')) {
    console.error('❌ Production requires a PostgreSQL database URL (postgresql://)')
    process.exit(1)
  }

  // Warn about missing but optional vars
  const OPTIONAL_VARS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'FRONTEND_URL']
  for (const varName of OPTIONAL_VARS) {
    if (!process.env[varName]) {
      console.warn(`⚠️  Optional env var ${varName} is not set — related features will be disabled`)
    }
  }

  console.log('✅ Environment validation passed')
}
