'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { AdminLiveToolbar } from '@/components/admin/AdminLiveToolbar'
import { SidebarToggleButton } from '@/components/ui/sidebar-toggle'
import { ADMIN_NAV_GROUPS, type AdminNavItem } from '@/lib/admin-nav'
import { clearCrmSession, getStaffUser } from '@/lib/staff-auth'
import { isModuleEnabled, isStaffModuleEnabled, type AppModule } from '@/lib/modules'
import { useCollapsibleSidebar } from '@/lib/use-collapsible-sidebar'
import { cn } from '@/lib/cn'

function navEnabled(module?: AppModule): boolean {
  if (!module) return true
  if (module === 'users' || module === 'shifts') return isStaffModuleEnabled(module)
  return isModuleEnabled(module)
}

function filterNavItem(item: AdminNavItem, role?: string): boolean {
  if (!item.roles || !role) return true
  return item.roles.includes(role)
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { collapsed, toggle } = useCollapsibleSidebar('admin')
  const user = getStaffUser('crm')
  const role = user?.role

  function logout() {
    clearCrmSession()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-charcoal" data-admin-cockpit>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-[#120e0c] transition-[width,transform] duration-200 ease-linear lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'w-[3rem] lg:w-[3rem]' : 'w-64',
        )}
      >
        <div className="relative border-b border-white/10 p-3">
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
            <Link
              href="/admin"
              className={cn('flex min-w-0 items-center', collapsed ? 'justify-center' : 'flex-1 gap-3')}
              onClick={() => setMobileOpen(false)}
              title="Tableau de bord"
            >
              <AppModuleBrand variant="back-office" collapsed={collapsed} subtitle={user?.name ?? undefined} />
            </Link>
            {!collapsed && (
              <button
                type="button"
                className="rounded-lg p-1.5 text-cream/50 hover:bg-white/5 lg:hidden"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <SidebarToggleButton
            collapsed={collapsed}
            onToggle={toggle}
            variant="rail"
            className="hidden lg:flex"
          />
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
          {ADMIN_NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => filterNavItem(item, role))
            if (items.length === 0) return null

            return (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-cream/30">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                    const enabled = navEnabled(item.module)
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        onClick={() => setMobileOpen(false)}
                        title={item.label}
                        className={cn(
                          'flex items-center rounded-xl text-sm font-medium transition-colors',
                          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                          active
                            ? 'border border-tomato/25 bg-tomato/15 text-tomato-light'
                            : enabled
                              ? 'text-cream/60 hover:bg-white/5 hover:text-cream'
                              : 'text-cream/30 hover:bg-white/[0.02] hover:text-cream/50',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && item.external && (
                          <span className="text-[9px] uppercase tracking-wide text-cream/25">↗</span>
                        )}
                        {!collapsed && !enabled && item.module && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cream/35">
                            off
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={logout}
            title="Déconnexion"
            className={cn(
              'flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && 'Déconnexion'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-charcoal/95 px-4">
          <button
            type="button"
            className="rounded-xl p-2 text-cream/70 hover:bg-white/5 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SidebarToggleButton collapsed={collapsed} onToggle={toggle} className="hidden md:inline-flex" />
          <span className="font-display text-sm font-semibold text-cream">Back-office</span>
        </header>
        <main className="flex flex-1 flex-col overflow-hidden">
          <AdminLiveToolbar />
          <div className="admin-main flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
