import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useThermalPrinter } from '../../hooks/useThermalPrinter';
import { Order } from '../../types';
import { Search, X, Printer, Usb, Clock, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/useTranslation';
import { formatMoney } from '../../lib/locale';

const statusColors: Record<string, string> = {
  PENDING: 'badge-pending',
  PREPARING: 'badge-preparing',
  READY: 'badge-ready',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
};

export default function OrdersPage() {
  const { t } = useTranslation();
  const printer = useThermalPrinter();
  const statusText: Record<string, string> = {
    PENDING: t('orders.pending'),
    PREPARING: t('orders.preparing'),
    READY: t('orders.ready'),
    DELIVERED: t('orders.delivered'),
    CANCELLED: t('orders.cancelled'),
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    api
      .getOrders(params.toString())
      .then(setOrders)
      .catch(() => toast.error(t('errors.load_failed')))
      .finally(() => setLoading(false));
  }, [filter, t]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await api.updateOrderStatus(id, status);
      toast.success(t('orders.status_updated'));
      loadOrders();
    } catch {
      toast.error(t('errors.failed'));
    }
  };

  const handlePayment = async (id: string, paymentStatus: string, paymentMethod: string) => {
    try {
      await api.updatePayment(id, { paymentStatus, paymentMethod });
      toast.success(t('orders.payment_updated'));
      loadOrders();
    } catch {
      toast.error(t('errors.failed'));
    }
  };

  const filteredOrders = orders.filter(
    o => !search || o.orderNumber.toString().includes(search) || o.customerName?.includes(search)
  );

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-50">{t('orders.title')}</h1>
          <p className="text-sm text-surface-400 mt-1">{t('orders.subtitle')}</p>
        </div>
        <div className="text-xs text-surface-400 bg-surface-800 px-3 py-1.5 rounded-lg border border-surface-600/40">
          {filteredOrders.length} {t('orders.count')}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              filter === s
                ? 'bg-primary-500/15 text-primary-200 border border-primary-500/30'
                : 'bg-surface-800 text-surface-300 hover:text-surface-50 hover:bg-surface-700 border border-surface-600/30'
            }`}
          >
            {s ? statusText[s] : t('orders.all')}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" size={20} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pr-10"
          placeholder={t('search')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredOrders.map((order, i) => (
          <div
            key={order.id}
            role="button"
            tabIndex={0}
            className="bg-surface-800 rounded-2xl p-4 border border-surface-600/40 hover:border-primary-500/30 transition-all duration-200 hover:shadow-glow animate-fade-in cursor-pointer"
            style={{ animationDelay: `${i * 0.03}s` }}
            onClick={() => setSelectedOrder(order)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') setSelectedOrder(order);
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-sm shadow-glow">
                  #{String(order.orderNumber).slice(-3)}
                </span>
                <div>
                  <p className="font-medium text-sm text-surface-50">
                    {order.customerName || `${t('consumer.table')} ${order.table?.number || '-'}`}
                  </p>
                  <p className="text-xs text-surface-400">
                    {order.type === 'DINE_IN'
                      ? t('menu_customer.dine_in')
                      : order.type === 'TAKEAWAY'
                        ? t('menu_customer.takeaway')
                        : t('menu_customer.delivery')}
                  </p>
                </div>
              </div>
              <span className={statusColors[order.status]}>{statusText[order.status]}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-surface-400">
                  <Clock size={12} />
                  {new Date(order.createdAt).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    order.paymentStatus === 'PAID'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {order.paymentStatus === 'PAID'
                    ? t('orders.payment.paid')
                    : t('orders.payment.unpaid')}
                </span>
              </div>
              <span className="font-bold text-primary-200">{formatMoney(order.total)}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-surface-600/40 flex gap-1.5 flex-wrap">
              {order.items?.slice(0, 4).map(item => (
                <span
                  key={item.id}
                  className="text-xs px-2 py-1 bg-surface-700 rounded-lg text-surface-300 truncate max-w-[120px]"
                >
                  {item.menuItem.name || item.menuItem.nameAr}
                </span>
              ))}
              {(order.items?.length || 0) > 4 && (
                <span className="text-xs px-2 py-1 bg-surface-700 rounded-lg text-surface-400">
                  +{order.items!.length - 4}
                </span>
              )}
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-surface-400">
            <ShoppingCart size={48} className="mb-3 text-surface-500" />
            <p className="text-lg font-medium">{t('no_data')}</p>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-600/40 shadow-modal animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-50">
                {t('orders.order')} #{selectedOrder.orderNumber}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 hover:bg-surface-700 rounded-lg text-surface-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-surface-400">{t('orders.type')}:</span>
                  <span className="mr-2 text-surface-50">
                    {selectedOrder.type === 'DINE_IN'
                      ? t('menu_customer.dine_in')
                      : selectedOrder.type === 'TAKEAWAY'
                        ? t('menu_customer.takeaway')
                        : t('menu_customer.delivery')}
                  </span>
                </div>
                <div>
                  <span className="text-surface-400">{t('orders.time')}:</span>
                  <span className="mr-2 text-surface-50">
                    {new Date(selectedOrder.createdAt).toLocaleString('ar-SA')}
                  </span>
                </div>
                {selectedOrder.table && (
                  <div>
                    <span className="text-surface-400">{t('consumer.table')}:</span>
                    <span className="mr-2 text-surface-50">{selectedOrder.table.number}</span>
                  </div>
                )}
                {selectedOrder.customerName && (
                  <div>
                    <span className="text-surface-400">{t('orders.customer')}:</span>
                    <span className="mr-2 text-surface-50">{selectedOrder.customerName}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-surface-600/40 pt-4">
                <h3 className="font-semibold mb-2 text-surface-50">{t('orders.items')}</h3>
                {selectedOrder.items.map(item => (
                  <div
                    key={item.id}
                    className="flex justify-between py-2 text-sm border-b border-surface-600/40 last:border-0"
                  >
                    <span className="text-surface-200">
                      {item.quantity}x {item.menuItem.name || item.menuItem.nameAr}
                    </span>
                    <span className="text-surface-50">
                      {formatMoney(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-surface-600/40 pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-surface-400">
                  <span>{t('orders.subtotal')}</span>
                  <span>{formatMoney(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-surface-400">
                  <span>{t('orders.tax')}</span>
                  <span>{formatMoney(selectedOrder.tax)}</span>
                </div>
                {selectedOrder.serviceCharge > 0 && (
                  <div className="flex justify-between text-surface-400">
                    <span>{t('orders.service')}</span>
                    <span>{formatMoney(selectedOrder.serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-surface-600/40">
                  <span className="text-surface-50">{t('orders.total')}</span>
                  <span className="text-primary-200">{formatMoney(selectedOrder.total)}</span>
                </div>
              </div>

              <div className="border-t border-surface-600/40 pt-4 space-y-2">
                {selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === 'PENDING' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedOrder.id, 'PREPARING')}
                        className="btn-primary text-sm py-2 flex-1"
                      >
                        {t('orders.start_preparing')}
                      </button>
                    )}
                    {selectedOrder.status === 'PREPARING' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedOrder.id, 'READY')}
                        className="btn-primary text-sm py-2 flex-1"
                      >
                        {t('orders.mark_ready')}
                      </button>
                    )}
                    {selectedOrder.status === 'READY' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedOrder.id, 'DELIVERED')}
                        className="btn-primary text-sm py-2 flex-1"
                      >
                        {t('orders.confirm_delivery')}
                      </button>
                    )}
                  </div>
                )}

                {selectedOrder.paymentStatus !== 'PAID' && selectedOrder.status !== 'CANCELLED' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePayment(selectedOrder.id, 'PAID', 'CASH')}
                      className="btn-secondary text-sm py-2 flex-1"
                    >
                      {t('orders.pay_cash')}
                    </button>
                    <button
                      onClick={() => handlePayment(selectedOrder.id, 'PAID', 'CARD')}
                      className="btn-secondary text-sm py-2 flex-1"
                    >
                      {t('orders.pay_card')}
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!printer.device) {
                        await printer.connectPrinter();
                      }
                      const receipt = await api.getReceipt(selectedOrder.id);
                      const text = JSON.stringify(receipt, null, 2);
                      await printer.printReceipt(text);
                    }}
                    className="btn-secondary text-sm py-2 flex-1 flex items-center justify-center gap-2"
                  >
                    <Printer size={16} />
                    {t('receipt.print')}
                  </button>
                  {printer.isSupported && (
                    <button
                      onClick={() => printer.connectPrinter()}
                      className={`btn-secondary text-sm py-2 px-3 ${printer.device ? 'bg-emerald-500/15 text-emerald-300' : ''}`}
                      title={
                        printer.device ? t('orders.printer_connected') : t('orders.connect_printer')
                      }
                    >
                      <Usb size={16} />
                    </button>
                  )}
                </div>

                {selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'DELIVERED' && (
                  <button
                    onClick={() => {
                      if (confirm(t('orders.confirm_cancel')))
                        handleStatusUpdate(selectedOrder.id, 'CANCELLED');
                    }}
                    className="btn-danger text-sm py-2 w-full"
                  >
                    {t('orders.cancel')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
