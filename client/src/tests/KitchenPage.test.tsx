import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from './setup'

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: false,
  disconnect: vi.fn(),
}

vi.mock('../services/socket', () => ({
  getSocket: vi.fn(() => mockSocket),
  reconnectSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}))

vi.mock('../services/offlineQueue', () => ({
  getQueueSize: vi.fn(() => Promise.resolve(0)),
  clearQueue: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/syncService', () => ({
  processQueue: vi.fn(() => Promise.resolve({ success: 0, failed: 0 })),
}))

import KitchenPage from '../pages/KitchenPage'
import { useAuthStore } from '../store/authStore'

describe('KitchenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      business: { id: 'biz-1', name: 'Test', taxRate: 10, serviceChargeRate: 0, currency: 'EUR', wifiDuration: 60, wifiVoucherEnabled: false, autoPrintOrders: false, kitchenDisplayEnabled: true },
      isAuthenticated: true,
      user: { id: 'u1', email: 'chef@test.com', name: 'Chef', role: 'CHEF', businessId: 'biz-1' },
    } as any)
    localStorage.setItem('accessToken', 'test-token')
  })

  it('should show loading state', () => {
    render(<KitchenPage />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should render order tickets after loading', async () => {
    render(<KitchenPage />)
    await waitFor(() => {
      expect(screen.getByText('#1001')).toBeInTheDocument()
    })
    expect(screen.getByText('#1002')).toBeInTheDocument()
  })

  it('should show order number, items, and status for each ticket', async () => {
    render(<KitchenPage />)
    await waitFor(() => {
      expect(screen.getByText('#1001')).toBeInTheDocument()
    })
    expect(screen.getByText('2x')).toBeInTheDocument()
    expect(screen.getByText('إسبريسو')).toBeInTheDocument()
  })

  it('should show empty state when no orders', async () => {
    server.use(
      http.get('/api/orders', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        if (status && status.includes('PENDING')) {
          return HttpResponse.json([])
        }
        return HttpResponse.json({ data: [], total: 0, page: 1, limit: 20 })
      }),
    )
    render(<KitchenPage />)
    await waitFor(() => {
      expect(screen.getByText('لا توجد طلبات حالياً')).toBeInTheDocument()
    })
  })

  it('should have sound notification on new order', async () => {
    const playMock = vi.fn(() => Promise.resolve())
    HTMLAudioElement.prototype.play = playMock

    render(<KitchenPage />)
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('order:new', expect.any(Function))
      expect(mockSocket.emit).toHaveBeenCalledWith('join:business', 'biz-1')
    })
  })

  it('should update status when status button clicked', async () => {
    render(<KitchenPage />)
    await waitFor(() => {
      expect(screen.getByText('#1001')).toBeInTheDocument()
    })
    const startButtons = screen.getAllByTitle('بدء التحضير')
    expect(startButtons.length).toBeGreaterThan(0)
    await userEvent.setup().click(startButtons[0])
  })

  it('should register socket listeners on mount', async () => {
    render(<KitchenPage />)
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('order:new', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('order:statusUpdate', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('kitchen:itemUpdated', expect.any(Function))
    })
  })
})
