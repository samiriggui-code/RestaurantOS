import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Business, MenuCategory } from '../types';
import {
  Coffee,
  ShoppingBag,
  Wifi,
  Bell,
  Clock,
  ChefHat,
  MapPin,
  Star,
  Sparkles,
  Utensils,
  Gift,
} from 'lucide-react';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n/useTranslation';

export default function ConsumerHomePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlBusinessId = searchParams.get('businessId') || '';
  const tableId = searchParams.get('tableId');
  const tableNumber = searchParams.get('table');
  const [businessId, setBusinessId] = useState(urlBusinessId);
  const [business, setBusiness] = useState<Business | null>(null);
  const [stats, setStats] = useState<{ categories: number; items: number } | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    if (urlBusinessId) {
      setBusinessId(urlBusinessId);
      return;
    }
    fetch('/api/settings/public')
      .then(r => r.json())
      .then(b => {
        if (b?.id) {
          setBusinessId(b.id);
          setBusiness(b);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [urlBusinessId]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    api
      .getCategories(businessId)
      .then(cats => {
        const itemsCount = cats.reduce((s: number, c: MenuCategory) => s + c.items.length, 0);
        setStats({ categories: cats.length, items: itemsCount });
      })
      .catch(() => {});
    fetch(`/api/settings/public/${businessId}`)
      .then(r => r.json())
      .then(setBusiness)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleCallWaiter = async () => {
    try {
      await fetch('/api/orders/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, businessId, message: 'طلب مساعدة' }),
      });
      toast.success('تم استدعاء النادل!');
    } catch {
      toast.error('فشل استدعاء النادل');
    }
  };

  const quickActions = [
    {
      icon: Coffee,
      label: t('consumer.view_menu'),
      desc: t('consumer.view_menu_desc'),
      gradient: 'from-emerald-500 to-green-600',
      shadow: 'shadow-emerald-200',
      onClick: () => navigate(`/menu?businessId=${businessId}&tableId=${tableId}`),
    },
    {
      icon: Wifi,
      label: 'WiFi',
      desc: t('consumer.wifi_desc'),
      gradient: 'from-blue-500 to-cyan-500',
      shadow: 'shadow-blue-200',
      onClick: () => navigate(`/wifi?businessId=${businessId}`),
    },
    {
      icon: Bell,
      label: t('consumer.call_waiter'),
      desc: t('consumer.call_waiter_desc'),
      gradient: 'from-amber-500 to-orange-500',
      shadow: 'shadow-amber-200',
      onClick: handleCallWaiter,
    },
    {
      icon: Clock,
      label: t('consumer.track_order'),
      desc: t('consumer.track_order_desc'),
      gradient: 'from-purple-500 to-violet-500',
      shadow: 'shadow-purple-200',
      onClick: () => {
        const num = prompt('أدخل رقم الطلب:');
        if (num) navigate(`/order/${num}?businessId=${businessId}`);
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-950 via-primary-950 to-surface-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-400/10 rounded-full blur-3xl" />
        <div className="absolute top-4 left-4 z-10">
          <LanguageSwitcher />
        </div>

        <div className="relative px-6 pt-12 pb-24 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-400 to-primary-600 shadow-2xl shadow-emerald-500/30 animate-bounce-in">
            <Utensils className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg tracking-tight">
            {business?.name || business?.nameAr || t('consumer.welcome')}
          </h1>

          {tableNumber && (
            <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full shadow-lg animate-fade-in">
              <MapPin size={14} className="text-emerald-300" />
              <span className="text-white/80 text-sm">{t('consumer.table')}</span>
              <span className="font-bold text-white bg-emerald-500/30 px-2.5 py-0.5 rounded-full text-sm">
                {tableNumber}
              </span>
            </div>
          )}

          <p className="text-emerald-200/80 mt-4 text-lg max-w-xs mx-auto leading-relaxed">
            {t('consumer.scan_order')}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="relative -mt-16 px-5">
        <div className="bg-white/95 backdrop-blur-xl rounded-4xl shadow-elevated p-7 border border-white/30 animate-slide-up">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={18} className="text-primary-500" />
            <h2 className="text-lg font-bold text-surface-800">{t('consumer.what_to_do')}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className="group relative flex flex-col items-center gap-3 p-5 rounded-3xl bg-gradient-to-br from-surface-50 to-white border border-surface-100 hover:border-primary-100 hover:shadow-lg transition-all duration-300 active:scale-[0.97]"
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.gradient} ${action.shadow} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                >
                  <action.icon className="w-7 h-7 text-white" />
                </div>
                <span className="font-bold text-surface-800 text-sm">{action.label}</span>
                <span className="text-[11px] text-surface-400 leading-tight text-center">
                  {action.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Info & Stats */}
      <div className="px-5 mt-6 space-y-4 pb-12">
        {stats && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 animate-fade-in">
            <div className="flex items-center justify-around">
              {[
                { value: stats.items, label: 'صنف', icon: Coffee, color: 'text-emerald-400' },
                { value: stats.categories, label: 'قسم', icon: Gift, color: 'text-primary-400' },
                { value: '4.8', label: t('consumer.rating'), icon: Star, color: 'text-amber-400' },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <stat.icon size={20} className={stat.color} />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/50">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <ChefHat size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">{t('consumer.how_to_order')}</h3>
              <p className="text-xs text-white/40">4 خطوات بسيطة</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { num: '1', text: t('consumer.step1'), icon: Coffee },
              { num: '2', text: t('consumer.step2'), icon: ShoppingBag },
              { num: '3', text: t('consumer.step3'), icon: ChefHat },
              { num: '4', text: t('consumer.step4'), icon: Star },
            ].map((step, i) => (
              <div
                key={step.num}
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <step.icon size={16} className="text-emerald-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-5 h-5 rounded-full bg-primary-500/30 text-primary-300 flex items-center justify-center text-[10px] font-bold">
                      {step.num}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
