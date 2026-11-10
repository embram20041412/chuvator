import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Package, 
  Search, 
  AlertTriangle, 
  CheckCircle2,
  Tag,
  Layers
} from 'lucide-react';

export default function MobilePosCatalog({
  products = [],
  cart = [],
  searchQuery,
  onSearchChange,
  activeCatalogTab,
  onCatalogTabChange,
  onAddToCart,
  onOpenInventoryModal
}) {
  const filteredProducts = products.filter((prod) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (prod.name || '').toLowerCase().includes(q) ||
      (prod.category || '').toLowerCase().includes(q) ||
      (prod.barcode || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (activeCatalogTab === 'fnb') {
      const cat = (prod.category || '').toLowerCase();
      return cat.includes('minuman') || cat.includes('makanan') || cat.includes('f&b') || cat.includes('snack');
    }
    if (activeCatalogTab === 'apparel') {
      const cat = (prod.category || '').toLowerCase();
      return cat.includes('apparel') || cat.includes('aksesoris') || cat.includes('shuttlecock') || cat.includes('bola');
    }
    if (activeCatalogTab === 'sewa') {
      const cat = (prod.category || '').toLowerCase();
      return prod.type === 'sewa' || cat.includes('sewa') || cat.includes('rental');
    }

    return true; // 'all'
  });

  return (
    <div className="space-y-3 text-left">
      
      {/* SEARCH BAR & INVENTORY MANAGEMENT TRIGGER */}
      <div className="bg-white dark:bg-[#14211E] p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama produk, kategori, barcode..."
              className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
            />
          </div>

          <button
            type="button"
            onClick={onOpenInventoryModal}
            className="px-3 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white text-xs font-bold rounded-xl border-b-2 border-[#C89D32] shadow-2xs shrink-0 cursor-pointer active:scale-95 transition-transform flex items-center gap-1"
          >
            <Plus className="w-4 h-4 text-[#C89D32]" />
            <span className="hidden sm:inline">Stok</span>
          </button>
        </div>

        {/* CATEGORY PILLS */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <button
            type="button"
            onClick={() => onCatalogTabChange('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              activeCatalogTab === 'all'
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Semua ({products.length})
          </button>

          <button
            type="button"
            onClick={() => onCatalogTabChange('fnb')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              activeCatalogTab === 'fnb'
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            F&amp;B / Minuman
          </button>

          <button
            type="button"
            onClick={() => onCatalogTabChange('apparel')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              activeCatalogTab === 'apparel'
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Apparel &amp; Alat
          </button>

          <button
            type="button"
            onClick={() => onCatalogTabChange('sewa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              activeCatalogTab === 'sewa'
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Rental Alat
          </button>
        </div>
      </div>

      {/* PRODUCTS GRID (2 COLUMNS ON MOBILE) */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-[#14211E] p-8 rounded-2xl text-center border border-slate-200/80 dark:border-white/10 space-y-2">
          <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
            Tidak ada produk ditemukan.
          </h3>
          <p className="text-[11px] text-slate-400">
            Coba kata kunci lain atau tambah produk baru ke inventaris GOR.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredProducts.map((product) => {
            const isRental = product.type === 'sewa';
            const stock = product.stock ?? 0;
            const isOutOfStock = !isRental && stock <= 0;
            const isLowStock = !isRental && stock > 0 && stock <= 5;

            const cartItem = cart.find((c) => c.id === product.id);
            const qtyInCart = cartItem?.qty || 0;

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && onAddToCart(product)}
                className={`p-3 bg-white dark:bg-[#14211E] rounded-2xl border transition-all flex flex-col justify-between space-y-2 relative shadow-2xs select-none ${
                  isOutOfStock
                    ? 'opacity-60 border-slate-200 dark:border-white/5 cursor-not-allowed bg-slate-50 dark:bg-white/5'
                    : 'border-slate-200/80 dark:border-white/10 hover:border-[#354944] cursor-pointer active:scale-95'
                }`}
              >
                {/* Quantity Badge if in cart */}
                {qtyInCart > 0 && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#C89D32] text-slate-950 font-extrabold text-[10px] rounded-full shadow-2xs animate-in zoom-in-50">
                    {qtyInCart}x
                  </span>
                )}

                <div className="space-y-1 min-w-0 pr-4">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                    {product.category || 'Retail'}
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
                    {product.name}
                  </h4>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black font-mono text-[#354944] dark:text-[#C89D32] block">
                      Rp {Number(product.price || 0).toLocaleString('id-ID')}
                    </span>
                    {!isRental && (
                      <span className={`text-[9px] font-bold block mt-0.5 ${
                        isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        {isOutOfStock ? 'Stok Habis' : `Stok: ${stock}`}
                      </span>
                    )}
                    {isRental && (
                      <span className="text-[9px] font-bold text-indigo-500 block mt-0.5">
                        Rental / Sewa
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isOutOfStock}
                    className="w-7 h-7 rounded-xl bg-[#354944] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 text-[#C89D32]" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
