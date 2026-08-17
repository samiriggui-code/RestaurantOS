import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { Employee, Shift } from '../../types'
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from '../../i18n/useTranslation'

export default function EmployeesPage() {
  const { t } = useTranslation()
  const roleText: Record<string, string> = {
    ADMIN: t('roles.ADMIN'),
    MANAGER: t('roles.MANAGER'),
    CASHIER: t('roles.CASHIER'),
    WAITER: t('roles.WAITER'),
    CHEF: t('roles.CHEF'),
  }
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)

  const loadData = () => {
    Promise.all([api.getEmployees(), api.getShifts()])
      .then(([emps, shs]) => { setEmployees(emps); setShifts(shs) })
      .catch(() => toast.error('فشل تحميل البيانات'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      role: form.get('role'),
      pin: form.get('pin') || undefined,
      password: form.get('password') || undefined,
      shiftId: form.get('shiftId') || undefined,
    }
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, data)
        toast.success('تم تحديث الموظف')
      } else {
        await api.createEmployee(data)
        toast.success('تم إضافة الموظف')
      }
      setShowModal(false)
      setEditingEmployee(null)
      loadData()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleSaveShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr'),
      startTime: form.get('startTime'),
      endTime: form.get('endTime'),
      days: 127,
    }
    try {
      if (editingShift) {
        await api.updateShift(editingShift.id, data)
        toast.success('تم تحديث المناوبة')
      } else {
        await api.createShift(data)
        toast.success('تم إضافة المناوبة')
      }
      setShowShiftModal(false)
      setEditingShift(null)
      loadData()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return
    try {
      await api.deleteEmployee(id)
      toast.success('تم إلغاء تنشيط الموظف')
      loadData()
    } catch { toast.error('فشل الحذف') }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('employees.title')}</h1>
          <p className="text-gray-500">{t('employees.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingShift(null); setShowShiftModal(true) }} className="btn-secondary text-sm py-2">
            <Plus size={16} className="inline ml-1" /> {t('employees.add_shift')}
          </button>
          <button onClick={() => { setEditingEmployee(null); setShowModal(true) }} className="btn-primary text-sm py-2">
            <Plus size={16} className="inline ml-1" /> {t('employees.add')}
          </button>
        </div>
      </div>

      {/* Shifts */}
      <div className="card">
        <h2 className="font-bold mb-4">{t('employees.shifts')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{shift.name || shift.nameAr}</h3>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingShift(shift); setShowShiftModal(true) }} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={14} /></button>
                  <button onClick={() => { if (confirm('حذف المناوبة؟')) api.deleteShift(shift.id).then(loadData) }} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-500">{shift.startTime} - {shift.endTime}</p>
              <p className="text-xs text-gray-400 mt-1">{shift._count?.users || 0} {t('employees.employee_count')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Employees */}
      <div className="card">
        <h2 className="font-bold mb-4">قائمة الموظفين</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-right py-3 px-2">{t('employees.name')}</th>
                <th className="text-right py-3 px-2">{t('employees.email')}</th>
                <th className="text-right py-3 px-2">{t('employees.role')}</th>
                <th className="text-right py-3 px-2">{t('employees.shift')}</th>
                <th className="text-right py-3 px-2">{t('employees.status')}</th>
                <th className="py-3 px-2">{t('employees.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-2 font-medium">{emp.name}</td>
                  <td className="py-3 px-2 text-gray-500" dir="ltr">{emp.email}</td>
                  <td className="py-3 px-2">{roleText[emp.role] || emp.role}</td>
                  <td className="py-3 px-2">{emp.shift?.nameAr || emp.shift?.name || '-'}</td>
                  <td className="py-3 px-2">
                    <span className={`badge ${emp.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {emp.isActive ? t('employees.active') : t('employees.inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button onClick={() => { setEditingEmployee(emp); setShowModal(true) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg mr-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">{editingEmployee ? t('edit') : t('employees.add')}</h2>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employees.name')}</label>
                  <input name="name" defaultValue={editingEmployee?.name} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employees.email')}</label>
                  <input name="email" type="email" defaultValue={editingEmployee?.email} className="input-field" required dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employees.phone')}</label>
                  <input name="phone" defaultValue={editingEmployee?.phone} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employees.role')}</label>
                  <select name="role" defaultValue={editingEmployee?.role || 'WAITER'} className="input-field">
                    {Object.entries(roleText).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!editingEmployee && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('employees.password')}</label>
                    <input name="password" type="password" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('employees.pin')}</label>
                    <input name="pin" className="input-field" placeholder={t('employees.pin_placeholder')} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t('employees.shift')}</label>
                <select name="shiftId" defaultValue={editingEmployee?.shiftId || ''} className="input-field">
                  <option value="">{t('employees.none')}</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name || s.nameAr}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">{editingEmployee ? t('save') : t('add')}</button>
                <button type="button" onClick={() => { setShowModal(false); setEditingEmployee(null) }} className="btn-secondary flex-1">{t('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">{editingShift ? t('edit') : t('employees.add_shift')}</h2>
            <form onSubmit={handleSaveShift} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الاسم (عربي)</label>
                  <input name="nameAr" defaultValue={editingShift?.nameAr || ''} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الاسم</label>
                  <input name="name" defaultValue={editingShift?.name || ''} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employees.start_time')}</label>
                  <input name="startTime" type="time" defaultValue={editingShift?.startTime || '06:00'} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employees.end_time')}</label>
                  <input name="endTime" type="time" defaultValue={editingShift?.endTime || '14:00'} className="input-field" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">{editingShift ? t('save') : t('add')}</button>
                <button type="button" onClick={() => { setShowShiftModal(false); setEditingShift(null) }} className="btn-secondary flex-1">{t('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
