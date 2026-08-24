import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Wifi, Smartphone, Clock, CheckCircle, AlertCircle, Shield, Signal } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import toast from 'react-hot-toast';

export default function WiFiConnectPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') || '';
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{
    durationMinutes?: number;
    business?: { name?: string };
  } | null>(null);
  const [connected, setConnected] = useState(false);
  const [wifiInfo, setWifiInfo] = useState<{ ssid?: string; password?: string } | null>(null);

  useEffect(() => {
    if (code) {
      api
        .getWifiInfo(code)
        .then(setInfo)
        .catch(() => toast.error(t('wifi.invalid_qr')));
    }
  }, [code, t]);

  const handleConnect = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('يرجى إدخال رقم جوال صحيح');
      return;
    }
    setLoading(true);
    try {
      const res = await api.connectWifi({ code, phoneNumber });
      setConnected(true);
      setWifiInfo(res.wifi);
      toast.success('تم الاتصال بالإنترنت بنجاح!');
    } catch (err) {
      toast.error((err instanceof Error && err.message) || 'فشل الاتصال');
    } finally {
      setLoading(false);
    }
  };

  if (!code) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-950 via-primary-950 to-surface-950 flex items-center justify-center p-5">
        <div className="text-center text-white">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('wifi.invalid_qr')}</h1>
          <p className="text-white/50">{t('wifi.invalid_qr_desc')}</p>
        </div>
      </div>
    );
  }

  if (connected && wifiInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-950 via-primary-950 to-surface-950 flex items-center justify-center p-5">
        <div className="bg-white/5 backdrop-blur-xl rounded-4xl p-8 max-w-sm w-full border border-white/10 text-center animate-scale-in">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{t('wifi.connect_page.connected')}</h1>
          <p className="text-white/50 mb-6">
            {t('wifi.connect_page.enjoy')} {info?.business?.name || ''}
          </p>

          <div className="bg-white/5 rounded-3xl p-5 border border-white/10 space-y-3 mb-5">
            <div className="flex items-center justify-between py-1">
              <span className="text-surface-400 text-sm">الشبكة</span>
              <span className="font-semibold text-white" dir="ltr">
                {wifiInfo.ssid}
              </span>
            </div>
            <div className="divider bg-white/5" />
            <div className="flex items-center justify-between py-1">
              <span className="text-surface-400 text-sm">كلمة المرور</span>
              <span
                className="font-semibold font-mono text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-xl"
                dir="ltr"
              >
                {wifiInfo.password}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-surface-400 bg-white/5 rounded-2xl py-3 px-4">
            <Clock size={16} className="text-emerald-400" />
            <span>مدة الجلسة: {info?.durationMinutes || 120} دقيقة</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-950 via-primary-950 to-surface-950 flex items-center justify-center p-5">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      </div>

      <div className="bg-white/5 backdrop-blur-xl rounded-4xl p-8 max-w-sm w-full border border-white/10 shadow-2xl relative">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-emerald-500/20">
            <Wifi className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {info?.business?.name || t('wifi.connect_page.title')}
          </h1>
          <p className="text-surface-400 mt-2 text-sm leading-relaxed">
            {t('wifi.connect_page.desc')}
          </p>
          {info && (
            <div className="inline-flex items-center gap-2 mt-4 text-sm text-emerald-300 bg-emerald-500/10 py-2.5 px-5 rounded-2xl border border-emerald-500/20">
              <Clock size={16} />
              <span>مدة الجلسة: {info.durationMinutes} دقيقة</span>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">
              {t('wifi.connect_page.phone')}
            </label>
            <div className="relative group">
              <Smartphone
                className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 group-focus-within:text-primary-400 transition-colors"
                size={18}
              />
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-3.5 pr-12 pl-4 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 focus:bg-white/10 transition-all duration-200"
                placeholder="05XXXXXXXX"
                dir="ltr"
              />
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-gradient-to-l from-primary-600 to-emerald-500 hover:from-primary-700 hover:to-emerald-600 disabled:from-primary-800 disabled:to-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Signal size={18} />
            )}
            {loading ? t('loading') : t('wifi.connect_page.connect')}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-surface-500">
          <Shield size={12} />
          <span>بالاتصال أنت توافق على شروط الاستخدام</span>
        </div>
      </div>
    </div>
  );
}
