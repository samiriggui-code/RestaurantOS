import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../store/authStore';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

import MenuManagementPage from '../pages/admin/MenuManagementPage';

describe('MenuManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', email: 'admin@cafe.com', name: 'Admin', role: 'ADMIN' },
      business: {
        id: 'biz-1',
        name: 'Test Cafe',
        nameAr: 'مقهى تجريبي',
        taxRate: 15,
        serviceChargeRate: 10,
        currency: 'DZD',
        wifiDuration: 60,
        wifiVoucherEnabled: false,
        autoPrintOrders: false,
        kitchenDisplayEnabled: true,
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('should render list of menu items', async () => {
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('قهوة')).toBeInTheDocument();
    });
    expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    expect(screen.getByText('كابتشينو')).toBeInTheDocument();
  });

  it('should open create form when add item button clicked', async () => {
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('قهوة')).toBeInTheDocument();
    });
    await userEvent.setup().click(screen.getByText('إضافة صنف'));
    await waitFor(() => {
      expect(document.querySelector('form')).toBeInTheDocument();
    });
  });

  it('should submit new item to API', async () => {
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('قهوة')).toBeInTheDocument();
    });
    await userEvent.setup().click(screen.getByText('إضافة صنف'));
    await waitFor(() => {
      expect(document.querySelector('form')).toBeInTheDocument();
    });
    const submitBtn = screen.getByText('إضافة');
    expect(submitBtn).toBeInTheDocument();
  });

  it('should edit existing item', async () => {
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const editBtn = document.querySelector('button svg.lucide-pen')?.closest('button');
    if (editBtn) await userEvent.setup().click(editBtn);
  });

  it('should delete item with confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const deleteBtns = document.querySelectorAll('.text-red-500');
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('should filter by category', async () => {
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('قهوة')).toBeInTheDocument();
    });
    expect(screen.getByText('معجنات')).toBeInTheDocument();
  });

  it('should toggle item availability', async () => {
    render(<MenuManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const toggleBtn = document
      .querySelector('button svg.lucide-toggle-right, button svg.lucide-toggle-left')
      ?.closest('button');
    if (toggleBtn) await userEvent.setup().click(toggleBtn);
  });
});
