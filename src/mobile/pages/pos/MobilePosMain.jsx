import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  getProducts, 
  createTransaction, 
  createLedgerEntry, 
  createPosReceipt,
  updateProduct 
} from '../../../services/supabaseArenaService';
import { getStudents, updateStudent, fetchAcademyBills } from '../../../services/supabaseAcademyService';
import { supabase } from '../../../config/supabase';
import useArenaData from '../../../hooks/useArenaData';
import MobilePosCatalog from './MobilePosCatalog';
import MobilePosAcademyBills from './MobilePosAcademyBills';
import MobilePosInventoryModal from './MobilePosInventoryModal';
import MobilePosCartSheet from './MobilePosCartSheet';
import MobilePosReceiptSheet from './MobilePosReceiptSheet';
import { Kasir3DIcon } from '../../../components/icons/App3DIcons';
import { 
  ShoppingBag, 
  GraduationCap, 
  ScanBarcode, 
  Plus, 
  ShoppingCart, 
  ArrowRight,
  CheckCircle2,
  X
} from 'lucide-react';

export default function MobilePosMain({ userProfile }) {
  const queryClient = useQueryClient();
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;
  const { tenantProfile } = useArenaData(userProfile);

  // React Query Caching
  const { data: cachedProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ['posProducts', tenantId],
    queryFn: () => getProducts(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: cachedStudents } = useQuery({
    queryKey: ['posStudents', tenantId],
    queryFn: () => getStudents(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: cachedBills, isLoading: isBillsLoading } = useQuery({
    queryKey: ['posAcademyBills', tenantId],
    queryFn: () => fetchAcademyBills(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const [localProducts, setLocalProducts] = useState(null);
  const [localBills, setLocalBills] = useState(null);

  const products = localProducts || cachedProducts || [];
  const academyBills = localBills || cachedBills || [];
  const loadingProducts = isProductsLoading && !cachedProducts;
  const loadingBills = isBillsLoading && !cachedBills;

  useEffect(() => {
    if (cachedProducts) setLocalProducts(cachedProducts);
  }, [cachedProducts]);

  useEffect(() => {
    if (cachedBills) setLocalBills(cachedBills);
  }, [cachedBills]);

  // Tab State: 'catalog' | 'bills'
  const [activeTab, setActiveTab] = useState('catalog');
  const [activeCatalogTab, setActiveCatalogTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Modals State
  const [cart, setCart] = useState([]);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showReceiptSheet, setShowReceiptSheet] = useState(false);

  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [lastTransactionData, setLastTransactionData] = useState(null);
  const [scanNotification, setScanNotification] = useState(null);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const arenaData = useMemo(() => ({
    name: tenantProfile?.name || tenantProfile?.receiptHeaderName || 'KEDIRI SPORT ARENA',
    address: tenantProfile?.address || tenantProfile?.alamat || tenantProfile?.receiptAddress || 'Jl. Letjen Soetoyo No. 20, Wates, Kediri',
    phone: tenantProfile?.phone || tenantProfile?.whatsapp || tenantProfile?.receiptContact || '082131447972',
    qrisImageBase64: tenantProfile?.qrisImageBase64 || tenantProfile?.qrisUrl || '',
    bankAccounts: tenantProfile?.bankAccounts || [],
    bankName: tenantProfile?.bankName || '',
    bankAccountNumber: tenantProfile?.bankAccountNumber || '',
    bankAccountHolder: tenantProfile?.bankAccountHolder || tenantProfile?.bankAccountName || tenantProfile?.name || 'GOR Arena'
  }), [tenantProfile]);

  // Barcode Scanner Integration
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  const handleAddToCart = useCallback((product) => {
    // 1. Tagihan SPP & Pendaftaran
    if (product.type === 'spp' || product.type === 'registration') {
      const isAlreadyInCart = cart.some((item) => item.id === product.id);
      if (isAlreadyInCart) {
        setScanNotification({
          type: 'error',
          message: `Tagihan "${product.name}" sudah ada di keranjang!`
        });
        setTimeout(() => setScanNotification(null), 3000);
        return;
      }

      const billItem = {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price) || 0,
        cogs: 0,
        category: 'Tagihan SPP',
        subCategory: product.subCategory || (product.type === 'registration' ? 'Biaya Pendaftaran' : 'SPP Bulanan'),
        type: product.type,
        studentId: product.studentId || product.student_id,
        student_id: product.student_id || product.studentId,
        sppId: product.sppId || product.spp_id || null,
        spp_id: product.spp_id || product.sppId || null,
        studentName: product.studentName || '',
        className: product.className || '',
        month: product.month || '',
        paid_month: product.paid_month || '',
        stock: 1,
        qty: 1
      };

      setCart((prev) => [...prev, billItem]);
      setScanNotification({
        type: 'success',
        message: `⚡ "${product.name}" ditambahkan ke keranjang`
      });
      setTimeout(() => setScanNotification(null), 3000);
      return;
    }

    // 2. Retail & Rental
    if (product.type !== 'sewa' && (product.stock ?? 0) <= 0) {
      setScanNotification({
        type: 'error',
        message: `Stok "${product.name}" habis!`
      });
      setTimeout(() => setScanNotification(null), 3000);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].qty;
        if (product.type !== 'sewa' && currentQty + 1 > (product.stock ?? 0)) {
          setScanNotification({
            type: 'error',
            message: `Mencapai batas stok (${product.stock} unit)`
          });
          setTimeout(() => setScanNotification(null), 3000);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex].qty += 1;
        return updated;
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: parseFloat(product.price) || 0,
          cogs: parseFloat(product.cogs) || 0,
          category: product.category || 'Minuman / F&B',
          type: product.type || 'jual',
          barcode: product.barcode || '',
          stock: product.stock ?? 0,
          qty: 1
        }
      ];
    });

    setScanNotification({
      type: 'success',
      message: `⚡ "${product.name}" (+1)`
    });
    setTimeout(() => setScanNotification(null), 3000);
  }, [cart]);

  // Barcode Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'Escape'].includes(e.key)) return;
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const codeToScan = barcodeBufferRef.current.trim();
        if (codeToScan) {
          const found = products.find(
            (p) => (p.barcode || '').trim().toLowerCase() === codeToScan.toLowerCase() ||
                   (p.name || '').trim().toLowerCase() === codeToScan.toLowerCase()
          );
          if (found) handleAddToCart(found);
          barcodeBufferRef.current = '';
        }
        return;
      }

      if (timeDiff < 50 || barcodeBufferRef.current.length > 0) {
        if (e.key.length === 1) barcodeBufferRef.current += e.key;
      } else if (!isInputFocused && e.key.length === 1) {
        barcodeBufferRef.current = e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, handleAddToCart]);

  const handleUpdateQty = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            if (item.type === 'spp' || item.type === 'registration') {
              return delta < 0 ? null : item;
            }
            const newQty = item.qty + delta;
            if (item.type !== 'sewa' && item.stock != null && newQty > item.stock) return item;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (itemId) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.qty, 0),
    [cart]
  );

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, i) => sum + i.qty, 0),
    [cart]
  );

  // Confirm POS Checkout
  const handleConfirmCheckout = async ({ paymentMethod: chosenMethod, cashReceived, changeAmount, customerName }) => {
    if (cart.length === 0 || !tenantId) return;

    try {
      setIsSubmittingCheckout(true);
      const activePaymentMethod = chosenMethod || 'Tunai (Cash)';
      const itemsSummary = cart.map((i) => `${i.name} (${i.qty}x)`).join(', ');
      const hasAcademy = cart.some((i) => i.type === 'spp' || i.type === 'registration');

      const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim()));

      // 1. Stock deduction in Supabase
      const physicalItems = cart.filter((i) => i.type !== 'spp' && i.type !== 'registration' && i.type !== 'sewa' && i.id);
      for (const item of physicalItems) {
        if (isUuid(item.id)) {
          try {
            const currentProd = products.find((p) => p.id === item.id);
            const currentStock = currentProd ? Number(currentProd.stock || 0) : item.stock || 0;
            const newStock = Math.max(0, currentStock - item.qty);
            await updateProduct(item.id, { stock: newStock });
          } catch (e) {
            console.warn('Product stock update error:', e);
          }
        }
      }

      // 2. Registration fees update in Supabase
      const regItems = cart.filter((i) => i.type === 'registration');
      for (const reg of regItems) {
        const sId = reg.studentId || reg.student_id;
        if (sId && isUuid(sId)) {
          try {
            await updateStudent(sId, {
              registrationFeePaid: true,
              isRegistrationFeePaid: true,
              registrationFeePaidAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn('Registration fee update error:', e);
          }
        }
      }

      // 3. SPP updates in Supabase
      const sppItems = cart.filter((i) => i.type === 'spp');
      for (const s of sppItems) {
        const sId = s.studentId || s.student_id;
        const targetMonth = s.paid_month || currentMonth;
        if (sId && isUuid(sId)) {
          try {
            await updateStudent(sId, {
              paymentStatus: 'lunas',
              sppStatus: 'Lunas',
              lastPaidMonth: targetMonth
            });
          } catch (e) {
            console.warn('SPP student update error:', e);
          }
        }

        if (isUuid(tenantId)) {
          try {
            if ((s.sppId || s.spp_id) && isUuid(s.sppId || s.spp_id)) {
              await supabase
                .from('spp_payments')
                .update({ status: 'COMPLETED', payment_method: activePaymentMethod, updated_at: new Date().toISOString() })
                .eq('id', s.sppId || s.spp_id);
            } else if (sId && isUuid(sId)) {
              await supabase.from('spp_payments').insert([{
                tenant_id: tenantId,
                student_id: sId,
                student_name: s.studentName || 'Siswa',
                amount: Number(s.price || 0),
                paid_month: targetMonth,
                payment_method: activePaymentMethod,
                status: 'COMPLETED',
                created_at: new Date().toISOString()
              }]);
            }
          } catch (e) {
            console.warn('spp_payments insert error:', e);
          }
        }
      }

      // 4. Create Transaction record
      let txRes = null;
      if (isUuid(tenantId)) {
        try {
          txRes = await createTransaction({
            tenantId,
            itemName: itemsSummary,
            itemCategory: hasAcademy ? 'POS & Tagihan SPP Akademi' : 'Penjualan Retail POS',
            amount: cartTotal,
            paymentMethod: activePaymentMethod,
            itemsCount: cartTotalItems,
            items: cart,
            status: 'COMPLETED'
          });
        } catch (e) {
          console.warn('createTransaction error:', e);
        }
      }

      // 5. Create POS receipt record
      if (isUuid(tenantId)) {
        try {
          await createPosReceipt({
            tenantId,
            amount: cartTotal,
            total: cartTotal,
            paymentMethod: activePaymentMethod,
            items: cart,
            transactionId: txRes?.id || null,
            status: 'LUNAS'
          });
        } catch (e) {
          console.warn('createPosReceipt error:', e);
        }
      }

      // 6. Create Ledger entry
      if (isUuid(tenantId)) {
        try {
          await createLedgerEntry({
            tenantId,
            type: 'PEMASUKAN',
            source: 'KASIR_POS',
            description: `Penjualan POS Kasir (${itemsSummary})`,
            amount: cartTotal,
            paymentMethod: activePaymentMethod,
            referenceId: txRes?.id || null,
            status: 'COMPLETED'
          });
        } catch (e) {
          console.warn('createLedgerEntry error:', e);
        }
      }

      // Optimistic updates
      setLocalProducts((prev) => {
        const list = prev || cachedProducts || [];
        return list.map((p) => {
          const cartItem = cart.find((c) => c.id === p.id);
          if (cartItem && cartItem.type !== 'spp' && cartItem.type !== 'registration' && cartItem.type !== 'sewa') {
            return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
          }
          return p;
        });
      });

      setLocalBills((prev) => {
        const list = prev || cachedBills || [];
        return list.filter((b) => !cart.some((c) => c.id === b.id));
      });

      queryClient.invalidateQueries({ queryKey: ['posAcademyBills', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['posProducts', tenantId] });
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));

      const now = new Date();
      const receiptPayload = {
        date: now.toLocaleDateString('id-ID'),
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        receiptNo: `POS-${txRes?.id ? String(txRes.id).slice(-6).toUpperCase() : Math.floor(Date.now() / 1000)}`,
        cashierName: userProfile?.displayName || userProfile?.name || 'Kasir Mobile',
        customerName: customerName || 'Pelanggan Umum',
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          subtotal: i.qty * i.price
        })),
        totalAmount: cartTotal,
        paymentMethod: activePaymentMethod,
        cashReceived,
        changeAmount
      };

      setLastTransactionData(receiptPayload);
      setShowCartSheet(false);
      setShowReceiptSheet(true);
      setCart([]);
    } catch (err) {
      console.error('POS Checkout error:', err);
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleFinishTransaction = () => {
    setShowReceiptSheet(false);
    setLastTransactionData(null);
    setCart([]);
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-28 text-left">
      
      {/* MOBILE HEADER */}
      <div className="bg-white dark:bg-[#14211E] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Kasir3DIcon className="w-10 h-10 shrink-0 drop-shadow-xs" />
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
              Kasir &amp; POS Mobile
            </h1>
            <p className="text-[11px] text-slate-500">Retail, rental &amp; SPP akademi</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setShowInventoryModal(true);
          }}
          className="px-3 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white text-xs font-bold rounded-xl border-b-2 border-[#C89D32] shadow-xs cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4 text-[#C89D32]" />
          <span>Stok</span>
        </button>
      </div>

      {/* FLASH SCAN NOTIFICATION */}
      {scanNotification && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between animate-in zoom-in-95 shadow-xs ${
          scanNotification.type === 'success'
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300'
            : 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-300'
        }`}>
          <span>{scanNotification.message}</span>
          <button onClick={() => setScanNotification(null)} className="p-0.5 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB NAV TAB PILLS */}
      <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/80 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#354944] text-white shadow-xs border-b-2 border-[#C89D32]'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Katalog Produk ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'bills'
              ? 'bg-[#354944] text-white shadow-xs border-b-2 border-[#C89D32]'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Tagihan SPP ({academyBills.length})</span>
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'catalog' && (
        <MobilePosCatalog
          products={products}
          cart={cart}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCatalogTab={activeCatalogTab}
          onCatalogTabChange={setActiveCatalogTab}
          onAddToCart={handleAddToCart}
          onOpenInventoryModal={() => {
            setEditingProduct(null);
            setShowInventoryModal(true);
          }}
        />
      )}

      {activeTab === 'bills' && (
        <MobilePosAcademyBills
          bills={academyBills}
          cart={cart}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddToCart={handleAddToCart}
          isLoading={loadingBills}
        />
      )}

      {/* FLOATING BOTTOM CART BAR (ALWAYS VISIBLE WHEN CART HAS ITEMS) */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-40 p-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setShowCartSheet(true)}
            className="w-full bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C89D32] text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
                {cartTotalItems}
              </div>
              <div className="text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C89D32] block">
                  Keranjang Kasir
                </span>
                <span className="text-sm font-black font-mono">
                  Rp {cartTotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-[#C89D32]">
              <span>Bayar / Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* INVENTORY MODAL */}
      <MobilePosInventoryModal
        isOpen={showInventoryModal}
        onClose={() => setShowInventoryModal(false)}
        userProfile={userProfile}
        editingProduct={editingProduct}
        onSaveSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['posProducts', tenantId] });
        }}
      />

      {/* CART & CHECKOUT SHEET */}
      <MobilePosCartSheet
        isOpen={showCartSheet}
        onClose={() => setShowCartSheet(false)}
        cart={cart}
        totalAmount={cartTotal}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
        cashierName={userProfile?.displayName || userProfile?.name || 'Kasir'}
        arenaData={arenaData}
        onConfirmCheckout={handleConfirmCheckout}
        isSubmitting={isSubmittingCheckout}
      />

      {/* THERMAL RECEIPT SHEET */}
      <MobilePosReceiptSheet
        isOpen={showReceiptSheet}
        onClose={() => setShowReceiptSheet(false)}
        transactionData={lastTransactionData}
        arenaData={arenaData}
        onFinish={handleFinishTransaction}
      />

    </div>
  );
}
