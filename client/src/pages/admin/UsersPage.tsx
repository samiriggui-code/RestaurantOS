import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { Plus, Edit2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const loadUsers = () => {
    api
      .get('/employees')
      .then(res => setUsers(res.data))
      .catch(() => toast.error('فشل تحميل المستخدمين'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      name: form.get('name'),
      email: form.get('email'),
      role: form.get('role'),
      phone: form.get('phone'),
    };
    const password = form.get('password') as string;
    if (password) data.password = password;

    try {
      if (editingUser) {
        await api.put(`/employees/${editingUser.id}`, data);
        toast.success('تم تحديث المستخدم');
      } else {
        await api.post('/employees', data);
        toast.success('تم إضافة المستخدم');
      }
      setShowModal(false);
      setEditingUser(null);
      loadUsers();
    } catch {
      toast.error('فشل الحفظ');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.put(`/employees/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
      loadUsers();
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    CASHIER: 'bg-green-100 text-green-700',
    WAITER: 'bg-yellow-100 text-yellow-700',
    CHEF: 'bg-red-100 text-red-700',
  };

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
          <h1 className="text-xl font-bold">{t('nav.users')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('employees.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> {t('employees.add')}
        </button>
      </div>

      <div className="grid gap-3">
        {users.map(u => (
          <div key={u.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                {u.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-medium">{u.name}</h3>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role] || 'bg-gray-100'}`}
              >
                {t(`roles.${u.role}`)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
              >
                {u.isActive ? t('employees.active') : t('employees.inactive')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(u)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Toggle active"
              >
                <Shield size={16} />
              </button>
              <button
                onClick={() => {
                  setEditingUser(u);
                  setShowModal(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Edit2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {!users.length && <p className="text-gray-400 text-center py-10">{t('no_data')}</p>}
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
            <h2 className="font-bold mb-4">{editingUser ? t('edit') : t('employees.add')}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                name="name"
                defaultValue={editingUser?.name}
                placeholder={t('employees.name')}
                className="input-field"
                required
              />
              <input
                name="email"
                type="email"
                defaultValue={editingUser?.email}
                placeholder={t('employees.email')}
                className="input-field"
                required
              />
              <input
                name="phone"
                defaultValue={editingUser?.phone || ''}
                placeholder={t('employees.phone')}
                className="input-field"
              />
              {!editingUser && (
                <input
                  name="password"
                  type="password"
                  placeholder={t('employees.password')}
                  className="input-field"
                  required
                />
              )}
              <select
                name="role"
                defaultValue={editingUser?.role || 'WAITER'}
                className="input-field"
              >
                <option value="ADMIN">{t('roles.ADMIN')}</option>
                <option value="MANAGER">{t('roles.MANAGER')}</option>
                <option value="CASHIER">{t('roles.CASHIER')}</option>
                <option value="WAITER">{t('roles.WAITER')}</option>
                <option value="CHEF">{t('roles.CHEF')}</option>
              </select>
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
