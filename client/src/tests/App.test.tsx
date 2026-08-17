import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartProvider } from '../store/CartContext'
import { useAuthStore } from '../store/authStore'
import App from '../App'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: false,
  disconnect: vi.fn(),
}

vi.mock('../services/socket', () => ({
  getSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}))

vi.mock('../services/offlineQueue', () => ({
  getQueueSize: vi.fn(() => Promise.resolve(0)),
  clearQueue: vi.fn(() => Promise.resolve()),
  enqueueRequest: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/syncService', () => ({
  processQueue: vi.fn(() => Promise.resolve({ success: 0, failed: 0 })),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <CartProvider>
          <App />
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('App', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      business: null,
      isAuthenticated: false,
      isLoading: false,
    })
  })

  it('shows loading spinner when checking auth', () => {
    useAuthStore.setState({ isLoading: true })
    renderApp()
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })

  it('redirects / to login when not authenticated', async () => {
    useAuthStore.setState({ isLoading: false })
    renderApp(['/'])
    const heading = await screen.findByRole('heading', { level: 2, name: 'Connexion' })
    expect(heading).toBeInTheDocument()
  })

  it('renders login page at /login', async () => {
    renderApp(['/login'])
    const heading = await screen.findByRole('heading', { level: 2, name: 'Connexion' })
    expect(heading).toBeInTheDocument()
  })

  it('redirects legacy /menu to login', async () => {
    renderApp(['/menu'])
    const heading = await screen.findByRole('heading', { level: 2, name: 'Connexion' })
    expect(heading).toBeInTheDocument()
  })

  it('redirects legacy /consumer to login', async () => {
    renderApp(['/consumer'])
    const heading = await screen.findByRole('heading', { level: 2, name: 'Connexion' })
    expect(heading).toBeInTheDocument()
  })

  it('redirects /admin to login when not authenticated', async () => {
    renderApp(['/admin'])
    const heading = await screen.findByRole('heading', { level: 2, name: 'Connexion' })
    expect(heading).toBeInTheDocument()
  })

  it('renders admin layout when authenticated', async () => {
    localStorage.setItem('accessToken', 'mock-access-token')
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'admin@cafe.com', name: 'Admin', role: 'ADMIN' },
    })
    renderApp(['/admin'])
    const el = await screen.findByText('Tableau de bord')
    expect(el).toBeInTheDocument()
  })

  it('redirects unknown routes to login when not authenticated', async () => {
    renderApp(['/nonexistent-route'])
    const heading = await screen.findByRole('heading', { level: 2, name: 'Connexion' })
    expect(heading).toBeInTheDocument()
  })
})
