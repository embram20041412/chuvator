import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  X, 
  Trophy, 
  Users, 
  DollarSign, 
  GitBranch, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Tag, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MessageCircle, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Handshake, 
  Sparkles, 
  Award,
  Layers,
  ArrowUpRight,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export default function EventDetailModal({ event, isOpen, onClose, userProfile }) {
  if (!isOpen || !event) return null;

  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid || event?.tenantId || '';

  // Internal Tabs: 'categories' | 'registrations' | 'finance' | 'bracket'
  const [activeTab, setActiveTab] = useState('categories');

  // Firestore Real-time Collections State
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [eventSponsors, setEventSponsors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal & Form States: Categories
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    maxSlots: 16,
    fee: 150000,
    description: ''
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Modal & Form States: Registrations
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [regForm, setRegForm] = useState({
    categoryId: '',
    participantName: '',
    contactName: '',
    whatsappNumber: '',
    paymentStatus: 'Lunas',
    paymentMethod: 'Cash',
    amountPaid: 0
  });
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regCategoryFilter, setRegCategoryFilter] = useState('Semua');
  const [regStatusFilter, setRegStatusFilter] = useState('Semua');

  // Modal & Form States: Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Wasit & Official',
    amount: 500000,
    note: ''
  });
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Formatters
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Data fetching helper
  const fetchEventData = async () => {
    if (!event?.id) return;
    setIsLoading(true);
    try {
      let catQ = supabase.from('event_categories').select('*').eq('event_id', event.id);
      let regQ = supabase.from('event_registrations').select('*').eq('event_id', event.id);
      let expQ = supabase.from('event_expenses').select('*').eq('event_id', event.id);
      let spQ = supabase.from('sponsors').select('*').eq('event_id', event.id);

      if (tenantId) {
        catQ = catQ.eq('tenant_id', tenantId);
        regQ = regQ.eq('tenant_id', tenantId);
        expQ = expQ.eq('tenant_id', tenantId);
        spQ = spQ.eq('tenant_id', tenantId);
      }

      const [catRes, regRes, expRes, spRes] = await Promise.all([catQ, regQ, expQ, spQ]);

      const mappedCats = (catRes.data || []).map((c) => ({
        ...c,
        id: c.id,
        name: c.name,
        maxSlots: c.max_slots ?? c.maxSlots ?? 16,
        fee: Number(c.fee || 0),
        description: c.description || ''
      }));
      setCategories(mappedCats);

      const mappedRegs = (regRes.data || []).map((r) => ({
        ...r,
        id: r.id,
        categoryId: r.category_id || r.categoryId,
        categoryName: r.category_name || r.categoryName || 'Umum',
        participantName: r.participant_name || r.participantName || '',
        contactName: r.contact_name || r.contactName || '',
        whatsappNumber: r.whatsapp_number || r.whatsappNumber || '',
        paymentStatus: r.payment_status || r.paymentStatus || 'Lunas',
        paymentMethod: r.payment_method || r.paymentMethod || 'Cash',
        amountPaid: Number(r.amount_paid ?? r.amountPaid ?? 0),
        fee: Number(r.fee || 0)
      }));
      setRegistrations(mappedRegs);

      const mappedExps = (expRes.data || []).map((e) => ({
        ...e,
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount || 0),
        note: e.note || ''
      }));
      setExpenses(mappedExps);

      const mappedSponsors = (spRes.data || []).map((s) => ({
        ...s,
        id: s.id,
        companyName: s.company_name || s.companyName || s.name || '',
        contractValue: Number(s.contract_value ?? s.contractValue ?? 0),
        status: s.status || 'Negosiasi',
        totalPaid: Number(s.total_paid ?? s.totalPaid ?? 0)
      }));
      setEventSponsors(mappedSponsors);
    } catch (err) {
      console.error('Error fetching event data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [event?.id, tenantId]);

  // ---------------------------------------------------------------------------
  // CATEGORIES ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({
        name: cat.name || '',
        maxSlots: cat.maxSlots || 16,
        fee: cat.fee || 0,
        description: cat.description || ''
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        maxSlots: 16,
        fee: event.registrationFee || 150000,
        description: ''
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert('Nama Kategori wajib diisi.');
      return;
    }

    setIsSavingCategory(true);
    try {
      const payload = {
        tenant_id: tenantId,
        event_id: event.id,
        name: categoryForm.name.trim(),
        max_slots: Number(categoryForm.maxSlots) || 0,
        fee: Number(categoryForm.fee) || 0,
        description: categoryForm.description.trim(),
        updated_at: new Date().toISOString()
      };

      if (editingCategory) {
        await supabase.from('event_categories').update(payload).eq('id', editingCategory.id);
      } else {
        await supabase.from('event_categories').insert([payload]);
      }

      setIsCategoryModalOpen(false);
      fetchEventData();
    } catch (err) {
      console.error('Error saving category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (window.confirm(`Hapus kategori "${catName}"? Pendaftaran terkait mungkin perlu diperiksa.`)) {
      try {
        await supabase.from('event_categories').delete().eq('id', catId);
        setCategories((prev) => prev.filter((c) => c.id !== catId));
      } catch (err) {
        console.error('Error deleting category:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // REGISTRATION ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenRegModal = (reg = null) => {
    if (reg) {
      setEditingReg(reg);
      setRegForm({
        categoryId: reg.categoryId || '',
        participantName: reg.participantName || '',
        contactName: reg.contactName || '',
        whatsappNumber: reg.whatsappNumber || '',
        paymentStatus: reg.paymentStatus || 'Lunas',
        paymentMethod: reg.paymentMethod || 'Cash',
        amountPaid: reg.amountPaid ?? reg.fee ?? 0
      });
    } else {
      setEditingReg(null);
      const defaultCat = categories[0];
      setRegForm({
        categoryId: defaultCat?.id || '',
        participantName: '',
        contactName: '',
        whatsappNumber: '',
        paymentStatus: 'Lunas',
        paymentMethod: 'Cash',
        amountPaid: defaultCat?.fee || event.registrationFee || 0
      });
    }
    setIsRegModalOpen(true);
  };

  const handleCategorySelectChange = (catId) => {
    const selectedCat = categories.find(c => c.id === catId);
    setRegForm(prev => ({
      ...prev,
      categoryId: catId,
      amountPaid: selectedCat ? selectedCat.fee : prev.amountPaid
    }));
  };

  const handleSaveReg = async (e) => {
    e.preventDefault();
    if (!regForm.participantName.trim()) {
      alert('Nama Peserta / Tim wajib diisi.');
      return;
    }

    setIsSavingReg(true);
    try {
      const selectedCat = categories.find(c => c.id === regForm.categoryId);
      const payload = {
        tenant_id: tenantId,
        event_id: event.id,
        category_id: regForm.categoryId || null,
        category_name: selectedCat ? selectedCat.name : 'Umum',
        fee: selectedCat ? (selectedCat.fee || 0) : (event.registrationFee || 0),
        participant_name: regForm.participantName.trim(),
        contact_name: regForm.contactName.trim(),
        whatsapp_number: regForm.whatsappNumber.trim(),
        payment_status: regForm.paymentStatus,
        payment_method: regForm.paymentMethod,
        amount_paid: Number(regForm.amountPaid) || 0,
        updated_at: new Date().toISOString()
      };

      if (editingReg) {
        await supabase.from('event_registrations').update(payload).eq('id', editingReg.id);
      } else {
        await supabase.from('event_registrations').insert([payload]);
      }

      setIsRegModalOpen(false);
      fetchEventData();
    } catch (err) {
      console.error('Error saving registration:', err);
    } finally {
      setIsSavingReg(false);
    }
  };

  const handleQuickStatusReg = async (regId, newStatus) => {
    try {
      await supabase.from('event_registrations').update({
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('id', regId);
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, paymentStatus: newStatus } : r));
    } catch (err) {
      console.error('Error updating reg status:', err);
    }
  };

  const handleDeleteReg = async (regId, participantName) => {
    if (window.confirm(`Hapus pendaftaran untuk "${participantName}"?`)) {
      try {
        await supabase.from('event_registrations').delete().eq('id', regId);
        setRegistrations(prev => prev.filter(r => r.id !== regId));
      } catch (err) {
        console.error('Error deleting registration:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // EXPENSE ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenExpenseModal = (exp = null) => {
    if (exp) {
      setEditingExpense(exp);
      setExpenseForm({
        title: exp.title || '',
        category: exp.category || 'Wasit & Official',
        amount: exp.amount || 0,
        note: exp.note || ''
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        title: '',
        category: 'Wasit & Official',
        amount: 500000,
        note: ''
      });
    }
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) {
      alert('Keterangan / Nama Item Pengeluaran wajib diisi.');
      return;
    }

    setIsSavingExpense(true);
    try {
      const payload = {
        tenant_id: tenantId,
        event_id: event.id,
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        amount: Number(expenseForm.amount) || 0,
        note: expenseForm.note.trim(),
        updated_at: new Date().toISOString()
      };

      if (editingExpense) {
        await supabase.from('event_expenses').update(payload).eq('id', editingExpense.id);
      } else {
        await supabase.from('event_expenses').insert([payload]);
      }

      setIsExpenseModalOpen(false);
      fetchEventData();
    } catch (err) {
      console.error('Error saving expense:', err);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expId, title) => {
    if (window.confirm(`Hapus item pengeluaran "${title}"?`)) {
      try {
        await supabase.from('event_expenses').delete().eq('id', expId);
        setExpenses(prev => prev.filter(e => e.id !== expId));
      } catch (err) {
        console.error('Error deleting expense:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // FINANCIAL CALCULATIONS
  // ---------------------------------------------------------------------------
  // Registration Revenue: Sum of actual amount paid for all registrations
  const registrationRevenue = registrations.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
  
  // Paid Registrations Count
  const paidRegistrationsCount = registrations.filter(r => r.paymentStatus === 'Lunas').length;
  const pendingRegistrationsCount = registrations.filter(r => r.paymentStatus !== 'Lunas').length;

  // Sponsor Revenue: Sum of contractValue for sponsors with status 'Deal' or 'Lunas'
  const sponsorRevenue = eventSponsors
    .filter(s => s.status === 'Deal' || s.status === 'Lunas')
    .reduce((sum, s) => sum + (Number(s.contractValue) || 0), 0);

  // Total Event Income
  const totalEventIncome = registrationRevenue + sponsorRevenue;

  // Total Event Expenses
  const totalEventExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Net Profit / Balance
  const netEventBalance = totalEventIncome - totalEventExpenses;

  // Filtered Registrations List
  const filteredRegistrations = registrations.filter(r => {
    const matchSearch = (r.participantName || '').toLowerCase().includes(regSearch.toLowerCase()) ||
                        (r.contactName || '').toLowerCase().includes(regSearch.toLowerCase()) ||
                        (r.whatsappNumber || '').includes(regSearch);
    const matchCat = regCategoryFilter === 'Semua' || r.categoryId === regCategoryFilter || r.categoryName === regCategoryFilter;
    const matchStatus = regStatusFilter === 'Semua' || r.paymentStatus === regStatusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl my-auto shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {event.posterUrl ? (
              <img 
                src={event.posterUrl} 
                alt={event.name} 
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-slate-700 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 flex-shrink-0">
                <Trophy className="w-8 h-8" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {event.sport || 'Olahraga'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  event.status === 'Berlangsung' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  event.status === 'Akan Datang' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  event.status === 'Selesai' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {event.status || 'Draft'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{event.name}</h2>
              <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {formatDate(event.startDate)} {event.endDate ? `- ${formatDate(event.endDate)}` : ''}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {event.location || 'GOR Utama'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors self-start sm:self-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* INTERNAL TABS NAVIGATION */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Info & Kategori ({categories.length})
          </button>

          <button
            onClick={() => setActiveTab('registrations')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'registrations'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            2. Pendaftaran Peserta ({registrations.length})
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'finance'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            3. Keuangan Event
          </button>

          <button
            onClick={() => setActiveTab('bracket')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'bracket'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            4. Bracket & Jadwal
          </button>
        </div>

        {/* TAB CONTENT BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* ================================================================= */}
          {/* TAB 1: INFO & KATEGORI */}
          {/* ================================================================= */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Event Description & Base Info Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Deskripsi & Ketentuan Event</h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {event.description || 'Belum ada deskripsi rinci untuk event ini.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[220px] bg-slate-900 p-3.5 rounded-lg border border-slate-800 justify-center">
                  <div>
                    <span className="text-xs text-slate-400 block">Biaya Standar Event</span>
                    <span className="text-base font-bold text-emerald-400">{formatRupiah(event.registrationFee)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Target Kuota Peserta</span>
                    <span className="text-base font-bold text-white">{event.totalSlots || 0} Slot</span>
                  </div>
                </div>
              </div>

              {/* Categories Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Tag className="w-5 h-5 text-emerald-400" />
                    Kategori Kompetisi ({categories.length})
                  </h3>
                  <p className="text-xs text-slate-400">Atur kelompok umur, ganda/tunggal, serta biaya pendaftaran per kategori.</p>
                </div>
                <button
                  onClick={() => handleOpenCategoryModal()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Kategori
                </button>
              </div>

              {/* Categories Grid */}
              {categories.length === 0 ? (
                <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                  <Tag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-slate-300 font-medium text-base mb-1">Belum Ada Kategori</h4>
                  <p className="text-slate-500 text-xs max-w-md mx-auto mb-4">
                    Tambahkan kategori seperti "Ganda Putra U-15", "Tunggal Putri Umum", atau "Ganda Campuran Adult".
                  </p>
                  <button
                    onClick={() => handleOpenCategoryModal()}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Buat Kategori Pertama
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => {
                    const catRegs = registrations.filter(r => r.categoryId === cat.id || r.categoryName === cat.name);
                    const filledSlots = catRegs.length;
                    const maxSlots = cat.maxSlots || 16;
                    const percentFilled = Math.min(100, Math.round((filledSlots / maxSlots) * 100));

                    return (
                      <div key={cat.id} className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-bold text-white text-base">{cat.name}</h4>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                              {formatRupiah(cat.fee)}
                            </span>
                          </div>

                          {cat.description && (
                            <p className="text-xs text-slate-400 mb-3 line-clamp-2">{cat.description}</p>
                          )}

                          {/* Progress Bar Kuota */}
                          <div className="space-y-1.5 my-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Kuota Terisi:</span>
                              <span className="font-semibold text-slate-200">{filledSlots} / {maxSlots} Tim/Peserta</span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  percentFilled >= 100 ? 'bg-rose-500' : percentFilled >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} 
                                style={{ width: `${percentFilled}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2 text-xs">
                          <button
                            onClick={() => handleOpenCategoryModal(cat)}
                            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PENDAFTARAN PESERTA */}
          {/* ================================================================= */}
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Total Pendaftar</span>
                    <span className="text-xl font-bold text-white">{registrations.length} Peserta / Tim</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Pembayaran Lunas</span>
                    <span className="text-xl font-bold text-emerald-400">{paidRegistrationsCount} Peserta</span>
                    <span className="text-xs text-slate-500 block">({formatRupiah(registrationRevenue)})</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Menunggak / Belum Bayar</span>
                    <span className="text-xl font-bold text-amber-400">{pendingRegistrationsCount} Peserta</span>
                  </div>
                </div>
              </div>

              {/* Controls Header */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama peserta / official / WA..."
                      value={regSearch}
                      onChange={(e) => setRegSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <select
                    value={regCategoryFilter}
                    onChange={(e) => setRegCategoryFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Semua">Semua Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={regStatusFilter}
                    onChange={(e) => setRegStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Semua">Semua Status Bayar</option>
                    <option value="Lunas">Lunas</option>
                    <option value="Menunggak / DP">Menunggak / DP</option>
                    <option value="Belum Bayar">Belum Bayar</option>
                  </select>
                </div>

                <button
                  onClick={() => handleOpenRegModal()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  + Pendaftaran Manual
                </button>
              </div>

              {/* Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                {filteredRegistrations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">Belum ada data pendaftaran yang sesuai filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <tr>
                          <th className="p-3.5">No</th>
                          <th className="p-3.5">Nama Peserta / Tim</th>
                          <th className="p-3.5">Kategori</th>
                          <th className="p-3.5">Kontak & Manager</th>
                          <th className="p-3.5">Nominal Bayar</th>
                          <th className="p-3.5">Status Bayar</th>
                          <th className="p-3.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {filteredRegistrations.map((reg, idx) => {
                          const waClean = (reg.whatsappNumber || '').replace(/[^0-9]/g, '');

                          return (
                            <tr key={reg.id} className="hover:bg-slate-900/50 transition-colors">
                              <td className="p-3.5 text-slate-500 text-xs font-mono">{idx + 1}</td>
                              <td className="p-3.5">
                                <span className="font-semibold text-white block">{reg.participantName}</span>
                                <span className="text-xs text-slate-500">Metode: {reg.paymentMethod || 'Cash'}</span>
                              </td>
                              <td className="p-3.5">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 inline-block">
                                  {reg.categoryName || 'Umum'}
                                </span>
                              </td>
                              <td className="p-3.5">
                                <span className="text-slate-300 text-xs block">{reg.contactName || '-'}</span>
                                {waClean && (
                                  <a
                                    href={`https://wa.me/${waClean.startsWith('0') ? '62' + waClean.slice(1) : waClean}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    {reg.whatsappNumber}
                                  </a>
                                )}
                              </td>
                              <td className="p-3.5 font-semibold text-emerald-400">
                                {formatRupiah(reg.amountPaid)}
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={reg.paymentStatus || 'Lunas'}
                                  onChange={(e) => handleQuickStatusReg(reg.id, e.target.value)}
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                    reg.paymentStatus === 'Lunas'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : reg.paymentStatus === 'Menunggak / DP'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  }`}
                                >
                                  <option value="Lunas" className="bg-slate-900 text-emerald-400">Lunas</option>
                                  <option value="Menunggak / DP" className="bg-slate-900 text-amber-400">Menunggak / DP</option>
                                  <option value="Belum Bayar" className="bg-slate-900 text-rose-400">Belum Bayar</option>
                                </select>
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenRegModal(reg)}
                                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReg(reg.id, reg.participantName)}
                                    className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: KEUANGAN EVENT */}
          {/* ================================================================= */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              {/* Financial Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Pemasukan */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pemasukan Event</span>
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{formatRupiah(totalEventIncome)}</h3>
                  <div className="space-y-1 text-xs text-slate-400 border-t border-slate-800/80 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span>Pendaftaran Peserta:</span>
                      <span className="font-semibold text-emerald-400">{formatRupiah(registrationRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sponsorship (Deal):</span>
                      <span className="font-semibold text-emerald-400">{formatRupiah(sponsorRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Pengeluaran */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pengeluaran Operasional</span>
                    <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{formatRupiah(totalEventExpenses)}</h3>
                  <p className="text-xs text-slate-400 border-t border-slate-800/80 pt-2 mt-2">
                    Terdiri dari {expenses.length} item biaya operasional (sewa, wasit, piala, dll).
                  </p>
                </div>

                {/* Saldo Bersih / Profit Margin */}
                <div className={`bg-slate-950 border rounded-2xl p-5 relative overflow-hidden ${
                  netEventBalance >= 0 ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-rose-500/40 bg-rose-950/10'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profit Margin / Saldo Bersih</span>
                    <div className={`p-2 rounded-xl border ${
                      netEventBalance >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      <Receipt className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className={`text-2xl font-bold mb-2 ${netEventBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatRupiah(netEventBalance)}
                  </h3>
                  <p className="text-xs text-slate-400 border-t border-slate-800/80 pt-2 mt-2">
                    {netEventBalance >= 0 ? 'PROFITABLE EVENT ✨' : 'DEFISIT EVENT (Pengeluaran > Pemasukan)'}
                  </p>
                </div>
              </div>

              {/* Expense Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-rose-400" />
                      Rincian Biaya & Pengeluaran Event
                    </h3>
                    <p className="text-xs text-slate-400">Catat honor wasit, sewa lapangan, trophy, konsumsi, dan operasional panitia.</p>
                  </div>
                  <button
                    onClick={() => handleOpenExpenseModal()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    + Tambah Pengeluaran
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  {expenses.length === 0 ? (
                    <div className="p-8 text-center">
                      <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium text-sm">Belum ada rincian pengeluaran untuk event ini.</p>
                      <button
                        onClick={() => handleOpenExpenseModal()}
                        className="mt-3 text-xs text-emerald-400 hover:underline font-semibold"
                      >
                        + Catat Pengeluaran Pertama
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                          <tr>
                            <th className="p-3.5">No</th>
                            <th className="p-3.5">Item / Keterangan</th>
                            <th className="p-3.5">Kategori Biaya</th>
                            <th className="p-3.5">Nominal (Rp)</th>
                            <th className="p-3.5">Catatan</th>
                            <th className="p-3.5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {expenses.map((exp, idx) => (
                            <tr key={exp.id} className="hover:bg-slate-900/50 transition-colors">
                              <td className="p-3.5 text-slate-500 text-xs font-mono">{idx + 1}</td>
                              <td className="p-3.5 font-semibold text-white">{exp.title}</td>
                              <td className="p-3.5">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                  {exp.category || 'Lainnya'}
                                </span>
                              </td>
                              <td className="p-3.5 font-semibold text-rose-400">
                                {formatRupiah(exp.amount)}
                              </td>
                              <td className="p-3.5 text-slate-400 text-xs">{exp.note || '-'}</td>
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenExpenseModal(exp)}
                                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(exp.id, exp.title)}
                                    className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: BRACKET & JADWAL (Part 3 Preview) */}
          {/* ================================================================= */}
          {activeTab === 'bracket' && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-xl">
                <GitBranch className="w-8 h-8" />
              </div>

              <div className="max-w-2xl mx-auto space-y-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-block">
                  🎯 SNEAK PEEK FASE 9 PART 3
                </span>
                <h3 className="text-2xl font-extrabold text-white">Bracket Generator Automatic & Tournament Match Scheduling</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Modul ini sedang disiapkan untuk generasi otomatis Bagan Pertandingan (Knockout System, Round Robin, Seedings), Penjadwalan Pertandingan terintegrasi Booking Lapangan, serta Real-time Live Scoreboard.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left pt-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg w-fit">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Bagan Knockout & Group</h4>
                  <p className="text-slate-400 text-xs">Generasi bagan otomatis dengan seeding unggulan & sistem gugur / setengah kompetisi.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg w-fit">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Auto Court Allocation</h4>
                  <p className="text-slate-400 text-xs">Penjadwalan partai match otomatis disesuaikan dengan ketersediaan jam & lapangan GOR.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg w-fit">
                    <Award className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Live Score & Leaderboard</h4>
                  <p className="text-slate-400 text-xs">Input skor real-time oleh wasit dan tampilan klasemen / hasil untuk pengunjung & penonton.</p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT KATEGORI */}
      {/* ===================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full my-auto max-h-[88vh] flex flex-col overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg">
                {editingCategory ? 'Edit Kategori Kompetisi' : 'Tambah Kategori Kompetisi'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  NAMA KATEGORI *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Ganda Putra U-15 / Tunggal Putri Umum"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    BATAS MAX PESERTA/TIM *
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={categoryForm.maxSlots}
                    onChange={(e) => setCategoryForm({ ...categoryForm, maxSlots: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    BIAYA REGISTRASI (RP) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={categoryForm.fee}
                    onChange={(e) => setCategoryForm({ ...categoryForm, fee: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  KETERANGAN / KETENTUAN KHUSUS
                </label>
                <textarea
                  rows="2"
                  placeholder="Misal: Kelahiran minimal tahun 2009, wajib bawa KK asli"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10"
                >
                  {isSavingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: REGISTRASI / PENDAFTARAN PESERTA */}
      {/* ===================================================================== */}
      {isRegModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full my-auto max-h-[88vh] flex flex-col overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg">
                {editingReg ? 'Edit Data Pendaftaran Peserta' : 'Form Pendaftaran Manual Peserta / Tim'}
              </h3>
              <button onClick={() => setIsRegModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  KATEGORI KOMPETISI *
                </label>
                <select
                  value={regForm.categoryId}
                  onChange={(e) => handleCategorySelectChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({formatRupiah(cat.fee)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  NAMA PESERTA / TIM / PASANGAN *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Ahmad & Budi (PB Jayaraya)"
                  value={regForm.participantName}
                  onChange={(e) => setRegForm({ ...regForm, participantName: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    NAMA OFFICIAL / MANAGER
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Coach Hendra"
                    value={regForm.contactName}
                    onChange={(e) => setRegForm({ ...regForm, contactName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    NO. WHATSAPP *
                  </label>
                  <input
                    type="text"
                    placeholder="081234567890"
                    value={regForm.whatsappNumber}
                    onChange={(e) => setRegForm({ ...regForm, whatsappNumber: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    STATUS PEMBAYARAN *
                  </label>
                  <select
                    value={regForm.paymentStatus}
                    onChange={(e) => setRegForm({ ...regForm, paymentStatus: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Lunas">Lunas</option>
                    <option value="Menunggak / DP">Menunggak / DP</option>
                    <option value="Belum Bayar">Belum Bayar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    METODE PEMBAYARAN
                  </label>
                  <select
                    value={regForm.paymentMethod}
                    onChange={(e) => setRegForm({ ...regForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Cash">Cash / Tunai</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  NOMINAL DIBAYAR (RP) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={regForm.amountPaid}
                  onChange={(e) => setRegForm({ ...regForm, amountPaid: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRegModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingReg}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10"
                >
                  {isSavingReg ? 'Menyimpan...' : 'Simpan Pendaftaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT PENGELUARAN EVENT */}
      {/* ===================================================================== */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full my-auto max-h-[88vh] flex flex-col overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg">
                {editingExpense ? 'Edit Pengeluaran Event' : 'Catat Pengeluaran Event Baru'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  KETERANGAN / ITEM PENGELUARAN *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Sewa Wasit PBSI 2 Hari / Piala & Trophy 3 Set"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    KATEGORI BIAYA *
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Wasit & Official">Wasit & Official</option>
                    <option value="Hadiah & Tropi">Hadiah & Tropi</option>
                    <option value="Konsumsi">Konsumsi</option>
                    <option value="Pubdekdok">Pubdekdok & Banner</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    NOMINAL (RP) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CATATAN TAMBAHAN
                </label>
                <textarea
                  rows="2"
                  placeholder="Misal: Dibayarkan via transfer ke rekening Bendahara Wasit"
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10"
                >
                  {isSavingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
