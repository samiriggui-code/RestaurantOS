import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/useTranslation';
import { formatMoney } from '../../lib/locale';

const COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

type SalesDataPoint = { date: string; total: number; count: number };
type CategoryDataPoint = {
  id: string;
  name?: string;
  nameAr?: string;
  revenue: number;
  totalSold: number;
};
type EmployeeDataPoint = {
  id: string;
  name: string;
  role: string;
  orderCount: number;
  totalSales: number;
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryDataPoint[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeeDataPoint[]>([]);
  const [period, setPeriod] = useState('7');
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(() => {
    const from = new Date();
    from.setDate(from.getDate() - parseInt(period));
    const params = `from=${from.toISOString()}`;

    Promise.all([
      api.getSalesReport(`${params}&groupBy=day`),
      api.getCategoryReport(params),
      api.getEmployeeReport(params),
    ])
      .then(([sales, cats, emps]) => {
        setSalesData(sales);
        setCategoryData(cats);
        setEmployeeData(emps);
      })
      .catch(() => toast.error('فشل تحميل التقارير'))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const totalSales = salesData.reduce((sum, d) => sum + d.total, 0);
  const totalOrders = salesData.reduce((sum, d) => sum + d.count, 0);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-gray-500">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {['7', '30', '90'].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {d === '7'
                ? t('reports.period.7days')
                : d === '30'
                  ? t('reports.period.30days')
                  : t('reports.period.90days')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-2xl font-bold text-primary-600">{formatMoney(totalSales)}</p>
          <p className="text-sm text-gray-500">{t('reports.total_sales')}</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold">{totalOrders}</p>
          <p className="text-sm text-gray-500">{t('reports.total_orders')}</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold">
            {totalOrders > 0 ? formatMoney(Math.round(totalSales / totalOrders)) : formatMoney(0)}
          </p>
          <p className="text-sm text-gray-500">{t('reports.avg_order')}</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold">{categoryData.reduce((s, c) => s + c.totalSold, 0)}</p>
          <p className="text-sm text-gray-500">{t('reports.total_items_sold')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('reports.daily_sales')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('reports.sales_by_category')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                  label={({ nameAr, percent }) => `${nameAr} (${(percent * 100).toFixed(0)}%)`}
                >
                  {categoryData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Table */}
      <div className="card">
        <h2 className="font-bold mb-4">{t('reports.category_details')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-right py-3 px-2">{t('reports.category')}</th>
                <th className="text-right py-3 px-2">{t('reports.quantity_sold')}</th>
                <th className="text-right py-3 px-2">{t('reports.revenue')}</th>
                <th className="text-right py-3 px-2">{t('reports.percentage')}</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map(cat => {
                const totalRev = categoryData.reduce((s, c) => s + c.revenue, 0);
                const pct = totalRev > 0 ? ((cat.revenue / totalRev) * 100).toFixed(1) : 0;
                return (
                  <tr key={cat.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium">{cat.name || cat.nameAr}</td>
                    <td className="py-3 px-2">{cat.totalSold}</td>
                    <td className="py-3 px-2">{formatMoney(cat.revenue)}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Performance */}
      <div className="card">
        <h2 className="font-bold mb-4">{t('reports.employee_performance')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-right py-3 px-2">{t('reports.employee')}</th>
                <th className="text-right py-3 px-2">{t('reports.employee_role')}</th>
                <th className="text-right py-3 px-2">{t('reports.employee_orders')}</th>
                <th className="text-right py-3 px-2">{t('reports.employee_sales')}</th>
              </tr>
            </thead>
            <tbody>
              {employeeData.map(emp => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-2 font-medium">{emp.name}</td>
                  <td className="py-3 px-2">{emp.role}</td>
                  <td className="py-3 px-2">{emp.orderCount}</td>
                  <td className="py-3 px-2">{formatMoney(emp.totalSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
