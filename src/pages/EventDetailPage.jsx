import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  DollarSign, 
  Clock, 
  Calendar, 
  MapPin, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  MessageCircle, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  TrendingDown, 
  Handshake, 
  Sparkles, 
  Award, 
  Layers, 
  GitBranch, 
  ChevronRight, 
  X, 
  Check, 
  RefreshCw, 
  Share2, 
  Building, 
  FileText,
  Play,
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Shirt,
  Shield,
  ListOrdered,
  CalendarDays,
  Table,
  QrCode,
  Wallet,
  Copy,
  CreditCard,
  Receipt,
  Printer
} from 'lucide-react';
import GlobalReceiptModal from '../components/GlobalReceiptModal';
import PaymentGatewayModal from '../components/PaymentGatewayModal';
import useArenaData from '../hooks/useArenaData';

export default function EventDetailPage({ eventData, eventId, userProfile, tenantData, onBack }) {
  const [event, setEvent] = useState(eventData || null);
  const targetEventId = event?.id || eventId || eventData?.id;
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid || event?.tenantId || '';

  // Real-time tenant data for dynamic QRIS, bank accounts, and branding
  const { tenantProfile } = useArenaData(userProfile);
  const activeTenant = tenantData || tenantProfile || userProfile?.tenant || {};

  // Sport Category & Team Mode Detection (Enterprise Fase 10 Part 2)
  const currentEvent = event || eventData || {
    name: 'Turnamen Kejuaraan',
    sport: 'Badminton',
    status: 'Pendaftaran Buka',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    location: 'GOR Utama Arena'
  };

  const currentSportCategory = currentEvent.sportCategory || (
    ['Sepakbola', 'Futsal', 'Mini Soccer'].includes(currentEvent.sport)
      ? 'field'
      : ['Basket', 'Bola Basket (5v5)', 'Bola Basket (3x3)'].includes(currentEvent.sport)
      ? 'court'
      : ['Voli', 'Bola Voli (Indoor)', 'Bola Voli (Pasir)', 'Sepak Takraw'].includes(currentEvent.sport)
      ? 'net'
      : 'racket'
  );
  const isTeamSport = currentSportCategory !== 'racket';

  // Tournament Format Detection (Enterprise Fase 10 Part 3)
  const currentTournamentFormat = currentEvent.tournamentFormat || 'knockout';
  const isLeagueFormat = currentTournamentFormat === 'league' || currentTournamentFormat === 'group';

  // Internal Tabs: 'overview' | 'categories' | 'registrations' | 'bracket' | 'finance'
  const [activeTab, setActiveTab] = useState('overview');

  // Firestore Real-time Subscriptions State
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Form States: Categories
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    maxSlots: 16,
    fee: 150000,
    description: ''
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Modals & Form States: Registrations & Team Roster (Enterprise Fase 10 Part 2)
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
  const [roster, setRoster] = useState([{ name: '', number: '' }]);
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regCategoryFilter, setRegCategoryFilter] = useState('Semua');
  const [regStatusFilter, setRegStatusFilter] = useState('Semua');
  // Payment Gateway Modal & Intersepsi Kasir (Enterprise Fase 10 Part 5)
  const [showPaymentGateway, setShowPaymentGateway] = useState(false);
  const [draftRegistration, setDraftRegistration] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [copiedRek, setCopiedRek] = useState(false);

  // Universal Thermal Receipt Generator (Enterprise Fase 10 Part 6)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Squad / Roster Read-Only Viewer Modal
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [selectedTeamSquad, setSelectedTeamSquad] = useState(null);

  // Modals & Form States: Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Honor Wasit',
    amount: 300000,
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Bracket & Matches States
  const [selectedBracketCategory, setSelectedBracketCategory] = useState('');
  const [isMatchScoreModalOpen, setIsMatchScoreModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [scoreForm, setScoreForm] = useState({
    score1: 0,
    score2: 0,
    sets: '21-18, 21-19',
    courtNumber: 1,
    time: '09:00',
    status: 'Selesai',
    winner: ''
  });
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isGeneratingBracket, setIsGeneratingBracket] = useState(false);

  // Standings & League Fixtures States (Enterprise Fase 10 Part 3)
  const [standings, setStandings] = useState([]);
  const [isGeneratingLeague, setIsGeneratingLeague] = useState(false);
  const [selectedMatchdayFilter, setSelectedMatchdayFilter] = useState('Semua');

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
    } catch {
      return dateString;
    }
  };

  const formatRegDate = (val) => {
    if (!val) return '-';
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  // 1. Fetch Event & Sub-resources from Supabase
  const fetchEventDetailData = useCallback(async () => {
    if (!targetEventId) return;
    setIsLoading(true);
    try {
      const [evRes, catRes, regRes, expRes, spRes, matchRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', targetEventId).maybeSingle(),
        supabase.from('event_categories').select('*').eq('event_id', targetEventId),
        supabase.from('event_registrations').select('*').eq('event_id', targetEventId),
        supabase.from('event_expenses').select('*').eq('event_id', targetEventId),
        supabase.from('sponsors').select('*').eq('event_id', targetEventId),
        supabase.from('event_matches').select('*').eq('event_id', targetEventId)
      ]);

      if (evRes.data) {
        setEvent({
          ...evRes.data,
          id: evRes.data.id,
          registrationFee: Number(evRes.data.registration_fee || 0),
          startDate: evRes.data.start_date,
          endDate: evRes.data.end_date,
          sportCategory: evRes.data.sport_category,
          tournamentFormat: evRes.data.tournament_format
        });
      }

      if (catRes.data) {
        const mappedCats = catRes.data.map(c => ({
          ...c,
          id: c.id,
          eventId: c.event_id,
          maxSlots: Number(c.max_slots || c.max_participants || 16),
          fee: Number(c.fee || 0)
        }));
        setCategories(mappedCats);
        if (mappedCats.length > 0 && !selectedBracketCategory) {
          setSelectedBracketCategory(mappedCats[0].id);
        }
      }

      if (regRes.data) {
        setRegistrations(regRes.data.map(r => ({
          ...r,
          id: r.id,
          eventId: r.event_id,
          categoryId: r.category_id,
          categoryName: r.category_name,
          participantName: r.participant_name || r.name,
          contactName: r.contact_name,
          whatsappNumber: r.whatsapp_number,
          paymentStatus: r.payment_status,
          paymentMethod: r.payment_method,
          amountPaid: Number(r.amount_paid || 0),
          roster: Array.isArray(r.roster) ? r.roster : []
        })));
      }

      if (expRes.data) {
        setExpenses(expRes.data.map(e => ({
          ...e,
          id: e.id,
          eventId: e.event_id,
          amount: Number(e.amount || 0)
        })));
      }

      if (spRes.data) {
        setSponsors(spRes.data.map(s => ({
          ...s,
          id: s.id,
          eventId: s.event_id,
          companyName: s.company_name || s.name,
          contractValue: Number(s.contract_value || 0),
          totalPaid: Number(s.total_paid || 0)
        })));
      }

      if (matchRes.data) {
        setMatches(matchRes.data.map(m => ({
          ...m,
          id: m.id,
          eventId: m.event_id,
          categoryId: m.category_id,
          categoryName: m.category_name,
          roundIndex: Number(m.round_index || 1),
          roundName: m.round_name,
          totalRounds: Number(m.total_rounds || 1),
          matchIndex: Number(m.match_index || 1),
          nextMatchRound: m.next_match_round ? Number(m.next_match_round) : null,
          nextMatchIndex: m.next_match_index ? Number(m.next_match_index) : null,
          nextMatchSlot: m.next_match_slot,
          participant1: m.participant1,
          participant2: m.participant2,
          score1: Number(m.score1 || 0),
          score2: Number(m.score2 || 0),
          courtNumber: Number(m.court_number || 1),
          isBye: m.is_bye === true
        })));
      }
    } catch (err) {
      console.error('Error fetching event detail data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetEventId, selectedBracketCategory]);

  useEffect(() => {
    fetchEventDetailData();
  }, [fetchEventDetailData]);

  // ---------------------------------------------------------------------------
  // FINANCIAL & METRICS CALCULATIONS
  // Reaktivitas: Biaya pendaftaran terkumpul dihitung DARI PESERTA YANG "Lunas"
  // ---------------------------------------------------------------------------
  const paidRegistrations = registrations.filter(r => r.paymentStatus === 'Lunas');
  const paidRegistrationsCount = paidRegistrations.length;
  const pendingRegistrations = registrations.filter(r => r.paymentStatus !== 'Lunas');
  const pendingRegistrationsCount = pendingRegistrations.length;

  const registrationRevenue = paidRegistrations.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
  const pendingRegistrationRevenue = pendingRegistrations.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);

  const sponsorRevenue = sponsors
    .filter(s => s.status === 'Deal' || s.status === 'Lunas')
    .reduce((sum, s) => sum + (Number(s.contractValue) || 0), 0);

  const totalEventIncome = registrationRevenue + sponsorRevenue;
  const totalEventExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = totalEventIncome - totalEventExpenses;

  // Total Max Quota across categories
  const totalSlotsQuota = categories.reduce((sum, c) => sum + (Number(c.maxSlots) || 0), 0);

  // Active / Today's Matches count
  const todayMatchesCount = matches.filter(m => m.status === 'Berlangsung' || m.status === 'Menunggu').length || (matches.length > 0 ? matches.length : 0);

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
        fee: event?.registrationFee || 150000,
        description: ''
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert('Nama kategori turnamen wajib diisi.');
      return;
    }
    setIsSavingCategory(true);
    try {
      const payload = {
        tenant_id: tenantId,
        event_id: targetEventId,
        name: categoryForm.name.trim(),
        max_slots: Number(categoryForm.maxSlots) || 0,
        fee: Number(categoryForm.fee) || 0,
        description: categoryForm.description.trim(),
        updated_at: new Date().toISOString()
      };

      if (editingCategory) {
        await supabase.from('event_categories').update(payload).eq('id', editingCategory.id);
      } else {
        await supabase.from('event_categories').insert([{ ...payload, created_at: new Date().toISOString() }]);
      }
      await fetchEventDetailData();
      setIsCategoryModalOpen(false);
    } catch (err) {
      console.error('Error saving category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (window.confirm(`Hapus kategori turnamen "${catName}"? Pendaftaran terkait tetap tersimpan.`)) {
      try {
        await supabase.from('event_categories').delete().eq('id', catId);
        await fetchEventDetailData();
      } catch (err) {
        console.error('Error deleting category:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // REGISTRATIONS ACTIONS
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
        amountPaid: reg.amountPaid || 0
      });
      if (reg.roster && Array.isArray(reg.roster) && reg.roster.length > 0) {
        setRoster(reg.roster);
      } else {
        setRoster([{ name: '', number: '' }]);
      }
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
        amountPaid: defaultCat?.fee || event?.registrationFee || 150000
      });
      setRoster([{ name: '', number: '' }]);
    }
    setIsRegModalOpen(true);
  };

  const handleAddRosterPlayer = () => {
    setRoster(prev => [...prev, { name: '', number: '' }]);
  };

  const handleRosterChange = (index, field, value) => {
    setRoster(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveRosterPlayer = (index) => {
    setRoster(prev => {
      if (prev.length <= 1) return [{ name: '', number: '' }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCategorySelectChange = (catId) => {
    const selected = categories.find(c => c.id === catId);
    setRegForm(prev => ({
      ...prev,
      categoryId: catId,
      amountPaid: selected ? (selected.fee || 0) : prev.amountPaid
    }));
  };

  const handleSaveReg = async (e) => {
    e.preventDefault();
    if (!regForm.participantName.trim()) {
      alert(isTeamSport ? 'Nama Tim / Klub wajib diisi.' : 'Nama Peserta / Pasangan wajib diisi.');
      return;
    }
    if (!regForm.categoryId) {
      alert('Silakan pilih nomor/kategori pertandingan.');
      return;
    }

    const selectedCat = categories.find(c => c.id === regForm.categoryId);
    if (!selectedCat) {
      alert('Kategori yang dipilih tidak valid.');
      return;
    }

    // Validasi Kuota Maksimal Kategori
    const currentCatCount = registrations.filter(
      r => r.categoryId === selectedCat.id && (!editingReg || r.id !== editingReg.id)
    ).length;
    const maxSlots = Number(selectedCat.maxSlots) || 16;
    if (currentCatCount >= maxSlots) {
      alert(`Pendaftaran gagal! Kuota peserta untuk kategori "${selectedCat.name}" sudah penuh (${currentCatCount}/${maxSlots} Tim). Silakan pilih kategori lain atau tambah kuota di Tab Kategori.`);
      return;
    }

    // Validasi & sanitasi Roster Pemain (buang input kosong)
    const cleanedRoster = roster
      .filter(p => p.name && p.name.trim() !== '')
      .map((p, idx) => ({
        id: p.id || `p-${Date.now()}-${idx}`,
        name: p.name.trim(),
        number: p.number ? String(p.number).trim() : ''
      }));

    const payload = {
      tenantId,
      eventId: targetEventId,
      categoryId: regForm.categoryId,
      categoryName: selectedCat.name || 'Umum',
      participantName: regForm.participantName.trim(),
      name: regForm.participantName.trim(),
      contactName: regForm.contactName.trim(),
      whatsappNumber: regForm.whatsappNumber.trim(),
      paymentStatus: regForm.paymentStatus || 'Lunas',
      paymentMethod: regForm.paymentMethod || 'Cash',
      amountPaid: Number(regForm.amountPaid) || 0,
      sportCategory: currentSportCategory,
      roster: isTeamSport ? cleanedRoster : [],
      editingId: editingReg ? editingReg.id : null
    };

    // INTERSEPSI PEMBAYARAN & INTEGRASI KASIR (Enterprise Fase 10 Part 5):
    // Jika status diset 'Lunas' atau 'DP' (atau nominal > 0), alihkan ke PaymentGatewayModal
    const isPaidOrDP = regForm.paymentStatus === 'Lunas' || regForm.paymentStatus === 'DP' || Number(regForm.amountPaid) > 0;
    if (isPaidOrDP) {
      setDraftRegistration(payload);
      setIsRegModalOpen(false);
      setShowPaymentGateway(true);
      return;
    }

    // Jika Belum Lunas / Belum Bayar (tanpa pembayaran langsung), simpan langsung
    setIsSavingReg(true);
    try {
      const { editingId, name, ...saveData } = payload;
      const dbSave = {
        tenant_id: saveData.tenantId,
        event_id: saveData.eventId,
        category_id: saveData.categoryId,
        category_name: saveData.categoryName,
        participant_name: saveData.participantName,
        contact_name: saveData.contactName,
        whatsapp_number: saveData.whatsappNumber,
        payment_status: saveData.paymentStatus,
        payment_method: saveData.paymentMethod,
        amount_paid: saveData.amountPaid,
        sport_category: saveData.sportCategory,
        roster: saveData.roster,
        updated_at: new Date().toISOString()
      };

      if (editingReg) {
        await supabase.from('event_registrations').update(dbSave).eq('id', editingReg.id);
      } else {
        await supabase.from('event_registrations').insert([{
          ...dbSave,
          created_at: new Date().toISOString(),
          registered_at: new Date().toISOString()
        }]);
      }
      await fetchEventDetailData();
      setIsRegModalOpen(false);
    } catch (err) {
      console.error('Error saving registration:', err);
    } finally {
      setIsSavingReg(false);
    }
  };

  const handleCopyRek = (accNumber = '1234567890') => {
    try {
      navigator.clipboard?.writeText(accNumber);
      setCopiedRek(true);
      setTimeout(() => setCopiedRek(false), 2500);
    } catch {
      setCopiedRek(true);
      setTimeout(() => setCopiedRek(false), 2500);
    }
  };

  // INTEGRASI CROSS-MODULE GLOBAL KASIR (GLOBAL LEDGER) & AUTO-RECEIPT
  const handleConfirmPayment = async () => {
    if (!draftRegistration || isProcessingPayment) return;
    setIsProcessingPayment(true);
    try {
      const currentDraft = { ...draftRegistration };
      const { editingId, name, ...cleanData } = currentDraft;
      const nominal = Number(currentDraft.amountPaid) || 0;

      const regPayload = {
        tenant_id: cleanData.tenantId,
        event_id: cleanData.eventId,
        category_id: cleanData.categoryId,
        category_name: cleanData.categoryName,
        participant_name: cleanData.participantName,
        contact_name: cleanData.contactName,
        whatsapp_number: cleanData.whatsappNumber,
        payment_status: cleanData.paymentStatus,
        payment_method: cleanData.paymentMethod,
        amount_paid: cleanData.amountPaid,
        sport_category: cleanData.sportCategory,
        roster: cleanData.roster,
        updated_at: new Date().toISOString()
      };

      const globalLedgerPayload = {
        tenant_id: tenantId,
        type: 'EVENT_REGISTRATION',
        event_id: targetEventId || (event && event.id),
        event_name: (event && event.name) || 'Turnamen Olahraga',
        participant_name: currentDraft.name || currentDraft.participantName,
        amount: nominal,
        method: currentDraft.paymentMethod || 'Cash',
        payment_method: currentDraft.paymentMethod || 'Cash',
        payment_status: currentDraft.paymentStatus || 'Lunas',
        category_name: currentDraft.categoryName || 'Umum',
        cashier_name: userProfile?.displayName || userProfile?.name || 'Kasir Turnamen',
        cashier_email: userProfile?.email || '',
        note: `Registrasi Event: ${(event && event.name)} [${currentDraft.categoryName}] - Tim/Peserta: ${currentDraft.participantName}`,
        source: 'EVENT_REGISTRATION_INTERCEPTION',
        created_at: new Date().toISOString()
      };

      if (editingId) {
        await Promise.all([
          supabase.from('event_registrations').update(regPayload).eq('id', editingId),
          supabase.from('pos_transactions').insert([globalLedgerPayload]),
          supabase.from('global_ledger').insert([globalLedgerPayload])
        ]);
      } else {
        await Promise.all([
          supabase.from('event_registrations').insert([{
            ...regPayload,
            created_at: new Date().toISOString(),
            registered_at: new Date().toISOString()
          }]),
          supabase.from('pos_transactions').insert([globalLedgerPayload]),
          supabase.from('global_ledger').insert([globalLedgerPayload])
        ]);
      }

      await fetchEventDetailData();

      const receiptPayload = {
        receiptNo: `EVT-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        cashierName: userProfile?.displayName || userProfile?.name || 'Kasir Turnamen',
        customerName: currentDraft.name || currentDraft.participantName,
        items: [
          {
            name: `Registrasi: ${(event && event.name)} [${currentDraft.categoryName}]`,
            qty: 1,
            price: nominal,
            subtotal: nominal
          }
        ],
        total: nominal,
        amountPaid: nominal,
        paymentMethod: currentDraft.paymentMethod || 'Cash',
        status: currentDraft.paymentStatus || 'LUNAS',
        notes: `Kategori: ${currentDraft.categoryName} • WA: ${currentDraft.whatsappNumber || '-'}`
      };

      setShowPaymentGateway(false);
      setReceiptData(receiptPayload);
      setReceiptModalOpen(true);
      setDraftRegistration(null);
      setIsRegModalOpen(false);
    } catch (err) {
      console.error('Error confirming payment and pushing to POS:', err);
      alert('Gagal menyimpan transaksi: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleQuickStatusReg = async (regId, newStatus) => {
    try {
      await supabase.from('event_registrations').update({
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('id', regId);
      await fetchEventDetailData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteReg = async (regId, name) => {
    if (window.confirm(`Hapus pendaftaran untuk "${name}"?`)) {
      try {
        await supabase.from('event_registrations').delete().eq('id', regId);
        await fetchEventDetailData();
      } catch (err) {
        console.error('Error deleting registration:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // EXPENSES ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenExpenseModal = (exp = null) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (exp) {
      setEditingExpense(exp);
      let expDateStr = todayStr;
      if (exp.date) {
        expDateStr = typeof exp.date === 'string' && exp.date.length >= 10 ? exp.date.substring(0, 10) : todayStr;
      } else if (exp.createdAt?.toDate) {
        expDateStr = exp.createdAt.toDate().toISOString().split('T')[0];
      }
      setExpenseForm({
        title: exp.title || exp.description || '',
        category: exp.category || 'Honor Wasit',
        amount: exp.amount || 0,
        date: expDateStr,
        note: exp.note || ''
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        title: '',
        category: 'Honor Wasit',
        amount: 300000,
        date: todayStr,
        note: ''
      });
    }
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) {
      alert('Keterangan pengeluaran wajib diisi.');
      return;
    }
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      alert('Nominal biaya pengeluaran harus lebih besar dari Rp 0.');
      return;
    }

    setIsSavingExpense(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const payload = {
        tenant_id: tenantId,
        event_id: targetEventId,
        title: expenseForm.title.trim(),
        description: expenseForm.title.trim(),
        category: expenseForm.category || 'Honor Wasit',
        amount: Number(expenseForm.amount) || 0,
        date: expenseForm.date || todayStr,
        note: expenseForm.note ? expenseForm.note.trim() : '',
        updated_at: new Date().toISOString()
      };

      if (editingExpense) {
        await supabase.from('event_expenses').update(payload).eq('id', editingExpense.id);
      } else {
        await supabase.from('event_expenses').insert([{ ...payload, created_at: new Date().toISOString() }]);
      }
      await fetchEventDetailData();
      setIsExpenseModalOpen(false);
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
        await fetchEventDetailData();
      } catch (err) {
        console.error('Error deleting expense:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // BRACKET & MATCHES ACTIONS (SISTEM GUGUR OTOMATIS)
  // ---------------------------------------------------------------------------
  const handleGenerateBracket = async () => {
    const activeCatId = selectedBracketCategory || categories[0]?.id;
    if (!activeCatId) {
      alert('Tambahkan kategori turnamen terlebih dahulu sebelum membuat bagan.');
      return;
    }

    const selCategory = categories.find(c => c.id === activeCatId);
    const catName = selCategory?.name || 'Kategori Turnamen';

    // Ambil peserta yang paymentStatus === 'Lunas' di kategori terpilih
    const catRegs = registrations.filter(r => 
      r.categoryId === activeCatId && (r.paymentStatus === 'Lunas' || r.paymentStatus === 'lunas')
    );

    if (catRegs.length < 2) {
      alert(`Minimal 2 peserta dengan status pembayaran LUNAS diperlukan untuk membuat bagan turnamen sistem gugur.\n\nSaat ini ditemukan: ${catRegs.length} peserta lunas di kategori "${catName}". Pastikan peserta sudah lunas di Tab Pendaftaran.`);
      return;
    }

    if (!window.confirm(`Generate bagan sistem gugur otomatis untuk kategori "${catName}" dengan ${catRegs.length} peserta LUNAS?`)) {
      return;
    }

    setIsGeneratingBracket(true);
    try {
      // 1. Hapus bagan lama untuk kategori ini di event ini
      await supabase.from('event_matches').delete().eq('category_id', activeCatId);

      // 2. Hitung ukuran bagan sistem gugur (pangkat 2 terdekat: 2, 4, 8, 16, 32)
      const N = catRegs.length;
      let targetSize = 2;
      while (targetSize < N) {
        targetSize *= 2;
      }
      const totalRounds = Math.log2(targetSize);

      const getRoundTitle = (rIdx) => {
        const diff = totalRounds - rIdx;
        if (diff === 0) return 'Final';
        if (diff === 1) return 'Semi Final';
        if (diff === 2) return 'Perempat Final';
        if (diff === 3) return 'Babak 16 Besar';
        if (diff === 4) return 'Babak 32 Besar';
        return `Babak ${rIdx}`;
      };

      // 3. Acak peserta
      const shuffled = [...catRegs].sort(() => 0.5 - Math.random());
      const numByes = targetSize - N;
      const numMatchesR1 = targetSize / 2;

      const round1Pairings = [];
      let playerCursor = 0;

      for (let i = 0; i < numMatchesR1; i++) {
        if (i < numByes) {
          const p1 = shuffled[playerCursor++];
          round1Pairings.push({
            p1: p1 ? p1.participantName : 'Peserta',
            p2: 'BYE (Lolos Otomatis)',
            isBye: true,
            winner: p1 ? p1.participantName : 'Peserta'
          });
        } else {
          const p1 = shuffled[playerCursor++];
          const p2 = shuffled[playerCursor++];
          round1Pairings.push({
            p1: p1 ? p1.participantName : 'Peserta 1',
            p2: p2 ? p2.participantName : 'Peserta 2',
            isBye: false,
            winner: ''
          });
        }
      }

      const allRoundMatches = [];

      // BABAK 1
      const r1Matches = [];
      for (let mIdx = 1; mIdx <= numMatchesR1; mIdx++) {
        const pairing = round1Pairings[mIdx - 1];
        const nextRound = totalRounds > 1 ? 2 : null;
        const nextMatchIdx = nextRound ? Math.floor((mIdx - 1) / 2) + 1 : null;
        const nextSlot = (mIdx - 1) % 2 === 0 ? 'participant1' : 'participant2';

        const matchDocData = {
          tenant_id: tenantId,
          event_id: targetEventId,
          category_id: activeCatId,
          category_name: catName,
          round_index: 1,
          round_name: getRoundTitle(1),
          total_rounds: totalRounds,
          match_index: mIdx,
          next_match_round: nextRound,
          next_match_index: nextMatchIdx,
          next_match_slot: nextSlot,
          participant1: pairing.p1,
          participant2: pairing.p2,
          score1: pairing.isBye ? 1 : 0,
          score2: 0,
          sets: pairing.isBye ? 'Menang BYE (Walkover)' : '',
          court_number: ((mIdx - 1) % 4) + 1,
          time: '08:30',
          status: pairing.isBye ? 'Selesai' : 'Menunggu',
          winner: pairing.isBye ? pairing.winner : '',
          is_bye: pairing.isBye,
          created_at: new Date().toISOString()
        };
        r1Matches.push(matchDocData);
      }
      allRoundMatches.push(r1Matches);

      // BABAK 2 HINGGA FINAL
      const roundTimeEstimates = ['08:30', '10:30', '13:30', '15:30', '17:00'];

      for (let r = 2; r <= totalRounds; r++) {
        const matchesInThisRound = targetSize / Math.pow(2, r);
        const rMatches = [];
        const prevRoundMatches = allRoundMatches[r - 2];

        for (let mIdx = 1; mIdx <= matchesInThisRound; mIdx++) {
          const nextRound = r < totalRounds ? r + 1 : null;
          const nextMatchIdx = nextRound ? Math.floor((mIdx - 1) / 2) + 1 : null;
          const nextSlot = (mIdx - 1) % 2 === 0 ? 'participant1' : 'participant2';

          const feeder1 = prevRoundMatches.find(pm => pm.match_index === (mIdx - 1) * 2 + 1);
          const feeder2 = prevRoundMatches.find(pm => pm.match_index === (mIdx - 1) * 2 + 2);

          const p1 = feeder1?.winner || 'TBD';
          const p2 = feeder2?.winner || 'TBD';

          const roundTime = roundTimeEstimates[r - 1] || '14:00';

          const matchDocData = {
            tenant_id: tenantId,
            event_id: targetEventId,
            category_id: activeCatId,
            category_name: catName,
            round_index: r,
            round_name: getRoundTitle(r),
            total_rounds: totalRounds,
            match_index: mIdx,
            next_match_round: nextRound,
            next_match_index: nextMatchIdx,
            next_match_slot: nextSlot,
            participant1: p1,
            participant2: p2,
            score1: 0,
            score2: 0,
            sets: '',
            court_number: ((mIdx - 1) % 4) + 1,
            time: roundTime,
            status: 'Menunggu',
            winner: '',
            is_bye: false,
            created_at: new Date().toISOString()
          };
          rMatches.push(matchDocData);
        }
        allRoundMatches.push(rMatches);
      }

      const flatRows = allRoundMatches.flat();
      if (flatRows.length > 0) {
        await supabase.from('event_matches').insert(flatRows);
      }

      await fetchEventDetailData();
      alert(`Bagan sistem gugur kategori "${catName}" sukses dibuat! Total: ${flatRows.length} partai pertandingan hingga Final.`);
    } catch (err) {
      console.error('Error generating bracket:', err);
    } finally {
      setIsGeneratingBracket(false);
    }
  };

  const handleResetBracket = async () => {
    const activeCatId = selectedBracketCategory || categories[0]?.id;
    if (!activeCatId) return;
    const selCategory = categories.find(c => c.id === activeCatId);
    const catName = selCategory?.name || 'Kategori Turnamen';

    if (!window.confirm(`Kocok ulang / Reset seluruh bagan kategori "${catName}"?\n\nSemua bagan babak, skor partai, dan data pemenang yang sudah tercatat akan dihapus secara permanen.`)) {
      return;
    }

    try {
      await supabase.from('event_matches').delete().eq('category_id', activeCatId);
      await fetchEventDetailData();
      alert(`Bagan turnamen kategori "${catName}" berhasil direset.`);
    } catch (err) {
      console.error('Error resetting bracket:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // SMART SCORE ENGINE: KALKULATOR KLASEMEN MULTI-CABANG (FASE 10 PART 4)
  // ---------------------------------------------------------------------------
  const calculateStandings = (matchesList = [], participantsList = [], sportCat = 'field') => {
    // Langkah A: Inisialisasi array standings dengan seluruh peserta lunas
    // Set M=0, W=0, D=0, L=0, GF=0, GA=0, GD=0, PTS=0
    const standingsMap = {};

    participantsList.forEach((p) => {
      const name = typeof p === 'string' ? p : (p.participantName || p.name || 'Peserta');
      const id = p.id || name;
      standingsMap[name] = {
        id,
        name,
        participantName: name,
        // Kolom M (Main)
        m: 0,
        played: 0,
        // Kolom W (Menang)
        w: 0,
        won: 0,
        // Kolom D (Seri)
        d: 0,
        drawn: 0,
        // Kolom L (Kalah)
        l: 0,
        lost: 0,
        // Kolom GF (Gol/Poin Memasukkan)
        gf: 0,
        gm: 0,
        // Kolom GA (Gol/Poin Kemasukan)
        ga: 0,
        gk: 0,
        // Kolom GD (Selisih)
        gd: 0,
        sg: 0,
        // Kolom PTS (Poin)
        pts: 0
      };
    });

    // Langkah B: Iterasi (loop) array matches. Abaikan pertandingan yang belum selesai (status !== 'completed' / 'Selesai')
    matchesList.forEach((m) => {
      const isCompleted = m.status === 'completed' || m.status === 'Selesai';
      if (!isCompleted || m.isBye) return;

      const p1 = m.participant1;
      const p2 = m.participant2;
      if (!p1 || !p2 || p1 === 'TBD' || p2 === 'TBD' || p1 === 'BYE_DUMMY' || p2 === 'BYE_DUMMY') return;

      // Inisialisasi peserta jika belum terdaftar di map
      if (!standingsMap[p1]) {
        standingsMap[p1] = {
          id: p1,
          name: p1,
          participantName: p1,
          m: 0, played: 0,
          w: 0, won: 0,
          d: 0, drawn: 0,
          l: 0, lost: 0,
          gf: 0, gm: 0,
          ga: 0, gk: 0,
          gd: 0, sg: 0,
          pts: 0
        };
      }
      if (!standingsMap[p2]) {
        standingsMap[p2] = {
          id: p2,
          name: p2,
          participantName: p2,
          m: 0, played: 0,
          w: 0, won: 0,
          d: 0, drawn: 0,
          l: 0, lost: 0,
          gf: 0, gm: 0,
          ga: 0, gk: 0,
          gd: 0, sg: 0,
          pts: 0
        };
      }

      const s1 = Number(m.score1) || 0;
      const s2 = Number(m.score2) || 0;

      // Langkah C (Kalkulasi Skor Dasar):
      // Tambahkan M (Main) +1 untuk kedua tim
      standingsMap[p1].m += 1;
      standingsMap[p1].played += 1;
      standingsMap[p2].m += 1;
      standingsMap[p2].played += 1;

      // Tambahkan GF (Gol Memasukkan) dan GA (Gol Kemasukan) sesuai skor masing-masing
      standingsMap[p1].gf += s1;
      standingsMap[p1].gm += s1;
      standingsMap[p1].ga += s2;
      standingsMap[p1].gk += s2;

      standingsMap[p2].gf += s2;
      standingsMap[p2].gm += s2;
      standingsMap[p2].ga += s1;
      standingsMap[p2].gk += s1;

      // Langkah D (Smart Point Distribution berdasarkan sportCategory):
      if (sportCat === 'field') {
        // Field (Futsal/Sepakbola/Mini Soccer): Menang = +3 PTS, Seri = +1 PTS, Kalah = +0 PTS
        if (s1 > s2) {
          standingsMap[p1].w += 1;
          standingsMap[p1].won += 1;
          standingsMap[p1].pts += 3;
          standingsMap[p2].l += 1;
          standingsMap[p2].lost += 1;
        } else if (s2 > s1) {
          standingsMap[p2].w += 1;
          standingsMap[p2].won += 1;
          standingsMap[p2].pts += 3;
          standingsMap[p1].l += 1;
          standingsMap[p1].lost += 1;
        } else {
          standingsMap[p1].d += 1;
          standingsMap[p1].drawn += 1;
          standingsMap[p1].pts += 1;
          standingsMap[p2].d += 1;
          standingsMap[p2].drawn += 1;
          standingsMap[p2].pts += 1;
        }
      } else if (sportCat === 'court') {
        // Court (Basket - FIBA rule): Menang = +2 PTS, Kalah = +1 PTS (Abaikan Seri karena basket ada Overtime)
        if (s1 > s2) {
          standingsMap[p1].w += 1;
          standingsMap[p1].won += 1;
          standingsMap[p1].pts += 2;
          standingsMap[p2].l += 1;
          standingsMap[p2].lost += 1;
          standingsMap[p2].pts += 1;
        } else if (s2 > s1) {
          standingsMap[p2].w += 1;
          standingsMap[p2].won += 1;
          standingsMap[p2].pts += 2;
          standingsMap[p1].l += 1;
          standingsMap[p1].lost += 1;
          standingsMap[p1].pts += 1;
        } else {
          // Seri tak terduga
          standingsMap[p1].d += 1;
          standingsMap[p1].drawn += 1;
          standingsMap[p1].pts += 1;
          standingsMap[p2].d += 1;
          standingsMap[p2].drawn += 1;
          standingsMap[p2].pts += 1;
        }
      } else {
        // Net (Voli) atau Racket (Badminton, Tenis, Padel): Menang = +1 PTS, Kalah = +0 PTS (Standard Match win)
        if (s1 > s2) {
          standingsMap[p1].w += 1;
          standingsMap[p1].won += 1;
          standingsMap[p1].pts += 1;
          standingsMap[p2].l += 1;
          standingsMap[p2].lost += 1;
        } else if (s2 > s1) {
          standingsMap[p2].w += 1;
          standingsMap[p2].won += 1;
          standingsMap[p2].pts += 1;
          standingsMap[p1].l += 1;
          standingsMap[p1].lost += 1;
        } else {
          standingsMap[p1].d += 1;
          standingsMap[p1].drawn += 1;
          standingsMap[p2].d += 1;
          standingsMap[p2].drawn += 1;
        }
      }

      // Hitung GD (Selisih) = GF - GA
      standingsMap[p1].gd = standingsMap[p1].gf - standingsMap[p1].ga;
      standingsMap[p1].sg = standingsMap[p1].gd;
      standingsMap[p2].gd = standingsMap[p2].gf - standingsMap[p2].ga;
      standingsMap[p2].sg = standingsMap[p2].gd;
    });

    // Langkah E (Sorting/Pemeringkatan):
    // Urutkan array standings yang sudah dihitung berdasarkan prioritas:
    // 1. PTS (Poin terbanyak)
    // 2. GD (Selisih Gol/Poin tertinggi)
    // 3. GF (Produktivitas Gol/Poin tertinggi)
    return Object.values(standingsMap).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  };

  // ---------------------------------------------------------------------------
  // INTEGRASI DENGAN STATE & FIRESTORE: STANDINGS REAKTIF
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const activeCatId = selectedBracketCategory || categories[0]?.id;
    if (!activeCatId) {
      setStandings([]);
      return;
    }

    const catRegs = registrations.filter(
      r => r.categoryId === activeCatId && (r.paymentStatus === 'Lunas' || r.paymentStatus === 'lunas')
    );
    const catMatches = matches.filter(m => m.categoryId === activeCatId);

    const calculated = calculateStandings(catMatches, catRegs, currentSportCategory);
    setStandings(calculated);
  }, [selectedBracketCategory, categories, registrations, matches, currentSportCategory]);

  // ---------------------------------------------------------------------------
  // GENERATE JADWAL LIGA ROUND-ROBIN (FASE 10 PART 3)
  // ---------------------------------------------------------------------------
  const handleGenerateLeagueSchedule = async () => {
    const activeCatId = selectedBracketCategory || categories[0]?.id;
    if (!activeCatId) {
      alert('Tambahkan kategori turnamen terlebih dahulu sebelum membuat jadwal liga.');
      return;
    }

    const selCategory = categories.find(c => c.id === activeCatId);
    const catName = selCategory?.name || 'Kategori Turnamen';

    // Ambil peserta yang paymentStatus === 'Lunas' di kategori terpilih
    const catRegs = registrations.filter(r => 
      r.categoryId === activeCatId && (r.paymentStatus === 'Lunas' || r.paymentStatus === 'lunas')
    );

    if (catRegs.length < 2) {
      alert(`Minimal 2 peserta dengan status pembayaran LUNAS diperlukan untuk membuat jadwal kompetisi liga.\n\nSaat ini ditemukan: ${catRegs.length} peserta lunas di kategori "${catName}".`);
      return;
    }

    if (!window.confirm(`Generate jadwal liga Round-Robin (semua tim saling bertemu 1 kali) untuk kategori "${catName}" dengan ${catRegs.length} tim/peserta LUNAS?`)) {
      return;
    }

    setIsGeneratingLeague(true);
    try {
      // 1. Hapus jadwal partai lama untuk kategori ini di event ini
      await supabase.from('event_matches').delete().eq('category_id', activeCatId);

      // 2. Buat Round-Robin scheduling (Berger Algorithm)
      const teamList = [...catRegs].sort(() => 0.5 - Math.random()).map(r => r.participantName);
      let teams = [...teamList];
      const hasGhost = teams.length % 2 !== 0;
      if (hasGhost) {
        teams.push('BYE_DUMMY');
      }

      const numTeams = teams.length;
      const numRounds = numTeams - 1;
      const halfSize = numTeams / 2;

      const schedule = [];
      const matchTimes = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30'];

      for (let round = 0; round < numRounds; round++) {
        const matchday = round + 1;
        let matchInDay = 1;

        for (let i = 0; i < halfSize; i++) {
          const t1 = teams[i];
          const t2 = teams[numTeams - 1 - i];

          if (t1 !== 'BYE_DUMMY' && t2 !== 'BYE_DUMMY') {
            const timeSlot = matchTimes[(matchInDay - 1) % matchTimes.length] || '09:00';
            const courtNum = ((matchInDay - 1) % 4) + 1;

            schedule.push({
              tenant_id: tenantId,
              event_id: targetEventId,
              category_id: activeCatId,
              category_name: catName,
              round_index: matchday,
              round_name: `Pekan ${matchday}`,
              match_index: matchInDay,
              participant1: t1,
              participant2: t2,
              score1: 0,
              score2: 0,
              sets: '',
              court_number: courtNum,
              time: timeSlot,
              status: 'Menunggu',
              winner: '',
              format: 'league',
              created_at: new Date().toISOString()
            });
            matchInDay++;
          }
        }

        teams = [teams[0], teams[numTeams - 1], ...teams.slice(1, numTeams - 1)];
      }

      if (schedule.length > 0) {
        await supabase.from('event_matches').insert(schedule);
      }

      await fetchEventDetailData();
      alert(`Jadwal liga Round-Robin berhasil dibuat! Terjadwal ${schedule.length} pertandingan dalam ${numRounds} Pekan kompetisi.`);
    } catch (err) {
      console.error('Error generating league schedule:', err);
    } finally {
      setIsGeneratingLeague(false);
    }
  };

  const handleOpenScoreModal = (match) => {
    setEditingMatch(match);
    setScoreForm({
      score1: match.score1 || 0,
      score2: match.score2 || 0,
      sets: match.sets || '',
      courtNumber: match.courtNumber || 1,
      time: match.time || '09:00',
      status: match.status || 'Selesai',
      winner: match.winner || ''
    });
    setIsMatchScoreModalOpen(true);
  };

  const handleSaveScore = async (e) => {
    e.preventDefault();
    if (!editingMatch) return;
    setIsSavingScore(true);
    try {
      const s1 = Number(scoreForm.score1) || 0;
      const s2 = Number(scoreForm.score2) || 0;
      let winnerName = scoreForm.winner;
      if (!winnerName) {
        if (s1 > s2) winnerName = editingMatch.participant1;
        else if (s2 > s1) winnerName = editingMatch.participant2;
        else winnerName = isLeagueFormat ? 'Seri (Draw)' : editingMatch.participant1;
      }
      if (s1 === s2 && isLeagueFormat && (!winnerName || winnerName === editingMatch.participant1 || winnerName === editingMatch.participant2)) {
        winnerName = 'Seri (Draw)';
      }

      await supabase.from('event_matches').update({
        score1: s1,
        score2: s2,
        sets: scoreForm.sets.trim(),
        court_number: Number(scoreForm.courtNumber) || 1,
        time: scoreForm.time || '09:00',
        status: scoreForm.status || 'Selesai',
        winner: winnerName,
        updated_at: new Date().toISOString()
      }).eq('id', editingMatch.id);

      if (!isLeagueFormat && editingMatch.nextMatchIndex && editingMatch.roundIndex) {
        const nextRoundIndex = editingMatch.roundIndex + 1;
        const targetNextMatch = matches.find(m => 
          m.categoryId === editingMatch.categoryId &&
          m.roundIndex === nextRoundIndex &&
          m.matchIndex === editingMatch.nextMatchIndex
        );

        if (targetNextMatch) {
          const updateField = editingMatch.nextMatchSlot === 'participant2' ? 'participant2' : 'participant1';
          await supabase.from('event_matches').update({
            [updateField]: winnerName,
            updated_at: new Date().toISOString()
          }).eq('id', targetNextMatch.id);
        }
      }

      await fetchEventDetailData();
      setIsMatchScoreModalOpen(false);
    } catch (err) {
      console.error('Error updating match score:', err);
    } finally {
      setIsSavingScore(false);
    }
  };

  // Quick Event Status Update
  const handleQuickStatusChange = async (newStatus) => {
    try {
      await supabase.from('events').update({
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('id', targetEventId);
      setEvent(prev => (prev ? { ...prev, status: newStatus } : null));
      await fetchEventDetailData();
    } catch (err) {
      console.error('Error updating event status:', err);
    }
  };

  // Filtered registrations
  const filteredRegistrations = registrations.filter(r => {
    const matchSearch = (r.participantName || '').toLowerCase().includes(regSearch.toLowerCase()) ||
                        (r.contactName || '').toLowerCase().includes(regSearch.toLowerCase()) ||
                        (r.whatsappNumber || '').includes(regSearch);
    const matchCat = regCategoryFilter === 'Semua' || r.categoryId === regCategoryFilter || r.categoryName === regCategoryFilter;
    const matchStatus = regStatusFilter === 'Semua' || r.paymentStatus === regStatusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  if (!event && isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Memuat data Command Center Event...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6 pb-12 text-slate-800 animate-fadeIn">
      
      {/* ===================================================================== */}
      {/* 1. HEADER EVENT (HERO SECTION - Sporty Light Tech) */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Top Decorative Sporty Gradient Bar */}
        <div className="h-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500" />
        
        <div className="p-5 sm:p-7 space-y-5">
          {/* Top Row: Back Button & Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs group"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Kembali ke Daftar Event</span>
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-400">Status Event:</span>
              <select
                value={currentEvent.status || 'Pendaftaran Buka'}
                onChange={(e) => handleQuickStatusChange(e.target.value)}
                className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer transition-colors shadow-2xs ${
                  currentEvent.status === 'Pendaftaran Buka' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                    : currentEvent.status === 'Berlangsung'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : currentEvent.status === 'Selesai'
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}
              >
                <option value="Draft">Draft</option>
                <option value="Pendaftaran Buka">Pendaftaran Buka</option>
                <option value="Berlangsung">Berlangsung</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          {/* Main Hero Content */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4.5 min-w-0">
              {currentEvent.posterUrl ? (
                <img
                  src={currentEvent.posterUrl}
                  alt={currentEvent.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl border border-slate-200 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0">
                  <Trophy className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-sm" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80">
                    {currentEvent.sport || 'Sport Tournament'}
                  </span>
                  {currentEvent.sportCategory && (
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {currentEvent.sportCategory === 'racket'
                        ? 'Racket Sports'
                        : currentEvent.sportCategory === 'field'
                        ? 'Field & Team'
                        : currentEvent.sportCategory === 'court'
                        ? 'Court Sports'
                        : 'Net Sports'}
                    </span>
                  )}
                  {currentEvent.tournamentFormat && (
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {currentEvent.tournamentFormat === 'knockout'
                        ? 'Single Elimination'
                        : currentEvent.tournamentFormat === 'league'
                        ? 'Round Robin / Liga'
                        : 'Grup + Knockout'}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider border ${
                    currentEvent.status === 'Pendaftaran Buka'
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : currentEvent.status === 'Berlangsung'
                      ? 'bg-blue-600 text-white border-blue-700 animate-pulse'
                      : currentEvent.status === 'Selesai'
                      ? 'bg-slate-700 text-slate-100 border-slate-800'
                      : 'bg-gray-800 text-gray-200 border-gray-900'
                  }`}>
                    {currentEvent.status || 'Aktif'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                  {currentEvent.name}
                </h1>

                <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-500 font-medium mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{formatDate(currentEvent.startDate)} {currentEvent.endDate ? `– ${formatDate(currentEvent.endDate)}` : ''}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate">{currentEvent.location || 'GOR Arena'}</span>
                  </span>
                  {currentEvent.prizePool > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                      <Award className="w-4 h-4 shrink-0" />
                      <span>Prize Pool: {formatRupiah(currentEvent.prizePool)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Hero Financial Pill */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-4 shrink-0">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pemasukan</p>
                <p className="text-lg font-black text-slate-900">{formatRupiah(totalEventIncome)}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  Laba Bersih: {formatRupiah(netProfit)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. EVENT NAVIGATION (SUB-MENU KHUSUS EVENT) */}
      {/* ===================================================================== */}
      <div className="space-y-2">
        {/* Mobile Dropdown */}
        <div className="block md:hidden">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Navigasi Event:
          </label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="overview">Overview (Ringkasan Event)</option>
            <option value="categories">Kategori &amp; Kelas ({categories.length})</option>
            <option value="registrations">Pendaftaran &amp; Peserta ({registrations.length})</option>
            <option value="bracket">
              {isLeagueFormat ? 'Klasemen & Jadwal Liga' : 'Bagan & Jadwal Pertandingan'}
            </option>
            <option value="finance">Keuangan Event (Laba Rugi)</option>
          </select>
        </div>

        {/* Desktop Segmented Control */}
        <div className="hidden md:flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          {[
            { id: 'overview', label: 'Overview', icon: Trophy, badge: null },
            { id: 'categories', label: 'Kategori & Kelas', icon: Layers, badge: categories.length },
            { id: 'registrations', label: 'Pendaftaran & Peserta', icon: Users, badge: registrations.length },
            { 
              id: 'bracket', 
              label: isLeagueFormat ? 'Klasemen & Jadwal' : 'Bagan & Jadwal', 
              icon: isLeagueFormat ? ListOrdered : GitBranch, 
              badge: matches.length > 0 ? matches.length : null 
            },
            { id: 'finance', label: 'Keuangan Event', icon: DollarSign, badge: null }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW (RINGKASAN EVENT - DEFAULT VIEW) */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Metrics Grid (4 Kolom - Sporty Light Tech) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metrik 1: Total Kategori */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Kategori</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{categories.length}</h3>
                <p className="text-xs text-blue-600 font-semibold mt-1">
                  {totalSlotsQuota} Total Target Kuota Slot
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-2xs">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            {/* Metrik 2: Total Peserta */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Peserta</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{registrations.length}</h3>
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                  {paidRegistrationsCount} Lunas &bull; {pendingRegistrationsCount} Belum Bayar
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-2xs">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Metrik 3: Total Pemasukan */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pemasukan (Rp)</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{formatRupiah(totalEventIncome)}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {formatRupiah(registrationRevenue)} Tiket + {formatRupiah(sponsorRevenue)} Sponsor
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-2xs">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Metrik 4: Pertandingan Hari Ini */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pertandingan Hari Ini</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{todayMatchesCount} Match</h3>
                <p className="text-xs text-indigo-600 font-semibold mt-1">
                  {matches.length} Total Partai di Bagan
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-2xs">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aksi Cepat Event:</span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => handleOpenRegModal()}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Pendaftaran Peserta</span>
              </button>
              <button
                onClick={() => handleOpenCategoryModal()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Kategori Baru</span>
              </button>
              <button
                onClick={() => setActiveTab('bracket')}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Kelola Bagan &amp; Skor</span>
              </button>
              <button
                onClick={() => handleOpenExpenseModal()}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>+ Catat Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* 2-Column Overview Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Kolom Kiri: Kuota Kategori & Bagan Preview (2 Kolom) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Kuota Kategori */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <span>Distribusi Kuota Peserta per Kategori</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Kelola Kategori &rarr;
                  </button>
                </div>

                {categories.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500 font-semibold mb-2">Belum ada kategori yang dibuat untuk event ini.</p>
                    <button
                      onClick={() => handleOpenCategoryModal()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                    >
                      + Tambah Kategori Pertama
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {categories.map((cat) => {
                      const catRegsCount = registrations.filter(r => r.categoryId === cat.id).length;
                      const max = cat.maxSlots || 16;
                      const percent = Math.min(100, Math.round((catRegsCount / max) * 100));

                      return (
                        <div key={cat.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                            <span className="font-semibold text-slate-600">
                              <strong className="text-blue-600">{catRegsCount}</strong> / {max} Peserta ({percent}%)
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                percent >= 100 ? 'bg-rose-500' : percent >= 75 ? 'bg-amber-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>Biaya Registrasi: <strong className="text-slate-700">{formatRupiah(cat.fee)}</strong></span>
                            <button
                              onClick={() => {
                                setRegCategoryFilter(cat.id);
                                setActiveTab('registrations');
                              }}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              Lihat Peserta
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Match Highlights / Jadwal Terdekat */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-indigo-600" />
                    <span>Jadwal &amp; Hasil Partai Terkini</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('bracket')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Buka Bagan Lengkap &rarr;
                  </button>
                </div>

                {matches.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500 font-semibold mb-3">
                      Bagan pertandingan belum digenerate. Daftarkan minimal 2 peserta lalu buat bagan otomatis.
                    </p>
                    <button
                      onClick={handleGenerateBracket}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Generate Bagan Otomatis
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.slice(0, 4).map((m) => (
                      <div key={m.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-bold text-slate-600">{m.roundName || 'Babak 1'}</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            m.status === 'Selesai' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {m.status}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className={`flex justify-between text-xs font-bold ${m.winner === m.participant1 ? 'text-emerald-600' : 'text-slate-800'}`}>
                            <span className="truncate">{m.participant1}</span>
                            <span>{m.score1}</span>
                          </div>
                          <div className={`flex justify-between text-xs font-bold ${m.winner === m.participant2 ? 'text-emerald-600' : 'text-slate-800'}`}>
                            <span className="truncate">{m.participant2}</span>
                            <span>{m.score2}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Lap. {m.courtNumber} &bull; {m.time}</span>
                          <button
                            onClick={() => handleOpenScoreModal(m)}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            Input Skor
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Kanan: Finansial & Pendaftar Terbaru (1 Kolom) */}
            <div className="space-y-6">
              {/* Card Finansial Ringkas */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Kalkulasi Laba / Rugi Event</span>
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Pendaftaran Peserta:</span>
                    <span className="font-bold text-slate-800">{formatRupiah(registrationRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Sponsorship (Deal):</span>
                    <span className="font-bold text-slate-800">{formatRupiah(sponsorRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-rose-600">
                    <span>Pengeluaran Operasional:</span>
                    <span className="font-bold">-{formatRupiah(totalEventExpenses)}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Net Profit Margin</p>
                      <p className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatRupiah(netProfit)}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      netProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {netProfit >= 0 ? 'Surplus / Laba' : 'Defisit'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('finance')}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors text-center cursor-pointer"
                >
                  Buka Rincian Keuangan &rarr;
                </button>
              </div>

              {/* Card Pendaftar Terbaru */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span>Pendaftar Terbaru</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('registrations')}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Semua ({registrations.length})
                  </button>
                </div>

                {registrations.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold text-center py-4">Belum ada peserta yang mendaftar.</p>
                ) : (
                  <div className="space-y-3">
                    {registrations.slice(0, 5).map((reg) => (
                      <div key={reg.id} className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">{reg.participantName}</p>
                          <p className="text-[11px] text-slate-500">{reg.categoryName || 'Umum'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                          reg.paymentStatus === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {reg.paymentStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: KATEGORI & KELAS */}
      {/* ===================================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Kategori Turnamen &amp; Kelas Pertandingan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur pembagian kelompok umur, nomor pertandingan (Tunggal/Ganda), kuota pendaftar, dan tarif tiket masuk.
              </p>
            </div>
            <button
              onClick={() => handleOpenCategoryModal()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Kategori Baru</span>
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">Belum Ada Kategori Pertandingan</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Buat kategori seperti Ganda Putra Dewasa, Tunggal Putri Pemula, dsb. untuk mulai menerima registrasi peserta.
              </p>
              <button
                onClick={() => handleOpenCategoryModal()}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
              >
                + Buat Kategori Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const catRegsCount = registrations.filter(r => r.categoryId === cat.id).length;
                const max = Number(cat.maxSlots) || 16;
                const isFull = catRegsCount >= max;
                const percent = Math.min(100, Math.round((catRegsCount / max) * 100));

                return (
                  <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900 leading-snug">{cat.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Nomor Pertandingan / Divisi</p>
                        </div>
                        <span className={`px-2.5 py-1 text-[11px] font-black rounded-lg shrink-0 border ${
                          isFull 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isFull ? 'KUOTA PENUH' : 'TERSEDIA'}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      {/* Kuota Peserta Card Row */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Kuota Peserta:</span>
                        <span className="font-extrabold text-slate-900">
                          <strong className={isFull ? 'text-rose-600' : 'text-blue-600'}>{catRegsCount}</strong> / {max} Tim Terdaftar ({percent}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? 'bg-rose-500' : percent >= 75 ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Biaya Pendaftaran */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500 font-medium">Biaya Pendaftaran:</span>
                        <span className="font-black text-emerald-600 text-sm">{formatRupiah(cat.fee)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                      <button
                        onClick={() => {
                          setRegCategoryFilter(cat.id);
                          setActiveTab('registrations');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Lihat Pendaftar ({catRegsCount})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenCategoryModal(cat)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Kategori"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PENDAFTARAN & PESERTA */}
      {/* ===================================================================== */}
      {activeTab === 'registrations' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Manajemen Peserta &amp; Registrasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola data atlet/tim pendaftar, verifikasi pembayaran turnamen, serta status kuota tiap kategori.
              </p>
            </div>
            <button
              onClick={() => handleOpenRegModal()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Pendaftaran Baru</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama atlet, tim, atau nomor WhatsApp..."
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-9 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={regCategoryFilter}
                onChange={(e) => setRegCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Semua">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={regStatusFilter}
                onChange={(e) => setRegStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Semua">Semua Status Bayar</option>
                <option value="Lunas">Lunas</option>
                <option value="Belum Lunas">Belum Bayar</option>
              </select>
            </div>
          </div>

          {/* Participants Table Container */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {registrations.length === 0 ? (
              /* EMPTY STATE: Belum ada peserta */
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <Users className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-900 text-base">Belum Ada Peserta Terdaftar</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Daftarkan tim atau atlet yang berpartisipasi dalam event ini untuk mulai mengisi kuota kategori dan menyiapkan bagan pertandingan.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenRegModal()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Pendaftaran Baru</span>
                </button>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              /* Filtered empty state */
              <div className="p-12 text-center space-y-3">
                <Search className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-slate-600 text-xs font-bold">Tidak ada peserta yang cocok dengan filter atau kata kunci pencarian.</p>
                <button
                  onClick={() => { setRegSearch(''); setRegCategoryFilter('Semua'); setRegStatusFilter('Semua'); }}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Reset Filter Pencarian
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-4 w-12 text-center">No</th>
                      <th className="p-4">{isTeamSport ? 'Nama Tim / Klub' : 'Nama Peserta / Pasangan'}</th>
                      <th className="p-4">Kategori</th>
                      <th className="p-4">Kontak WA</th>
                      <th className="p-4">Tanggal Daftar</th>
                      <th className="p-4">Status Pembayaran</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRegistrations.map((reg, idx) => {
                      const waClean = (reg.whatsappNumber || '').replace(/[^0-9]/g, '');
                      const isLunas = reg.paymentStatus === 'Lunas';

                      return (
                        <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="p-4 font-bold text-slate-900">
                            <div className="text-sm flex items-center gap-2 flex-wrap">
                              <span>{reg.participantName}</span>
                              {isTeamSport && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold rounded-md border border-blue-200 inline-flex items-center gap-1">
                                  <Shirt className="w-3 h-3 text-blue-500" />
                                  <span>{reg.roster?.length || 0} Pemain</span>
                                </span>
                              )}
                            </div>

                            {/* Fitur Lihat Skuad untuk Cabang Olahraga Tim */}
                            {isTeamSport && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTeamSquad(reg);
                                    setIsSquadModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                >
                                  <Users className="w-3 h-3" />
                                  <span>Lihat Skuad {reg.roster?.length ? `(${reg.roster.length})` : ''}</span>
                                </button>
                              </div>
                            )}

                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                              Metode: {reg.paymentMethod || 'Cash'} &bull; {formatRupiah(reg.amountPaid)}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100 inline-block">
                              {reg.categoryName || 'Umum'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-slate-800">{reg.contactName || '-'}</div>
                            {waClean && (
                              <a
                                href={`https://wa.me/${waClean.startsWith('0') ? '62' + waClean.slice(1) : waClean}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 font-bold mt-0.5"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>{reg.whatsappNumber}</span>
                              </a>
                            )}
                          </td>
                          <td className="p-4 text-slate-600 font-medium">
                            {formatRegDate(reg.registeredAt || reg.createdAt)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border ${
                                isLunas
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {isLunas ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                )}
                                <span>{isLunas ? 'Lunas' : 'Belum Bayar'}</span>
                              </span>

                              <select
                                value={isLunas ? 'Lunas' : 'Belum Lunas'}
                                onChange={(e) => handleQuickStatusReg(reg.id, e.target.value)}
                                className="text-[11px] font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                                title="Ubah Status Pembayaran Cepat"
                              >
                                <option value="Lunas">Lunas</option>
                                <option value="Belum Lunas">Belum Bayar</option>
                              </select>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isLunas && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReceiptData({
                                      receiptNo: `EVT-${(reg.id || '').slice(0, 6).toUpperCase() || Date.now().toString().slice(-6)}`,
                                      date: formatRegDate(reg.registeredAt || reg.createdAt),
                                      cashierName: userProfile?.displayName || userProfile?.name || 'Kasir Turnamen',
                                      customerName: reg.participantName,
                                      items: [
                                        {
                                          name: `Registrasi: ${currentEvent.name} [${reg.categoryName || 'Umum'}]`,
                                          qty: 1,
                                          price: Number(reg.amountPaid) || 0,
                                          subtotal: Number(reg.amountPaid) || 0
                                        }
                                      ],
                                      total: Number(reg.amountPaid) || 0,
                                      amountPaid: Number(reg.amountPaid) || 0,
                                      paymentMethod: reg.paymentMethod || 'Cash',
                                      status: 'LUNAS',
                                      notes: `Kategori: ${reg.categoryName || 'Umum'} • Kontak WA: ${reg.whatsappNumber || '-'}`
                                    });
                                    setReceiptModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Cetak Struk Thermal Kasir"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenRegModal(reg)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Peserta"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteReg(reg.id, reg.participantName)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Peserta"
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

      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* TAB 4: BAGAN & JADWAL (TOURNAMENT BRACKET KNOCKOUT TREE) */}
      {/* ===================================================================== */}
      {activeTab === 'bracket' && (() => {
        const activeCatId = selectedBracketCategory || categories[0]?.id || '';
        const currentCat = categories.find(c => c.id === activeCatId);
        const currentCatMatches = matches.filter(m => m.categoryId === activeCatId);
        
        // Peserta di kategori terpilih
        const catRegistrations = registrations.filter(r => r.categoryId === activeCatId);
        const catLunasPeserta = catRegistrations.filter(r => r.paymentStatus === 'Lunas' || r.paymentStatus === 'lunas');

        // Statistik partai
        const totalMatches = currentCatMatches.length;
        const completedMatches = currentCatMatches.filter(m => m.status === 'Selesai');
        const ongoingMatches = currentCatMatches.filter(m => m.status === 'Berlangsung');

        // Group matches by roundIndex
        const roundIndices = [...new Set(currentCatMatches.map(m => Number(m.roundIndex) || 1))].sort((a, b) => a - b);
        
        // Find Final match if exists
        const finalMatch = currentCatMatches.find(m => m.roundName === 'Final' || m.nextMatchRound === null || (roundIndices.length > 0 && Number(m.roundIndex) === roundIndices[roundIndices.length - 1]));
        const isFinalDone = finalMatch && finalMatch.status === 'Selesai' && Boolean(finalMatch.winner);
        const finalWinner = finalMatch?.winner || '';
        const finalRunnerUp = isFinalDone && finalMatch
          ? (finalMatch.winner === finalMatch.participant1 ? finalMatch.participant2 : finalMatch.participant1)
          : '';

        // =====================================================================
        // MORPHING TAB 4: DUNIA 1 - SISTEM LIGA (STANDINGS & FIXTURES LIST)
        // =====================================================================
        if (isLeagueFormat) {
          const matchdays = [...new Set(currentCatMatches.map(m => m.roundName || `Pekan ${m.roundIndex || 1}`))];
          const totalMatchdays = matchdays.length;
          const progressPercent = totalMatches > 0 ? Math.round((completedMatches.length / totalMatches) * 100) : 0;
          const topLeader = standings[0];

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Kontrol & Filter Kategori */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-slate-900">Klasemen Liga &amp; Jadwal Pertandingan</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Sistem Liga (Round-Robin)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {currentEvent.sport || 'Umum'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tabel peringkat poin klasemen (Standings), selisih gol/poin, serta jadwal &amp; input skor per pekan pertandingan.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Category Selector */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <span className="text-[11px] font-bold text-slate-400">Kategori:</span>
                    <select
                      value={activeCatId}
                      onChange={(e) => setSelectedBracketCategory(e.target.value)}
                      className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
                    >
                      {categories.length === 0 ? (
                        <option value="">Belum Ada Kategori</option>
                      ) : (
                        categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Primary Action Button: Generate League vs Reset */}
                  {currentCatMatches.length === 0 ? (
                    <button
                      onClick={handleGenerateLeagueSchedule}
                      disabled={isGeneratingLeague || categories.length === 0}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                        isGeneratingLeague || categories.length === 0
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingLeague ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingLeague ? 'Menyusun Jadwal...' : 'Generate Jadwal Liga'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResetBracket}
                      className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Kocok ulang seluruh jadwal liga untuk kategori ini"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset / Buat Ulang Jadwal</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Metrics Bar jika jadwal sudah digenerate */}
              {currentCatMatches.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori</span>
                    <span className="text-xs font-black text-slate-800 truncate block mt-0.5">{currentCat?.name || 'Umum'}</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pertandingan</span>
                    <span className="text-xs font-black text-slate-800 block mt-0.5">{totalMatches} Laga ({totalMatchdays} Pekan)</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Progres Liga</span>
                    <span className="text-xs font-black text-emerald-600 block mt-0.5">{completedMatches.length} / {totalMatches} Selesai ({progressPercent}%)</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pemuncak Klasemen</span>
                    <span className="text-xs font-black text-blue-600 truncate block mt-0.5">
                      {topLeader && topLeader.played > 0 ? `🥇 ${topLeader.name} (${topLeader.pts} Pts)` : 'Menunggu Laga'}
                    </span>
                  </div>
                </div>
              )}

              {/* State 1: Kategori Belum Ada */}
              {categories.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-xs space-y-4">
                  <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <Layers className="w-8 h-8" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Belum Ada Kategori Pertandingan</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Sebelum membuat jadwal liga dan klasemen, buat minimal satu kategori pertandingan terlebih dahulu di Tab Kategori &amp; Kelas.
                  </p>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    Ke Tab Kategori &amp; Kelas
                  </button>
                </div>
              ) : currentCatMatches.length === 0 ? (
                /* State 2: Belum Generate Jadwal Liga */
                <div className="bg-white rounded-3xl border border-slate-100 p-10 md:p-14 text-center shadow-xs space-y-5">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <ListOrdered className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-900 text-xl">Jadwal Kompetisi Liga Belum Dibuat</h3>
                    <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                      Kategori aktif: <strong className="text-slate-800">{currentCat?.name}</strong>. Sistem akan menyusun jadwal Round-Robin otomatis di mana setiap tim berstatus <strong>LUNAS</strong> akan saling bertanding 1 kali secara bergiliran tiap Pekan/Matchday.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs">
                    <span className="text-slate-500">Terdaftar: <strong className="text-slate-900">{catRegistrations.length} Tim</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className={catLunasPeserta.length >= 2 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                      Status Lunas: {catLunasPeserta.length} Tim {catLunasPeserta.length >= 2 ? '✓' : '(Minimal 2)'}
                    </span>
                  </div>

                  {catLunasPeserta.length < 2 ? (
                    <div className="space-y-3 pt-2">
                      <p className="text-xs text-rose-600 font-semibold max-w-md mx-auto">
                        Minimal diperlukan 2 tim/peserta dengan status pembayaran LUNAS untuk membentuk jadwal liga Round-Robin.
                      </p>
                      <button
                        onClick={() => setActiveTab('registrations')}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        Buka Tab Pendaftaran &amp; Peserta
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <button
                        onClick={handleGenerateLeagueSchedule}
                        disabled={isGeneratingLeague}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${isGeneratingLeague ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingLeague ? 'Menyusun Jadwal...' : `Generate Jadwal Liga (${catLunasPeserta.length} Tim Lunas)`}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* State 3: KLASEMEN (STANDINGS) + DAFTAR PERTANDINGAN (FIXTURES) */
                <div className="space-y-8">
                  {/* =================================================== */}
                  {/* 1. UI TABEL KLASEMEN (STANDINGS TABLE)              */}
                  {/* =================================================== */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shadow-2xs border border-amber-100">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">Tabel Klasemen Sementara</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Kategori: <strong className="text-slate-700">{currentCat?.name}</strong> &bull; Pemeringkatan Poin Otomatis
                          </p>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 font-semibold bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                        {currentSportCategory === 'field' ? (
                          <span>Aturan Poin (Futsal/Bola): <strong className="text-emerald-600">Menang: +3</strong> &bull; <strong className="text-amber-600">Seri: +1</strong> &bull; <strong className="text-rose-600">Kalah: +0</strong></span>
                        ) : currentSportCategory === 'court' ? (
                          <span>Aturan Poin (Basket FIBA): <strong className="text-emerald-600">Menang: +2</strong> &bull; <strong className="text-amber-600">Kalah: +1</strong></span>
                        ) : (
                          <span>Aturan Poin ({currentSportCategory === 'net' ? 'Voli' : 'Racket'}): <strong className="text-emerald-600">Menang: +1</strong> &bull; <strong className="text-rose-600">Kalah: +0</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="p-4 w-14 text-center">Pos</th>
                            <th className="p-4 min-w-[200px]">Nama Tim</th>
                            <th className="p-4 text-center" title="M (Main)">M</th>
                            <th className="p-4 text-center text-emerald-700" title="W (Menang)">W</th>
                            <th className="p-4 text-center text-amber-700" title="D (Seri)">D</th>
                            <th className="p-4 text-center text-rose-700" title="L (Kalah)">L</th>
                            <th className="p-4 text-center" title="GF (Gol/Poin Memasukkan)">GF</th>
                            <th className="p-4 text-center" title="GA (Gol/Poin Kemasukan)">GA</th>
                            <th className="p-4 text-center" title="GD (Selisih)">GD</th>
                            <th className="p-4 text-center bg-blue-50/60 text-blue-900 font-black" title="PTS (Poin)">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {standings.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-slate-400 text-xs">
                                Belum ada tim yang tercatat di klasemen kategori ini.
                              </td>
                            </tr>
                          ) : (
                            standings.map((team, idx) => {
                              const pos = idx + 1;
                              const isTop1 = pos === 1;
                              const isTop2 = pos === 2;
                              const isTop3 = pos === 3;

                              return (
                                <tr
                                  key={team.id || team.name}
                                  className={`transition-colors ${
                                    isTop1
                                      ? 'bg-amber-50 font-bold border-l-4 border-l-amber-500 hover:bg-amber-100/60'
                                      : isTop2
                                      ? 'bg-amber-50/80 font-semibold border-l-4 border-l-amber-400 hover:bg-amber-100/50'
                                      : isTop3
                                      ? 'bg-amber-50/50 font-medium border-l-4 border-l-amber-300 hover:bg-amber-100/40'
                                      : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                  }`}
                                >
                                  {/* POSISI */}
                                  <td className="p-4 text-center">
                                    {isTop1 ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-xs shadow-2xs">
                                        1
                                      </span>
                                    ) : isTop2 ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs shadow-2xs">
                                        2
                                      </span>
                                    ) : isTop3 ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-700 text-white font-black text-xs shadow-2xs">
                                        3
                                      </span>
                                    ) : (
                                      <span className="font-mono text-slate-400 font-bold">{pos}</span>
                                    )}
                                  </td>

                                  {/* NAMA TIM */}
                                  <td className="p-4 font-bold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate">{team.name}</span>
                                      {isTop1 && (
                                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded-md inline-flex items-center gap-1 shrink-0">
                                          <Trophy className="w-3 h-3 text-amber-700" />
                                          <span>Leader</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* M (MAIN) */}
                                  <td className="p-4 text-center font-mono font-bold text-slate-800">{team.played}</td>
                                  
                                  {/* W (MENANG) */}
                                  <td className="p-4 text-center font-mono font-bold text-emerald-600">{team.won}</td>
                                  
                                  {/* D (SERI) */}
                                  <td className="p-4 text-center font-mono font-bold text-amber-600">{team.drawn}</td>
                                  
                                  {/* L (KALAH) */}
                                  <td className="p-4 text-center font-mono font-bold text-rose-600">{team.lost}</td>
                                  
                                  {/* GF */}
                                  <td className="p-4 text-center font-mono text-slate-700">{team.gm}</td>
                                  
                                  {/* GA */}
                                  <td className="p-4 text-center font-mono text-slate-700">{team.gk}</td>
                                  
                                  {/* GD */}
                                  <td className={`p-4 text-center font-mono font-bold ${
                                    team.sg > 0 ? 'text-emerald-600' : team.sg < 0 ? 'text-rose-600' : 'text-slate-400'
                                  }`}>
                                    {team.sg > 0 ? `+${team.sg}` : team.sg}
                                  </td>

                                  {/* PTS */}
                                  <td className="p-4 text-center bg-blue-50/50">
                                    <span className="inline-block px-2.5 py-1 bg-blue-600 text-white rounded-lg font-mono font-black text-xs shadow-2xs">
                                      {team.pts}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* =================================================== */}
                  {/* 2. UI DAFTAR PERTANDINGAN (FIXTURES & RESULTS LIST) */}
                  {/* =================================================== */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                          <CalendarDays className="w-5 h-5 text-blue-600" />
                          <span>Jadwal &amp; Hasil Pertandingan Liga</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Semua partai kompetisi Round-Robin disusun berdasarkan putaran pekan tanding.
                        </p>
                      </div>

                      {/* Filter Pekan */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Filter Pekan:</span>
                        <select
                          value={selectedMatchdayFilter}
                          onChange={(e) => setSelectedMatchdayFilter(e.target.value)}
                          className="bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                        >
                          <option value="Semua">Semua Pekan ({matchdays.length})</option>
                          {matchdays.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Daftar Pekan / Fixtures Vertikal */}
                    <div className="space-y-6">
                      {matchdays
                        .filter(p => selectedMatchdayFilter === 'Semua' || p === selectedMatchdayFilter)
                        .map((pekanName) => {
                          const pekanMatches = currentCatMatches
                            .filter(m => (m.roundName || `Pekan ${m.roundIndex}`) === pekanName)
                            .sort((a, b) => (Number(a.matchIndex) || 1) - (Number(b.matchIndex) || 1));
                          const pekanCompleted = pekanMatches.filter(m => m.status === 'Selesai').length;

                          return (
                            <div key={pekanName} className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                <div className="flex items-center gap-2">
                                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-black rounded-xl shadow-2xs">
                                    {pekanName}
                                  </span>
                                  <span className="text-xs font-bold text-slate-700">
                                    {pekanMatches.length} Partai Pertandingan
                                  </span>
                                </div>
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                                  pekanCompleted === pekanMatches.length && pekanMatches.length > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}>
                                  {pekanCompleted} / {pekanMatches.length} Laga Selesai
                                </span>
                              </div>

                              {/* Kartu Pertandingan Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {pekanMatches.map((m) => {
                                  const isDone = m.status === 'Selesai';
                                  const isOngoing = m.status === 'Berlangsung';
                                  const isDraw = isDone && (m.score1 === m.score2 || m.winner === 'Seri (Draw)');
                                  const isP1Winner = isDone && !isDraw && (m.score1 > m.score2 || m.winner === m.participant1);
                                  const isP2Winner = isDone && !isDraw && (m.score2 > m.score1 || m.winner === m.participant2);

                                  return (
                                    <div
                                      key={m.id}
                                      className={`bg-white rounded-2xl border shadow-2xs hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3.5 ${
                                        isDone
                                          ? 'border-slate-200'
                                          : isOngoing
                                          ? 'border-amber-300 ring-2 ring-amber-100'
                                          : 'border-slate-200/90 hover:border-blue-300'
                                      }`}
                                    >
                                      {/* Top: Tanggal & Waktu, Nomor Lapangan */}
                                      <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-100">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                          <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                                          <span>{formatDate(currentEvent.startDate)} &bull; {m.time || '09:00'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px]">
                                            Lap. {m.courtNumber || 1}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            isDone
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : isOngoing
                                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}>
                                            {m.status || 'Menunggu'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Center: Nama Tim A vs Nama Tim B & Skor di Tengah */}
                                      <div className="flex items-center justify-between gap-3 py-1">
                                        {/* Nama Tim A */}
                                        <div className="flex-1 text-left min-w-0">
                                          <div className={`text-xs font-black truncate ${isP1Winner ? 'text-emerald-700' : 'text-slate-900'}`} title={m.participant1}>
                                            {m.participant1}
                                          </div>
                                          {isP1Winner && (
                                            <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-0.5 mt-0.5">
                                              <Trophy className="w-3 h-3 text-amber-500" />
                                              <span>Menang</span>
                                            </span>
                                          )}
                                        </div>

                                        {/* Center: Skor Akhir (misal '2 - 1') atau Tombol Biru 'Input Skor' jika belum main */}
                                        <div className="shrink-0 text-center px-2">
                                          {isDone ? (
                                            <div className="flex flex-col items-center">
                                              <div className="px-3 py-1 bg-slate-900 text-white font-mono font-black text-sm rounded-xl tracking-wider shadow-xs">
                                                {m.score1} - {m.score2}
                                              </div>
                                              <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                {isDraw ? 'Seri' : 'Selesai'}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center gap-1.5">
                                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">VS</span>
                                              <button
                                                onClick={() => handleOpenScoreModal(m)}
                                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1 cursor-pointer"
                                              >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                <span>Input Skor</span>
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {/* Nama Tim B */}
                                        <div className="flex-1 text-right min-w-0">
                                          <div className={`text-xs font-black truncate ${isP2Winner ? 'text-emerald-700' : 'text-slate-900'}`} title={m.participant2}>
                                            {m.participant2}
                                          </div>
                                          {isP2Winner && (
                                            <span className="text-[10px] text-emerald-600 font-extrabold flex items-center justify-end gap-0.5 mt-0.5">
                                              <Trophy className="w-3 h-3 text-amber-500" />
                                              <span>Menang</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Bottom: Info Pemenang / Tombol Ubah Skor jika selesai */}
                                      {isDone && (
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                          <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">
                                            {isDraw ? '🤝 Hasil Seri' : `🏆 ${m.winner || 'Pemenang'}`}
                                          </span>
                                          <button
                                            onClick={() => handleOpenScoreModal(m)}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Ubah Skor</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }

        // =====================================================================
        // MORPHING TAB 4: DUNIA 2 - SISTEM GUGUR (KNOCKOUT TREE BRACKET)
        // =====================================================================
        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Control & Filter Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">Bagan Turnamen &amp; Penjadwalan Skor</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Sistem Gugur
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisasi knockout tree, penugasan lapangan &amp; jam tanding, serta auto-advance pemenang antar babak.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Category Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <span className="text-[11px] font-bold text-slate-400">Kategori:</span>
                  <select
                    value={activeCatId}
                    onChange={(e) => setSelectedBracketCategory(e.target.value)}
                    className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {categories.length === 0 ? (
                      <option value="">Belum Ada Kategori</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Primary Button: Generate vs Reset */}
                {currentCatMatches.length === 0 ? (
                  <button
                    onClick={handleGenerateBracket}
                    disabled={isGeneratingBracket || categories.length === 0}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                      isGeneratingBracket || categories.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingBracket ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingBracket ? 'Mengacak Bagan...' : 'Generate Bagan Acak'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleResetBracket}
                    className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Kocok ulang seluruh bagan pertandingan untuk kategori ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset / Kocok Ulang</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar if bracket is generated */}
            {currentCatMatches.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori</span>
                  <span className="text-xs font-black text-slate-800 truncate block mt-0.5">{currentCat?.name || 'Umum'}</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Partai</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">{totalMatches} Pertandingan ({roundIndices.length} Babak)</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Partai Selesai</span>
                  <span className="text-xs font-black text-emerald-600 block mt-0.5">{completedMatches.length} / {totalMatches} Selesai</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Juara</span>
                  <span className="text-xs font-black text-indigo-600 truncate block mt-0.5">
                    {finalWinner ? `🏆 ${finalWinner}` : (ongoingMatches.length > 0 ? `${ongoingMatches.length} Berlangsung` : 'Menunggu Pertandingan')}
                  </span>
                </div>
              </div>
            )}

            {/* Content Area */}
            {categories.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-xs space-y-4">
                <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg">Belum Ada Kategori Pertandingan</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Sebelum membuat bagan dan jadwal pertandingan, buat minimal satu kategori (misal: "Ganda Putra Dewasa") terlebih dahulu di Tab Kategori &amp; Kelas.
                </p>
                <button
                  onClick={() => setActiveTab('categories')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  Ke Tab Kategori &amp; Kelas
                </button>
              </div>
            ) : currentCatMatches.length === 0 ? (
              /* Empty state before generating bracket */
              <div className="bg-white rounded-3xl border border-slate-100 p-10 md:p-14 text-center shadow-xs space-y-5">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <GitBranch className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-slate-900 text-xl">Bagan Sistem Gugur Belum Dibuat</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                    Kategori aktif: <strong className="text-slate-800">{currentCat?.name}</strong>. Sistem akan mengacak urutan peserta berstatus <strong>LUNAS</strong>, memberikan slot BYE otomatis jika jumlah peserta bukan pangkat 2 (misal 5, 6, 7 peserta), dan menyusun pairing berjenjang hingga babak Final.
                  </p>
                </div>

                <div className="inline-flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-500">Terdaftar: <strong className="text-slate-900">{catRegistrations.length} Tim</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className={catLunasPeserta.length >= 2 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                    Status Lunas: {catLunasPeserta.length} Tim {catLunasPeserta.length >= 2 ? '✓' : '(Minimal 2)'}
                  </span>
                </div>

                {catLunasPeserta.length < 2 ? (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-rose-600 font-semibold max-w-md mx-auto">
                      Minimal diperlukan 2 peserta dengan status pembayaran LUNAS untuk membentuk bagan turnamen.
                    </p>
                    <button
                      onClick={() => setActiveTab('registrations')}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      Buka Tab Pendaftaran &amp; Peserta
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateBracket}
                      disabled={isGeneratingBracket}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGeneratingBracket ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingBracket ? 'Memproses Pengacakan...' : `Generate Bagan Acak (${catLunasPeserta.length} Peserta Lunas)`}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* VISUALISASI BAGAN KNOCKOUT TREE (NATIVE FLEXBOX TAILWIND CSS) */
              <div className="space-y-4">
                <div className="overflow-x-auto pb-6 pt-2 px-1">
                  <div className="flex flex-row gap-8 min-w-max items-stretch p-6 bg-slate-50/70 border border-slate-200/80 rounded-3xl min-h-[540px]">
                    {roundIndices.map((rIdx) => {
                      const roundMatches = currentCatMatches
                        .filter(m => (Number(m.roundIndex) || 1) === rIdx)
                        .sort((a, b) => (Number(a.matchIndex) || 1) - (Number(b.matchIndex) || 1));
                      const roundTitle = roundMatches[0]?.roundName || `Babak ${rIdx}`;

                      return (
                        <div key={rIdx} className="flex flex-col justify-between gap-6 w-72">
                          {/* Round Header Sticky Card */}
                          <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs text-center sticky top-0 z-10">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                              Babak {rIdx}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 mt-0.5">
                              {roundTitle}
                            </h4>
                            <span className="text-[11px] text-slate-400 font-semibold">
                              {roundMatches.length} Partai
                            </span>
                          </div>

                          {/* Match Nodes Column */}
                          <div className="flex flex-col justify-around gap-6 flex-1 py-2">
                            {roundMatches.map((m) => {
                              const isDone = m.status === 'Selesai';
                              const isOngoing = m.status === 'Berlangsung';
                              const isBye = m.isBye;
                              const isP1TBD = m.participant1 === 'TBD' || !m.participant1;
                              const isP2TBD = m.participant2 === 'TBD' || !m.participant2;
                              const isP1Winner = isDone && m.winner && m.winner === m.participant1;
                              const isP2Winner = isDone && m.winner && m.winner === m.participant2;
                              const canInputScore = !isP1TBD && !isP2TBD && !isBye;

                              return (
                                <div
                                  key={m.id}
                                  className={`w-72 bg-white rounded-2xl border shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative ${
                                    isDone
                                      ? 'border-slate-200'
                                      : isOngoing
                                      ? 'border-amber-300 ring-2 ring-amber-100'
                                      : 'border-slate-200/90 hover:border-indigo-300'
                                  }`}
                                >
                                  {/* Top bar: match index, court, time, status badge */}
                                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/90 border-b border-slate-100 text-[11px]">
                                    <span className="font-extrabold text-slate-700">Partai #{m.matchIndex}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-slate-400">
                                        Lap. {m.courtNumber || 1} &bull; {m.time || '09:00'}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                        isDone
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : isOngoing
                                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                                          : isBye
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {m.status || (isBye ? 'BYE' : 'Menunggu')}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Opponents & Scores */}
                                  <div className="p-3 space-y-1.5">
                                    {/* Opponent 1 */}
                                    <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                                      isP1Winner
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black shadow-2xs'
                                        : isDone
                                        ? 'bg-slate-50/60 border-slate-100 text-slate-400 font-medium'
                                        : isP1TBD
                                        ? 'bg-slate-50 border-dashed border-slate-200 text-slate-400 italic text-[11px]'
                                        : 'bg-white border-slate-200 text-slate-800 font-bold'
                                    }`}>
                                      <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                                        {isP1Winner && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                        <span className="truncate">{m.participant1 || 'TBD'}</span>
                                      </div>
                                      <span className="font-mono text-sm font-black pl-2">
                                        {isDone || isOngoing ? m.score1 : '-'}
                                      </span>
                                    </div>

                                    {/* Opponent 2 */}
                                    <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                                      isP2Winner
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black shadow-2xs'
                                        : isDone
                                        ? 'bg-slate-50/60 border-slate-100 text-slate-400 font-medium'
                                        : isP2TBD
                                        ? 'bg-slate-50 border-dashed border-slate-200 text-slate-400 italic text-[11px]'
                                        : m.participant2 === 'BYE (Lolos Otomatis)'
                                        ? 'bg-purple-50/60 border-purple-200 text-purple-700 italic text-[11px]'
                                        : 'bg-white border-slate-200 text-slate-800 font-bold'
                                    }`}>
                                      <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                                        {isP2Winner && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                        <span className="truncate">{m.participant2 || 'TBD'}</span>
                                      </div>
                                      <span className="font-mono text-sm font-black pl-2">
                                        {isDone || isOngoing ? m.score2 : '-'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Detail Set Skor jika ada */}
                                  {m.sets && (
                                    <div className="px-3 pb-2 text-[10px] font-mono text-slate-500 truncate">
                                      <span className="font-bold text-slate-400">Set: </span>{m.sets}
                                    </div>
                                  )}

                                  {/* Action Footer */}
                                  <div className="px-3 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[140px]">
                                      {m.winner
                                        ? `Menang: ${m.winner}`
                                        : (isP1TBD || isP2TBD ? 'Menunggu Lawan' : 'Siap Main')}
                                    </span>

                                    <button
                                      onClick={() => handleOpenScoreModal(m)}
                                      disabled={!canInputScore}
                                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                        !canInputScore
                                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                          : isDone
                                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer'
                                      }`}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>{isDone ? 'Ubah Skor' : 'Input Skor'}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Trophy & Podium Column */}
                    {finalMatch && (
                      <div className="flex flex-col justify-center items-center w-72 p-4">
                        <div className={`w-full p-6 rounded-3xl border text-center transition-all ${
                          isFinalDone
                            ? 'bg-gradient-to-b from-amber-50 to-amber-100/70 border-amber-300 shadow-md scale-105'
                            : 'bg-white/80 border-dashed border-slate-300 shadow-2xs opacity-80'
                        }`}>
                          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-sm ${
                            isFinalDone ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'
                          }`}>
                            <Trophy className="w-8 h-8" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                            JUARA TURNAMEN
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-1 line-clamp-2">
                            {finalWinner || 'Menunggu Partai Final'}
                          </h4>

                          {isFinalDone && (
                            <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1">
                              <span className="text-xs font-black text-amber-900 block">
                                🥇 Juara 1: {finalWinner}
                              </span>
                              {finalRunnerUp && (
                                <span className="text-[11px] text-slate-600 block">
                                  🥈 Runner-Up: {finalRunnerUp}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB 5: KEUANGAN EVENT (MINI-GENERAL LEDGER & LABA RUGI TURNAMEN) */}
      {/* ===================================================================== */}
      {activeTab === 'finance' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Laporan Keuangan &amp; Laba Rugi Event</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Mini-General Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kalkulasi otomatis laba/rugi berdasarkan penerimaan pendaftaran (peserta lunas), sponsorship, dan biaya operasional.
              </p>
            </div>
            <button
              onClick={() => handleOpenExpenseModal()}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Catat Pengeluaran Baru</span>
            </button>
          </div>

          {/* 1. UI RINGKASAN LABA/RUGI (TOP SECTION: 3 KOLOM SPORTY LIGHT TECH) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kartu 1: Total Pemasukan */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">TOTAL PEMASUKAN</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-2xs">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black text-emerald-600 tracking-tight">
                  {formatRupiah(totalEventIncome)}
                </h3>
                <span className="text-[11px] text-slate-400 font-semibold block mt-1">
                  Pendaftaran Lunas + Sponsor Deal
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Registrasi Peserta:</span>
                  <span className="font-black text-slate-800">{formatRupiah(registrationRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dana Sponsor (Deal):</span>
                  <span className="font-black text-slate-800">{formatRupiah(sponsorRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Kartu 2: Total Pengeluaran */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">TOTAL PENGELUARAN</span>
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl shadow-2xs">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black text-rose-600 tracking-tight">
                  {formatRupiah(totalEventExpenses)}
                </h3>
                <span className="text-[11px] text-slate-400 font-semibold block mt-1">
                  Realisasi Operasional &amp; Hadiah
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Jumlah Transaksi:</span>
                  <span className="font-black text-slate-800">{expenses.length} Pos Biaya</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Rata-rata Biaya:</span>
                  <span className="font-black text-slate-800">
                    {formatRupiah(expenses.length > 0 ? Math.round(totalEventExpenses / expenses.length) : 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Kartu 3: Laba Bersih (Net Profit) */}
            <div className={`p-5 rounded-3xl border shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between transition-all ${
              netProfit >= 0
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}>
                  LABA BERSIH (NET PROFIT)
                </span>
                <div className={`p-2.5 rounded-2xl shadow-2xs ${
                  netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${
                  netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {formatRupiah(netProfit)}
                </h2>
                <span className={`text-[11px] font-bold block mt-1 ${
                  netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {netProfit >= 0 ? '✓ Surplus / Keuntungan Turnamen' : '⚠ Defisit Anggaran Turnamen'}
                </span>
              </div>
              <div className={`space-y-1 text-xs border-t pt-3 font-semibold ${
                netProfit >= 0 ? 'border-emerald-200/80 text-emerald-900' : 'border-rose-200/80 text-rose-900'
              }`}>
                <div className="flex justify-between items-center">
                  <span>Profit Margin:</span>
                  <span className="font-black">
                    {totalEventIncome > 0 ? Math.round((netProfit / totalEventIncome) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Rasio Beban Biaya:</span>
                  <span className="font-black">
                    {totalEventIncome > 0 ? Math.round((totalEventExpenses / totalEventIncome) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. DAFTAR PEMASUKAN (READ-ONLY SECTION) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-black text-base text-slate-900">Rincian Sumber Pemasukan (Otomatis)</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Panel A: Registrasi Peserta (Lunas) */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">Registrasi Peserta (Lunas)</h4>
                      <p className="text-[11px] text-slate-400">Total biaya dari atlet/tim yang pembayarannya sudah berstatus Lunas.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {paidRegistrationsCount} Tim Lunas
                    </span>
                  </div>

                  {paidRegistrations.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-semibold">
                      Belum ada pembayaran pendaftaran peserta berstatus Lunas.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-64 divide-y divide-slate-100 mt-2">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50/60 sticky top-0">
                          <tr>
                            <th className="py-2 px-2.5">Nama Peserta / Tim</th>
                            <th className="py-2 px-2.5">Kategori</th>
                            <th className="py-2 px-2.5 text-right">Nominal (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {paidRegistrations.slice(0, 10).map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-2.5 font-bold text-slate-900 truncate max-w-[150px]">
                                {r.participantName}
                              </td>
                              <td className="py-2 px-2.5 text-slate-500 truncate max-w-[120px]">
                                {r.categoryName || 'Umum'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-black text-emerald-600">
                                {formatRupiah(r.amountPaid)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {paidRegistrations.length > 10 && (
                        <p className="text-[10px] text-slate-400 text-center py-1.5 italic">
                          Menampilkan 10 dari {paidRegistrations.length} peserta lunas.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">Total Penerimaan Registrasi:</span>
                  <span className="text-sm font-black text-emerald-600">{formatRupiah(registrationRevenue)}</span>
                </div>
              </div>

              {/* Panel B: Dana Sponsor (CRM) */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">Dana Sponsorship (CRM)</h4>
                      <p className="text-[11px] text-slate-400">Nilai kontrak kemitraan sponsor yang terkait dengan turnamen ini.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                      {sponsors.length} Sponsor
                    </span>
                  </div>

                  {sponsors.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-semibold">
                      Belum ada data sponsor yang dihubungkan dengan event ini di tab Sponsor CRM.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-64 divide-y divide-slate-100 mt-2">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50/60 sticky top-0">
                          <tr>
                            <th className="py-2 px-2.5">Nama Perusahaan</th>
                            <th className="py-2 px-2.5">Tier / Status</th>
                            <th className="py-2 px-2.5 text-right">Nilai Kontrak</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {sponsors.map((sp) => {
                            const val = Number(sp.contractValue || sp.amount || 0);
                            const isDeal = sp.status === 'Deal' || sp.status === 'Lunas';
                            return (
                              <tr key={sp.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-2.5 font-bold text-slate-900 truncate max-w-[150px]">
                                  {sp.companyName}
                                </td>
                                <td className="py-2 px-2.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    isDeal ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {sp.tier || 'Gold'} &bull; {sp.status}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 text-right font-black text-emerald-600">
                                  {formatRupiah(val)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">Total Dana Sponsor (Deal):</span>
                  <span className="text-sm font-black text-emerald-600">{formatRupiah(sponsorRevenue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. MODAL & DAFTAR PENGELUARAN OPERASIONAL (CRUD SECTION) */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden space-y-4 p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-base text-slate-900">Pengeluaran Operasional Event</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                    {expenses.length} Transaksi
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Catatan pembelanjaan panitia turnamen untuk wasit, venue, piala, konsumsi, dan logistik.
                </p>
              </div>

              <button
                onClick={() => handleOpenExpenseModal()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Catat Pengeluaran Baru</span>
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <DollarSign className="w-7 h-7" />
                </div>
                <h4 className="font-black text-slate-900 text-base">Belum Ada Pengeluaran Dicatat</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Catat seluruh biaya operasional seperti honor wasit, sewa lapangan, piala juara, dan konsumsi agar laba bersih turnamen terhitung akurat.
                </p>
                <button
                  onClick={() => handleOpenExpenseModal()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  + Catat Pengeluaran Pertama
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Tanggal</th>
                      <th className="p-3.5">Keterangan Pengeluaran</th>
                      <th className="p-3.5">Kategori</th>
                      <th className="p-3.5">Catatan / No. Nota</th>
                      <th className="p-3.5 text-right">Nominal (Rp)</th>
                      <th className="p-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[...expenses]
                      .sort((a, b) => {
                        const dateA = a.date || (a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : '');
                        const dateB = b.date || (b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : '');
                        return dateB.localeCompare(dateA);
                      })
                      .map((exp) => {
                        const displayDate = exp.date ? formatDate(exp.date) : formatRegDate(exp.createdAt);
                        
                        // Kategori badge styling
                        let catBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (exp.category === 'Honor Wasit' || exp.category === 'Wasit & Official') {
                          catBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                        } else if (exp.category === 'Sewa Lapangan') {
                          catBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        } else if (exp.category === 'Hadiah/Piala' || exp.category === 'Hadiah & Piala') {
                          catBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        } else if (exp.category === 'Konsumsi' || exp.category === 'Konsumsi & Logistik') {
                          catBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                        }

                        return (
                          <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3.5 font-bold text-slate-600 whitespace-nowrap">
                              {displayDate}
                            </td>
                            <td className="p-3.5 font-black text-slate-900">
                              {exp.title || exp.description}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${catBadgeClass}`}>
                                {exp.category || 'Lain-lain'}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500 font-medium">
                              {exp.note || '-'}
                            </td>
                            <td className="p-3.5 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                              {formatRupiah(exp.amount)}
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenExpenseModal(exp)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Pengeluaran"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(exp.id, exp.title || exp.description)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Pengeluaran"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot className="bg-slate-50/70 border-t border-slate-200 text-xs font-black">
                    <tr>
                      <td colSpan="4" className="p-3.5 text-slate-700 text-right uppercase tracking-wider text-[11px]">
                        Total Akumulasi Pengeluaran:
                      </td>
                      <td className="p-3.5 text-right text-rose-600 text-base font-black">
                        {formatRupiah(totalEventExpenses)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT KATEGORI */}
      {/* ===================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full my-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-lg">
                {editingCategory ? 'Edit Kategori Kompetisi' : 'Tambah Kategori Turnamen'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NAMA KATEGORI *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Ganda Putra Dewasa, Tunggal Pemula U-15"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    MAX KUOTA SLOT *
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={categoryForm.maxSlots}
                    onChange={(e) => setCategoryForm({ ...categoryForm, maxSlots: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    BIAYA REGISTRASI (RP) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={categoryForm.fee}
                    onChange={(e) => setCategoryForm({ ...categoryForm, fee: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SYARAT &amp; KETENTUAN KHUSUS
                </label>
                <textarea
                  rows="2"
                  placeholder="Misal: Batasan umur kelahiran min. 2008, bawa KTP/KK asli"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                >
                  {isSavingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT REGISTRASI PESERTA */}
      {/* ===================================================================== */}
      {isRegModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-lg w-full my-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {editingReg ? (isTeamSport ? 'Edit Data Tim & Skuad' : 'Edit Data Pendaftaran Peserta') : (isTeamSport ? 'Form Pendaftaran Tim & Roster Baru' : 'Form Pendaftaran Baru Peserta')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isTeamSport ? 'Entri data tim pendaftar turnamen beserta susunan roster pemain' : 'Entri data pendaftar turnamen ke kategori pertandingan'}
                </p>
              </div>
              <button onClick={() => setIsRegModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Check if no categories exist */}
            {categories.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Belum Ada Kategori Pertandingan!</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Event ini belum memiliki kategori kelas. Anda harus membuat minimal 1 kategori pertandingan di Tab "Kategori &amp; Kelas" sebelum dapat menerima pendaftaran peserta.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegModalOpen(false);
                      setActiveTab('categories');
                      handleOpenCategoryModal();
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Buat Kategori Sekarang</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveReg} className="space-y-4">
                {/* 1. Kategori Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      KATEGORI / NOMOR PERTANDINGAN *
                    </label>
                    {regForm.categoryId && (() => {
                      const sel = categories.find(c => c.id === regForm.categoryId);
                      if (!sel) return null;
                      const count = registrations.filter(r => r.categoryId === sel.id && (!editingReg || r.id !== editingReg.id)).length;
                      const max = Number(sel.maxSlots) || 16;
                      const isFull = count >= max;
                      return (
                        <span className={`text-[11px] font-black ${isFull ? 'text-rose-600' : 'text-blue-600'}`}>
                          {count} / {max} Tim {isFull ? '(PENUH)' : ''}
                        </span>
                      );
                    })()}
                  </div>
                  <select
                    value={regForm.categoryId}
                    onChange={(e) => handleCategorySelectChange(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">-- Pilih Kategori Pertandingan --</option>
                    {categories.map((cat) => {
                      const count = registrations.filter(r => r.categoryId === cat.id && (!editingReg || r.id !== editingReg.id)).length;
                      const max = Number(cat.maxSlots) || 16;
                      const isFull = count >= max;
                      return (
                        <option 
                          key={cat.id} 
                          value={cat.id}
                          disabled={isFull && (!editingReg || editingReg.categoryId !== cat.id)}
                        >
                          {cat.name} ({formatRupiah(cat.fee)}) - {count}/{max} Tim {isFull ? ' [KUOTA PENUH]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Quota Full Warning */}
                  {(() => {
                    const sel = categories.find(c => c.id === regForm.categoryId);
                    if (!sel) return null;
                    const count = registrations.filter(r => r.categoryId === sel.id && (!editingReg || r.id !== editingReg.id)).length;
                    const max = Number(sel.maxSlots) || 16;
                    if (count >= max && (!editingReg || editingReg.categoryId !== sel.id)) {
                      return (
                        <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold">Kuota Penuh! </span>
                            <span>Kategori "{sel.name}" sudah mencapai batas maksimal {max} tim. Pendaftaran baru tidak dapat disimpan untuk kategori ini.</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* 2. Nama Tim / Peserta */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isTeamSport ? 'NAMA TIM / KLUB *' : 'NAMA PESERTA / PASANGAN *'}
                  </label>
                  <input
                    type="text"
                    placeholder={isTeamSport ? "Misal: Garuda FC / Bhayangkara VC / Satria Muda" : "Misal: PB Djarum / Kevin & Marcus"}
                    value={regForm.participantName}
                    onChange={(e) => setRegForm({ ...regForm, participantName: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* UI INPUT SKUAD (MORPHING FORM) - HANYA JIKA BUKAN RACKET */}
                {isTeamSport && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shirt className="w-4 h-4 text-blue-600" />
                        <label className="text-xs font-extrabold text-slate-900 uppercase">
                          Daftar Pemain (Roster)
                        </label>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-md">
                          {roster.filter(p => p.name && p.name.trim()).length} Terisi
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Nomor Punggung (Opsional)</span>
                    </div>

                    {/* Mapping Input Roster Dinamis */}
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {roster.map((player, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-400 w-5 text-center shrink-0">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            placeholder="Nama Pemain"
                            value={player.name}
                            onChange={(e) => handleRosterChange(idx, 'name', e.target.value)}
                            className="flex-1 bg-white border border-slate-200 text-slate-900 px-3 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="relative w-24 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">#</span>
                            <input
                              type="number"
                              placeholder="No"
                              value={player.number}
                              onChange={(e) => handleRosterChange(idx, 'number', e.target.value)}
                              className="w-full bg-white border border-slate-200 text-slate-900 pl-6 pr-2 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRosterPlayer(idx)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                            title="Hapus Pemain"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleAddRosterPlayer}
                        className="w-full py-2 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Tambah Pemain</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Kontak WhatsApp Official */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NAMA OFFICIAL / MANAGER
                    </label>
                    <input
                      type="text"
                      placeholder="Nama kontak penanggung jawab"
                      value={regForm.contactName}
                      onChange={(e) => setRegForm({ ...regForm, contactName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NO. WHATSAPP OFFICIAL *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Misal: 081234567890"
                        value={regForm.whatsappNumber}
                        onChange={(e) => setRegForm({ ...regForm, whatsappNumber: e.target.value })}
                        required
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Status Pembayaran & Metode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      STATUS PEMBAYARAN *
                    </label>
                    <select
                      value={regForm.paymentStatus}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selCat = categories.find(c => c.id === regForm.categoryId);
                        setRegForm({
                          ...regForm,
                          paymentStatus: val,
                          amountPaid: val === 'Lunas' ? (selCat ? Number(selCat.fee) : regForm.amountPaid) : val === 'DP' ? (selCat ? Math.round(Number(selCat.fee) / 2) : 50000) : 0
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Lunas">Lunas</option>
                      <option value="DP">DP (Uang Muka)</option>
                      <option value="Belum Lunas">Belum Lunas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      METODE BAYAR
                    </label>
                    <select
                      value={regForm.paymentMethod}
                      onChange={(e) => setRegForm({ ...regForm, paymentMethod: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Cash">Cash / Tunai</option>
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>
                </div>

                {/* 5. Nominal Pembayaran */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      NOMINAL DIBAYARKAN (RP)
                    </label>
                    {regForm.paymentStatus === 'Lunas' && (
                      <span className="text-[11px] font-bold text-emerald-600">Terhitung ke Pemasukan Event</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={regForm.amountPaid}
                    onChange={(e) => setRegForm({ ...regForm, amountPaid: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRegModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Batal
                  </button>
                  {(() => {
                    const sel = categories.find(c => c.id === regForm.categoryId);
                    const count = sel ? registrations.filter(r => r.categoryId === sel.id && (!editingReg || r.id !== editingReg.id)).length : 0;
                    const max = Number(sel?.maxSlots) || 16;
                    const isFull = sel ? count >= max : false;
                    const disableSubmit = isSavingReg || (isFull && !editingReg);

                    return (
                      <button
                        type="submit"
                        disabled={disableSubmit}
                        className={`font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-xs ${
                          disableSubmit
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        }`}
                      >
                        {isSavingReg ? 'Menyimpan...' : (isFull && !editingReg ? 'Kuota Penuh' : 'Simpan Pendaftaran')}
                      </button>
                    );
                  })()}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: LIHAT SKUAD / ROSTER PEMAIN TIM (READ-ONLY)                     */}
      {/* ===================================================================== */}
      {isSquadModalOpen && selectedTeamSquad && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full my-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 border border-blue-100">
                  <Shirt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                    {selectedTeamSquad.participantName}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Kategori: <strong className="text-slate-600">{selectedTeamSquad.categoryName || 'Umum'}</strong> &bull; Skuad Pemain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSquadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Roster list content */}
            {(!selectedTeamSquad.roster || selectedTeamSquad.roster.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-600 font-bold">Belum ada daftar pemain dalam roster tim ini.</p>
                <p className="text-[11px] text-slate-400">Gunakan tombol edit di tabel untuk menambahkan susunan pemain.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div className="grid grid-cols-12 text-[10px] font-extrabold text-slate-400 uppercase px-3 py-1 bg-slate-50 rounded-lg">
                  <div className="col-span-2 text-center">No</div>
                  <div className="col-span-7">Nama Pemain</div>
                  <div className="col-span-3 text-right">No. Punggung</div>
                </div>
                {selectedTeamSquad.roster.map((player, idx) => (
                  <div
                    key={player.id || idx}
                    className="grid grid-cols-12 items-center text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="col-span-2 text-center font-mono font-bold text-slate-400">{idx + 1}</div>
                    <div className="col-span-7 font-bold text-slate-800 truncate">{player.name}</div>
                    <div className="col-span-3 text-right">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-100 text-blue-700 font-mono font-black text-xs rounded-md">
                        {player.number ? `#${player.number}` : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Total: <strong className="text-slate-900">{selectedTeamSquad.roster?.length || 0}</strong> Pemain Terdaftar
              </span>
              <button
                type="button"
                onClick={() => setIsSquadModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: PAYMENT GATEWAY & INTERSEPSI GLOBAL KASIR (FASE 10 PART 5 & 7)  */}
      {/* ===================================================================== */}
      <PaymentGatewayModal
        isOpen={showPaymentGateway && Boolean(draftRegistration)}
        onClose={() => {
          setShowPaymentGateway(false);
          setIsRegModalOpen(true);
        }}
        draftRegistration={draftRegistration}
        tenantData={activeTenant}
        onConfirmPayment={handleConfirmPayment}
        isProcessing={isProcessingPayment}
      />


      {/* ===================================================================== */}
      {/* MODAL: CATAT PENGELUARAN EVENT */}
      {/* ===================================================================== */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full my-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-lg">
                {editingExpense ? 'Edit Pengeluaran Operasional' : 'Catat Pengeluaran Event'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  KETERANGAN PENGELUARAN *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Honor Wasit 2 Hari, Sewa Lapangan Final, Piala & Medali"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    KATEGORI BIAYA *
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="Honor Wasit">Honor Wasit</option>
                    <option value="Sewa Lapangan">Sewa Lapangan</option>
                    <option value="Hadiah/Piala">Hadiah/Piala</option>
                    <option value="Konsumsi">Konsumsi</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TANGGAL TRANSAKSI *
                  </label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    NOMINAL BIAYA (RP) *
                  </label>
                  {Number(expenseForm.amount) > 0 && (
                    <span className="text-[11px] font-black text-rose-600">
                      {formatRupiah(expenseForm.amount)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CATATAN / NOMOR NOTA (OPSIONAL)
                </label>
                <textarea
                  rows="2"
                  placeholder="Keterangan rincian nota atau nama penerima biaya"
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className={`font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                    isSavingExpense
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                  }`}
                >
                  {isSavingExpense ? 'Menyimpan...' : (editingExpense ? 'Simpan Perubahan' : 'Catat Pengeluaran')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: INPUT SKOR & HASIL PERTANDINGAN */}
      {/* ===================================================================== */}
      {isMatchScoreModalOpen && editingMatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full my-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Input Skor &amp; Hasil Partai</h3>
                <p className="text-[11px] text-slate-500">{editingMatch.roundName || 'Babak Gugur'}</p>
              </div>
              <button onClick={() => setIsMatchScoreModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScore} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-800 truncate">{editingMatch.participant1}</span>
                  <input
                    type="number"
                    min="0"
                    value={scoreForm.score1}
                    onChange={(e) => setScoreForm({ ...scoreForm, score1: e.target.value })}
                    className="w-16 bg-white border border-slate-200 text-center font-black text-sm py-1.5 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-800 truncate">{editingMatch.participant2}</span>
                  <input
                    type="number"
                    min="0"
                    value={scoreForm.score2}
                    onChange={(e) => setScoreForm({ ...scoreForm, score2: e.target.value })}
                    className="w-16 bg-white border border-slate-200 text-center font-black text-sm py-1.5 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DETAIL SKOR TIAP SET
                </label>
                <input
                  type="text"
                  placeholder="Misal: 21-18, 19-21, 21-15"
                  value={scoreForm.sets}
                  onChange={(e) => setScoreForm({ ...scoreForm, sets: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NOMOR LAPANGAN
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={scoreForm.courtNumber}
                    onChange={(e) => setScoreForm({ ...scoreForm, courtNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WAKTU / JAM PERTANDINGAN
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: 09:30"
                    value={scoreForm.time}
                    onChange={(e) => setScoreForm({ ...scoreForm, time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  STATUS PERTANDINGAN
                </label>
                <select
                  value={scoreForm.status}
                  onChange={(e) => setScoreForm({ ...scoreForm, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Menunggu">Menunggu</option>
                  <option value="Berlangsung">Berlangsung</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PENENTUAN HASIL &amp; PEMENANG
                </label>
                <select
                  value={scoreForm.winner}
                  onChange={(e) => setScoreForm({ ...scoreForm, winner: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">-- Otomatis berdasarkan skor pertandingan --</option>
                  <option value={editingMatch.participant1}>{editingMatch.participant1} (Menang)</option>
                  <option value={editingMatch.participant2}>{editingMatch.participant2} (Menang)</option>
                  <option value="Seri (Draw)">Hasil Imbang / Seri (1 Poin)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isLeagueFormat
                    ? 'Hasil pertandingan akan langsung mengupdate poin, selisih gol/poin, dan peringkat pada Tabel Klasemen.'
                    : 'Pemenang otomatis diloloskan (auto-advance) ke slot babak berikutnya di bagan turnamen.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMatchScoreModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingScore}
                  className={`font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                    isSavingScore
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                  }`}
                >
                  {isSavingScore
                    ? 'Menyimpan...'
                    : (isLeagueFormat ? 'Simpan Skor & Update Klasemen' : 'Simpan Skor & Update Bagan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* UNIVERSAL THERMAL RECEIPT MODAL (FASE 10 PART 6)                     */}
      {/* ===================================================================== */}
      <GlobalReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        transactionData={receiptData}
        tenantData={activeTenant}
      />

    </div>
  );
}
