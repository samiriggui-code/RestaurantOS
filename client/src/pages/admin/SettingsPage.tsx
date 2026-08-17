import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from '../../i18n/useTranslation'
import { displayName } from '../../lib/locale'
import { PUBLIC_MENU_URL, PUBLIC_ORDER_URL } from '../../lib/public-site'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { business, user } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr'),
      taxRate: parseFloat(form.get('taxRate') as string) || 15,
      serviceChargeRate: parseFloat(form.get('serviceChargeRate') as string) || 10,
      currency: form.get('currency'),
      wifiDuration: parseInt(form.get('wifiDuration') as string) || 120,
      wifiVoucherEnabled: form.get('wifiVoucherEnabled') === 'on',
      autoPrintOrders: form.get('autoPrintOrders') === 'on',
      kitchenDisplayEnabled: form.get('kitchenDisplayEnabled') === 'on',
    }
    try {
      await api.updateSettings(data)
      toast.success(t('settings.saved'))
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-gray-500">{t('settings.subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Info */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('settings.business_info')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.name')}</label>
              <input name="name" defaultValue={business?.name || ''} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.name_secondary')}</label>
              <input name="nameAr" defaultValue={business?.nameAr || ''} className="input-field" />
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('settings.financial')}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.tax_rate')}</label>
              <input name="taxRate" type="number" step="0.1" defaultValue={business?.taxRate || 15} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.service_charge')}</label>
              <input name="serviceChargeRate" type="number" step="0.1" defaultValue={business?.serviceChargeRate || 10} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.currency')}</label>
              <select name="currency" defaultValue={business?.currency || 'EUR'} className="input-field">
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
              </select>
            </div>
          </div>
        </div>

        {/* WiFi */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('settings.wifi')}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.wifi_duration')}</label>
                <input name="wifiDuration" type="number" defaultValue={business?.wifiDuration || 120} className="input-field" />
              </div>
            </div>
            <label className="flex items-center gap-3">
              <input name="wifiVoucherEnabled" type="checkbox" defaultChecked={business?.wifiVoucherEnabled} className="w-5 h-5 rounded border-gray-300 text-primary-600" />
              <span className="text-sm">{t('settings.wifi_voucher')}</span>
            </label>
          </div>
        </div>

        {/* System */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('settings.system')}</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input name="kitchenDisplayEnabled" type="checkbox" defaultChecked={business?.kitchenDisplayEnabled} className="w-5 h-5 rounded border-gray-300 text-primary-600" />
              <span className="text-sm">{t('settings.kitchen_display')}</span>
            </label>
            <label className="flex items-center gap-3">
              <input name="autoPrintOrders" type="checkbox" defaultChecked={business?.autoPrintOrders} className="w-5 h-5 rounded border-gray-300 text-primary-600" />
              <span className="text-sm">{t('settings.auto_print')}</span>
            </label>
          </div>
        </div>

        {/* Business Info - Public */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('settings.business_info')}</h2>
          <p className="text-sm text-gray-500 mb-3">{t('settings.business_public_desc')}</p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div>
              <span className="text-xs text-gray-400">{t('settings.public_menu_link')}</span>
              <div className="flex gap-2 mt-1">
                <input readOnly value={PUBLIC_MENU_URL} className="input-field text-xs flex-1" dir="ltr" onClick={e => (e.target as HTMLInputElement).select()} />
                <button onClick={() => { navigator.clipboard.writeText(PUBLIC_MENU_URL); toast.success(t('copied')) }} className="px-3 py-2 bg-primary-500/15 text-tomato-light rounded-xl text-sm hover:bg-primary-500/25">{t('copy')}</button>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-400">{t('settings.public_order_link')}</span>
              <div className="flex gap-2 mt-1">
                <input readOnly value={PUBLIC_ORDER_URL} className="input-field text-xs flex-1" dir="ltr" onClick={e => (e.target as HTMLInputElement).select()} />
                <button onClick={() => { navigator.clipboard.writeText(PUBLIC_ORDER_URL); toast.success(t('copied')) }} className="px-3 py-2 bg-primary-500/15 text-tomato-light rounded-xl text-sm hover:bg-primary-500/25">{t('copy')}</button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Info */}
        <div className="card">
          <h2 className="font-bold mb-4">{t('settings.admin_info')}</h2>
          <p className="text-sm text-gray-500">{t('settings.manager')}: {user?.name} ({user?.email})</p>
          <p className="text-sm text-gray-500">{t('settings.business_id')}: <span dir="ltr" className="font-mono text-xs">{business?.id}</span></p>
          <button onClick={() => { navigator.clipboard.writeText(business?.id || ''); toast.success(t('copied')) }} className="mt-2 text-xs px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">{t('copy')}</button>
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
          {loading ? t('loading') : t('settings.save')}
        </button>
      </form>
    </div>
  )
}
