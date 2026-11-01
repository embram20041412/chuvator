import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  getProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  createTransaction, 
  createLedgerEntry, 
  createPosReceipt 
} from '../services/supabaseArenaService';
import { getStudents, updateStudent, fetchAcademyBills } from '../services/supabaseAcademyService';
import { supabase } from '../config/supabase';
import useArenaData from '../hooks/useArenaData';
import PosCheckoutModal from '../components/PosCheckoutModal';
import PosThermalReceipt from '../components/PosThermalReceipt';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Receipt, 
  CreditCard, 
  Inbox, 
  CheckCircle2, 
  X, 
  Search, 
  DollarSign, 
  Tag, 
  RotateCcw,
  GraduationCap,
  Users,
  Check,
  AlertCircle,
  Package,
  Layers,
  Barcode,
  ScanBarcode,
  Edit3,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Printer
} from 'lucide-react';
import { Kasir3DIcon, Akademi3DIcon } from '../components/icons/App3DIcons';

import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function POSPage({ userProfile }) {
  const queryClient = useQueryClient();
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // =====================================================================
  // 1 & 2. REACT QUERY CACHE: PRODUK, SISWA & TAGIHAN AKADEMI (INSTANT IN-MEMORY UI)
  // =====================================================================
  const { data: cachedProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ['posProducts', tenantId],
    queryFn: () => getProducts(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: cachedStudents, isLoading: isStudentsLoading } = useQuery({
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
  const [localStudents, setLocalStudents] = useState(null);
  const [localBills, setLocalBills] = useState(null);

  const products = localProducts || cachedProducts || [];
  const students = localStudents || cachedStudents || [];
  const academyBills = localBills || cachedBills || [];
  const loadingProducts = isProductsLoading && !cachedProducts;
  const loadingStudents = isStudentsLoading && !cachedStudents;
  const loadingBills = isBillsLoading && !cachedBills;

  // Sinkronisasi data cache ke local state saat ada update latar belakang
  useEffect(() => {
    if (cachedProducts) setLocalProducts(cachedProducts);
  }, [cachedProducts]);

  useEffect(() => {
    if (cachedStudents) setLocalStudents(cachedStudents);
  }, [cachedStudents]);

  useEffect(() => {
    if (cachedBills) setLocalBills(cachedBills);
  }, [cachedBills]);

  const setProducts = useCallback((updater) => {
    setLocalProducts((prev) => {
      const current = prev || cachedProducts || [];
      const updated = typeof updater === 'function' ? updater(current) : updater;
      queryClient.setQueryData(['posProducts', tenantId], updated);
      return updated;
    });
  }, [cachedProducts, queryClient, tenantId]);

  const setStudents = useCallback((updater) => {
    setLocalStudents((prev) => {
      const current = prev || cachedStudents || [];
      const updated = typeof updater === 'function' ? updater(current) : updater;
      queryClient.setQueryData(['posStudents', tenantId], updated);
      return updated;
    });
  }, [cachedStudents, queryClient, tenantId]);

  const setAcademyBills = useCallback((updater) => {
    setLocalBills((prev) => {
      const current = prev || cachedBills || [];
      const updated = typeof updater === 'function' ? updater(current) : updater;
      queryClient.setQueryData(['posAcademyBills', tenantId], updated);
      return updated;
    });
  }, [cachedBills, queryClient, tenantId]);

  const fetchProducts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['posProducts', tenantId] });
  }, [queryClient, tenantId]);

  const fetchStudents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['posStudents', tenantId] });
  }, [queryClient, tenantId]);

  const fetchBills = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['posAcademyBills', tenantId] });
  }, [queryClient, tenantId]);


  // =====================================================================
  // 3. STATE KERANJANG, SEARCH, BARCODE SCANNER, RECEIPT & TAB KATALOG
  // =====================================================================
  const { tenantProfile } = useArenaData(userProfile);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Tunai (Cash)');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState(null);

  // POS Checkout & Thermal Receipt Modal States
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastTransactionData, setLastTransactionData] = useState(null);
  const receiptRef = useRef(null);

  const arenaData = useMemo(() => ({
    name: tenantProfile?.name || tenantProfile?.receiptHeaderName || 'KEDIRI SPORT ARENA',
    address: tenantProfile?.address || tenantProfile?.alamat || tenantProfile?.receiptAddress || 'Jl. Letjen Soetoyo No. 20, Wates, Kediri',
    phone: tenantProfile?.phone || tenantProfile?.whatsapp || tenantProfile?.receiptContact || '082131447972',
    qrisImageBase64: tenantProfile?.qrisImageBase64 || tenantProfile?.qrisUrl || '',
    bankName: tenantProfile?.bankName || 'BCA',
    bankAccountNumber: tenantProfile?.bankAccountNumber || '1234-567-890',
    bankAccountHolder: tenantProfile?.bankAccountHolder || tenantProfile?.name || 'GOR Arena'
  }), [tenantProfile]);

  // Barcode Scanner & Manual Barcode Entry States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanNotification, setScanNotification] = useState(null);
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Tab Filter Katalog: 'all' | 'fnb' | 'sewa' | 'apparel' | 'spp'
  const [activeCatalogTab, setActiveCatalogTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Adding/Editing Product Master
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Minuman / F&B');
  const [newProductType, setNewProductType] = useState('jual'); // 'jual' | 'sewa'
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [newProductCogs, setNewProductCogs] = useState(''); // Modal / HPP
  const [newProductPrice, setNewProductPrice] = useState(''); // Harga Jual
  const [newProductStock, setNewProductStock] = useState('50'); // Stok
  const [savingProduct, setSavingProduct] = useState(false);

  // Saring Siswa dengan Tagihan Belum Lunas / Menunggak
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const unpaidStudents = useMemo(() => {
    return students.filter((st) => {
      // 1. Cek status eksplisit menunggak atau belum lunas
      if (st.paymentStatus === 'menunggak' || st.sppStatus === 'Belum Lunas') {
        return true;
      }
      // 2. Cek apakah belum ada pembayaran untuk bulan berjalan
      if (st.lastPaidMonth !== currentMonth) {
        return true;
      }
      return false;
    });
  }, [students, currentMonth]);

  // =====================================================================
  // 6. GLOBAL BARCODE SCANNER LISTENER (HID KEYBOARD EMULATION)
  // =====================================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore system modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'Escape'].includes(e.key)) {
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT'
      );

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key signals end of barcode scanning sequence or manual submit
      if (e.key === 'Enter') {
        const isManualInput = isInputFocused && activeEl.id === 'manual-barcode-input';
        const codeToScan = isManualInput ? barcodeInput.trim() : barcodeBufferRef.current.trim();

        if (codeToScan) {
          processBarcodeScan(codeToScan);
          barcodeBufferRef.current = '';
          setBarcodeInput('');
          if (isManualInput) {
            e.preventDefault();
          }
        }
        return;
      }

      // Scanner sends keystrokes with < 50ms interval between characters
      if (timeDiff < 50 || barcodeBufferRef.current.length > 0) {
        if (e.key.length === 1) {
          barcodeBufferRef.current += e.key;
        }
      } else if (!isInputFocused && e.key.length === 1) {
        barcodeBufferRef.current = e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, barcodeInput, cart]);

  // Process barcode scan lookup and add item to cart
  const processBarcodeScan = (code) => {
    if (!code) return;
    const targetCode = code.trim().toLowerCase();

    // Look up product by barcode (exact or lowercase) or name
    const found = products.find(
      (p) => (p.barcode || '').trim().toLowerCase() === targetCode ||
             (p.name || '').trim().toLowerCase() === targetCode
    );

    if (found) {
      if (found.type !== 'sewa' && (found.stock ?? 0) <= 0) {
        setScanNotification({
          type: 'error',
          message: `⚠️ STOK HABIS: Produk "${found.name}" (Stok: ${found.stock || 0})`
        });
        setTimeout(() => setScanNotification(null), 3500);
        return;
      }

      handleAddToCart(found);
      setScanNotification({
        type: 'success',
        message: `⚡ SCAN BERHASIL: "${found.name}" ditambahkan ke keranjang (+1)`
      });
      setTimeout(() => setScanNotification(null), 3500);
    } else {
      setScanNotification({
        type: 'error',
        message: `❌ PRODUK TIDAK DITEMUKAN: Barcode "${code}"`
      });
      setTimeout(() => setScanNotification(null), 3500);
    }
  };

  // =====================================================================
  // 7. FILTERING KATALOG PRODUK & TAGIHAN
  // =====================================================================
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = (prod.name || '').toLowerCase().includes(q) ||
        (prod.category || '').toLowerCase().includes(q) ||
        (prod.barcode || '').toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (activeCatalogTab === 'fnb') {
        return (prod.category || '').toLowerCase().includes('minuman') || 
               (prod.category || '').toLowerCase().includes('makanan') ||
               (prod.category || '').toLowerCase().includes('f&b') ||
               (prod.category || '').toLowerCase().includes('snack');
      }
      if (activeCatalogTab === 'apparel') {
        return (prod.category || '').toLowerCase().includes('apparel') ||
               (prod.category || '').toLowerCase().includes('aksesoris') ||
               (prod.category || '').toLowerCase().includes('shuttlecock') ||
               (prod.category || '').toLowerCase().includes('bola');
      }
      if (activeCatalogTab === 'sewa') {
        return prod.type === 'sewa' || (prod.category || '').toLowerCase().includes('sewa');
      }
      return true; // 'all'
    });
  }, [products, activeCatalogTab, searchQuery]);

  // Filter Tagihan Akademi (Pendaftaran & SPP Bulanan)
  const filteredBills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return academyBills;
    return academyBills.filter((bill) => {
      const bName = (bill.name || '').toLowerCase();
      const sName = (bill.studentName || '').toLowerCase();
      const cName = (bill.className || '').toLowerCase();
      const pName = (bill.parentName || '').toLowerCase();
      const pPhone = (bill.parentPhone || '').toLowerCase();
      const subCat = (bill.subCategory || '').toLowerCase();
      return bName.includes(q) || sName.includes(q) || cName.includes(q) || pName.includes(q) || pPhone.includes(q) || subCat.includes(q);
    });
  }, [academyBills, searchQuery]);

  // =====================================================================
  // 8. CART HANDLERS & STOCK CHECK
  // =====================================================================
  const handleAddToCart = (product) => {
    // 1. Khusus tagihan akademi (Pendaftaran Siswa Baru atau SPP Bulanan)
    if (product.type === 'spp' || product.type === 'registration') {
      const isAlreadyInCart = cart.some((item) => item.id === product.id);
      if (isAlreadyInCart) {
        setScanNotification({
          type: 'error',
          message: `⚠️ Tagihan "${product.name}" sudah ada di keranjang!`
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
        message: `⚡ TAGIHAN DITAMBAHKAN: "${product.name}" siap di-checkout`
      });
      setTimeout(() => setScanNotification(null), 3000);
      return;
    }

    // 2. Produk retail & sewa inventaris
    if (product.type !== 'sewa' && (product.stock ?? 0) <= 0) {
      setScanNotification({
        type: 'error',
        message: `⚠️ Produk "${product.name}" stoknya habis!`
      });
      setTimeout(() => setScanNotification(null), 3000);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.id === product.id);
    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].qty;
      if (product.type !== 'sewa' && currentQty + 1 > (product.stock ?? 0)) {
        setScanNotification({
          type: 'error',
          message: `⚠️ Kuantitas melebihi stok tersedia (${product.stock} unit)`
        });
        setTimeout(() => setScanNotification(null), 3000);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].qty += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: parseFloat(product.price) || 0,
          cogs: parseFloat(product.cogs) || 0, // CRITICAL FOR GROSS PROFIT REPORTING
          category: product.category || 'Minuman / F&B',
          type: product.type || 'jual',
          barcode: product.barcode || '',
          stock: product.stock ?? 0,
          qty: 1
        }
      ]);
    }
  };

  const handleUpdateQty = (itemId, delta) => {
    const updated = cart
      .map((item) => {
        if (item.id === itemId) {
          if (item.type === 'spp' || item.type === 'registration') {
            return delta < 0 ? null : item;
          }
          const newQty = item.qty + delta;
          if (item.type !== 'sewa' && item.stock != null && newQty > item.stock) {
            setScanNotification({
              type: 'error',
              message: `Mencapai batas stok tersedia (${item.stock} unit)`
            });
            setTimeout(() => setScanNotification(null), 3000);
            return item;
          }
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      })
      .filter(Boolean);
    setCart(updated);
  };

  const handleRemoveFromCart = (itemId) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // =====================================================================
  // 9. CHECKOUT HANDLER & SUPABASE TRANSACTION (STOK DEDUCTION + KAS LEDGER)
  // =====================================================================
  const handleConfirmPayment = async ({ paymentMethod: chosenMethod, cashReceived, changeAmount, customerName } = {}) => {
    if (cart.length === 0 || !tenantId) return;
    setSubmittingCheckout(true);
    setCheckoutSuccessMsg(null);

    const activePaymentMethod = chosenMethod || paymentMethod;
    const isCashMode = activePaymentMethod?.toLowerCase().includes('cash') || activePaymentMethod?.toLowerCase().includes('tunai');
    const finalCashReceived = isCashMode ? (Number(cashReceived) || cartTotal) : cartTotal;
    const finalChange = isCashMode ? Math.max(0, Number(changeAmount) || (finalCashReceived - cartTotal)) : 0;

    const isUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim()));

    try {
      const itemsSummary = cart.map((i) => `${i.name} (${i.qty}x)`).join(', ');
      const hasAcademy = cart.some((i) => i.type === 'spp' || i.type === 'registration');

      // 1. Update product stocks in Supabase (produk fisik retail)
      const physicalItems = cart.filter((i) => i.type !== 'spp' && i.type !== 'registration' && i.type !== 'sewa' && i.id);
      for (const item of physicalItems) {
        if (isUuid(item.id)) {
          try {
            const currentProd = products.find((p) => p.id === item.id);
            const currentStock = currentProd ? Number(currentProd.stock || 0) : item.stock || 0;
            const newStock = Math.max(0, currentStock - item.qty);
            await updateProduct(item.id, { stock: newStock });
          } catch (e) {
            console.warn('Stock update skipped for non-persisted product:', item.id, e);
          }
        }
      }

      // 2. Update status Biaya Pendaftaran Siswa di tabel students
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
            console.warn('Student registration fee update error:', e);
          }
        }
      }

      // 3. Update SPP students and record spp_payments
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
            console.warn('Student SPP update error:', e);
          }
        }

        if (isUuid(tenantId)) {
          try {
            if ((s.sppId || s.spp_id) && isUuid(s.sppId || s.spp_id)) {
              await supabase
                .from('spp_payments')
                .update({
                  status: 'COMPLETED',
                  payment_method: activePaymentMethod,
                  updated_at: new Date().toISOString()
                })
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

      // 4. Create transaction record in Supabase
      let txRes = null;
      if (isUuid(tenantId)) {
        try {
          txRes = await createTransaction({
            tenantId,
            itemName: itemsSummary,
            itemCategory: hasAcademy ? 'POS & Tagihan SPP Akademi' : 'Penjualan Retail POS',
            amount: cartTotal,
            paymentMethod: activePaymentMethod,
            itemsCount: cart.reduce((a, b) => a + b.qty, 0),
            items: cart.map((i) => ({
              id: i.id,
              productId: i.id,
              name: i.name,
              price: i.price,
              cogs: i.cogs || 0,
              qty: i.qty,
              type: i.type || 'jual',
              category: i.category || 'Retail',
              barcode: i.barcode || '',
              studentId: i.studentId || i.student_id || null,
              academyId: i.academyId || null
            })),
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

      // 6. Create cash ledger record
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

      // Update local product stocks optimistically
      setProducts((prev) =>
        prev.map((p) => {
          const cartItem = cart.find((c) => c.id === p.id);
          if (cartItem && cartItem.type !== 'spp' && cartItem.type !== 'registration' && cartItem.type !== 'sewa') {
            return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
          }
          return p;
        })
      );

      // Update local students SPP & Registration status optimistically
      setStudents((prev) =>
        prev.map((st) => {
          let updated = { ...st };
          if (regItems.some((ri) => (ri.studentId || ri.student_id) === st.id)) {
            updated.registrationFeePaid = true;
            updated.isRegistrationFeePaid = true;
          }
          if (sppItems.some((si) => (si.studentId || si.student_id) === st.id)) {
            updated.sppStatus = 'Lunas';
            updated.paymentStatus = 'lunas';
            updated.lastPaidMonth = currentMonth;
          }
          return updated;
        })
      );

      // Remove paid bills from local academyBills state optimistically
      setAcademyBills((prev) => prev.filter((b) => !cart.some((c) => c.id === b.id)));

      // Invalidate queries so TanStack Query background refetches fresh data
      queryClient.invalidateQueries({ queryKey: ['posAcademyBills', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['posStudents', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['posProducts', tenantId] });

      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));

      // Format payload struk thermal untuk preview & cetak
      const now = new Date();
      const receiptPayload = {
        date: now.toLocaleDateString('id-ID'),
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        receiptNo: `POS-${txRes?.id ? String(txRes.id).slice(-6).toUpperCase() : Math.floor(Date.now() / 1000)}`,
        cashierName: userProfile?.fullName || userProfile?.name || 'Kasir',
        customerName: customerName || 'Pelanggan Umum',
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          type: i.type,
          subtotal: i.qty * i.price
        })),
        totalAmount: cartTotal,
        paymentMethod: activePaymentMethod,
        cashReceived: finalCashReceived,
        changeAmount: finalChange
      };

      setLastTransactionData(receiptPayload);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);

      setCheckoutSuccessMsg(
        hasSpp 
          ? 'Transaksi kasir & pelunasan SPP Akademi berhasil disimpan! Silakan cetak struk.' 
          : 'Transaksi kasir berhasil disimpan! Silakan cetak struk.'
      );
      setTimeout(() => setCheckoutSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error during POS checkout in Supabase:', err);
      setCheckoutSuccessMsg('Gagal memproses checkout: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleFinishTransaction = () => {
    setShowReceiptModal(false);
    setLastTransactionData(null);
    setCart([]);
  };

  // =====================================================================
  // 10. CRUD MASTER PRODUK & INVENTARIS
  // =====================================================================
  const handleOpenAddProductModal = () => {
    setEditingProduct(null);
    setNewProductName('');
    setNewProductCategory('Minuman / F&B');
    setNewProductType('jual');
    setNewProductBarcode('');
    setNewProductCogs('');
    setNewProductPrice('');
    setNewProductStock('50');
    setShowAddProductModal(true);
  };

  const handleOpenEditProductModal = (prod) => {
    setEditingProduct(prod);
    setNewProductName(prod.name || '');
    setNewProductCategory(prod.category || 'Minuman / F&B');
    setNewProductType(prod.type || 'jual');
    setNewProductBarcode(prod.barcode || '');
    setNewProductCogs(prod.cogs != null ? String(prod.cogs) : '');
    setNewProductPrice(prod.price != null ? String(prod.price) : '');
    setNewProductStock(prod.stock != null ? String(prod.stock) : '0');
    setShowAddProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!newProductName.trim() || !tenantId) return;
    setSavingProduct(true);
    try {
      const payload = {
        tenantId,
        name: newProductName.trim(),
        category: newProductCategory,
        type: newProductType,
        barcode: newProductBarcode.trim(),
        cogs: parseFloat(newProductCogs) || 0,
        price: parseFloat(newProductPrice) || 0,
        stock: parseInt(newProductStock, 10) || 0
      };

      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
      } else {
        const created = await createProduct(payload);
        setProducts((prev) => [created, ...prev]);
      }

      setShowAddProductModal(false);
      setEditingProduct(null);
      setNewProductName('');
      setNewProductBarcode('');
      setNewProductCogs('');
      setNewProductPrice('');
      setNewProductType('jual');
    } catch (err) {
      console.error('Error saving product master in Supabase:', err);
      alert('Gagal menyimpan produk: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus produk "${productName}" dari inventaris?`)) {
      return;
    }
    try {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setCart((prev) => prev.filter((item) => item.id !== productId));
    } catch (err) {
      console.error('Error deleting product from Supabase:', err);
      alert('Gagal menghapus produk: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  return (
    <div className="space-y-3.5 text-[#333333]">
      
      {/* HEADER UTAMA KASIR */}
      <div className="bg-white dark:bg-[#14211E] rounded-xl px-4 py-3 shadow-xs border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Kasir3DIcon className="w-8 h-8 shrink-0 drop-shadow-2xs" />
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>Kasir (POS Global)</span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Penjualan retail F&amp;B, sewa peralatan, serta pembayaran tagihan SPP Akademi dalam satu struk
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddProductModal}
          className="px-3 py-1.5 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah / Kelola Inventaris</span>
        </button>
      </div>

      {checkoutSuccessMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-semibold flex items-center space-x-2 animate-fadeIn shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{checkoutSuccessMsg}</span>
        </div>
      )}

      {/* BARCODE SCANNER INTEGRATION BANNER & MANUAL INPUT */}
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-[#354944]/10 dark:bg-white/10 text-[#354944] dark:text-[#C89D32] rounded-lg shrink-0">
              <ScanBarcode className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Auto Barcode Scanner POS</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pindai barcode scanner atau ketik manual lalu tekan <kbd className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-1.5 py-0.2 rounded text-[10px] font-mono">Enter</kbd>
              </p>
            </div>
          </div>

          {/* MANUAL BARCODE INPUT FIELD */}
          <div className="w-full sm:w-80 relative">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="manual-barcode-input"
              type="text"
              placeholder="Scan / Ketik Barcode [Enter]..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  processBarcodeScan(barcodeInput.trim());
                  setBarcodeInput('');
                }
              }}
              className="w-full pl-9 pr-16 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-mono text-slate-800 placeholder-slate-400 shadow-2xs"
            />
            <button
              type="button"
              onClick={() => {
                processBarcodeScan(barcodeInput.trim());
                setBarcodeInput('');
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-sm"
            >
              Scan
            </button>
          </div>
        </div>

        {/* FLASH SCAN NOTIFICATION BANNER */}
        {scanNotification && (
          <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-between animate-fadeIn ${
            scanNotification.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <span>{scanNotification.message}</span>
            <button onClick={() => setScanNotification(null)} className="p-0.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* RESPONSIVE GRID & LAYOUT UTAMA */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3.5 relative">
        
        {/* AREA KATALOG & TAB (KOLOM KIRI - 2 COLS) */}
        <div className={`lg:col-span-2 flex flex-col bg-white dark:bg-[#14211E] rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 dark:border-white/10 space-y-3 ${cart.length > 0 ? 'pb-72 lg:pb-4' : 'pb-4 lg:pb-4'}`}>
          
          {/* BAR PENCARIAN & TAB KATEGORI */}
          <div className="space-y-2.5 border-b border-slate-100 dark:border-white/10 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-bold text-sm sm:text-base text-slate-800 flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4 text-[#354944]" />
                <span>Katalog Produk Inventaris &amp; Tagihan</span>
              </h2>

              {/* SEARCH INPUT */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={activeCatalogTab === 'spp' ? 'Cari nama siswa / wali...' : 'Cari nama / barcode produk...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-medium"
                />
              </div>
            </div>

            {/* TAB SEGMENTED CONTROL */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
              <button
                type="button"
                onClick={() => setActiveCatalogTab('all')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  activeCatalogTab === 'all'
                    ? 'bg-[#354944] text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-medium'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Semua Item ({products.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCatalogTab('fnb')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  activeCatalogTab === 'fnb'
                    ? 'bg-[#354944] text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-medium'
                }`}
              >
                <span>F&amp;B / Minuman</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCatalogTab('apparel')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  activeCatalogTab === 'apparel'
                    ? 'bg-[#354944] text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-medium'
                }`}
              >
                <span>Apparel / Alat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCatalogTab('sewa')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  activeCatalogTab === 'sewa'
                    ? 'bg-[#354944] text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-medium'
                }`}
              >
                <span>Rental Alat</span>
              </button>

              {/* TAB KHUSUS: TAGIHAN SPP & PENDAFTARAN AKADEMI */}
              <button
                type="button"
                onClick={() => setActiveCatalogTab('spp')}
                className={`px-3.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  activeCatalogTab === 'spp'
                    ? 'bg-[#354944] text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-medium'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Tagihan SPP &amp; Pendaftaran</span>
                {academyBills.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    activeCatalogTab === 'spp' ? 'bg-white text-[#354944]' : 'bg-rose-500 text-white'
                  }`}>
                    {academyBills.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* KONTEN KATALOG: TAB 'SPP & PENDAFTARAN' */}
          {activeCatalogTab === 'spp' ? (
            loadingBills ? (
              <div className="py-12 text-center text-xs text-slate-500 font-medium">
                Memuat data tagihan siswa akademi...
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-center flex flex-col items-center justify-center p-6 bg-emerald-50/30 dark:bg-emerald-950/20">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Semua Tagihan Siswa Selesai!
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 max-w-sm mt-1">
                  Tidak ada siswa akademi dengan status pendaftaran atau SPP menunggak saat ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <span>Daftar Tagihan Belum Lunas ({filteredBills.length})</span>
                  <span className="text-[10px] text-[#354944] dark:text-[#C89D32] font-bold">Klik kartu atau tombol untuk menambahkan ke kasir</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredBills.map((bill) => {
                    const isAdded = cart.some((c) => c.id === bill.id);
                    const isRegistration = bill.type === 'registration';

                    return (
                      <div
                        key={bill.id}
                        onClick={() => !isAdded && handleAddToCart(bill)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isAdded
                            ? 'bg-[#354944]/10 dark:bg-white/10 border-[#354944] dark:border-[#C89D32] ring-2 ring-[#354944]/30'
                            : 'bg-white dark:bg-[#14211E] border-slate-200/80 dark:border-white/10 hover:border-[#354944]/40 hover:bg-[#354944]/5 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            {isRegistration ? (
                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 font-extrabold text-[9px] rounded-md uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>PENDAFTARAN</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 font-extrabold text-[9px] rounded-md uppercase tracking-wider flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-purple-700 dark:text-purple-300" />
                                <span>SPP BULANAN</span>
                              </span>
                            )}

                            {bill.className && (
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-[9px] rounded-md truncate max-w-[130px]">
                                {bill.className}
                              </span>
                            )}
                          </div>

                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 pt-0.5 leading-snug">
                            {bill.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Wali: <strong className="text-slate-700 dark:text-slate-300">{bill.parentName || '-'}</strong> {bill.parentPhone ? `(${bill.parentPhone})` : ''}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-white/10">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">
                              {isRegistration ? 'Biaya Pendaftaran:' : 'Nominal SPP:'}
                            </span>
                            <span className={`font-black text-sm ${isRegistration ? 'text-amber-700 dark:text-amber-300' : 'text-purple-700 dark:text-purple-300'}`}>
                              Rp {Number(bill.price || 0).toLocaleString('id-ID')}
                            </span>
                          </div>

                          {isAdded ? (
                            <span className="px-2.5 py-1 bg-[#354944] text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs">
                              <Check className="w-3.5 h-3.5" />
                              <span>Di Keranjang</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(bill);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1 border ${
                                isRegistration
                                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-600 hover:text-white'
                                  : 'bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800 hover:bg-purple-600 hover:text-white'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Bayar di Kasir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            /* KONTEN KATALOG: PRODUK RETAIL & SEWA ALAT (INVENTARIS) */
            loadingProducts ? (
              <div className="py-12 text-center text-xs text-slate-500 font-medium">Memuat katalog produk inventaris...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center p-6">
                <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  Tidak ada produk yang sesuai dengan filter atau pencarian.
                </p>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  Klik tombol "+ Tambah / Kelola Inventaris" untuk mendaftarkan barang baru.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProducts.map((prod) => {
                  const isSewa = prod.type === 'sewa';
                  const isOutOfStock = !isSewa && (prod.stock ?? 0) <= 0;
                  const margin = (prod.price || 0) - (prod.cogs || 0);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => !isOutOfStock && handleAddToCart(prod)}
                      className={`p-3.5 rounded-2xl border transition-all relative flex flex-col justify-between space-y-2 group shadow-2xs ${
                        isOutOfStock
                          ? 'bg-slate-100/70 border-slate-200 opacity-65 cursor-not-allowed grayscale'
                          : 'bg-white border-slate-200 hover:border-[#354944]/40 hover:bg-[#354944]/5 cursor-pointer'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                            {prod.category || 'F&B'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isSewa ? (
                              <span className="px-1.5 py-0.5 bg-[#354944]/10 text-[#354944] font-black text-[9px] rounded-md uppercase">
                                SEWA
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[9px] rounded-md uppercase">
                                JUAL
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditProductModal(prod);
                              }}
                              className="p-1 text-slate-400 hover:text-[#354944] hover:bg-[#354944]/10 rounded-lg transition-colors cursor-pointer"
                              title="Edit Produk Master"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(prod.id, prod.name);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-[#354944] leading-snug line-clamp-2">
                          {prod.name}
                        </p>

                        {/* BARCODE BADGE */}
                        {prod.barcode && (
                          <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-mono">
                            <Barcode className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{prod.barcode}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {/* METRICS STOK & HPP/MARGIN */}
                        <div className="flex items-center justify-between text-[10px]">
                          <div>
                            <span className="text-slate-400 block font-bold">Stok:</span>
                            {isSewa ? (
                              <span className="font-bold text-[#354944]">{prod.stock || 0} unit</span>
                            ) : isOutOfStock ? (
                              <span className="font-extrabold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase">HABIS</span>
                            ) : (
                              <span className="font-bold text-slate-700">{prod.stock || 0} unit</span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-slate-400 block font-bold">HPP / Margin:</span>
                            <span className="font-bold text-emerald-700">
                              Rp {(margin > 0 ? margin : 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        {/* HARGA JUAL & BUTTON */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-black text-sm text-[#354944]">
                            Rp {Number(prod.price || 0).toLocaleString('id-ID')}
                          </span>

                          {isOutOfStock ? (
                            <span className="px-2 py-1 bg-slate-200 text-slate-500 rounded-xl text-[10px] font-bold">
                              Habis
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-900 group-hover:bg-[#354944] text-white rounded-xl text-[10px] font-bold transition-colors flex items-center gap-1 shadow-2xs">
                              <Plus className="w-3 h-3" />
                              <span>Tambah</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* AREA KERANJANG */}
        <div className={`${cart.length === 0 ? 'hidden lg:flex lg:flex-col lg:sticky lg:top-24 lg:col-span-1' : 'fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#14211E] border-t border-slate-200 dark:border-white/10 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.15)] p-3.5 max-h-[65vh] overflow-y-auto rounded-t-xl lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:col-span-1 lg:sticky lg:top-24 lg:border-none lg:shadow-none lg:p-0 lg:max-h-[calc(100vh-120px)] lg:rounded-none'}`}>
          <div className="bg-white dark:bg-[#14211E] lg:rounded-xl lg:p-3.5 sm:lg:p-4 lg:shadow-xs lg:border lg:border-slate-200/80 dark:border-white/10 flex flex-col justify-between space-y-3">
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2">
                <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                  <Receipt className="w-4 h-4 text-[#354944] dark:text-[#C89D32]" />
                  <span>Keranjang Belanja</span>
                </h2>
                <span className="text-[11px] font-semibold text-slate-400">
                  {cart.reduce((a, b) => a + b.qty, 0)} Item
                </span>
              </div>

              {/* CART ITEMS OR EMPTY STATE */}
              {cart.length === 0 ? (
                <div className="py-4 lg:py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-3">
                  <Inbox className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Keranjang kosong</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">Pilih produk retail atau tagihan SPP di katalog.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-48 lg:max-h-60 overflow-y-auto pr-1 space-y-0.5">
                  {cart.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div className="overflow-hidden pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{item.name}</span>
                          
                          {item.type === 'registration' ? (
                            <span className="text-[8px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5 shrink-0 border border-amber-300 dark:border-amber-700">
                              <span>Pendaftaran</span>
                            </span>
                          ) : item.type === 'spp' ? (
                            <span className="text-[8px] bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5 shrink-0 border border-purple-200 dark:border-purple-800">
                              <GraduationCap className="w-2.5 h-2.5 text-purple-700 dark:text-purple-300" />
                              <span>SPP</span>
                            </span>
                          ) : item.type === 'sewa' ? (
                            <span className="text-[8px] bg-[#354944]/10 dark:bg-white/10 text-[#354944] dark:text-[#C89D32] px-1 py-0.2 rounded font-extrabold shrink-0">
                              SEWA
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          @ Rp {Number(item.price).toLocaleString('id-ID')}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {item.type === 'registration' || item.type === 'spp' ? (
                          <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            item.type === 'registration'
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          }`}>
                            {item.type === 'registration' ? '1 Siswa' : '1 Bln'}
                          </div>
                        ) : (
                          <div className="flex items-center bg-slate-100 dark:bg-white/10 rounded-md p-0.5 border border-slate-200 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, -1)}
                              className="px-1.5 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer"
                            >
                              -
                            </button>
                            <span className="px-1.5 font-bold text-xs font-mono text-slate-800 dark:text-slate-100">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, 1)}
                              className="px-1.5 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Hapus dari keranjang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TOTAL & CHECKOUT BUTTON */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">Metode Bayar</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg focus:bg-white focus:outline-none focus:border-[#354944] font-semibold text-slate-800 dark:text-slate-200 shrink-0 cursor-pointer"
                >
                  <option value="QRIS / Transfer">QRIS / Transfer Bank</option>
                  <option value="Tunai (Cash)">Tunai (Cash)</option>
                  <option value="Kartu Debit/Kredit">Kartu Debit/Kredit</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Total Bayar:</span>
                <span className="text-base lg:text-lg font-bold font-mono text-[#354944] dark:text-[#C89D32] tabular-nums">
                  Rp {cartTotal.toLocaleString('id-ID')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                disabled={cart.length === 0 || submittingCheckout}
                className="w-full py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border dark:disabled:border-slate-700/80 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg shadow-xs disabled:shadow-none transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{submittingCheckout ? 'Memproses Transaksi...' : 'Bayar & Cetak Struk'}</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* MODAL: TAMBAH / EDIT PRODUK MASTER INVENTARIS */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-slate-800 border border-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-[#354944]" />
                <h3 className="font-bold text-base text-slate-800">
                  {editingProduct ? 'Edit Master Produk Inventaris' : 'Tambah Master Produk Inventaris'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowAddProductModal(false);
                  setEditingProduct(null);
                }} 
                className="p-1 text-slate-400 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-left">
              
              {/* PEMILIH TIPE PRODUK (JUAL VS SEWA) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Tipe Barang / Layanan <span className="text-[#C89D32]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProductType('jual')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      newProductType === 'jual'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Jual (Barang Fisik / Retail)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProductType('sewa')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      newProductType === 'sewa'
                        ? 'bg-[#354944]/10 border-[#354944] text-[#354944] shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Sewa (Rental Alat)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Produk / Barang <span className="text-[#C89D32]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder={
                    newProductType === 'sewa'
                      ? 'misal: Sewa Raket Yonex / Sepatu Size 42'
                      : 'misal: Air Mineral 600ml / Shuttlecock JP Gold'
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#354944] font-bold"
                />
              </div>

              {/* KODE BARCODE & AUTO GENERATE BUTTON */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Kode Barcode (EAN / UPC / Custom)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randCode = '899' + Math.floor(100000000 + Math.random() * 900000000);
                      setNewProductBarcode(randCode);
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    + Auto Random Code
                  </button>
                </div>
                <input
                  type="text"
                  value={newProductBarcode}
                  onChange={(e) => setNewProductBarcode(e.target.value)}
                  placeholder="Scan dengan Barcode Scanner atau Ketik Manual..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-mono text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kategori</label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#354944] cursor-pointer font-medium"
                  >
                    <option value="Minuman / F&B">Minuman / F&amp;B</option>
                    <option value="Makanan / Snack">Makanan / Snack</option>
                    <option value="Shuttlecock / Bola">Shuttlecock / Bola</option>
                    <option value="Apparel / Jersey">Apparel / Jersey</option>
                    <option value="Sewa Raket / Sepatu">Sewa Raket / Sepatu</option>
                    <option value="Aksesoris Olahraga">Aksesoris Olahraga</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    HPP / Modal (Rp) <span className="text-emerald-600 font-normal">(COGS)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newProductCogs}
                    onChange={(e) => setNewProductCogs(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {newProductType === 'sewa' ? 'Harga Sewa (Rp / Sesi)' : 'Harga Jual (Rp)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    placeholder={newProductType === 'sewa' ? '25000' : '10000'}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#354944] font-bold text-[#354944]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {newProductType === 'sewa' ? 'Unit Disewakan' : 'Stok Tersisa (Unit)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newProductStock}
                    onChange={(e) => setNewProductStock(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#354944] font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-1 py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-semibold text-xs rounded-xl cursor-pointer shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>{savingProduct ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: KONFIRMASI PEMBAYARAN KASIR (POS CHECKOUT MODAL) */}
      <PosCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        cart={cart}
        totalAmount={cartTotal}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cashierName={userProfile?.fullName || userProfile?.name || 'Kasir'}
        arena={arenaData}
        onConfirmPayment={handleConfirmPayment}
        isProcessing={submittingCheckout}
      />

      {/* MODAL 2: PRATINJAU STRUK KASIR & CETAK THERMAL */}
      {showReceiptModal && lastTransactionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-category">
          <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 flex flex-col my-auto max-h-[92vh] overflow-hidden">
            
            {/* Header Dialog */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10 bg-emerald-50/80 dark:bg-emerald-950/40 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Pratinjau Struk Kasir</h2>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Pembayaran Berhasil &amp; Transaksi Dicatat</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleFinishTransaction} 
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Tutup & Transaksi Baru"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Receipt Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50">
              <div className="w-full text-center space-y-0.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Struk Siap Dicetak</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Gunakan printer thermal 58mm / 80mm untuk mencetak bukti transaksi.</p>
              </div>

              {/* Printable Container */}
              <div className="w-full flex justify-center overflow-x-auto p-2 bg-slate-200 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
                <div id="thermal-receipt-printable" className="bg-white rounded-md shadow-xs">
                  <PosThermalReceipt 
                    ref={receiptRef} 
                    transaction={lastTransactionData} 
                    arena={arenaData} 
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-3.5 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-[#162320] flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleFinishTransaction}
                className="flex-1 py-2 px-3 border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                Selesai / Transaksi Baru
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[#F4D068]" />
                <span>Cetak Struk</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
