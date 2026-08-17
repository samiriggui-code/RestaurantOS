import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { Shift } from '../../types'
import { Plus, Edit2, Trash2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ShiftsPage() {
  const { t } = useTranslation()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)

  const loadShifts = () => {
    api.get('/employees/shifts')
      .then(res => setShifts(res.data))
      .catch(() => toast.error('فشل تحميل المناوبات'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadShifts() }, [])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr'),
      startTime: form.get('startTime'),
      endTime: form.get('endTime'),
    }
    try {
      if (editingShift) {
        await api.put(`/employees/shifts/${editingShift.id}`, data)
        toast.success('تم تحديث المناوبة')
      } else {
        await api.post('/employees/shifts', data)
        toast.success('تم إضافة المناوبة')
      }
      setShowModal(false)
      setEditingShift(null)
      loadShifts()
    } catch { toast.error('فشل الحفظ') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return
    try {
      await api.delete(`/employees/shifts/${id}`)
      toast.success('تم الحذف')
      loadShifts()
    } catch { toast.error('فشل الحذف') }
  }

  const getDays = (mask: number) => DAYS.filter((_, i) => mask & (1 << i))

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('nav.shifts')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('employees.subtitle')}</p>
        </div>
        <button onClick={() => { setEditingShift(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> {t('employees.add_shift')}
        </button>
      </div>

      <div className="grid gap-4">
        {shifts.map(shift => (
          <div key={shift.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Clock className="text-emerald-600" size={24} />
              </div>
              <div>
                <h3 className="font-medium">{shift.name || shift.nameAr}</h3>
                <p className="text-sm text-gray-500">{shift.startTime} - {shift.endTime}</p>
                <div className="flex gap-1 mt-1">
                  {getDays(shift.days).map(d => (
                    <span key={d} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{d}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {shift._count && <span className="text-xs text-gray-400">{shift._count.users} {t('employees.name')}</span>}
              <button onClick={() => { setEditingShift(shift); setShowModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(shift.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {!shifts.length && <p className="text-gray-400 text-center py-10">{t('no_data')}</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-4">{editingShift ? t('edit') : t('employees.add_shift')}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input name="name" defaultValue={editingShift?.name} placeholder={t('employees.name') + ' (EN)'} className="input-field" required />
              <input name="nameAr" defaultValue={editingShift?.nameAr || ''} placeholder={t('employees.name') + ' (AR)'} className="input-field" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">{t('employees.shift')} - {t('employees.name')}</label>
                  <input type="time" name="startTime" defaultValue={editingShift?.startTime || '09:00'} className="input-field" required />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">End</label>
                  <input type="time" name="endTime" defaultValue={editingShift?.endTime || '17:00'} className="input-field" required />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('cancel')}</button>
                <button type="submit" className="btn-primary">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
