import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../store/CartContext'
import { useAuthStore } from '../store/authStore'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useTranslation } from '../i18n/useTranslation'
import { api } from '../services/api'
import {
  Trash2, Plus, Minus, ArrowRight, CreditCard, Store, Package, Truck,
  WifiOff, ShoppingBag, Wallet, Sparkles, MapPin, Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function CartPage() {
  const { t } = useTranslation()
  const isOnline = useNetworkStatus()
  const navigate = useNavigate()
  const { business } = useAuthStore()
  const {
    items, subtotal, tableId, existingOrderId, orderType, customerName, customerPhone, notes, businessId,
    setOrderType, setCustomerName, setCustomerPhone, setNotes,
    removeItem, updateItemQuantity, clearCart,
  } = useCart()
  const effectiveBusinessId = business?.id || businessId || new URLSearchParams(window.location.search).get('businessId') || ''
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH')

  const taxRate = business?.taxRate || 15
  const serviceChargeRate = business?.serviceChargeRate || 10
  const tax = subtotal * (taxRate / 100)
  const serviceCharge = orderType === 'DINE_IN' ? subtotal * (serviceChargeRate / 100) : 0
  const total = subtotal + tax + serviceCharge

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error(t('menu_customer.cart_empty'))
      return
    }

    setLoading(true)
    try {
      const itemsData = items.map(item => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        notes: item.notes,
        selectedModifiers: item.selectedModifiers,
      }))

      if (existingOrderId) {
        const order = await api.addItemsToOrder(existingOrderId, itemsData)
        toast.success('تم إضافة الأصناف للطلب!')
        clearCart()
        const params = new URLSearchParams(window.location.search)
        navigate(`/order/${order.orderNumber}?${params.toString()}`)
      } else {
        const orderData = {
          items: itemsData,
          tableId,
          type: orderType,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          notes: notes || undefined,
          businessId: effectiveBusinessId,
        }
        const order = await api.createOrder(orderData)
        toast.success('تم إرسال الطلب بنجاح!')
        clearCart()
        const params = new URLSearchParams(window.location.search)
        navigate(`/order/${order.orderNumber}?${params.toString()}`)
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل إرسال الطلب')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-surface-50 to-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-3xl bg-surface-100 flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-surface-300" />
        </div>
        <h2 className="text-xl font-bold text-surface-600 mb-1">{t('menu_customer.cart_empty')}</h2>
        <p className="text-surface-400 mb-8">أضف أصنافاً من القائمة</p>
        <button onClick={() => navigate('/menu')} className="btn-primary flex items-center gap-2">
          <Store size={18} />
          {t('menu_customer.view_menu')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-charcoal-soft max-w-lg mx-auto pb-36 text-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-charcoal/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 bg-gradient-to-br from-tomato-dark via-tomato to-tomato-light px-5 py-4">
          <button onClick={() => navigate('/menu')} className="rounded-2xl bg-white/15 p-2.5 backdrop-blur-sm transition-all hover:bg-white/25">
            <ArrowRight className="h-5 w-5 text-white" />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-white">{t('menu_customer.cart')}</h1>
            <p className="text-xs text-cream/80">{items.length} {t('menu_customer.cart_items')}</p>
          </div>
          <button
            onClick={clearCart}
            className="mr-auto p-2.5 bg-red-500/20 hover:bg-red-500/30 rounded-2xl backdrop-blur-sm transition-all"
          >
            <Trash2 className="w-4 h-4 text-red-300" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Order Type */}
        <div className="rounded-3xl border border-white/10 bg-charcoal/80 p-5 shadow-soft">
          <label className="mb-4 block text-sm font-bold text-cream/70">{t('menu_customer.order_type')}</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'DINE_IN', label: t('menu_customer.dine_in'), icon: Store },
              { value: 'TAKEAWAY', label: t('menu_customer.takeaway'), icon: Package },
              { value: 'DELIVERY', label: t('menu_customer.delivery'), icon: Truck },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setOrderType(value as any)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-sm font-medium transition-all duration-200 ${
                  orderType === value
                    ? 'border-primary-500 bg-primary-50/50 text-primary-700 shadow-sm'
                    : 'border-surface-100 text-surface-500 hover:border-surface-200 hover:bg-surface-50'
                }`}
              >
                <Icon size={22} className={orderType === value ? 'text-primary-500' : 'text-surface-400'} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Customer Info */}
        {(orderType === 'DELIVERY' || orderType === 'TAKEAWAY') && (
          <div className="bg-white rounded-3xl p-5 border border-surface-100 shadow-soft space-y-3.5 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={16} className="text-primary-500" />
              <span className="text-sm font-bold text-surface-600">معلومات العميل</span>
            </div>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="input-field"
              placeholder={t('reservations.customer_name')}
            />
            <input
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="input-field"
              placeholder={t('reservations.customer_phone')}
              dir="ltr"
            />
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-surface-700 text-sm">الطلبية</h3>
            <span className="text-xs text-surface-400">{items.length} صنف</span>
          </div>
          {items.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl p-4 border border-surface-100 shadow-soft animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-surface-800">{item.menuItem.name || item.menuItem.nameAr}</h4>
                  <span className="text-sm text-primary-600 font-medium">{item.totalPrice.toFixed(2)} د.ج</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateItemQuantity(index, Math.max(1, item.quantity - 1))}
                    className="w-9 h-9 bg-surface-100 hover:bg-surface-200 rounded-xl flex items-center justify-center transition-all active:scale-90"
                  >
                    <Minus size={14} className="text-surface-600" />
                  </button>
                  <span className="w-8 text-center font-bold text-surface-800 text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateItemQuantity(index, item.quantity + 1)}
                    className="w-9 h-9 bg-primary-50 hover:bg-primary-100 rounded-xl flex items-center justify-center transition-all active:scale-90"
                  >
                    <Plus size={14} className="text-primary-600" />
                  </button>
                  <button
                    onClick={() => removeItem(index)}
                    className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center mr-1 transition-all active:scale-90"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
              {item.notes && (
                <p className="text-xs text-surface-400 bg-surface-50 rounded-xl px-3 py-1.5 mt-1">📝 {item.notes}</p>
              )}
              {item.selectedModifiers && Object.keys(item.selectedModifiers).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.values(item.selectedModifiers).flat().map((mod, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg font-medium">+{mod}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Notes & Payment */}
        <div className="bg-white rounded-3xl p-5 border border-surface-100 shadow-soft space-y-4">
          <div>
            <label className="block text-sm font-bold text-surface-600 mb-2">ملاحظات</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="textarea-field"
              rows={2}
              placeholder={t('menu_customer.notes')}
            />
          </div>

          {/* Price breakdown */}
          <div className="divider" />
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm text-surface-500">
              <span>{t('menu_customer.subtotal')}</span>
              <span>{subtotal.toFixed(2)} د.ج</span>
            </div>
            <div className="flex justify-between text-sm text-surface-500">
              <span>الضريبة ({taxRate}%)</span>
              <span>{tax.toFixed(2)} د.ج</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between text-sm text-surface-500">
                <span>خدمة ({serviceChargeRate}%)</span>
                <span>{serviceCharge.toFixed(2)} د.ج</span>
              </div>
            )}
            <div className="divider" />
            <div className="flex justify-between font-bold text-lg">
              <span className="text-surface-800">{t('menu_customer.total')}</span>
              <span className="text-gradient">{total.toFixed(2)} د.ج</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-3xl p-5 border border-surface-100 shadow-soft">
          <label className="block text-sm font-bold text-surface-600 mb-4">{t('menu_customer.payment_method')}</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'CASH', label: 'نقداً', icon: Wallet },
              { value: 'CARD', label: 'بطاقة', icon: CreditCard },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setPaymentMethod(value as any)}
                className={`flex items-center justify-center gap-2.5 p-4 rounded-2xl border-2 font-medium transition-all duration-200 ${
                  paymentMethod === value
                    ? 'border-primary-500 bg-primary-50/50 text-primary-700 shadow-sm'
                    : 'border-surface-100 text-surface-500 hover:border-surface-200 hover:bg-surface-50'
                }`}
              >
                <Icon size={20} className={paymentMethod === value ? 'text-primary-500' : 'text-surface-400'} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-surface-100 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
        {!isOnline && (
          <div className="flex items-center gap-2 mb-2.5 text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-2xl border border-red-100">
            <WifiOff className="w-4 h-4 shrink-0" />
            بدون إنترنت - سيتم حفظ الطلب وإرساله لاحقاً
          </div>
        )}
        <button
          onClick={handleSubmitOrder}
          disabled={loading}
          className="w-full bg-gradient-to-l from-primary-600 to-emerald-500 hover:from-primary-700 hover:to-emerald-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-200/50 flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Receipt size={20} />
            )}
            {loading ? t('loading') : t('menu_customer.place_order')}
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-xl text-sm">
            {total.toFixed(2)} د.ج
          </span>
        </button>
      </div>
    </div>
  )
}
