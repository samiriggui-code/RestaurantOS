import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { WifiQrCode, WifiSession } from '../../types';
import { Plus, QrCode, ToggleLeft, ToggleRight, X, Copy, Wifi, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/useTranslation';

export default function WifiPage() {
  const { t } = useTranslation();
  const [qrCodes, setQrCodes] = useState<WifiQrCode[]>([]);
  const [sessions, setSessions] = useState<WifiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<WifiQrCode | null>(null);
  const [showSessions, setShowSessions] = useState(false);

  const loadData = () => {
    Promise.all([api.getWifiQrCodes(), api.getWifiSessions()])
      .then(([codes, sess]) => {
        setQrCodes(codes);
        setSessions(sess);
      })
      .catch(() => toast.error('فشل تحميل البيانات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      label: form.get('label'),
      durationMinutes: parseInt(form.get('durationMinutes') as string) || 120,
      maxSessions: parseInt(form.get('maxSessions') as string) || 50,
    };
    try {
      const res = await api.createWifiQrCode(data);
      setShowQrModal(res);
      setShowModal(false);
      loadData();
      toast.success('تم إنشاء رمز QR');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleWifiQrCode(id);
      loadData();
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await api.disconnectWifiSession(id);
      toast.success('تم قطع الاتصال');
      loadData();
    } catch {
      toast.error('فشل');
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
          <h1 className="text-2xl font-bold">{t('wifi.title')}</h1>
          <p className="text-gray-500">{t('wifi.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="btn-secondary text-sm py-2"
          >
            <Smartphone size={16} className="inline ml-1" /> {t('wifi.sessions')} ({sessions.length}
            )
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm py-2">
            <Plus size={16} className="inline ml-1" /> {t('wifi.create_qr')}
          </button>
        </div>
      </div>

      {showSessions && (
        <div className="card">
          <h2 className="font-bold mb-4">{t('wifi.active_sessions')}</h2>
          {sessions.filter(s => s.status === 'ACTIVE').length === 0 ? (
            <p className="text-gray-400 text-center py-4">{t('wifi.no_sessions')}</p>
          ) : (
            <div className="space-y-2">
              {sessions
                .filter(s => s.status === 'ACTIVE')
                .map(session => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm"
                  >
                    <div>
                      <p className="font-medium">{session.phoneNumber || 'زائر'}</p>
                      <p className="text-gray-500">QR: {session.wifiQrCode?.label}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-gray-500">
                        {new Date(session.endTime).toLocaleTimeString('ar-SA')}
                      </p>
                      <button
                        onClick={() => handleDisconnect(session.id)}
                        className="text-red-500 text-xs"
                      >
                        {t('wifi.disconnect')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {qrCodes.map(qr => (
          <div key={qr.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{qr.label || qr.code}</h3>
              <button
                onClick={() => handleToggle(qr.id)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                {qr.isActive ? (
                  <ToggleRight size={18} className="text-green-600" />
                ) : (
                  <ToggleLeft size={18} className="text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <Wifi size={14} />
              <span>
                {qr.durationMinutes} {t('wifi.duration')} | {qr.maxSessions} {t('wifi.session')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <span>
                {qr._count?.sessions || 0} {t('wifi.sessions_used')}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQrModal(qr)}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-50 text-primary-600 rounded-xl text-sm hover:bg-primary-100"
              >
                <QrCode size={16} /> {t('wifi.view_qr')}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qr.qrUrl || '');
                  toast.success(t('copied'));
                }}
                className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">{t('wifi.create')}</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('wifi.label')}</label>
                <input
                  name="label"
                  className="input-field"
                  placeholder={t('wifi.label_placeholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('wifi.duration_label')}
                  </label>
                  <input
                    name="durationMinutes"
                    type="number"
                    defaultValue={120}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('wifi.max_sessions')}</label>
                  <input
                    name="maxSessions"
                    type="number"
                    defaultValue={50}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">
                  {t('add')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 text-center">
            <button
              onClick={() => setShowQrModal(null)}
              className="float-left p-1 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-2">{showQrModal.label || showQrModal.code}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('wifi.scan_to_connect')}</p>
            {showQrModal.qrImage ? (
              <img src={showQrModal.qrImage} alt="QR Code" className="w-64 h-64 mx-auto" />
            ) : (
              <div className="w-64 h-64 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center">
                <QrCode size={64} className="text-gray-400" />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4 break-all" dir="ltr">
              {showQrModal.qrUrl}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(showQrModal.qrUrl || '');
                toast.success(t('copied'));
              }}
              className="btn-primary mt-4 w-full"
            >
              <Copy size={16} className="inline ml-1" /> {t('copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
