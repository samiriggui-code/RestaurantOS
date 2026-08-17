import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import NetworkStatus from './components/NetworkStatus'
import LoginPage from './pages/LoginPage'
import KitchenPage from './pages/KitchenPage'
import AdminLayout from './components/layout/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import MenuManagementPage from './pages/admin/MenuManagementPage'
import OrdersPage from './pages/admin/OrdersPage'
import TablesPage from './pages/admin/TablesPage'
import EmployeesPage from './pages/admin/EmployeesPage'
import WifiPage from './pages/admin/WifiPage'
import ReportsPage from './pages/admin/ReportsPage'
import ReservationsPage from './pages/admin/ReservationsPage'
import SettingsPage from './pages/admin/SettingsPage'
import POSPage from './pages/admin/POSPage'
import ShiftsPage from './pages/admin/ShiftsPage'
import ExpensesPage from './pages/admin/ExpensesPage'
import UsersPage from './pages/admin/UsersPage'

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

/** Point d'entrée : auth employé / gérant uniquement (plus de hub client QR). */
function AuthEntry() {
  const { isAuthenticated } = useAuthStore()
  return <Navigate to={isAuthenticated ? '/admin' : '/login'} replace />
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-charcoal">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-tomato border-t-transparent" />
      <p className="text-cream/55">Chargement…</p>
    </div>
  )
}

export default function App() {
  const { checkAuth, isLoading } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <NetworkStatus />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute>
              <KitchenPage />
            </ProtectedRoute>
          }
        />

        {/* Ancien parcours client QR / menu — hors périmètre pizzeria */}
        <Route path="/consumer" element={<Navigate to="/login" replace />} />
        <Route path="/menu" element={<Navigate to="/login" replace />} />
        <Route path="/cart" element={<Navigate to="/login" replace />} />
        <Route path="/wifi" element={<Navigate to="/login" replace />} />
        <Route path="/order/:orderNumber" element={<Navigate to="/login" replace />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="menu" element={<MenuManagementPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="wifi" element={<WifiPage />} />
          <Route
            path="reports"
            element={
              <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route
            path="expenses"
            element={
              <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/" element={<AuthEntry />} />
        <Route path="*" element={<AuthEntry />} />
      </Routes>
    </>
  )
}
