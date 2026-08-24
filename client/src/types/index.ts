export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'CHEF';

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'PARTIAL';
export type PaymentMethod = 'CASH' | 'CARD' | 'WALLET' | 'BANK_TRANSFER';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  businessId: string;
  isActive: boolean;
}

export interface Business {
  id: string;
  name: string;
  nameAr?: string;
  logo?: string;
  taxRate: number;
  serviceChargeRate: number;
  currency: string;
  wifiDuration: number;
  wifiVoucherEnabled: boolean;
  autoPrintOrders: boolean;
  kitchenDisplayEnabled: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  discountPrice?: number;
  image?: string;
  isAvailable: boolean;
  isActive: boolean;
  prepTime: number;
  sortOrder: number;
  modifiers: MenuModifier[];
}

export interface MenuModifier {
  id: string;
  menuItemId: string;
  name: string;
  nameAr?: string;
  type: 'SINGLE' | 'MULTIPLE';
  required: boolean;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  modifierId: string;
  name: string;
  nameAr?: string;
  price: number;
  sortOrder: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  businessId: string;
  tableId?: string;
  table?: Table;
  cashierId?: string;
  cashier?: { id: string; name: string };
  customerName?: string;
  customerPhone?: string;
  type: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  total: number;
  notes?: string;
  isOnlineOrder: boolean;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  price: number;
  notes?: string;
  selectedModifiers?: Record<string, string[]>;
  status: OrderStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  qrCode?: string;
}

export interface WifiQrCode {
  id: string;
  code: string;
  label?: string;
  durationMinutes: number;
  maxSessions: number;
  isActive: boolean;
  qrImage?: string;
  qrUrl?: string;
  _count?: { sessions: number };
}

export interface WifiSession {
  id: string;
  wifiQrCodeId: string;
  wifiQrCode?: { label: string; code: string };
  macAddress?: string;
  phoneNumber?: string;
  durationMinutes: number;
  status: 'ACTIVE' | 'EXPIRED' | 'DISCONNECTED';
  startTime: string;
  endTime: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  shiftId?: string;
  shift?: Shift;
  createdAt: string;
}

export interface Shift {
  id: string;
  name: string;
  nameAr?: string;
  startTime: string;
  endTime: string;
  days: number;
  _count?: { users: number };
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  guests: number;
  tableId?: string;
  table?: Table;
  dateTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
}

export interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  activeTables: number;
  totalItems: number;
  totalCategories: number;
  recentOrders: Order[];
  topSellingItems: unknown[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  selectedModifiers: Record<string, string[]>;
  totalPrice: number;
}
