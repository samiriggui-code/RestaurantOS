import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, TrendingDown, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { centsToEuros, eurosToCents, formatMoney } from '../../lib/locale';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export default function ExpensesPage() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const loadExpenses = () => {
    api
      .get('/expenses')
      .then(res => setExpenses(res.data))
      .catch(() => toast.error('فشل تحميل المصروفات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      description: form.get('description'),
      amount: eurosToCents(parseFloat(form.get('amount') as string) || 0),
      category: form.get('category'),
      notes: form.get('notes'),
      date: new Date().toISOString(),
    };
    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, data);
        toast.success('تم تحديث المصروف');
      } else {
        await api.post('/expenses', data);
        toast.success('تم إضافة المصروف');
      }
      setShowModal(false);
      setEditingExpense(null);
      loadExpenses();
    } catch {
      toast.error('فشل الحفظ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('تم الحذف');
      loadExpenses();
    } catch {
      toast.error('فشل الحذف');
    }
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('nav.expenses')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">إدارة المصروفات</p>
        </div>
        <button
          onClick={() => {
            setEditingExpense(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> إضافة مصروف
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 text-lg font-bold">
          <TrendingDown className="text-red-500" size={24} />
          <span>
            إجمالي المصروفات: <span className="text-red-500">{formatMoney(total)}</span>
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        {expenses.map(expense => (
          <div key={expense.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Tag className="text-red-600" size={18} />
              </div>
              <div>
                <h3 className="font-medium">{expense.description}</h3>
                <p className="text-xs text-gray-500">
                  {expense.category} • {new Date(expense.createdAt).toLocaleDateString('ar-DZ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-red-600">{formatMoney(expense.amount)}</span>
              <button
                onClick={() => {
                  setEditingExpense(expense);
                  setShowModal(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDelete(expense.id)}
                className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {!expenses.length && <p className="text-gray-400 text-center py-10">{t('no_data')}</p>}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="button"
          tabIndex={0}
          aria-label={t('cancel')}
          onClick={e => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') setShowModal(false);
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold mb-4">{editingExpense ? t('edit') : 'إضافة مصروف'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                name="description"
                defaultValue={editingExpense?.description}
                placeholder="الوصف"
                className="input-field"
                required
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                defaultValue={editingExpense ? centsToEuros(editingExpense.amount) : ''}
                placeholder="المبلغ"
                className="input-field"
                required
              />
              <select
                name="category"
                defaultValue={editingExpense?.category || 'إمدادات'}
                className="input-field"
              >
                <option value="إمدادات">إمدادات</option>
                <option value="صيانة">صيانة</option>
                <option value="رواتب">رواتب</option>
                <option value="فواتير">فواتير</option>
                <option value="أخرى">أخرى</option>
              </select>
              <textarea
                name="notes"
                defaultValue={editingExpense?.notes || ''}
                placeholder="ملاحظات"
                className="input-field"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
