import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Reservation, Table } from '../../types';
import { Plus, CalendarDays, Phone, Users, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/useTranslation';

const statusColors: Record<string, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-preparing',
  SEATED: 'badge-ready',
  CANCELLED: 'badge-cancelled',
  NO_SHOW: 'badge-cancelled',
};

export default function ReservationsPage() {
  const { t } = useTranslation();
  const statusText: Record<string, string> = {
    PENDING: t('reservations.status.pending'),
    CONFIRMED: t('reservations.status.confirmed'),
    SEATED: t('reservations.status.seated'),
    CANCELLED: t('reservations.status.cancelled'),
    NO_SHOW: t('reservations.status.no_show'),
  };
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  const loadData = useCallback(() => {
    Promise.all([api.getReservations(`date=${dateFilter}`), api.getTables()])
      .then(([res, tabs]) => {
        setReservations(res);
        setTables(tabs);
      })
      .catch(() => toast.error('فشل تحميل البيانات'))
      .finally(() => setLoading(false));
  }, [dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      customerName: form.get('customerName'),
      customerPhone: form.get('customerPhone'),
      guests: parseInt(form.get('guests') as string) || 1,
      tableId: form.get('tableId') || null,
      dateTime: form.get('dateTime'),
      notes: form.get('notes'),
    };
    try {
      if (editingRes) {
        await api.updateReservation(editingRes.id, data);
        toast.success('تم تحديث الحجز');
      } else {
        await api.createReservation(data);
        toast.success('تم إضافة الحجز');
      }
      setShowModal(false);
      setEditingRes(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.updateReservationStatus(id, status);
      toast.success('تم تحديث الحالة');
      loadData();
    } catch {
      toast.error('فشل التحديث');
    }
  };

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
          <h1 className="text-2xl font-bold">{t('reservations.title')}</h1>
          <p className="text-gray-500">{t('reservations.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setEditingRes(null);
            setShowModal(true);
          }}
          className="btn-primary text-sm py-2"
        >
          <Plus size={16} className="inline ml-1" /> {t('reservations.add')}
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <CalendarDays size={20} className="text-gray-400" />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="input-field w-auto"
        />
      </div>

      {/* Reservations */}
      <div className="space-y-3">
        {reservations.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">
            <p>{t('no_data')}</p>
          </div>
        ) : (
          reservations.map(res => (
            <div key={res.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{res.customerName}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone size={14} />
                      {res.customerPhone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {res.guests} {t('reservations.guests_label')}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">
                      {new Date(res.dateTime).toLocaleString('ar-SA')}
                    </span>
                    {res.table && (
                      <span className="mr-3 text-gray-500">طاولة {res.table.number}</span>
                    )}
                  </div>
                  {res.notes && <p className="text-sm text-gray-400 mt-1">{res.notes}</p>}
                </div>
                <div className="text-left">
                  <span className={statusColors[res.status]}>{statusText[res.status]}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {res.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(res.id, 'CONFIRMED')}
                      className="btn-primary text-sm py-2 flex-1"
                    >
                      {t('reservations.confirm')}
                    </button>
                    <button
                      onClick={() => handleStatusChange(res.id, 'CANCELLED')}
                      className="btn-danger text-sm py-2 flex-1"
                    >
                      {t('cancel')}
                    </button>
                  </>
                )}
                {res.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleStatusChange(res.id, 'SEATED')}
                    className="btn-primary text-sm py-2 flex-1"
                  >
                    {t('reservations.seated')}
                  </button>
                )}
                {(res.status === 'PENDING' || res.status === 'CONFIRMED') && (
                  <button
                    onClick={() => {
                      setEditingRes(res);
                      setShowModal(true);
                    }}
                    className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {(res.status === 'CONFIRMED' || res.status === 'PENDING') && (
                  <button
                    onClick={() => handleStatusChange(res.id, 'NO_SHOW')}
                    className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 text-sm"
                  >
                    {t('reservations.status.no_show')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingRes ? t('edit') : t('reservations.add')}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('reservations.customer_name')}
                  </label>
                  <input
                    name="customerName"
                    defaultValue={editingRes?.customerName || ''}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('reservations.customer_phone')}
                  </label>
                  <input
                    name="customerPhone"
                    defaultValue={editingRes?.customerPhone || ''}
                    className="input-field"
                    required
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('reservations.guests')}
                  </label>
                  <input
                    name="guests"
                    type="number"
                    defaultValue={editingRes?.guests || 1}
                    min={1}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('reservations.table')}
                  </label>
                  <select
                    name="tableId"
                    defaultValue={editingRes?.tableId || ''}
                    className="input-field"
                  >
                    <option value="">{t('reservations.no_table')}</option>
                    {tables
                      .filter(t => t.status === 'AVAILABLE')
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          طاولة {t.number} (سعة {t.capacity})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('reservations.date_time')}
                </label>
                <input
                  name="dateTime"
                  type="datetime-local"
                  defaultValue={editingRes?.dateTime?.slice(0, 16) || ''}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('reservations.notes')}</label>
                <textarea
                  name="notes"
                  defaultValue={editingRes?.notes || ''}
                  className="input-field"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">
                  {editingRes ? t('save') : t('reservations.book')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingRes(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
