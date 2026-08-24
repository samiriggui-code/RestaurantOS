import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { MenuCategory, MenuItem } from '../../types';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/useTranslation';
import { centsToEuros, eurosToCents, formatMoney } from '../../lib/locale';

export default function MenuManagementPage() {
  const { business } = useAuthStore();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory] = useState('');
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);
  const [uploading] = useState(false);
  const { t } = useTranslation();

  const loadMenu = useCallback(() => {
    const businessId = business?.id || '';
    api
      .getCategories(businessId)
      .then(setCategories)
      .catch(() => toast.error('فشل تحميل القائمة'))
      .finally(() => setLoading(false));
  }, [business]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr'),
      sortOrder: parseInt(form.get('sortOrder') as string) || 0,
    };
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, data);
        toast.success('تم تحديث الفئة');
      } else {
        await api.createCategory(data);
        toast.success('تم إضافة الفئة');
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      loadMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟')) return;
    try {
      await api.deleteCategory(id);
      toast.success('تم حذف الفئة');
      loadMenu();
    } catch {
      toast.error('فشل الحذف');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    try {
      await api.deleteItem(id);
      toast.success('تم حذف الصنف');
      loadMenu();
    } catch {
      toast.error('فشل حذف الصنف');
    }
  };

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = (form.get('name') as string) || '';
    const nameAr = (form.get('nameAr') as string) || '';
    const price = eurosToCents(parseFloat(form.get('price') as string) || 0);
    const imageFile = itemImageFile;

    let categoryId = (form.get('categoryId') as string) || '';
    if (!categoryId) {
      if (categories.length === 0) {
        const def = await api.createCategory({ name: 'عام', nameAr: 'عام', sortOrder: 0 });
        categoryId = def.id;
        loadMenu();
      } else {
        categoryId = categories[0].id;
      }
    }

    try {
      const data = {
        name,
        nameAr,
        price: price || 0,
        discountPrice: form.get('discountPrice')
          ? eurosToCents(parseFloat(form.get('discountPrice') as string) || 0)
          : null,
        prepTime: parseInt(form.get('prepTime') as string) || 10,
        description: (form.get('description') as string) || '',
        categoryId,
        sortOrder: parseInt(form.get('sortOrder') as string) || 0,
      };
      if (editingItem) {
        await api.updateMenuItem(editingItem.id, data);
        if (imageFile) await api.uploadItemImage(editingItem.id, imageFile);
        toast.success('تم');
      } else {
        const created = await api.createMenuItem(data);
        if (imageFile) await api.uploadItemImage(created.id, imageFile);
        toast.success('تم');
      }
      loadMenu();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || 'خطأ');
    }

    setShowItemModal(false);
    setEditingItem(null);
    setItemImageFile(null);
    setItemImagePreview(null);
  };

  const handleToggleItem = async (id: string) => {
    try {
      await api.toggleMenuItem(id);
      loadMenu();
    } catch {
      toast.error('فشل التحديث');
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
          <h1 className="text-2xl font-bold">{t('menu.title')}</h1>
          <p className="text-gray-500">{t('menu.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            className="btn-secondary text-sm py-2"
          >
            <Plus size={16} className="inline ml-1" /> {t('menu.add_category')}
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowItemModal(true);
            }}
            className="btn-primary text-sm py-2"
          >
            <Plus size={16} className="inline ml-1" /> {t('menu.add_item')}
          </button>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat.id} className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">{cat.name || cat.nameAr}</h3>
              <p className="text-sm text-gray-500">{cat.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingCategory(cat);
                  setShowCategoryModal(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {cat.items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {item.image && (
                    <img src={item.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name || item.nameAr}</span>
                      {!item.isAvailable && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          {t('menu.not_available')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatMoney(item.price)}{' '}
                      {item.discountPrice != null && item.discountPrice > 0 && (
                        <span className="text-primary-600">{formatMoney(item.discountPrice)}</span>
                      )}
                      {' | '}
                      {t('menu.prep_time')}: {item.prepTime} {t('menu.minutes')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    className="p-1.5 hover:bg-gray-200 rounded-lg"
                  >
                    {item.isAvailable ? (
                      <ToggleRight size={18} className="text-green-600" />
                    ) : (
                      <ToggleLeft size={18} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setShowItemModal(true);
                    }}
                    className="p-1.5 hover:bg-gray-200 rounded-lg"
                  >
                    <Edit2 size={16} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
        >
          <h2 className="text-xl font-bold mb-4">
            {editingCategory ? `${t('edit')} ${t('menu.category')}` : t('menu.add_category')}
          </h2>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="category-nameAr" className="block text-sm font-medium mb-1">
                  الاسم (عربي)
                </label>
                <input
                  id="category-nameAr"
                  name="nameAr"
                  defaultValue={editingCategory?.nameAr || ''}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label htmlFor="category-name" className="block text-sm font-medium mb-1">
                  الاسم (إنجليزي)
                </label>
                <input
                  id="category-name"
                  name="name"
                  defaultValue={editingCategory?.name || ''}
                  className="input-field"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label htmlFor="category-sortOrder" className="block text-sm font-medium mb-1">
                الترتيب
              </label>
              <input
                id="category-sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={editingCategory?.sortOrder || 0}
                className="input-field"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                {editingCategory ? t('save') : t('add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="btn-secondary flex-1"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <Modal
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
        >
          <h2 className="text-xl font-bold mb-4">
            {editingItem ? `${t('edit')} ${t('menu.item')}` : t('menu.add_item')}
          </h2>
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="item-nameAr" className="block text-sm font-medium mb-1">
                  الاسم (عربي)
                </label>
                <input
                  id="item-nameAr"
                  name="nameAr"
                  defaultValue={editingItem?.nameAr || ''}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="item-name" className="block text-sm font-medium mb-1">
                  الاسم (إنجليزي)
                </label>
                <input
                  id="item-name"
                  name="name"
                  defaultValue={editingItem?.name || ''}
                  className="input-field"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('menu.price')}</label>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={editingItem ? centsToEuros(editingItem.price) : 0}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('menu.discount_price')}</label>
                <input
                  name="discountPrice"
                  type="number"
                  step="0.01"
                  defaultValue={
                    editingItem?.discountPrice ? centsToEuros(editingItem.discountPrice) : ''
                  }
                  className="input-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="item-barcode" className="block text-sm font-medium mb-1">
                  الباركود
                </label>
                <input
                  id="item-barcode"
                  name="barcode"
                  defaultValue={
                    (editingItem as (MenuItem & { barcode?: string }) | null)?.barcode || ''
                  }
                  className="input-field"
                  placeholder="رمز المنتج (اختياري)"
                />
              </div>
              <div>
                <label htmlFor="item-categoryId" className="block text-sm font-medium mb-1">
                  الفئة
                </label>
                <select
                  id="item-categoryId"
                  name="categoryId"
                  defaultValue={editingItem?.categoryId || selectedCategory}
                  className="input-field"
                >
                  <option value="">اختر فئة</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('menu.prep_time')}</label>
                <input
                  name="prepTime"
                  type="number"
                  defaultValue={editingItem?.prepTime || 10}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label htmlFor="item-description" className="block text-sm font-medium mb-1">
                الوصف
              </label>
              <textarea
                id="item-description"
                name="description"
                defaultValue={editingItem?.description || ''}
                className="input-field"
                rows={2}
              />
            </div>
            <div>
              <div className="block text-sm font-medium mb-1">صورة الصنف</div>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 text-sm">
                  <Image size={16} />
                  اختر صورة
                  <input
                    id="item-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setItemImageFile(file);
                        setItemImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
                {(itemImagePreview || editingItem?.image) && (
                  <div className="relative">
                    <img
                      src={itemImagePreview || editingItem?.image || ''}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setItemImageFile(null);
                        setItemImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              {!itemImageFile && editingItem?.image && (
                <p className="text-xs text-gray-400 mt-1">
                  الصورة الحالية. اختر صورة جديدة لاستبدالها.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {uploading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {uploading ? 'جاري الرفع...' : editingItem ? t('save') : t('add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                  setItemImageFile(null);
                  setItemImagePreview(null);
                }}
                className="btn-secondary flex-1"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="float-left p-1 hover:bg-gray-100 rounded-lg">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
