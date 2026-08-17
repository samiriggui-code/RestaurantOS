import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  LayoutDashboard, Menu, ShoppingBag, Table2, Users, Wifi,
  BarChart3, CalendarDays, Settings, LogOut, ChefHat, Bell,
  CreditCard, Clock, TrendingDown, UserCog, X, ChevronLeft,
  UtensilsCrossed,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { getSocket } from '../../services/socket'
import LanguageSwitcher from '../ui/LanguageSwitcher'
import { displayName, formatMoney } from '../../lib/locale'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const navItems: { to: string; icon: any; label: string; end?: boolean; roles?: string[] }[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'nav.dashboard', end: true },
  { to: '/admin/pos', icon: CreditCard, label: 'nav.pos' },
  { to: '/admin/orders', icon: ShoppingBag, label: 'nav.orders' },
  { to: '/admin/menu', icon: Menu, label: 'nav.menu', roles: ['ADMIN', 'MANAGER'] },
  { to: '/admin/tables', icon: Table2, label: 'nav.tables' },
  { to: '/admin/reservations', icon: CalendarDays, label: 'nav.reservations' },
  { to: '/admin/employees', icon: Users, label: 'nav.employees' },
  { to: '/admin/shifts', icon: Clock, label: 'nav.shifts' },
  { to: '/admin/wifi', icon: Wifi, label: 'nav.wifi', roles: ['ADMIN', 'MANAGER'] },
  { to: '/admin/expenses', icon: TrendingDown, label: 'nav.expenses', roles: ['ADMIN', 'MANAGER'] },
  { to: '/admin/reports', icon: BarChart3, label: 'nav.reports', roles: ['ADMIN', 'MANAGER'] },
  { to: '/admin/users', icon: UserCog, label: 'nav.users', roles: ['ADMIN'] },
  { to: '/admin/settings', icon: Settings, label: 'nav.settings', roles: ['ADMIN'] },
]

export default function AdminLayout() {
  const { t } = useTranslation()
  const { user, business, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    const socket = getSocket()

    const handleWaiterCall = (data: any) => {
      toast.custom(() => (
        <div className="bg-amber-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px] border border-amber-500/30">
          <Bell className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">{t('waiter:called')}</p>
            <p className="text-sm opacity-80">{t('consumer.table')} {data.tableNumber}</p>
          </div>
        </div>
      ), { duration: 8000 })
      setNotifications(prev => [data, ...prev].slice(0, 20))
    }

    const handleNewOrder = (order: any) => {
      toast.custom(() => (
        <div className="bg-primary-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px] border border-primary-500/30">
          <ShoppingBag className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">{t('orders.title')}</p>
            <p className="text-sm opacity-80">#{order.orderNumber} — {formatMoney(order.total ?? 0)}</p>
          </div>
        </div>
      ), { duration: 5000 })
    }

    socket.on('waiter:called', handleWaiterCall)
    socket.on('order:new', handleNewOrder)

    return () => {
      socket.off('waiter:called', handleWaiterCall)
      socket.off('order:new', handleNewOrder)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const filteredNav = navItems.filter(item =>
    !item.roles || item.roles.length === 0 || (user && item.roles.includes(user.role))
  )

  return (
    <div className="min-h-screen bg-charcoal flex" dir="auto">
      {/* Mobile header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-charcoal-soft/95 backdrop-blur-xl border-b border-white/10 lg:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-surface-700 rounded-xl text-surface-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-tomato flex items-center justify-center text-white font-bold text-xs font-display">Z</div>
            <span className="font-display font-bold text-sm text-cream">{displayName(business) || 'La Z Pizza'}</span>
          </div>
          <button
            onClick={() => setNotifications([])}
            className="relative p-2 hover:bg-surface-700 rounded-xl text-surface-200"
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold ring-2 ring-surface-900">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-30 w-64 bg-charcoal-soft border-l border-white/10 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto ${
        mobileOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Sidebar header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tomato to-tomato-dark flex items-center justify-center text-white font-display font-bold shadow-glow">
                  Z
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-sm text-cream truncate">{displayName(business) || 'La Z Pizza'}</h2>
                  <p className="text-xs text-cream/45 truncate">{user?.name}</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 hover:bg-surface-700 rounded-lg text-surface-400 lg:hidden">
                <X size={16} />
              </button>
            </div>

            {/* Notification preview */}
            {notifications.length > 0 && (
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {notifications.slice(0, 4).map((n, i) => (
                  <div key={i} className="text-xs bg-amber-500/10 text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                    <Bell size={10} />
                    {t('consumer.table')} {n.tableNumber}: {n.message || t('waiter:called')}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {filteredNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-tomato/15 text-tomato-light border border-tomato/25'
                      : 'text-cream/55 hover:text-cream hover:bg-white/5'
                  }`
                }
              >
                <item.icon size={18} />
                <span>{t(item.label)}</span>
              </NavLink>
            ))}

            <NavLink
              to="/kitchen"
              target="_blank"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-300 hover:text-surface-50 hover:bg-surface-700/50 transition-all duration-200"
            >
              <ChefHat size={18} />
              <span>{t('nav.kitchen')}</span>
            </NavLink>
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-surface-700/50 space-y-2">
            <LanguageSwitcher compact />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full transition-all duration-200"
            >
              <LogOut size={18} />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-4 lg:p-6 lg:pt-6 pt-20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
