import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { MenuCategory, CartItem } from '../../types'
import { Plus, Minus, Trash2, ShoppingCart, X, Search, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/locale'

export default function POSPage() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)

  const businessId = localStorage.getItem('businessId') || ''

  useEffect(() => {
    if (!businessId) return
    api.get(`/menu/categories?businessId=${businessId}`)
      .then(res => { setCategories(res.data); if (res.data.length) setSelectedCategory(res.data[0].id) })
      .catch(() => toast.error(t('errors.load_failed')))
      .finally(() => setLoading(false))
  }, [businessId])

  const allItems = categories.flatMap(c => c.items).filter(i => i.isAvailable)
  const filtered = search
    ? allItems.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.nameAr?.includes(search)
      )
    : selectedCategory
      ? categories.find(c => c.id === selectedCategory)?.items.filter(i => i.isAvailable) || []
      : allItems

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id)
      if (existing) {
        return prev.map(i => i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { menuItem: item, quantity: 1, selectedModifiers: {}, totalPrice: item.discountPrice || item.price }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.menuItem.id !== id) return i
      const qty = Math.max(0, i.quantity + delta)
      return qty === 0 ? null : { ...i, quantity: qty, totalPrice: i.totalPrice !== 0 ? (i.totalPrice / i.quantity) * qty : 0 }
    }).filter(Boolean) as CartItem[])
  }

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => i.menuItem.id !== id))
  }

  const subtotal = cart.reduce((sum, i) => sum + i.totalPrice, 0)

  const placeOrder = async () => {
    if (!cart.length) return
    try {
      await api.post('/orders', {
        businessId,
        items: cart.map(i => ({ menuItemId: i.menuItem.id, quantity: i.quantity, unitPrice: i.menuItem.discountPrice || i.menuItem.price })),
        type: 'DINE_IN',
      })
      toast.success(t('orders.order_placed'))
      setCart([])
      setShowPayment(false)
    } catch {
      toast.error(t('errors.failed'))
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full bg-surface-800 border border-surface-600/40 rounded-xl py-2.5 pr-10 pl-4 text-sm text-surface-50 placeholder-surface-400 focus:outline-none focus:border-primary-500/50"
            />
          </div>
        </div>

        {!search && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === c.id
                    ? 'bg-primary-500/15 text-primary-200 border border-primary-500/30'
                    : 'bg-surface-800 text-surface-300 hover:text-surface-50 border border-surface-600/30'
                }`}
              >
                {c.name || c.nameAr}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-surface-800 rounded-xl p-3 border border-surface-600/40 hover:border-primary-500/30 hover:shadow-glow transition-all text-right group"
            >
              {item.image && (
                <img src={item.image} className="w-full h-24 object-cover rounded-lg mb-2" />
              )}
              <p className="font-medium text-sm text-surface-50">{item.name || item.nameAr}</p>
              <p className="text-primary-200 font-bold mt-1">{formatMoney(item.discountPrice || item.price)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="w-80 bg-surface-800 rounded-2xl border border-surface-600/40 flex flex-col">
        <div className="p-4 border-b border-surface-600/40">
          <h2 className="font-bold text-surface-50 flex items-center gap-2">
            <ShoppingCart size={18} className="text-primary-200" />
            {t('menu_customer.cart')} ({cart.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-surface-700 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-50 truncate">{item.menuItem.name || item.menuItem.nameAr}</p>
                <p className="text-xs text-surface-400">{formatMoney(item.menuItem.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(item.menuItem.id, -1)} className="w-7 h-7 rounded-full bg-surface-600 flex items-center justify-center hover:bg-surface-500 text-surface-200">
                  <Minus size={14} />
                </button>
                <span className="text-sm font-bold text-surface-50 w-5 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.menuItem.id, 1)} className="w-7 h-7 rounded-full bg-surface-600 flex items-center justify-center hover:bg-surface-500 text-surface-200">
                  <Plus size={14} />
                </button>
              </div>
              <button onClick={() => removeItem(item.menuItem.id)} className="text-red-400 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!cart.length && <p className="text-surface-400 text-center py-8 text-sm">{t('menu_customer.cart_empty')}</p>}
        </div>

        <div className="p-4 border-t border-surface-600/40 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-surface-400">{t('menu_customer.subtotal')}</span>
            <span className="font-bold text-surface-50">{formatMoney(subtotal)}</span>
          </div>
          <button
            onClick={() => setShowPayment(true)}
            disabled={!cart.length}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <CreditCard size={18} />
            {t('menu_customer.place_order')} ({cart.length})
          </button>
        </div>
      </div>

      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-800 rounded-2xl p-6 w-full max-w-sm border border-surface-600/40 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-surface-50">{t('menu_customer.payment_method')}</h3>
              <button onClick={() => setShowPayment(false)} className="text-surface-400 hover:text-surface-200 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">{t('menu_customer.subtotal')}</span>
                <span className="text-surface-50">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-surface-600/40 pt-2">
                <span className="text-surface-50">{t('menu_customer.total')}</span>
                <span className="text-primary-200">{formatMoney(subtotal)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={placeOrder} className="bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-medium transition-all active:scale-[0.98]">
                {t('menu_customer.cash')}
              </button>
              <button onClick={placeOrder} className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-medium transition-all active:scale-[0.98]">
                {t('menu_customer.card')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
