import type { AuthScope } from '@/lib/staff-auth'

export type OpsViewMode = 'device' | 'admin'

export function authScopeForOpsMode(mode: OpsViewMode): AuthScope {
  return mode === 'admin' ? 'crm' : 'device'
}
