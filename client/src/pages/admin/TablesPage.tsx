import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Table } from '../../types';
import { Plus, QrCode, Edit2, Trash2, Grid3X3, Table2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/useTranslation';

const statusConfig: Record<string, { label: string; color: string; border: string; bg: string }> = {
  AVAILABLE: {
    label: 'tables.status.available',
    color: 'text-emerald-300',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
  },
  OCCUPIED: {
    color: 'text-red-300',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    label: 'tables.status.occupied',
  },
  RESERVED: {
    color: 'text-amber-300',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    label: 'tables.status.reserved',
  },
  MAINTENANCE: {
    color: 'text-surface-400',
    border: 'border-surface-500/30',
    bg: 'bg-surface-600/30',
    label: 'tables.status.maintenance',
  },
};

export default function TablesPage() {
  const { t } = useTranslation();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'floor'>('floor');

  const loadTables = useCallback(() => {
    api
      .getTables()
      .then(setTables)
      .catch(() => toast.error(t('errors.load_failed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      number: form.get('number') as string,
      capacity: parseInt(form.get('capacity') as string) || 4,
    };
    try {
      if (editingTable) {
        await api.updateTable(editingTable.id, data);
        toast.success(t('tables.updated'));
      } else {
        await api.createTable(data);
        toast.success(t('tables.added'));
      }
      setShowModal(false);
      setEditingTable(null);
      loadTables();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRegenerateQr = async (id: string) => {
    try {
      await api.regenerateTableQr(id);
      toast.success(t('tables.qr_updated'));
      loadTables();
    } catch {
      toast.error(t('errors.failed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('tables.confirm_delete'))) return;
    try {
      await api.deleteTable(id);
      toast.success(t('tables.deleted'));
      loadTables();
    } catch {
      toast.error(t('errors.failed'));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.updateTableStatus(id, status);
      loadTables();
    } catch {
      toast.error(t('errors.failed'));
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-50">{t('tables.title')}</h1>
          <p className="text-sm text-surface-400 mt-1">{t('tables.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-800 rounded-xl p-1 border border-surface-600/40">
            <button
              onClick={() => setViewMode('floor')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'floor' ? 'bg-primary-500/20 text-primary-200' : 'text-surface-400 hover:text-surface-200'}`}
              title={t('tables.floor_plan')}
            >
              <Table2 size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary-500/20 text-primary-200' : 'text-surface-400 hover:text-surface-200'}`}
              title={t('tables.grid_view')}
            >
              <Grid3X3 size={16} />
            </button>
          </div>
          <button
            onClick={() => {
              setEditingTable(null);
              setShowModal(true);
            }}
            className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-all active:scale-[0.97] flex items-center gap-2"
          >
            <Plus size={16} />
            {t('tables.add')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-surface-400 bg-surface-800 rounded-xl px-4 py-3 border border-surface-600/40">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.bg} border ${cfg.border}`} />
            <span>{t(cfg.label as string)}</span>
          </div>
        ))}
      </div>

      {viewMode === 'floor' ? (
        /* Floor Plan View */
        <div className="bg-surface-800 rounded-2xl p-6 border border-surface-600/40 min-h-[400px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {tables.map((table, i) => {
              const cfg = statusConfig[table.status] || statusConfig.AVAILABLE;
              const isRound = ['1', '3', '5', '7', '9', '11', '13', '15'].includes(table.number);
              return (
                <div
                  key={table.id}
                  className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 animate-card-enter ${cfg.bg} ${cfg.border} hover:shadow-lg`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Table shape */}
                  <div
                    className={`relative flex items-center justify-center mb-2 ${
                      isRound ? 'w-16 h-16 rounded-full' : 'w-16 h-12 rounded-xl'
                    } bg-surface-800/60 border border-surface-500/40`}
                  >
                    <span className="text-2xl font-bold text-surface-50">{table.number}</span>
                  </div>

                  {/* Capacity */}
                  <div className="flex items-center gap-1 text-xs text-surface-400">
                    <Users size={11} />
                    <span>{table.capacity}</span>
                  </div>

                  {/* Status pill */}
                  <div
                    className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}
                  >
                    {t(cfg.label as string)}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-surface-900/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5">
                    <select
                      value={table.status}
                      onChange={e => handleStatusChange(table.id, e.target.value)}
                      className="text-[10px] px-1.5 py-1 rounded-lg bg-surface-700 border border-surface-500 text-surface-200 outline-none"
                      onClick={e => e.stopPropagation()}
                    >
                      {Object.entries(statusConfig).map(([value, sc]) => (
                        <option key={value} value={value}>
                          {t(sc.label as string)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRegenerateQr(table.id)}
                      className="p-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-surface-300"
                    >
                      <QrCode size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingTable(table);
                        setShowModal(true);
                      }}
                      className="p-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-surface-300"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(table.id)}
                      className="p-1.5 bg-surface-700 hover:bg-red-500/20 rounded-lg text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {tables.length === 0 && (
              <div className="col-span-full text-center py-16 text-surface-400">
                <Table2 className="w-12 h-12 mx-auto mb-3 text-surface-500" />
                <p className="font-medium">{t('tables.no_tables')}</p>
                <button
                  onClick={() => {
                    setEditingTable(null);
                    setShowModal(true);
                  }}
                  className="mt-3 text-primary-200 text-sm hover:text-primary-100 underline"
                >
                  {t('tables.add_first')}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="table-grid">
          {tables.map((table, i) => {
            const cfg = statusConfig[table.status] || statusConfig.AVAILABLE;
            return (
              <div
                key={table.id}
                className={`relative bg-surface-800 rounded-2xl p-4 text-center border-2 transition-all duration-200 animate-card-enter hover:shadow-glow ${cfg.border}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="text-3xl font-bold text-surface-50 mb-1">{table.number}</div>
                <div className="text-xs text-surface-400 mb-2">
                  {t('tables.capacity')}: {table.capacity}
                </div>
                <div className={`text-xs font-semibold mb-3 ${cfg.color}`}>
                  {t(cfg.label as string)}
                </div>
                <div className="flex justify-center gap-1">
                  <select
                    value={table.status}
                    onChange={e => handleStatusChange(table.id, e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg bg-surface-700 border border-surface-500 text-surface-200 outline-none"
                  >
                    {Object.entries(statusConfig).map(([value, sc]) => (
                      <option key={value} value={value}>
                        {t(sc.label as string)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRegenerateQr(table.id)}
                    className="p-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-surface-300"
                  >
                    <QrCode size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingTable(table);
                      setShowModal(true);
                    }}
                    className="p-1.5 hover:bg-surface-700 rounded-lg text-surface-300"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(table.id)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-800 rounded-2xl p-6 max-w-sm w-full border border-surface-600/40 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-surface-50">
                {editingTable ? t('edit') : t('tables.add')}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTable(null);
                }}
                className="p-1.5 hover:bg-surface-700 rounded-lg text-surface-400"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  {t('tables.table_number')}
                </label>
                <input
                  name="number"
                  defaultValue={editingTable?.number || ''}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  {t('tables.capacity')}
                </label>
                <input
                  name="capacity"
                  type="number"
                  defaultValue={editingTable?.capacity || 4}
                  className="input-field"
                  required
                  min={1}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-xl flex-1 transition-all active:scale-[0.97]"
                >
                  {editingTable ? t('save') : t('add')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTable(null);
                  }}
                  className="bg-surface-700 hover:bg-surface-600 text-surface-200 font-semibold py-3 px-6 rounded-xl flex-1 transition-all active:scale-[0.97] border border-surface-500/30"
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
