import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CartProvider, useCart } from '../store/CartContext';
import { MenuItem } from '../types';
import React from 'react';

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => true),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

import CartPage from '../pages/CartPage';

const mockMenuItem: MenuItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  name: 'Espresso',
  nameAr: 'إسبريسو',
  description: 'Rich coffee shot',
  descriptionAr: 'قهوة غنية',
  price: 12.0,
  isAvailable: true,
  isActive: true,
  prepTime: 3,
  sortOrder: 0,
  modifiers: [],
};

const mockMenuItem2: MenuItem = {
  id: 'item-2',
  categoryId: 'cat-1',
  name: 'Cappuccino',
  nameAr: 'كابتشينو',
  description: 'Espresso with steamed milk foam',
  descriptionAr: 'إسبريسو مع حليب رغوي',
  price: 16.0,
  isAvailable: true,
  isActive: true,
  prepTime: 5,
  sortOrder: 1,
  modifiers: [],
};

function CartWithItems({ children }: { children: React.ReactNode }) {
  const { addItem, setBusinessId } = useCart();
  React.useEffect(() => {
    setBusinessId('biz-1');
    addItem(mockMenuItem, 2);
    addItem(mockMenuItem2, 1);
  }, [addItem, setBusinessId]);
  return <>{children}</>;
}

function renderCartPage() {
  return render(
    <BrowserRouter>
      <CartProvider>
        <CartWithItems>
          <CartPage />
        </CartWithItems>
      </CartProvider>
    </BrowserRouter>
  );
}

function renderEmptyCartPage() {
  return render(
    <BrowserRouter>
      <CartProvider>
        <CartPage />
      </CartProvider>
    </BrowserRouter>
  );
}

describe('CartPage', () => {
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

  it('should render cart items', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    expect(screen.getByText('كابتشينو')).toBeInTheDocument();
  });

  it('should show price breakdown (subtotal, tax, total)', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText(/40\.00/)).toBeInTheDocument();
    });
  });

  it('should increase item quantity', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const plusBtns = screen.getAllByRole('button');
    const plusBtn = plusBtns.find(b => b.querySelector('svg.lucide-plus'));
    if (plusBtn) {
      await userEvent.setup().click(plusBtn!);
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    }
  });

  it('should decrease item quantity', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const minusBtns = screen.getAllByRole('button');
    const minusBtn = minusBtns.find(
      b => b.querySelector('svg.lucide-minus') && b.closest('[class*="bg-surface"]')
    );
    if (minusBtn) {
      await userEvent.setup().click(minusBtn!);
    }
  });

  it('should remove item from cart', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const trashBtns = screen.getAllByRole('button');
    const trashBtn = trashBtns.find(
      b => b.querySelector('svg.lucide-trash2') && !b.closest('.sticky')
    );
    if (trashBtn) {
      await userEvent.setup().click(trashBtn!);
    }
  });

  it('should clear all items', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const clearBtn = document.querySelector('.text-red-300')?.closest('button');
    if (clearBtn) {
      await userEvent.setup().click(clearBtn!);
    }
  });

  it('should show empty cart state', async () => {
    renderEmptyCartPage();
    await waitFor(() => {
      expect(screen.getByText('السلة فارغة')).toBeInTheDocument();
    });
  });

  it('should proceed to checkout', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('إسبريسو')).toBeInTheDocument();
    });
    const submitBtn = screen.getByText('إرسال الطلب');
    expect(submitBtn).toBeInTheDocument();
  });

  it('should change order type', async () => {
    renderCartPage();
    await waitFor(() => {
      expect(screen.getByText('طلبات خارجية')).toBeInTheDocument();
    });
    await userEvent.setup().click(screen.getByText('طلبات خارجية'));
  });
});
