'use client'

import type { AppModule } from '@/lib/modules'
import { isModuleEnabled, isStaffModuleEnabled } from '@/lib/modules'
import { ModuleDisabled } from '@/components/ops/ModuleDisabled'

export function ModuleGuard({
  module,
  title,
  children,
}: {
  module: AppModule
  title?: string
  children: React.ReactNode
}) {
  const enabled =
    module === 'users' || module === 'shifts'
      ? isStaffModuleEnabled(module)
      : isModuleEnabled(module)

  if (!enabled) {
    return <ModuleDisabled module={module} title={title} />
  }

  return <>{children}</>
}

