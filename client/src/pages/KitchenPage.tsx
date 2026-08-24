import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { reconnectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Order, OrderStatus } from '../types';
import { ChefHat, Bell, CheckCircle, Clock, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n/useTranslation';

const CACHE_KEY = 'kitchen-orders-cache';

/** Statuts visibles en cuisine (CDC : CONFIRMED après paiement, pas PENDING_PAYMENT). */
const KITCHEN_ORDER_STATUSES = 'CONFIRMED,PENDING,PREPARING,READY';

function cacheOrders(orders: Order[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(orders));
  } catch {
    /* ignore */
  }
}

function getCachedOrders(): Order[] {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export default function KitchenPage() {
  const { t } = useTranslation();
  const businessId = useAuthStore(s => s.business?.id);
  const isOnline = useNetworkStatus();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrdersCount = useRef(0);

  useEffect(() => {
    audioRef.current = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+Af39/gIB/f3+AgH9/f4CAf39/gH9/f4CAf3+Af39/gICAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf3+Af39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4CAf3+Af39/gIB/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4CAf3+Af39/gIB/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f3+Af39/gIB/f3+Af39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/'
    );

    const token = localStorage.getItem('accessToken') || undefined;
    const socket = reconnectSocket(token);

    const joinBusinessRoom = () => {
      if (businessId) socket.emit('join:business', businessId);
    };
    joinBusinessRoom();
    socket.on('connect', joinBusinessRoom);

    const handleNewOrder = (order: Order) => {
      setOrders(prev => {
        const updated = [order, ...prev];
        cacheOrders(updated);
        return updated;
      });
      audioRef.current?.play().catch(() => {});
      toast.custom(
        () => (
          <div className="new-order-pulse text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <span>
              {t('kitchen.new_order')} #{order.orderNumber}
            </span>
          </div>
        ),
        { duration: 5000 }
      );
    };

    const handleStatusUpdate = (order: Order) => {
      setOrders(prev => {
        const updated = prev.map(o => (o.id === order.id ? order : o));
        cacheOrders(updated);
        return updated;
      });
    };

    const handleItemUpdate = (data: { orderId: string; itemId: string; status: string }) => {
      setOrders(prev => {
        const updated = prev.map(order => {
          if (order.id !== data.orderId) return order;
          return {
            ...order,
            items: order.items.map(item =>
              item.id === data.itemId ? { ...item, status: data.status as OrderStatus } : item
            ),
          };
        });
        cacheOrders(updated);
        return updated;
      });
    };

    socket.on('order:new', handleNewOrder);
    socket.on('order:statusUpdate', handleStatusUpdate);
    socket.on('kitchen:itemUpdated', handleItemUpdate);

    // Load existing orders (from cache first if offline)
    if (!navigator.onLine) {
      const cached = getCachedOrders();
      if (cached.length > 0) {
        setOrders(cached);
        setLoading(false);
      }
    }

    api
      .getOrders(`status=${KITCHEN_ORDER_STATUSES}`)
      .then(data => {
        setOrders(data);
        cacheOrders(data);
        prevOrdersCount.current = data.length;
      })
      .catch(() => {
        if (orders.length === 0) {
          const cached = getCachedOrders();
          if (cached.length > 0) {
            setOrders(cached);
          }
        }
        if (!navigator.onLine) {
          toast('وضع عدم الاتصال - تعمل الشاشة من البيانات المخزنة', { icon: '📡' });
        } else {
          toast.error('فشل تحميل الطلبات');
        }
      })
      .finally(() => setLoading(false));

    return () => {
      socket.off('connect', joinBusinessRoom);
      socket.off('order:new', handleNewOrder);
      socket.off('order:statusUpdate', handleStatusUpdate);
      socket.off('kitchen:itemUpdated', handleItemUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `orders.length` n'est lu qu'au moment du catch (fallback cache hors-ligne pour le fetch initial) ; l'ajouter redéclencherait tout le setup socket à chaque commande ajoutée/retirée.
  }, [businessId, t]);

  const handleItemStatus = async (orderId: string, itemId: string, status: string) => {
    try {
      await api.updateOrderItemStatus(orderId, itemId, status);
    } catch {
      toast.error('فشل تحديث الحالة');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'CONFIRMED':
        return 'text-yellow-600 bg-yellow-50';
      case 'PREPARING':
        return 'text-blue-600 bg-blue-50';
      case 'READY':
        return 'text-green-600 bg-green-50';
      case 'DELIVERED':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'CONFIRMED':
        return t('orders.pending');
      case 'PREPARING':
        return t('orders.preparing');
      case 'READY':
        return t('orders.ready');
      case 'DELIVERED':
        return t('orders.delivered');
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-primary-400" />
          <h1 className="text-2xl font-bold">{t('kitchen.title')}</h1>
        </div>
        <div className="flex items-center gap-4">
          {!isOnline && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-xl text-sm">
              <WifiOff className="w-4 h-4" />
              غير متصل
            </span>
          )}
          <span className="text-gray-400">
            {orders.length} {t('kitchen.active_orders')}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-800 rounded-xl hover:bg-gray-700 text-sm"
          >
            {t('kitchen.refresh')}
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <CheckCircle className="w-16 h-16 mb-4" />
          <p className="text-xl">{t('kitchen.no_orders')}</p>
          <p className="text-sm mt-2">{t('kitchen.no_orders_msg')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-gray-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">#{order.orderNumber}</h2>
                  <p className="text-sm text-gray-400">
                    {order.table
                      ? `طاولة ${order.table.number}`
                      : order.customerName || 'طلب أونلاين'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleTimeString('ar-SA')}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}
                >
                  {getStatusText(order.status)}
                </span>
              </div>

              <div className="border-t border-gray-700 pt-3 space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{item.quantity}x </span>
                      <span>{item.menuItem.name || item.menuItem.nameAr}</span>
                      {item.notes && <p className="text-xs text-yellow-400 mt-0.5">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}
                      >
                        {getStatusText(item.status)}
                      </span>
                      {item.status === 'PENDING' && (
                        <button
                          onClick={() => handleItemStatus(order.id, item.id, 'PREPARING')}
                          className="p-1.5 bg-blue-600 rounded-lg hover:bg-blue-500"
                          title={t('kitchen.start_prep')}
                        >
                          <Clock size={14} />
                        </button>
                      )}
                      {item.status === 'PREPARING' && (
                        <button
                          onClick={() => handleItemStatus(order.id, item.id, 'READY')}
                          className="p-1.5 bg-green-600 rounded-lg hover:bg-green-500"
                          title={t('kitchen.mark_done')}
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {order.notes && (
                <div className="bg-yellow-900/30 text-yellow-300 text-sm p-2 rounded-lg">
                  {order.notes}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                  <button
                    onClick={() => api.updateOrderStatus(order.id, 'PREPARING')}
                    className="flex-1 py-2 bg-blue-600 rounded-xl hover:bg-blue-500 text-sm font-medium"
                  >
                    <Clock className="w-4 h-4 inline ml-1" />
                    {t('kitchen.start_prep')}
                  </button>
                )}
                {order.status === 'PREPARING' && (
                  <button
                    onClick={() => api.updateOrderStatus(order.id, 'READY')}
                    className="flex-1 py-2 bg-green-600 rounded-xl hover:bg-green-500 text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4 inline ml-1" />
                    {t('kitchen.mark_done')}
                  </button>
                )}
                {order.status === 'READY' && (
                  <button
                    onClick={() => api.updateOrderStatus(order.id, 'DELIVERED')}
                    className="flex-1 py-2 bg-gray-600 rounded-xl hover:bg-gray-500 text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4 inline ml-1" />
                    {t('kitchen.delivered')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
