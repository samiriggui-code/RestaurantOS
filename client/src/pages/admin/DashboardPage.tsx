import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Table2,
  DollarSign,
  Clock,
  Users,
  Package,
  CreditCard,
  Percent,
  type LucideIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../../lib/locale';

const StatCard = ({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: number;
  color?: string;
}) => (
  <div className="relative group bg-surface-800 rounded-2xl p-5 border border-surface-600/40 hover:border-primary-500/30 transition-all duration-300 hover:shadow-glow overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${color || 'bg-primary-500/15'}`}>
          <Icon size={20} className={color ? 'text-white' : 'text-primary-200'} />
        </div>
        {trend !== undefined && (
          <span
            className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full ${
              trend >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
            }`}
          >
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-surface-50">{value}</div>
      <div className="text-sm text-surface-300 mt-0.5">{title}</div>
      {sub && <div className="text-xs text-surface-400 mt-1">{sub}</div>}
    </div>
  </div>
);

export default function DashboardPage() {
  const { t } = useTranslation();
  useAuthStore();
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/reports/dashboard');
      return data;
    },
    refetchInterval: 60_000,
  });

  const { data: salesData } = useQuery({
    queryKey: ['sales-chart'],
    queryFn: async () => {
      const { data } = await api.get('/reports/sales?period=week');
      return data;
    },
  });

  useEffect(() => {
    const socket = getSocket(token || undefined);
    const handleNewData = () => refetch();
    socket.on('order:created', handleNewData);
    socket.on('payment:completed', handleNewData);
    return () => {
      socket.off('order:created', handleNewData);
      socket.off('payment:completed', handleNewData);
    };
  }, [refetch, token]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );

  const s = data?.sales;
  const o = data?.operations;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-surface-50">{t('dashboard.title')}</h1>
        <p className="text-surface-400 text-sm mt-1">
          {t('dashboard.subtitle')} — {new Date().toLocaleDateString('ar-DZ')}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.today_revenue')}
          value={formatMoney(s?.today || 0)}
          sub={`${t('dashboard.yesterday')}: ${formatMoney(s?.yesterday || 0)}`}
          icon={DollarSign}
          color="bg-emerald-500/15"
          trend={s?.growth}
        />
        <StatCard
          title={t('dashboard.today_orders')}
          value={s?.ordersCount || 0}
          sub={`${t('dashboard.avg_order')}: ${formatMoney(Math.round(s?.avgOrderValue || 0))}`}
          icon={ShoppingCart}
          color="bg-blue-500/15"
        />
        <StatCard
          title={t('dashboard.pending_orders')}
          value={o?.pendingOrders || 0}
          sub={t('dashboard.awaiting_preparation')}
          icon={Clock}
          color={o?.pendingOrders > 5 ? 'bg-amber-500/15' : 'bg-primary-500/15'}
        />
        <StatCard
          title={t('dashboard.active_tables')}
          value={`${o?.tablesOccupied || 0}/${o?.totalTables || 0}`}
          sub={t('dashboard.occupied_total')}
          icon={Table2}
          color="bg-purple-500/15"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-800 rounded-2xl p-4 border border-surface-600/40 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15">
            <Users size={18} className="text-amber-300" />
          </div>
          <div>
            <div className="text-lg font-bold text-surface-50">{o?.totalCustomers || 0}</div>
            <div className="text-xs text-surface-400">{t('dashboard.total_customers')}</div>
          </div>
        </div>
        <div className="bg-surface-800 rounded-2xl p-4 border border-surface-600/40 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15">
            <CreditCard size={18} className="text-emerald-300" />
          </div>
          <div>
            <div className="text-lg font-bold text-surface-50">{s?.paidOrders || 0}</div>
            <div className="text-xs text-surface-400">{t('dashboard.paid_orders')}</div>
          </div>
        </div>
        <div className="bg-surface-800 rounded-2xl p-4 border border-surface-600/40 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/15">
            <Package size={18} className="text-blue-300" />
          </div>
          <div>
            <div className="text-lg font-bold text-surface-50">{data?.totalItems || 0}</div>
            <div className="text-xs text-surface-400">{t('dashboard.menu_items')}</div>
          </div>
        </div>
        <div className="bg-surface-800 rounded-2xl p-4 border border-surface-600/40 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-500/15">
            <Percent size={18} className="text-primary-200" />
          </div>
          <div>
            <div className="text-lg font-bold text-surface-50">{o?.occupancyRate || 0}%</div>
            <div className="text-xs text-surface-400">{t('dashboard.occupancy_rate')}</div>
          </div>
        </div>
      </div>

      {salesData?.byDay?.length > 0 && (
        <div className="bg-surface-800 rounded-2xl p-5 border border-surface-600/40 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-surface-50 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-200" />
              {t('dashboard.sales_chart')}
            </h2>
            <span className="text-xs text-surface-400 bg-surface-700 px-2.5 py-1 rounded-lg">
              آخر 7 أيام
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={salesData.byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222a3d" />
              <XAxis dataKey="date" tick={{ fill: '#6e7180', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6e7180', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#131b2e',
                  border: '1px solid #222a3d',
                  borderRadius: 8,
                  color: '#dae2fd',
                }}
                labelStyle={{ color: '#c3c6d7' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data?.recentOrders?.length > 0 && (
        <div className="bg-surface-800 rounded-2xl p-5 border border-surface-600/40 animate-fade-in">
          <h2 className="text-base font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-primary-200" />
            {t('dashboard.recent_orders')}
          </h2>
          <div className="space-y-1">
            {data.recentOrders.slice(0, 8).map(
              (
                order: {
                  id: string;
                  orderNumber: string | number;
                  customerName?: string;
                  table?: { number?: string | number };
                  status: string;
                  total: number;
                },
                i: number
              ) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-700/50 transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-200">
                      #{String(order.orderNumber).slice(-3)}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-surface-50">
                        {order.customerName ||
                          `${t('consumer.table')} ${order.table?.number || '-'}`}
                      </span>
                      {order.table && (
                        <span className="text-xs text-surface-400 mr-2">
                          {t('consumer.table')} {order.table.number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        order.status === 'DELIVERED'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : order.status === 'PREPARING'
                            ? 'bg-amber-500/15 text-amber-300'
                            : order.status === 'READY'
                              ? 'bg-blue-500/15 text-blue-300'
                              : order.status === 'CANCELLED'
                                ? 'bg-red-500/15 text-red-300'
                                : 'bg-surface-600 text-surface-300'
                      }`}
                    >
                      {order.status === 'DELIVERED'
                        ? t('orders.delivered')
                        : order.status === 'PREPARING'
                          ? t('orders.preparing')
                          : order.status === 'READY'
                            ? t('orders.ready')
                            : order.status === 'CANCELLED'
                              ? t('orders.cancelled')
                              : order.status === 'PENDING'
                                ? t('orders.pending')
                                : order.status}
                    </span>
                    <span className="text-sm text-emerald-300 font-medium">
                      {formatMoney(order.total ?? 0)}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
