import React, { useState, useEffect } from 'react';
import { X, Package, Tag, Barcode, DollarSign, Layers, Plus, Save } from 'lucide-react';
import { createProduct, updateProduct } from '../../../services/supabaseArenaService';

export default function MobilePosInventoryModal({
  isOpen,
  onClose,
  userProfile,
  editingProduct,
  onSaveSuccess
}) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Minuman / F&B');
  const [type, setType] = useState('jual'); // 'jual' | 'sewa'
  const [barcode, setBarcode] = useState('');
  const [cogs, setCogs] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('50');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setCategory(editingProduct.category || 'Minuman / F&B');
      setType(editingProduct.type || 'jual');
      setBarcode(editingProduct.barcode || '');
      setCogs(editingProduct.cogs != null ? String(editingProduct.cogs) : '');
      setPrice(editingProduct.price != null ? String(editingProduct.price) : '');
      setStock(editingProduct.stock != null ? String(editingProduct.stock) : '0');
    } else {
      setName('');
      setCategory('Minuman / F&B');
      setType('jual');
      setBarcode('');
      setCogs('');
      setPrice('');
      setStock('50');
    }
    setErrorMsg(null);
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama produk wajib diisi.');
      return;
    }
    if (!price || Number(price) <= 0) {
      setErrorMsg('Harga jual / sewa wajib diisi dengan benar.');
      return;
    }
    if (!tenantId) {
      setErrorMsg('Data tenant tidak valid.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const payload = {
        tenantId,
        name: name.trim(),
        category,
        type,
        barcode: barcode.trim(),
        cogs: parseFloat(cogs) || 0,
        price: parseFloat(price) || 0,
        stock: parseInt(stock, 10) || 0
      };

      let result;
      if (editingProduct) {
        result = await updateProduct(editingProduct.id, payload);
      } else {
        result = await createProduct(payload);
      }

      if (onSaveSuccess) {
        onSaveSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error('Error saving master product:', err);
      setErrorMsg(err.message || 'Gagal menyimpan produk.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in slide-in-from-bottom duration-250">
        
        {/* Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              {editingProduct ? 'Edit Master Produk' : 'Tambah Produk Inventaris'}
            </h2>
            <p className="text-[11px] text-slate-500">Kelola item retail, rental alat &amp; stok kasir</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-2xl font-semibold shrink-0">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">

            {/* Nama Produk */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Nama Produk <span className="text-[#C89D32]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Pocari Sweat 500ml / Sewa Raket Yonex"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
              />
            </div>

            {/* Kategori & Tipe */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                >
                  <option value="Minuman / F&B">Minuman / F&amp;B</option>
                  <option value="Makanan / Snack">Makanan / Snack</option>
                  <option value="Apparel / Alat">Apparel / Alat</option>
                  <option value="Rental Alat">Rental Alat</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Jenis Item
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                >
                  <option value="jual">Barang Dijual</option>
                  <option value="sewa">Disewakan / Rental</option>
                </select>
              </div>
            </div>

            {/* Barcode & HPP Modal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Kode Barcode
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="899..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Modal / HPP (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cogs}
                  onChange={(e) => setCogs(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                />
              </div>
            </div>

            {/* Harga Jual & Stok */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {type === 'sewa' ? 'Harga Sewa (Rp)' : 'Harga Jual (Rp)'} <span className="text-[#C89D32]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-[#354944] dark:text-[#C89D32] focus:outline-none focus:ring-2 focus:ring-[#354944]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {type === 'sewa' ? 'Unit Disewakan' : 'Jumlah Stok'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="50"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                />
              </div>
            </div>

          </div>

          {/* Sticky Sheet Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#C89D32]" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Produk'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
