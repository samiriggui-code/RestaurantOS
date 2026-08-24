import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { api } from '../services/api';
import { useCart } from '../store/CartContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { MenuCategory, MenuItem } from '../types';
import {
  ShoppingCart,
  Plus,
  ChevronLeft,
  Bell,
  Home,
  UtensilsCrossed,
  Timer,
  ShoppingBag,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MenuPage() {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlBusinessId = searchParams.get('businessId') || '';
  const tableId = searchParams.get('tableId');
  const existingOrderParam = searchParams.get('existingOrderId');
  const [businessId, setBusinessId] = useState(urlBusinessId);
  const [businessName, setBusinessName] = useState('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemModifiers, setItemModifiers] = useState<Record<string, string[]>>({});
  const [itemNotes, setItemNotes] = useState('');
  const {
    addItem,
    itemCount,
    setTableId,
    setBusinessId: setCartBusinessId,
    setExistingOrderId,
  } = useCart();

  useEffect(() => {
    if (tableId) setTableId(tableId);
    if (existingOrderParam) setExistingOrderId(existingOrderParam);
  }, [tableId, existingOrderParam, setTableId, setExistingOrderId]);

  useEffect(() => {
    if (tableId && businessId && isOnline && !existingOrderParam) {
      api
        .getActiveOrderForTable(tableId, businessId)
        .then((order: { id?: string } | null) => {
          if (order?.id) setExistingOrderId(order.id);
        })
        .catch(() => {});
    }
  }, [tableId, businessId, isOnline, existingOrderParam, setExistingOrderId]);

  useEffect(() => {
    if (urlBusinessId) {
      setBusinessId(urlBusinessId);
      setCartBusinessId(urlBusinessId);
      return;
    }
    fetch('/api/settings/public')
      .then(r => r.json())
      .then(b => {
        if (b?.id) {
          setBusinessId(b.id);
          setCartBusinessId(b.id);
          setBusinessName(b.name || b.nameAr);
        }
      })
      .catch(() => setLoading(false));
  }, [urlBusinessId, setCartBusinessId]);

  useEffect(() => {
    if (!businessId) return;
    api
      .getCategories(businessId)
      .then(data => {
        setCategories(data);
        if (data.length > 0) setActiveCategory(data[0].id);
      })
      .catch(() => {
        if (!urlBusinessId) toast.error('لا يوجد مطعم بعد - سجل دخول لوحة التحكم وأضف الأصناف');
        else toast.error('فشل تحميل القائمة');
      })
      .finally(() => setLoading(false));
  }, [businessId, urlBusinessId]);

  const handleAddToCart = (item: MenuItem) => {
    if (item.modifiers && item.modifiers.length > 0) {
      setSelectedItem(item);
      setItemModifiers({});
      setItemNotes('');
    } else {
      addItem(item);
      toast.success(t('menu_customer.add_to_cart'));
    }
  };

  const handleConfirmModifiers = () => {
    if (!selectedItem) return;
    for (const mod of selectedItem.modifiers) {
      if (mod.required && (!itemModifiers[mod.id] || itemModifiers[mod.id].length === 0)) {
        toast.error(`يرجى اختيار ${mod.name || mod.nameAr}`);
        return;
      }
    }
    addItem(selectedItem, 1, itemModifiers, itemNotes);
    toast.success(t('menu_customer.add_to_cart'));
    setSelectedItem(null);
  };

  const activeItems = categories.find(c => c.id === activeCategory)?.items || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!businessId && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-surface-950 to-primary-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <UtensilsCrossed className="w-10 h-10 text-tomato-light" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('consumer.welcome')}</h1>
        <p className="text-white/50 mb-2">{t('no_data')}</p>
        <p className="text-sm text-white/30 mb-8">
          للمشرف: امسح QR الخاص بالمطعم أو استخدم لوحة التحكم
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {t('nav.dashboard')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-soft max-w-lg mx-auto pb-28 text-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-charcoal/95 backdrop-blur-xl">
        <div className="bg-gradient-to-br from-tomato-dark via-tomato to-tomato-light px-5 pt-5 pb-7">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {tableId && (
                <button
                  onClick={() => navigate(`/consumer?businessId=${businessId}&tableId=${tableId}`)}
                  className="p-2.5 bg-white/15 hover:bg-white/25 rounded-2xl backdrop-blur-sm transition-all"
                >
                  <Home className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {tableId && (
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/orders/call-waiter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tableId, businessId }),
                      });
                      toast.success('تم استدعاء النادل!');
                    } catch {
                      toast.error('فشل');
                    }
                  }}
                  className="p-2.5 bg-white/15 hover:bg-white/25 rounded-2xl backdrop-blur-sm transition-all"
                  title={t('consumer.call_waiter')}
                >
                  <Bell className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                onClick={() => navigate('/cart' + window.location.search)}
                className="relative p-2.5 bg-white/15 hover:bg-white/25 rounded-2xl backdrop-blur-sm transition-all"
              >
                <ShoppingBag className="w-5 h-5 text-white" />
                {itemCount > 0 && <span className="notif-count">{itemCount}</span>}
              </button>
            </div>
          </div>
          <div className="text-center">
            <h1 className="font-bold text-xl text-white">{t('menu_customer.title')}</h1>
            {businessName && (
              <p className="text-sm text-cream/80 mt-0.5 font-display">{businessName}</p>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto gap-2 px-5 py-3.5 scrollbar-hide bg-charcoal-soft">
          {categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                activeCategory === cat.id
                  ? 'bg-tomato text-white shadow-lg shadow-primary-500/30 scale-105'
                  : 'bg-white/5 text-cream/70 hover:bg-white/10 border border-white/10'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="flex items-center gap-2">{cat.name || cat.nameAr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-3">
        {activeItems.map((item, i) => (
          <div
            key={item.id}
            className="rounded-3xl border border-white/10 bg-charcoal/80 p-4 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-tomato/30 hover:shadow-glow animate-slide-up"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="flex gap-4">
              {item.image && (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden shrink-0 shadow-md">
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                  {item.discountPrice && (
                    <div className="absolute top-2 right-2 bg-gradient-to-br from-red-500 to-rose-500 text-white text-[10px] px-2 py-1 rounded-lg font-bold shadow-md">
                      خصم
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-base font-bold leading-snug text-cream">
                    {item.name || item.nameAr}
                  </h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-cream/45">
                      {item.description}
                    </p>
                  )}
                  {item.prepTime > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Timer size={11} className="text-surface-300" />
                      <span className="text-[10px] text-surface-400">{item.prepTime} د</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    {item.discountPrice ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-tomato-light">
                          {item.discountPrice}
                        </span>
                        <span className="text-xs text-cream/35 line-through">{item.price}</span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-cream">{item.price}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddToCart(item)}
                    disabled={!item.isAvailable}
                    className={`p-3 rounded-2xl transition-all duration-200 active:scale-90 ${
                      item.isAvailable
                        ? 'bg-tomato text-white shadow-lg shadow-primary-500/30 hover:bg-tomato-light'
                        : 'cursor-not-allowed bg-white/5 text-cream/35'
                    }`}
                  >
                    {item.isAvailable ? <Plus size={20} /> : 'نفذ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {activeItems.length === 0 && (
          <div className="text-center py-16 text-surface-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-surface-200" />
            <p className="font-medium">لا توجد أصناف في هذا القسم</p>
          </div>
        )}
      </div>

      {/* Modifier Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-charcoal-soft w-full max-w-lg rounded-t-4xl border-t border-white/10 p-6 max-h-[80vh] overflow-y-auto animate-slide-up shadow-modal text-cream">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-bold text-cream">
                  {selectedItem.name || selectedItem.nameAr}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-tomato-light">
                  {selectedItem.price} €
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-10 h-10 rounded-2xl bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-all"
              >
                <ChevronLeft size={20} className="text-surface-500" />
              </button>
            </div>

            <div className="divider mb-5" />

            <div className="space-y-5">
              {selectedItem.modifiers.map(mod => (
                <div key={mod.id}>
                  <label className="block font-bold text-surface-700 mb-3 text-sm">
                    {mod.name || mod.nameAr}
                    {mod.required && <span className="text-red-500 mr-1">*</span>}
                  </label>
                  <div className="space-y-2">
                    {mod.options.map(opt => {
                      const isSelected = itemModifiers[mod.id]?.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            if (mod.type === 'SINGLE') {
                              setItemModifiers(prev => ({ ...prev, [mod.id]: [opt.id] }));
                            } else {
                              setItemModifiers(prev => {
                                const current = prev[mod.id] || [];
                                const updated = current.includes(opt.id)
                                  ? current.filter((id: string) => id !== opt.id)
                                  : [...current, opt.id];
                                return { ...prev, [mod.id]: updated };
                              });
                            }
                          }}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50/50 text-primary-700 shadow-sm'
                              : 'border-surface-200 hover:border-primary-200 hover:bg-surface-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-500'
                                  : 'border-surface-300'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="font-medium text-sm">{opt.name || opt.nameAr}</span>
                          </div>
                          {opt.price > 0 && (
                            <span className="text-sm font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg">
                              +{opt.price}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="block font-bold text-surface-700 mb-3 text-sm">
                  {t('menu_customer.notes')}
                </label>
                <textarea
                  value={itemNotes}
                  onChange={e => setItemNotes(e.target.value)}
                  className="textarea-field"
                  rows={2}
                  placeholder={t('menu_customer.notes')}
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleConfirmModifiers}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
              >
                <ShoppingBag size={18} />
                {t('menu_customer.add_to_cart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart floating button */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-charcoal via-charcoal/95 to-transparent p-4">
          <button
            onClick={() => navigate('/cart' + window.location.search)}
            className="btn-primary flex w-full items-center justify-between py-4 px-6 text-base"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} />
              <span>{t('menu_customer.cart')}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-xl">
              <span className="counter-badge">{itemCount}</span>
              <span className="text-sm">{t('menu_customer.cart_items')}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
