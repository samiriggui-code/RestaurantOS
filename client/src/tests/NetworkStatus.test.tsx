import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockUseNetworkStatus, mockGetQueueSize, mockClearQueue, mockProcessQueue } = vi.hoisted(
  () => ({
    mockUseNetworkStatus: vi.fn(),
    mockGetQueueSize: vi.fn(),
    mockClearQueue: vi.fn(),
    mockProcessQueue: vi.fn(),
  })
);

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: mockUseNetworkStatus,
}));

vi.mock('../services/offlineQueue', () => ({
  getQueueSize: (...args: unknown[]) => mockGetQueueSize(...args),
  clearQueue: (...args: unknown[]) => mockClearQueue(...args),
}));

vi.mock('../services/syncService', () => ({
  processQueue: (...args: unknown[]) => mockProcessQueue(...args),
}));

import NetworkStatus from '../components/NetworkStatus';

describe('NetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueueSize.mockResolvedValue(0);
    mockClearQueue.mockResolvedValue(undefined);
    mockProcessQueue.mockResolvedValue({ success: 0, failed: 0 });
  });

  it('should not render when online', async () => {
    mockUseNetworkStatus.mockReturnValue(true);
    const { container } = render(<NetworkStatus />);
    await waitFor(() => {
      expect(mockGetQueueSize).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeNull();
  });

  it('should render offline indicator when offline', async () => {
    mockUseNetworkStatus.mockReturnValue(false);
    render(<NetworkStatus />);
    expect(await screen.findByText('لا يوجد اتصال بالإنترنت')).toBeInTheDocument();
  });

  it('should show pending order count from queue', async () => {
    mockUseNetworkStatus.mockReturnValue(true);
    mockGetQueueSize.mockResolvedValue(3);
    render(<NetworkStatus />);
    expect(await screen.findByText('3 طلب بانتظار الإرسال')).toBeInTheDocument();
  });

  it('should have a sync button when online with pending orders', async () => {
    mockUseNetworkStatus.mockReturnValue(true);
    mockGetQueueSize.mockResolvedValue(2);
    render(<NetworkStatus />);
    const syncBtn = await screen.findByText('إرسال');
    expect(syncBtn).toBeInTheDocument();
    await userEvent.setup().click(syncBtn);
    expect(mockProcessQueue).toHaveBeenCalled();
  });

  it('should have a clear queue button', async () => {
    mockUseNetworkStatus.mockReturnValue(true);
    mockGetQueueSize.mockResolvedValue(5);
    render(<NetworkStatus />);
    const buttons = await screen.findAllByRole('button');
    const clearBtn = buttons.find(b => b.innerHTML.includes('lucide-trash2'));
    expect(clearBtn).toBeDefined();
    await userEvent.setup().click(clearBtn!);
    expect(mockClearQueue).toHaveBeenCalled();
  });
});
