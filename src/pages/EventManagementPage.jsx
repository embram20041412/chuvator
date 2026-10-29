import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import useArenaData from '../hooks/useArenaData';
import { 
  Event3DIcon, 
  TotalEvent3DIcon, 
  EventBerlangsung3DIcon, 
  PendaftaranBuka3DIcon, 
  DanaSponsor3DIcon, 
  RegulasiDokumen3DIcon 
} from '../components/icons/App3DIcons';
import { 
  Trophy, 
  Handshake, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  Award, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  MessageCircle, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  X, 
  Building, 
  Upload, 
  Image as ImageIcon,
  ShieldCheck,
  Tag,
  Download,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Gift,
  Check,
  Layers,
  Activity,
  Target,
  CreditCard,
  Receipt,
  Loader2
} from 'lucide-react';
import { uploadToCloudinary } from '../services/uploadService';
import EventDetailModal from '../components/EventDetailModal';
import EventDetailPage from './EventDetailPage';
import SponsorPaymentModal from '../components/SponsorPaymentModal';
import { generateSponsorInvoice } from '../utils/invoiceGenerator';

// SPORT OPTIONS DICTIONARY (FASE 10 PART 1 BUG FIX)
export const sportOptions = {
  racket: ['Badminton', 'Tenis', 'Padel', 'Squash', 'Tenis Meja'],
  field: ['Sepakbola', 'Futsal', 'Mini Soccer'],
  court: ['Bola Basket (5v5)', 'Bola Basket (3x3)'],
  net: ['Bola Voli (Indoor)', 'Bola Voli (Pasir)', 'Sepak Takraw']
};

export const SPORT_CATEGORIES = [
  {
    id: 'racket',
    title: 'Racket Sports',
    subtitle: 'Badminton, Tenis, Padel',
    defaultSport: 'Badminton',
    sports: sportOptions.racket,
    icon: Trophy,
    color: 'blue',
    description: 'Olahraga raket tunggal & ganda dengan sistem perhitungan rally point.'
  },
  {
    id: 'field',
    title: 'Field & Team Sports',
    subtitle: 'Sepakbola, Futsal, Mini Soccer',
    defaultSport: 'Sepakbola',
    sports: sportOptions.field,
    icon: Activity,
    color: 'emerald',
    description: 'Olahraga tim lapangan rumput atau vinyl dengan sistem babak waktu.'
  },
  {
    id: 'court',
    title: 'Court Team Sports',
    subtitle: 'Bola Basket (5v5 & 3x3)',
    defaultSport: 'Bola Basket (5v5)',
    sports: sportOptions.court,
    icon: Target,
    color: 'amber',
    description: 'Olahraga lapangan tertutup berbasis kuarter dan perhitungan angka tim.'
  },
  {
    id: 'net',
    title: 'Net Team Sports',
    subtitle: 'Bola Voli (Indoor & Pasir)',
    defaultSport: 'Bola Voli (Indoor)',
    sports: sportOptions.net,
    icon: ShieldCheck,
    color: 'purple',
    description: 'Olahraga tim antar-jaring berbasis set point dan rotasi tim.'
  }
];

export const TOURNAMENT_FORMATS = [
  {
    id: 'knockout',
    title: 'Single Elimination (Sistem Gugur)',
    subtitle: 'Kalah langsung gugur, alur bagan lurus hingga final',
    tag: 'Paling Populer',
    icon: Layers,
    description: 'Kalah langsung gugur, cocok untuk kompetisi cepat & peserta banyak.'
  },
  {
    id: 'league',
    title: 'Round Robin / League (Setengah Kompetisi)',
    subtitle: 'Semua tim saling bertanding, klasemen poin',
    tag: 'Klasemen & Poin',
    icon: Award,
    description: 'Semua tim saling bertanding, penentuan juara berdasarkan perolehan poin klasemen.'
  },
  {
    id: 'group',
    title: 'Group Stage + Knockout (Fase Grup Lanjut Gugur)',
    subtitle: 'Penyisihan grup dilanjutkan babak gugur untuk tim terbaik',
    tag: 'Turnamen Akbar',
    icon: Users,
    description: 'Penyisihan grup setengah kompetisi dilanjutkan babak gugur untuk tim terbaik.'
  }
];

export default function EventManagementPage({ userProfile }) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;
  const { courts, tenantProfile } = useArenaData(userProfile);

  // Dedicated Event Command Center Page State (Enterprise Fase 9 Part 2)
  const [selectedEventForDetail, setSelectedEventForDetail] = useState(null);

  // Main Tabs State: 'dashboard' | 'sponsors' | 'documents'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Smart Collapsible Card Accordion State for Event List
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Detail Modal State (Participants & Categories)
  const [selectedDetailEvent, setSelectedDetailEvent] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Firestore Real-time Collections State
  const [events, setEvents] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('Semua');
  const [eventSportFilter, setEventSportFilter] = useState('Semua');

  const [sponsorSearch, setSponsorSearch] = useState('');
  const [sponsorStatusFilter, setSponsorStatusFilter] = useState('Semua');
  const [sponsorEventFilter, setSponsorEventFilter] = useState('Semua');

  const [docSearch, setDocSearch] = useState('');
  const [docEventFilter, setDocEventFilter] = useState('Semua');

  // Modals Open States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Multi-Step Wizard State for Event Modal (Enterprise Fase 10 Part 1)
  const [step, setStep] = useState(1);
  const [sportCategory, setSportCategory] = useState(''); // 'racket', 'field', 'court', 'net'
  const [tournamentFormat, setTournamentFormat] = useState(''); // 'knockout', 'league', 'group'
  const formStep = step;

  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [paymentModalSponsor, setPaymentModalSponsor] = useState(null);

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // Extract unique sports dynamically from tenant's courts (Zero Mock Data)
  const uniqueSports = Array.from(
    new Set(courts.map((court) => court.sport || court.category).filter(Boolean))
  );
  // Fallback if tenant has no courts configured with sport yet
  const availableSports = uniqueSports.length > 0 ? uniqueSports : ['Badminton', 'Futsal', 'Basket', 'Padel', 'Tennis'];

  // Event Form State
  const [eventForm, setEventForm] = useState({
    name: '',
    sport: availableSports[0] || 'Badminton',
    startDate: '',
    endDate: '',
    status: 'Draft',
    registrationFee: '',
    totalSlots: '',
    prizePool: '',
    description: '',
    posterUrl: '',
  });

  // Multi-Select Courts State: Array of { courtId, courtName }
  const [selectedCourts, setSelectedCourts] = useState([]);

  const [eventPosterBase64, setEventPosterBase64] = useState('');
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState('');
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Sponsor Form State
  const [sponsorForm, setSponsorForm] = useState({
    companyName: '',
    eventId: '', // empty string means "Sponsor Global"
    category: 'Sponsor Utama',
    contractValue: 0,
    contactPerson: '',
    whatsappNumber: '',
    status: 'Negosiasi',
  });
  const [isSavingSponsor, setIsSavingSponsor] = useState(false);

  // Document Form State
  const [docForm, setDocForm] = useState({
    title: '',
    eventId: '',
    documentType: 'Technical Handbook',
    fileUrl: '',
    fileName: '',
    contentSummary: '',
  });
  const [docFile, setDocFile] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // 1. Fetch from Supabase Tables
  const fetchEventManagementData = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [eventsRes, sponsorsRes, docsRes, catRes, regRes] = await Promise.all([
        supabase.from('events').select('*').eq('tenant_id', tenantId).order('start_date', { ascending: false }),
        supabase.from('sponsors').select('*').eq('tenant_id', tenantId),
        supabase.from('event_documents').select('*').eq('tenant_id', tenantId),
        supabase.from('event_categories').select('*').eq('tenant_id', tenantId),
        supabase.from('event_registrations').select('*').eq('tenant_id', tenantId),
      ]);

      if (eventsRes.data) {
        const mapped = eventsRes.data.map((e) => ({
          ...e,
          id: e.id,
          tenantId: e.tenant_id,
          startDate: e.start_date,
          endDate: e.end_date,
          sportCategory: e.sport_category,
          tournamentFormat: e.tournament_format,
          registrationFee: Number(e.registration_fee || 0),
          totalSlots: Number(e.total_slots || 0),
          prizePool: Number(e.prize_pool || 0),
          bannerUrl: e.banner_url,
          posterUrl: e.poster_url,
          courts: Array.isArray(e.courts) ? e.courts : []
        }));
        setEvents(mapped);
      }

      if (sponsorsRes.data) {
        const mapped = sponsorsRes.data.map((s) => ({
          ...s,
          id: s.id,
          tenantId: s.tenant_id,
          eventId: s.event_id,
          eventName: s.event_name,
          companyName: s.company_name || s.name || '',
          contractValue: Number(s.contract_value || 0),
          totalPaid: Number(s.total_paid || 0),
          pendingAmount: Number(s.pending_amount || 0),
          paymentStatus: s.payment_status || 'Unpaid',
          crmStatus: s.crm_status || s.status,
          contactPerson: s.contact_person || '',
          whatsappNumber: s.whatsapp_number || '',
          paymentHistory: Array.isArray(s.payment_history) ? s.payment_history : []
        }));
        setSponsors(mapped);
      }

      if (docsRes.data) {
        const mapped = docsRes.data.map((d) => ({
          ...d,
          id: d.id,
          tenantId: d.tenant_id,
          eventId: d.event_id,
          eventName: d.event_name,
          documentType: d.document_type,
          fileUrl: d.file_url,
          fileName: d.file_name,
          contentSummary: d.content_summary
        }));
        setDocuments(mapped);
      }

      if (catRes.data) {
        setEventCategories(catRes.data.map((c) => ({
          ...c,
          id: c.id,
          tenantId: c.tenant_id,
          eventId: c.event_id,
          categoryName: c.category_name,
          maxParticipants: c.max_participants
        })));
      }

      if (regRes.data) {
        setEventRegistrations(regRes.data.map((r) => ({
          ...r,
          id: r.id,
          tenantId: r.tenant_id,
          eventId: r.event_id,
          categoryId: r.category_id,
          participantName: r.participant_name,
          teamName: r.team_name,
          paymentStatus: r.payment_status
        })));
      }
    } catch (err) {
      console.error('Error fetching event management data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchEventManagementData();
  }, [fetchEventManagementData]);

  // Handle Poster File Selection (Menyimpan File object untuk diunggah ke Cloudinary saat submit)
  const handlePosterFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran file gambar terlalu besar. Maksimal 10MB.');
        return;
      }
      setPosterFile(file);
      const localPreviewUrl = URL.createObjectURL(file);
      setPosterPreview(localPreviewUrl);
      setEventPosterBase64(localPreviewUrl);
    }
  };

  // ----------------------------------------------------
  // EVENT ACTIONS & MULTI-STEP WIZARD (ENTERPRISE FASE 10 PART 1)
  // ----------------------------------------------------
  const handleOpenEventModal = (eventObj = null) => {
    setStep(1); // Always reset wizard to Step 1
    const defaultSport = availableSports[0] || 'Badminton';

    if (eventObj) {
      setEditingEvent(eventObj);
      setSportCategory(eventObj.sportCategory || 'racket');
      setTournamentFormat(eventObj.tournamentFormat || 'knockout');
      const existingPoster = eventObj.bannerUrl || eventObj.posterUrl || '';
      setEventForm({
        name: eventObj.name || '',
        sport: eventObj.sport || defaultSport,
        startDate: eventObj.startDate || '',
        endDate: eventObj.endDate || '',
        status: eventObj.status || 'Draft',
        registrationFee: eventObj.registrationFee !== undefined && eventObj.registrationFee !== null ? eventObj.registrationFee : '',
        totalSlots: eventObj.totalSlots !== undefined && eventObj.totalSlots !== null ? eventObj.totalSlots : '',
        prizePool: eventObj.prizePool !== undefined && eventObj.prizePool !== null ? eventObj.prizePool : '',
        description: eventObj.description || '',
        posterUrl: existingPoster,
        bannerUrl: existingPoster,
      });
      setSelectedCourts(eventObj.courts || []);
      setPosterFile(null);
      setPosterPreview(existingPoster);
      setEventPosterBase64(existingPoster);
    } else {
      setEditingEvent(null);
      setSportCategory('');
      setTournamentFormat('');
      setEventForm({
        name: '',
        sport: defaultSport,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'Pendaftaran Buka',
        registrationFee: '',
        totalSlots: '',
        prizePool: '',
        description: '',
        posterUrl: '',
        bannerUrl: '',
      });
      setSelectedCourts([]);
      setPosterFile(null);
      setPosterPreview('');
      setEventPosterBase64('');
    }
    setIsEventModalOpen(true);
  };

  const handleStep1Next = (e) => {
    if (e) e.preventDefault();
    if (!sportCategory) {
      alert('Pilih Kategori Olahraga terlebih dahulu.');
      return;
    }
    setStep(2);
  };

  const handleStep2Back = (e) => {
    if (e) e.preventDefault();
    setStep(1);
  };

  const handleStep2Next = (e) => {
    if (e) e.preventDefault();
    if (!tournamentFormat) {
      alert('Pilih Format Pertandingan / Turnamen terlebih dahulu.');
      return;
    }
    // Auto-select default value (index 0 of sport category)
    const currentOptions = sportOptions[sportCategory] || [];
    if (currentOptions.length > 0 && !currentOptions.includes(eventForm.sport)) {
      setEventForm((prev) => ({ ...prev, sport: currentOptions[0] }));
      setSelectedCourts([]);
    }
    setStep(3);
  };

  const handleStep3Back = (e) => {
    if (e) e.preventDefault();
    setStep(2);
  };

  const handleCourtToggle = (court) => {
    const exists = selectedCourts.some((item) => item.courtId === court.id);
    if (exists) {
      setSelectedCourts(selectedCourts.filter((item) => item.courtId !== court.id));
    } else {
      setSelectedCourts([...selectedCourts, { courtId: court.id, courtName: court.name }]);
    }
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!sportCategory) {
      alert('Silakan pilih Kategori Olahraga di Langkah 1.');
      setStep(1);
      return;
    }

    if (!tournamentFormat) {
      alert('Silakan pilih Format Turnamen di Langkah 2.');
      setStep(2);
      return;
    }

    if (!eventForm.name.trim()) {
      alert('Nama Event wajib diisi.');
      setStep(3);
      return;
    }

    if (!eventForm.startDate || !eventForm.endDate) {
      alert('Tanggal Mulai dan Tanggal Selesai wajib diisi.');
      setStep(3);
      return;
    }

    setIsSavingEvent(true);
    let finalBannerUrl = eventForm.bannerUrl || eventForm.posterUrl || '';

    try {
      // 1. Jika ada file gambar baru yang dipilih, unggah ke Cloudinary terlebih dahulu
      if (posterFile) {
        setIsUploadingPoster(true);
        try {
          const uploadResult = await uploadToCloudinary(posterFile, { folder: 'chua_sport/events' });
          finalBannerUrl = uploadResult.secure_url;
        } catch (uploadErr) {
          console.error('Gagal mengunggah banner/poster ke Cloudinary:', uploadErr);
          alert(`Gagal mengunggah gambar poster: ${uploadErr.message || 'Terjadi kesalahan saat upload'}`);
          setIsSavingEvent(false);
          setIsUploadingPoster(false);
          return;
        } finally {
          setIsUploadingPoster(false);
        }
      } else if (posterPreview && !posterPreview.startsWith('blob:') && !posterPreview.startsWith('data:')) {
        finalBannerUrl = posterPreview;
      }

      const locationString = selectedCourts.length > 0
        ? selectedCourts.map((c) => c.courtName).join(', ')
        : 'GOR Utama';

      const payload = {
        tenantId,
        name: eventForm.name.trim(),
        sport: eventForm.sport,
        sportCategory: sportCategory,
        tournamentFormat: tournamentFormat,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate,
        courts: selectedCourts,
        location: locationString,
        status: eventForm.status,
        registrationFee: eventForm.registrationFee === '' ? 0 : Number(eventForm.registrationFee) || 0,
        totalSlots: eventForm.totalSlots === '' ? 0 : Number(eventForm.totalSlots) || 0,
        prizePool: eventForm.prizePool === '' ? 0 : Number(eventForm.prizePool) || 0,
        description: eventForm.description.trim(),
        bannerUrl: finalBannerUrl,
        posterUrl: finalBannerUrl,
        updatedAt: serverTimestamp(),
      };

      // Helper function to calculate all date strings between start and end (inclusive) without timezone offset issues
      const getDatesInRange = (startDate, endDate) => {
        const dates = [];
        if (!startDate || !endDate) return dates;
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        let current = new Date(startYear, startMonth - 1, startDay);
        const end = new Date(endYear, endMonth - 1, endDay);
        
        while (current <= end) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
          current.setDate(current.getDate() + 1);
        }
        return dates;
      };

      let currentEventId = editingEvent?.id;

      if (editingEvent) {
        // Delete old locked bookings for this event
        await supabase.from('bookings').delete().eq('event_id', editingEvent.id);

        await supabase.from('events').update({
          name: payload.name,
          sport: payload.sport,
          sport_category: payload.sportCategory,
          tournament_format: payload.tournamentFormat,
          start_date: payload.startDate,
          end_date: payload.endDate,
          courts: payload.courts,
          location: payload.location,
          status: payload.status,
          registration_fee: payload.registrationFee,
          total_slots: payload.totalSlots,
          prize_pool: payload.prizePool,
          description: payload.description,
          banner_url: payload.bannerUrl,
          poster_url: payload.posterUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', editingEvent.id);
      } else {
        const { data: newEv, error: evErr } = await supabase.from('events').insert([{
          tenant_id: tenantId,
          name: payload.name,
          sport: payload.sport,
          sport_category: payload.sportCategory,
          tournament_format: payload.tournamentFormat,
          start_date: payload.startDate,
          end_date: payload.endDate,
          courts: payload.courts,
          location: payload.location,
          status: payload.status,
          registration_fee: payload.registrationFee,
          total_slots: payload.totalSlots,
          prize_pool: payload.prizePool,
          description: payload.description,
          banner_url: payload.bannerUrl,
          poster_url: payload.posterUrl,
          created_at: new Date().toISOString(),
        }]).select().single();

        if (evErr) throw evErr;
        currentEventId = newEv.id;
      }

      // 2. RECREATE BOOKING SCHEDULE (AUTO-LOCK COURTS ACROSS ALL NEW DATES)
      if (selectedCourts.length > 0 && currentEventId && eventForm.startDate && eventForm.endDate) {
        const datesToBook = getDatesInRange(eventForm.startDate, eventForm.endDate);
        const bookingRows = [];

        selectedCourts.forEach((court) => {
          datesToBook.forEach((date) => {
            bookingRows.push({
              tenant_id: tenantId,
              event_id: currentEventId,
              court_id: court.courtId,
              court_name: court.courtName,
              date: date,
              booking_date: date,
              start_time: '08:00',
              end_time: '23:00',
              booking_type: 'TOURNAMENT',
              customer_name: `Turnamen: ${eventForm.name.trim()}`,
              customer_phone: '-',
              status: 'Lunas',
              total_price: 0,
              payment_method: 'Internal GOR',
              created_at: new Date().toISOString(),
            });
          });
        });

        if (bookingRows.length > 0) {
          await supabase.from('bookings').insert(bookingRows);
        }
      }

      await fetchEventManagementData();
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));

      setPosterFile(null);
      setPosterPreview(finalBannerUrl);
      setIsEventModalOpen(false);
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleQuickStatusChange = async (eventId, newStatus) => {
    try {
      await supabase.from('events').update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', eventId);
      await fetchEventManagementData();
    } catch (err) {
      console.error('Failed to update event status:', err);
    }
  };

  const handleDeleteEvent = async (eventId, eventName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus event "${eventName}"? Jadwal booking lapangan terkait juga akan dibatalkan/dihapus.`)) {
      try {
        await supabase.from('bookings').delete().eq('event_id', eventId);
        await supabase.from('events').delete().eq('id', eventId);
        await fetchEventManagementData();
        window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      } catch (err) {
        console.error('Failed to delete event:', err);
      }
    }
  };

  // ----------------------------------------------------
  // SPONSOR ACTIONS
  // ----------------------------------------------------
  const handleOpenSponsorModal = (sponsorObj = null) => {
    if (sponsorObj) {
      setEditingSponsor(sponsorObj);
      setSponsorForm({
        companyName: sponsorObj.companyName || '',
        eventId: sponsorObj.eventId || '',
        category: sponsorObj.category || 'Sponsor Utama',
        contractValue: sponsorObj.contractValue || 0,
        contactPerson: sponsorObj.contactPerson || '',
        whatsappNumber: sponsorObj.whatsappNumber || '',
        status: sponsorObj.status || 'Negosiasi',
      });
    } else {
      setEditingSponsor(null);
      setSponsorForm({
        companyName: '',
        eventId: events[0]?.id || '',
        category: 'Sponsor Utama',
        contractValue: 5000000,
        contactPerson: '',
        whatsappNumber: '',
        status: 'Negosiasi',
      });
    }
    setIsSponsorModalOpen(true);
  };

  const handleSaveSponsor = async (e) => {
    e.preventDefault();
    if (!sponsorForm.companyName.trim()) {
      alert('Nama Perusahaan / Brand wajib diisi.');
      return;
    }

    setIsSavingSponsor(true);
    try {
      const selectedEvent = events.find((ev) => ev.id === sponsorForm.eventId);
      const contractVal = Number(sponsorForm.contractValue) || 0;
      const payload = {
        tenant_id: tenantId,
        company_name: sponsorForm.companyName.trim(),
        name: sponsorForm.companyName.trim(),
        event_id: sponsorForm.eventId || '',
        event_name: selectedEvent ? selectedEvent.name : 'Sponsor Global',
        category: sponsorForm.category,
        contract_value: contractVal,
        contact_person: sponsorForm.contactPerson.trim(),
        whatsapp_number: sponsorForm.whatsappNumber.trim(),
        status: sponsorForm.status,
        updated_at: new Date().toISOString(),
      };

      if (editingSponsor) {
        const totalPaid = editingSponsor.totalPaid !== undefined ? editingSponsor.totalPaid : 0;
        let crmStatus = sponsorForm.status || 'Negosiasi';
        if (totalPaid >= contractVal && contractVal > 0) {
          crmStatus = 'Lunas';
        } else if (totalPaid > 0) {
          crmStatus = 'Deal';
        }
        await supabase.from('sponsors').update({
          ...payload,
          total_paid: totalPaid,
          payment_status: editingSponsor.paymentStatus || (totalPaid >= contractVal && contractVal > 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid'),
          payment_history: Array.isArray(editingSponsor.paymentHistory) ? editingSponsor.paymentHistory : [],
          status: crmStatus,
          crm_status: crmStatus,
        }).eq('id', editingSponsor.id);
      } else {
        await supabase.from('sponsors').insert([{
          ...payload,
          total_paid: 0,
          payment_status: 'Unpaid',
          payment_history: [],
          status: sponsorForm.status || 'Negosiasi',
          crm_status: sponsorForm.status || 'Negosiasi',
          created_at: new Date().toISOString(),
        }]);
      }

      await fetchEventManagementData();
      setIsSponsorModalOpen(false);
    } catch (err) {
      console.error('Failed to save sponsor:', err);
    } finally {
      setIsSavingSponsor(false);
    }
  };

  // CETAK INVOICE / FAKTUR (FASE 12 ENGINE GENERATOR)
  const handlePrintInvoice = (sponsor) => {
    try {
      const matchedEvent = events.find((ev) => ev.id === sponsor.eventId);
      const eventName = matchedEvent ? matchedEvent.name : sponsor.eventName || 'Sponsor Global';
      const cVal = Number(sponsor.contractValue || 0);
      const tPaid = Number(sponsor.totalPaid || 0);
      const rem = Math.max(0, cVal - tPaid);
      const currentAmount = rem > 0 ? rem : cVal;
      const term = sponsor.paymentStatus === 'Paid' || sponsor.status === 'Lunas'
        ? 'Pelunasan Sponsorship'
        : tPaid > 0
        ? 'Tagihan Termin Berjalan'
        : 'Penagihan Awal Sponsorship';
      const benefits = sponsor.benefits || sponsor.benefit || 'Publikasi Brand, Media Partner';

      generateSponsorInvoice(
        sponsor,
        tenantProfile,
        eventName,
        currentAmount,
        sponsor.invoiceDueDate || sponsor.dueDate || '',
        term,
        benefits,
        userProfile
      );
    } catch (err) {
      console.error('Gagal mencetak invoice sponsor:', err);
    }
  };

  const handleUpdateSponsorStatus = async (sponsorId, newStatus) => {
    try {
      await supabase.from('sponsors').update({
        status: newStatus,
        crm_status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', sponsorId);
      await fetchEventManagementData();
    } catch (err) {
      console.error('Failed to update sponsor status:', err);
    }
  };

  const handleDeleteSponsor = async (sponsorId, companyName) => {
    if (window.confirm(`Hapus data sponsor "${companyName}"?`)) {
      try {
        await supabase.from('sponsors').delete().eq('id', sponsorId);
        await fetchEventManagementData();
      } catch (err) {
        console.error('Failed to delete sponsor:', err);
      }
    }
  };

  // ----------------------------------------------------
  // DOCUMENT ACTIONS
  // ----------------------------------------------------
  const handleOpenDocModal = (docObj = null) => {
    setDocFile(null);
    if (docObj) {
      setEditingDoc(docObj);
      setDocForm({
        title: docObj.title || '',
        eventId: docObj.eventId || '',
        documentType: docObj.documentType || 'Technical Handbook',
        fileUrl: docObj.fileUrl || '',
        fileName: docObj.fileName || '',
        contentSummary: docObj.contentSummary || '',
      });
    } else {
      setEditingDoc(null);
      setDocForm({
        title: '',
        eventId: events[0]?.id || '',
        documentType: 'Technical Handbook',
        fileUrl: '',
        fileName: '',
        contentSummary: '',
      });
    }
    setIsDocModalOpen(true);
  };

  const handleSaveDoc = async (e) => {
    e.preventDefault();
    if (!docForm.title.trim()) {
      alert('Nama Dokumen wajib diisi.');
      return;
    }
    if (!docForm.eventId) {
      alert('Pilih event terkait terlebih dahulu.');
      return;
    }

    if (!docFile && !docForm.fileUrl) {
      alert('Silakan pilih file dokumen (PDF, Word) untuk diunggah.');
      return;
    }

    let finalFileUrl = docForm.fileUrl;
    let finalFileName = docForm.fileName || '';

    // Upload to Cloudinary if new file selected
    if (docFile) {
      setIsUploadingDoc(true);
      try {
        const uploadResult = await uploadToCloudinary(docFile, {
          folder: 'chua_sport_regulations',
        });
        finalFileUrl = uploadResult.secure_url;
        finalFileName = docFile.name;
      } catch (uploadError) {
        console.error('Failed to upload document file:', uploadError);
        alert('Gagal mengunggah dokumen ke Cloudinary: ' + (uploadError.message || 'Terjadi kesalahan'));
        setIsUploadingDoc(false);
        return;
      } finally {
        setIsUploadingDoc(false);
      }
    }

    setIsSavingDoc(true);
    try {
      const selectedEvent = events.find((ev) => ev.id === docForm.eventId);
      const payload = {
        tenant_id: tenantId,
        title: docForm.title.trim(),
        event_id: docForm.eventId,
        event_name: selectedEvent ? selectedEvent.name : 'Event Turnamen',
        document_type: docForm.documentType,
        file_url: finalFileUrl || '',
        file_name: finalFileName,
        content_summary: docForm.contentSummary.trim(),
        updated_at: new Date().toISOString(),
      };

      if (editingDoc) {
        await supabase.from('event_documents').update(payload).eq('id', editingDoc.id);
      } else {
        await supabase.from('event_documents').insert([{ ...payload, created_at: new Date().toISOString() }]);
      }

      await fetchEventManagementData();
      setIsDocModalOpen(false);
      setDocFile(null);
    } catch (err) {
      console.error('Failed to save document:', err);
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId, title) => {
    if (window.confirm(`Hapus dokumen "${title}"?`)) {
      try {
        await supabase.from('event_documents').delete().eq('id', docId);
        await fetchEventManagementData();
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  };

  // Helper formatting
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Filtered Lists
  const filteredEvents = events.filter((ev) => {
    const matchSearch = (ev.name || '').toLowerCase().includes(eventSearch.toLowerCase()) ||
                        (ev.sport || '').toLowerCase().includes(eventSearch.toLowerCase()) ||
                        (ev.location || '').toLowerCase().includes(eventSearch.toLowerCase());
    const matchStatus = eventStatusFilter === 'Semua' || ev.status === eventStatusFilter;
    const matchSport = eventSportFilter === 'Semua' || ev.sport === eventSportFilter;
    return matchSearch && matchStatus && matchSport;
  });

  const filteredSponsors = sponsors.filter((sp) => {
    const matchSearch = (sp.companyName || '').toLowerCase().includes(sponsorSearch.toLowerCase()) ||
                        (sp.contactPerson || '').toLowerCase().includes(sponsorSearch.toLowerCase()) ||
                        (sp.category || '').toLowerCase().includes(sponsorSearch.toLowerCase());
    const matchStatus = sponsorStatusFilter === 'Semua' || sp.status === sponsorStatusFilter;
    const matchEvent = sponsorEventFilter === 'Semua' || sp.eventId === sponsorEventFilter;
    return matchSearch && matchStatus && matchEvent;
  });

  const filteredDocs = documents.filter((dc) => {
    const matchSearch = (dc.title || '').toLowerCase().includes(docSearch.toLowerCase()) ||
                        (dc.documentType || '').toLowerCase().includes(docSearch.toLowerCase()) ||
                        (dc.contentSummary || '').toLowerCase().includes(docSearch.toLowerCase());
    const matchEvent = docEventFilter === 'Semua' || dc.eventId === docEventFilter;
    return matchSearch && matchEvent;
  });

  // Calculate Metrics
  const totalEventsCount = events.length;
  const activeEventsCount = events.filter((e) => e.status === 'Berlangsung').length;
  const openRegEventsCount = events.filter((e) => e.status === 'Pendaftaran Buka').length;

  const totalSponsorPotential = sponsors.reduce((acc, curr) => acc + (Number(curr.contractValue) || 0), 0);
  const totalSponsorDealLunas = sponsors
    .filter((s) => s.status === 'Deal' || s.status === 'Lunas')
    .reduce((acc, curr) => acc + (Number(curr.contractValue) || 0), 0);
  const totalSponsorPaid = sponsors.reduce((acc, curr) => acc + (Number(curr.totalPaid) || 0), 0);
  const totalSponsorRemaining = Math.max(0, totalSponsorDealLunas - totalSponsorPaid);

  // Filter courts by selected sport with case-insensitive comparison (court.category or court.sport)
  const selectedSportNormalized = (eventForm.sport || '').trim().toLowerCase();
  const filteredCourtsForEvent = courts.filter((court) => {
    const courtCategory = (court.category || '').trim().toLowerCase();
    const courtSport = (court.sport || '').trim().toLowerCase();

    // Direct case-insensitive match on category or sport
    if (courtCategory && courtCategory === selectedSportNormalized) return true;
    if (courtSport && courtSport === selectedSportNormalized) return true;

    // Fallback: match without whitespace (e.g. 'sepak bola' vs 'sepakbola')
    const normalizedSelectedNoSpace = selectedSportNormalized.replace(/\s+/g, '');
    if (courtCategory && courtCategory.replace(/\s+/g, '') === normalizedSelectedNoSpace) return true;
    if (courtSport && courtSport.replace(/\s+/g, '') === normalizedSelectedNoSpace) return true;

    return false;
  });

  // RENDER BERSYARAT: EVENT COMMAND CENTER (EVENT DETAIL DASHBOARD)
  if (selectedEventForDetail) {
    return (
      <EventDetailPage
        eventData={selectedEventForDetail}
        userProfile={userProfile}
        tenantData={tenantProfile}
        onBack={() => setSelectedEventForDetail(null)}
      />
    );
  }

  return (
    <div className="space-y-6 text-left pb-12">
      {/* TOP HEADER TITLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <Event3DIcon className="w-10 h-10 shrink-0 drop-shadow-2xs" />
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Event &amp; Tournament</h1>
              <p className="text-xs text-gray-500 font-medium">
                Kelola turnamen, kompetisi arena, kemitraan sponsor, dan dokumen regulasi pertandingan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'dashboard' && (
            <button
              onClick={() => handleOpenEventModal()}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Event / Turnamen</span>
            </button>
          )}

          {activeTab === 'sponsors' && (
            <button
              onClick={() => handleOpenSponsorModal()}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#C89D32] hover:bg-[#B38A28] text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mitra / Sponsor</span>
            </button>
          )}

          {activeTab === 'documents' && (
            <button
              onClick={() => handleOpenDocModal()}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Dokumen Regulasi</span>
            </button>
          )}
        </div>
      </div>

      {/* RESPONSIVE TAB NAVIGATION */}
      {/* MOBILE DROPDOWN */}
      <div className="block md:hidden mb-4">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl font-bold text-xs text-gray-800 dark:text-slate-100 shadow-sm focus:outline-none cursor-pointer"
        >
          <option value="dashboard">Dasbor Event ({totalEventsCount})</option>
          <option value="sponsors">Mitra & Sponsor CRM ({sponsors.length})</option>
          <option value="documents">Regulasi & Dokumen ({documents.length})</option>
        </select>
      </div>

      {/* DESKTOP SEGMENTED CONTROL */}
      <div className="hidden md:flex items-center space-x-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-fit border border-slate-200/80 dark:border-slate-700/80">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#354944] text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Event3DIcon className="w-5 h-5 shrink-0" />
          <span>Dasbor Event ({totalEventsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('sponsors')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'sponsors'
              ? 'bg-[#354944] text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <DanaSponsor3DIcon className="w-5 h-5 shrink-0" />
          <span>Mitra & Sponsor CRM ({sponsors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-[#354944] text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <RegulasiDokumen3DIcon className="w-5 h-5 shrink-0" />
          <span>Regulasi & Dokumen ({documents.length})</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: DASBOR EVENT */}
      {/* ==================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* STATS OVERVIEW CARDS (TOPOGRAPHY CARDS) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Warm Mustard Gold Highlight */}
            <div className="bg-[#C89D32] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between z-10">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Total Event</p>
                <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
                  <TotalEvent3DIcon className="w-6 h-6 shrink-0" />
                </div>
              </div>
              <div className="z-10 mt-2">
                <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">{totalEventsCount}</p>
              </div>
              <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
                Event Terdaftar
              </div>
            </div>

            {/* Card 2: Deep Slate Teal */}
            <div className="bg-[#354944] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between z-10">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Event Berlangsung</p>
                <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
                  <EventBerlangsung3DIcon className="w-6 h-6 shrink-0" />
                </div>
              </div>
              <div className="z-10 mt-2">
                <p className="text-2xl sm:text-3xl font-black font-mono text-[#D4A73A] tracking-tight">{activeEventsCount}</p>
              </div>
              <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
                Sedang Aktif
              </div>
            </div>

            {/* Card 3: Deep Slate Teal */}
            <div className="bg-[#354944] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between z-10">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Pendaftaran Buka</p>
                <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
                  <PendaftaranBuka3DIcon className="w-6 h-6 shrink-0" />
                </div>
              </div>
              <div className="z-10 mt-2">
                <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">{openRegEventsCount}</p>
              </div>
              <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
                Siap Menerima Tim
              </div>
            </div>

            {/* Card 4: Deep Slate Teal */}
            <div className="bg-[#354944] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between z-10">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Dana Sponsor Deal</p>
                <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
                  <DanaSponsor3DIcon className="w-6 h-6 shrink-0" />
                </div>
              </div>
              <div className="z-10 mt-2">
                <p className="text-lg sm:text-xl font-black font-mono text-[#D4A73A] truncate tracking-tight">{formatRupiah(totalSponsorDealLunas)}</p>
              </div>
              <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
                Total Komitmen Sponsor
              </div>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama event, cabang, lokasi..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={eventStatusFilter}
                onChange={(e) => setEventStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="Semua">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Pendaftaran Buka">Pendaftaran Buka</option>
                <option value="Berlangsung">Berlangsung</option>
                <option value="Selesai">Selesai</option>
              </select>

              {/* Sport Filter */}
              <select
                value={eventSportFilter}
                onChange={(e) => setEventSportFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="Semua">Semua Cabang Olahraga</option>
                {availableSports.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* EVENT GRID / LIST */}
          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-gray-500 font-medium">Memuat data turnamen dari Firestore...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800">Belum Ada Event / Turnamen</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                {eventSearch || eventStatusFilter !== 'Semua' || eventSportFilter !== 'Semua'
                  ? 'Tidak ada event yang sesuai dengan filter pencarian.'
                  : 'Buat event turnamen pertama Anda untuk membuka pendaftaran tim, menghubungkan sponsor, dan menerbitkan jadwal regulasi.'}
              </p>
              <button
                onClick={() => handleOpenEventModal()}
                className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Event Turnamen Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((ev) => {
                const eventSponsorsCount = sponsors.filter((s) => s.eventId === ev.id).length;
                const eventDocsCount = documents.filter((d) => d.eventId === ev.id).length;

                return (
                  <div
                    key={ev.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* CARD HEADER (VISUAL ATAS) */}
                      <div className="relative h-24 bg-gradient-to-r from-blue-700 to-cyan-500 overflow-hidden flex items-end p-4">
                        {ev.posterUrl && (
                          <img
                            src={ev.posterUrl}
                            alt={ev.name}
                            className="absolute inset-0 w-full h-full object-cover opacity-30"
                          />
                        )}
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                              ev.status === 'Draft'
                                ? 'bg-gray-800 text-gray-200'
                                : ev.status === 'Pendaftaran Buka'
                                ? 'bg-emerald-500 text-white'
                                : ev.status === 'Berlangsung'
                                ? 'bg-blue-600 text-white animate-pulse'
                                : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <div className="relative z-10 text-white flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-md">
                            {ev.sport}
                          </span>
                          {ev.tournamentFormat && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-md text-cyan-200 border border-white/20">
                              {ev.tournamentFormat === 'knockout' ? 'Sistem Gugur' : ev.tournamentFormat === 'league' ? 'Liga' : 'Grup + Gugur'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* INFO UTAMA (TENGAH) */}
                      <div className="p-5 space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {ev.sportCategory && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md border border-blue-200">
                                {ev.sportCategory === 'racket' ? 'Racket Sports' : ev.sportCategory === 'field' ? 'Field & Team' : ev.sportCategory === 'court' ? 'Court Sports' : 'Net Sports'}
                              </span>
                            )}
                          </div>
                          <h3 className="font-black text-base text-gray-900 leading-snug">{ev.name}</h3>
                          <div className="flex items-center space-x-2 text-xs text-gray-500 font-medium mt-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>
                              {formatDateShort(ev.startDate)} - {formatDateShort(ev.endDate)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-500 font-medium mt-1">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{ev.location || 'GOR Utama'}</span>
                          </div>
                        </div>

                        {/* STATS BADGES */}
                        <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Registrasi</p>
                            <p className="text-xs font-black text-emerald-600">
                              {ev.registrationFee > 0 ? formatRupiah(ev.registrationFee) : 'Gratis'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Prize Pool</p>
                            <p className="text-xs font-black text-amber-600">
                              {ev.prizePool > 0 ? formatRupiah(ev.prizePool) : '-'}
                            </p>
                          </div>
                        </div>

                        {/* ACCORDION TOGGLE BUTTON */}
                        <button
                          type="button"
                          onClick={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                          className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span>Lihat Detail Kategori &amp; Aksi</span>
                          {expandedEventId === ev.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {/* TOMBOL MASUK KE DASHBOARD EVENT (COMMAND CENTER) */}
                        <button
                          type="button"
                          onClick={() => setSelectedEventForDetail(ev)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold mt-4 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
                        >
                          <span>Masuk ke Dashboard Event ➔</span>
                        </button>

                        {/* EXPANDED ACCORDION CONTENT */}
                        {expandedEventId === ev.id && (() => {
                          // Ambil data kategori aktual dari sub-koleksi database atau array event.categories
                          const eventCats = eventCategories.filter((c) => c.eventId === ev.id);
                          const actualCategories = eventCats.length > 0
                            ? eventCats.map((cat) => ({
                                id: cat.id,
                                name: cat.name,
                                maxSlots: cat.maxSlots || 16,
                                registeredCount: eventRegistrations.filter((r) => r.categoryId === cat.id).length
                              }))
                            : (Array.isArray(ev.categories) && ev.categories.length > 0
                                ? ev.categories.map((cat) => ({
                                    id: cat.id || cat.name,
                                    name: typeof cat === 'string' ? cat : cat.name,
                                    maxSlots: cat.maxSlots || cat.quota || 16,
                                    registeredCount: cat.registeredCount || cat.participantsCount || 0
                                  }))
                                : []);

                          return (
                            <div className="pt-3 border-t border-slate-100 space-y-3 animate-fadeIn">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Kategori Pertandingan</p>
                                  {actualCategories.length > 0 && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                      {actualCategories.length} Kategori Aktif
                                    </span>
                                  )}
                                </div>

                                {actualCategories.length === 0 ? (
                                  <p className="text-sm text-slate-400 italic text-center py-2">
                                    Belum ada kategori pertandingan yang dikonfigurasi.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {actualCategories.map((kategori, idx) => (
                                      <div key={kategori.id || idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg text-xs border border-slate-100">
                                        <span className="font-bold text-gray-800">{kategori.name}</span>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                          {kategori.registeredCount || 0} / {kategori.maxSlots} Peserta
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEventForDetail(ev)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors text-center cursor-pointer"
                                >
                                  Kelola Bagan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedEventForDetail(ev)}
                                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors text-center cursor-pointer"
                                >
                                  Input Skor
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* CARD FOOTER */}
                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <select
                        value={ev.status}
                        onChange={(e) => handleQuickStatusChange(ev.id, e.target.value)}
                        className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 cursor-pointer focus:outline-none"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pendaftaran Buka">Pendaftaran Buka</option>
                        <option value="Berlangsung">Berlangsung</option>
                        <option value="Selesai">Selesai</option>
                      </select>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenEventModal(ev)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Event"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id, ev.name)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Event"
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

      {/* ==================================================== */}
      {/* TAB 2: MITRA & SPONSOR (CRM) */}
      {/* ==================================================== */}
      {activeTab === 'sponsors' && (
        <div className="space-y-6">
          {/* STATS SPONSORS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
                <Handshake className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Partner</p>
                <p className="text-xl font-black text-gray-900">{sponsors.length}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Potensi Nilai Sponsor</p>
                <p className="text-xs font-black text-blue-700 truncate">{formatRupiah(totalSponsorPotential)}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sponsor Deal Kontrak</p>
                <p className="text-xs font-black text-purple-700 truncate">{formatRupiah(totalSponsorDealLunas)}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
                <DanaSponsor3DIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Dana Cair (B2B)</p>
                <p className="text-xs font-black text-amber-700 truncate">{formatRupiah(totalSponsorPaid)}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tahap Negosiasi</p>
                <p className="text-xl font-black text-amber-600">
                  {sponsors.filter((s) => s.status === 'Negosiasi').length}
                </p>
              </div>
            </div>
          </div>

          {/* SPONSOR FILTERS & ACTIONS */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama perusahaan, kontak, kategori..."
                value={sponsorSearch}
                onChange={(e) => setSponsorSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={sponsorStatusFilter}
                onChange={(e) => setSponsorStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="Semua">Semua Status CRM</option>
                <option value="Negosiasi">Negosiasi</option>
                <option value="Deal">Deal</option>
                <option value="Lunas">Lunas</option>
              </select>

              <select
                value={sponsorEventFilter}
                onChange={(e) => setSponsorEventFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white text-gray-700 focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="Semua">Semua Event Terkait</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SPONSOR TABLE / CARDS */}
          {filteredSponsors.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <Handshake className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800">Belum Ada Mitra Sponsor</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Kelola proposisi sponsor untuk mendukung pendanaan turnamen Anda. Catat status negosiasi hingga penerimaan dana sponsor.
              </p>
              <button
                onClick={() => handleOpenSponsorModal()}
                className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Mitra Sponsor Baru</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Brand / Perusahaan</th>
                      <th className="py-3.5 px-4">Event Terkait</th>
                      <th className="py-3.5 px-4">Kategori Sponsor</th>
                      <th className="py-3.5 px-4 text-right">Nilai Kontrak</th>
                      <th className="py-3.5 px-4 text-center">Pembayaran (B2B)</th>
                      <th className="py-3.5 px-4">Status CRM</th>
                      <th className="py-3.5 px-4">Contact Person / WA</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                    {filteredSponsors.map((sp) => {
                      const waClean = (sp.whatsappNumber || '').replace(/\D/g, '');
                      const waUrl = waClean
                        ? `https://wa.me/${waClean.startsWith('0') ? '62' + waClean.slice(1) : waClean}`
                        : null;

                      return (
                        <tr key={sp.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                                {sp.companyName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{sp.companyName}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                              {sp.eventName || 'Sponsor Global'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                sp.category === 'Sponsor Utama'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : sp.category === 'Gold'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : sp.category === 'Silver'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {sp.category}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                            {formatRupiah(sp.contractValue)}
                          </td>

                          {/* STATUS PEMBAYARAN B2B (FASE 12 PART 1, 2, & 3) */}
                          <td className="py-3.5 px-4 min-w-[200px]">
                            {(() => {
                              const cVal = Number(sp.contractValue || 0);
                              const tPaid = Number(sp.totalPaid || 0);
                              const pPending = Number(sp.pendingAmount || 0);
                              const rem = Math.max(0, cVal - tPaid);
                              const pct = cVal > 0 ? Math.min(100, Math.round((tPaid / cVal) * 100)) : 0;
                              const isPaid = tPaid >= cVal && cVal > 0;

                              return (
                                <div className="space-y-1.5">
                                  {/* Persentase Pembayaran */}
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-gray-700">
                                      {pct}%
                                    </span>
                                    {pPending > 0 ? (
                                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        Giro: {formatRupiah(pPending)}
                                      </span>
                                    ) : (
                                      <span className={`text-[10px] font-bold ${isPaid ? 'text-green-600' : 'text-gray-400'}`}>
                                        {isPaid ? 'Lunas' : 'Termin Berjalan'}
                                      </span>
                                    )}
                                  </div>

                                  {/* Progress Bar HTML/Tailwind */}
                                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200/80">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isPaid
                                          ? 'bg-green-500'
                                          : pct > 0
                                          ? 'bg-blue-500'
                                          : 'bg-gray-300'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>

                                  {/* Nominal: Rp X masuk / Rp Y sisa */}
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span className="font-semibold text-emerald-700">
                                      {formatRupiah(tPaid)} masuk
                                    </span>
                                    <span className="text-gray-300">/</span>
                                    <span className={rem > 0 ? 'font-semibold text-rose-600' : 'text-gray-400'}>
                                      {rem === 0 ? 'Rp 0 sisa' : `${formatRupiah(rem)} sisa`}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>

                          {/* STATUS CRM (BADGE STATIS DINAMIS - FASE 12 PART 3) */}
                          <td className="py-3.5 px-4">
                            {(() => {
                              const cVal = Number(sp.contractValue || 0);
                              const tPaid = Number(sp.totalPaid || 0);
                              let crmStatus = sp.status || 'Negosiasi';
                              if (tPaid >= cVal && cVal > 0) {
                                crmStatus = 'Lunas';
                              } else if (tPaid > 0) {
                                crmStatus = 'Deal';
                              }

                              const badgeColor =
                                crmStatus === 'Lunas'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : crmStatus === 'Deal'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : 'bg-orange-100 text-orange-700 border-orange-200';

                              return (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
                                  {crmStatus}
                                </span>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-semibold text-gray-800">{sp.contactPerson || '-'}</p>
                              <p className="text-[10px] text-gray-500">{sp.whatsappNumber || '-'}</p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              {/* TOMBOL CATAT PEMBAYARAN TERMIN */}
                              <button
                                type="button"
                                onClick={() => setPaymentModalSponsor(sp)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-xs border border-amber-200 flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs shrink-0"
                                title="Catat Pembayaran Termin (B2B)"
                              >
                                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                                <span>Catat Bayar</span>
                              </button>

                              {/* TOMBOL CETAK INVOICE / FAKTUR (FASE 12 PART 3) */}
                              <button
                                type="button"
                                onClick={() => handlePrintInvoice(sp)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="Cetak Invoice"
                              >
                                <FileText className="w-4 h-4 text-indigo-600" />
                              </button>

                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Chat WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={() => handleOpenSponsorModal(sp)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Sponsor"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSponsor(sp.id, sp.companyName)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Sponsor"
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
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: REGULASI & DOKUMEN */}
      {/* ==================================================== */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS FOR DOCUMENTS */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari judul dokumen, jenis, regulasi..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="w-full md:w-auto">
              <select
                value={docEventFilter}
                onChange={(e) => setDocEventFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white text-gray-700 focus:outline-none cursor-pointer w-full md:w-auto"
              >
                <option value="Semua">Semua Event Terkait</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* DOCUMENTS GRID */}
          {filteredDocs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800">Belum Ada Dokumen Regulasi</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Tambahkan Technical Handbook, Peraturan Pertandingan, Formulir Bebas Cedera, atau Jadwal Fixture untuk peserta turnamen.
              </p>
              <button
                onClick={() => handleOpenDocModal()}
                className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Dokumen Regulasi Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map((dc) => (
                <div
                  key={dc.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                        {dc.documentType}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-gray-900 leading-snug line-clamp-2">{dc.title}</h4>
                      <p className="text-[11px] text-gray-500 font-semibold mt-1">
                        Event: <span className="text-gray-800">{dc.eventName}</span>
                      </p>
                    </div>

                    {dc.contentSummary && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 line-clamp-3">
                        {dc.contentSummary}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    {dc.fileUrl ? (
                      <a
                        href={dc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <span>Buka / Download Link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">Tanpa Link File</span>
                    )}

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenDocModal(dc)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Dokumen"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(dc.id, dc.title)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: BUAT / EDIT EVENT (3-STEP SETUP WIZARD)     */}
      {/* ==================================================== */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto my-auto flex flex-col justify-between">
            <div>
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-gray-900">
                      {editingEvent ? 'Edit Event Turnamen' : 'Event Setup Wizard'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      {step === 1 && 'Langkah 1 dari 3: Pilih Kategori Olahraga'}
                      {step === 2 && 'Langkah 2 dari 3: Pilih Format Pertandingan / Turnamen'}
                      {step === 3 && 'Langkah 3 dari 3: Detail Informasi Event & Fasilitas'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 3-STEP PROGRESS BAR / INDICATOR */}
              <div className="pt-4 pb-2">
                <div className="grid grid-cols-3 gap-2.5">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      step >= 1 ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                  <div
                    className={`h-2 rounded-full transition-all ${
                      step >= 2 ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                  <div
                    className={`h-2 rounded-full transition-all ${
                      step >= 3 ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-3 text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider text-center">
                  <span className={step === 1 ? 'text-blue-600 font-black' : step > 1 ? 'text-slate-700' : ''}>
                    1. Kategori Olahraga
                  </span>
                  <span className={step === 2 ? 'text-blue-600 font-black' : step > 2 ? 'text-slate-700' : ''}>
                    2. Format Turnamen
                  </span>
                  <span className={step === 3 ? 'text-blue-600 font-black' : ''}>
                    3. Detail &amp; Fasilitas
                  </span>
                </div>
              </div>

              {/* FORM CONTAINER */}
              <form onSubmit={handleSaveEvent} className="pt-3 space-y-4">
                {/* ---------------------------------------------------- */}
                {/* STEP 1: PILIH KATEGORI OLAHRAGA                      */}
                {/* ---------------------------------------------------- */}
                {step === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="border-b border-gray-100 pb-2">
                      <h4 className="text-sm font-black text-slate-900">
                        Langkah 1: Pilih Kategori Olahraga
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pilih rumpun cabang olahraga turnamen yang sesuai dengan fasilitas arena Anda.
                      </p>
                    </div>

                    {/* GRID 2x2 KATEGORI OLAHRAGA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {SPORT_CATEGORIES.map((cat) => {
                        const IconComponent = cat.icon;
                        const isSelected = sportCategory === cat.id;

                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setSportCategory(cat.id);
                              if (!cat.sports.includes(eventForm.sport)) {
                                setEventForm((prev) => ({ ...prev, sport: cat.defaultSport }));
                                setSelectedCourts([]);
                              }
                            }}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left group ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-slate-50/70 shadow-xs'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                                  }`}
                                >
                                  <IconComponent className="w-5 h-5" />
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-gray-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>

                              <h5 className="font-black text-sm text-slate-900">{cat.title}</h5>
                              <p className="text-[11px] font-bold text-blue-600 mt-0.5">
                                {cat.subtitle}
                              </p>
                              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                {cat.description}
                              </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                              <span>Cabang: {cat.sports.join(', ')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* STEP 2: PILIH FORMAT TURNAMEN                        */}
                {/* ---------------------------------------------------- */}
                {step === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="border-b border-gray-100 pb-2">
                      <h4 className="text-sm font-black text-slate-900">
                        Langkah 2: Pilih Format Pertandingan / Turnamen
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tentukan bagan dan sistem kompetisi yang akan diterapkan untuk turnamen ini.
                      </p>
                    </div>

                    {/* FORMAT OPTIONS CARDS */}
                    <div className="space-y-3 pt-1">
                      {TOURNAMENT_FORMATS.map((fmt) => {
                        const IconComponent = fmt.icon;
                        const isSelected = tournamentFormat === fmt.id;

                        return (
                          <div
                            key={fmt.id}
                            onClick={() => setTournamentFormat(fmt.id)}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 text-left group ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-slate-50/70 shadow-xs'
                            }`}
                          >
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                              }`}
                            >
                              <IconComponent className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-black text-sm text-slate-900">{fmt.title}</h5>
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-md">
                                    {fmt.tag}
                                  </span>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-gray-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>

                              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                {fmt.description}
                              </p>
                              <p className="text-[11px] text-blue-600 font-semibold mt-1">
                                {fmt.subtitle}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* STEP 3: INFORMASI UMUM & FASILITAS                   */}
                {/* ---------------------------------------------------- */}
                {step === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="border-b border-gray-100 pb-2">
                      <h4 className="text-sm font-black text-slate-900">
                        Langkah 3: Detail Informasi Event
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lengkapi nama turnamen, jadwal tanggal, alokasi lapangan, dan biaya pendaftaran.
                      </p>
                    </div>

                    {/* SUMMARY PILLS OF PREVIOUS CHOICES */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 font-bold text-blue-900">
                          <Trophy className="w-4 h-4 text-blue-600" />
                          <span>
                            {SPORT_CATEGORIES.find((c) => c.id === sportCategory)?.title || 'Racket Sports'}
                          </span>
                        </div>
                        <span className="text-blue-300">•</span>
                        <div className="flex items-center gap-1.5 font-bold text-blue-800">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span>
                            {TOURNAMENT_FORMATS.find((f) => f.id === tournamentFormat)?.title || 'Single Elimination'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-blue-700 hover:text-blue-900 font-black underline cursor-pointer text-[11px]"
                      >
                        Ubah Kategori/Format
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. NAMA EVENT / TURNAMEN */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Nama Event / Turnamen *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Chua Open Championship 2026"
                          value={eventForm.name}
                          onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* 2. SPESIFIKASI CABANG OLAHRAGA */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Spesifikasi Cabang Olahraga *
                        </label>
                        <select
                          value={eventForm.sport}
                          onChange={(e) => {
                            setEventForm({ ...eventForm, sport: e.target.value });
                            setSelectedCourts([]);
                          }}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                        >
                          {(sportOptions[sportCategory] || []).map((sport) => (
                            <option key={sport} value={sport}>
                              {sport}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. STATUS EVENT */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Status Event
                        </label>
                        <select
                          value={eventForm.status}
                          onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Pendaftaran Buka">Pendaftaran Buka</option>
                          <option value="Berlangsung">Berlangsung</option>
                          <option value="Selesai">Selesai</option>
                        </select>
                      </div>

                      {/* 4. TANGGAL MULAI */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Tanggal Mulai *
                        </label>
                        <input
                          type="date"
                          required
                          value={eventForm.startDate}
                          onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* 5. TANGGAL SELESAI */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Tanggal Selesai *
                        </label>
                        <input
                          type="date"
                          required
                          value={eventForm.endDate}
                          onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* 6. MULTI-SELECT LAPANGAN TURNAMEN */}
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Pilih Lapangan Turnamen ({eventForm.sport}) *
                          </label>
                          <span className="text-[10px] text-gray-500 font-semibold">
                            {selectedCourts.length} Lapangan Dipilih (Auto-Lock Booking)
                          </span>
                        </div>

                        {filteredCourtsForEvent.length === 0 ? (
                          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
                            <p className="text-xs font-bold text-amber-800">
                              Tidak ada lapangan khusus cabang "{eventForm.sport}".
                            </p>
                            <p className="text-[11px] text-amber-700">
                              Anda dapat memilih dari daftar seluruh lapangan yang tersedia di arena:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                              {courts.map((court) => {
                                const isSelected = selectedCourts.some((item) => item.courtId === court.id);
                                return (
                                  <button
                                    key={court.id}
                                    type="button"
                                    onClick={() => handleCourtToggle(court)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-50 border-blue-600 text-blue-600 shadow-xs'
                                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span className="truncate">{court.name}</span>
                                    <div
                                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                                        isSelected
                                          ? 'bg-blue-600 border-blue-600 text-white'
                                          : 'border-gray-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto p-1">
                            {filteredCourtsForEvent.map((court) => {
                              const isSelected = selectedCourts.some((item) => item.courtId === court.id);
                              return (
                                <button
                                  key={court.id}
                                  type="button"
                                  onClick={() => handleCourtToggle(court)}
                                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-600 text-blue-600 shadow-xs'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="truncate">{court.name}</span>
                                  <div
                                    className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                                      isSelected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-gray-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 7. BIAYA REGISTRASI */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Biaya Registrasi / Slot (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Kosongkan jika gratis"
                          value={eventForm.registrationFee}
                          onChange={(e) => setEventForm({ ...eventForm, registrationFee: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* 8. TOTAL SLOT PESERTA */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Total Slot Peserta / Tim
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Contoh: 16"
                          value={eventForm.totalSlots}
                          onChange={(e) => setEventForm({ ...eventForm, totalSlots: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* 9. TOTAL HADIAH / PRIZE POOL (RP) */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Total Hadiah / Prize Pool (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Contoh: 10000000"
                          value={eventForm.prizePool}
                          onChange={(e) => setEventForm({ ...eventForm, prizePool: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* 10. DESKRIPSI EVENT */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                          Deskripsi Event
                        </label>
                        <textarea
                          rows="2"
                          placeholder="Catatan umum, kategori umur, atau kelompok turnamen..."
                          value={eventForm.description}
                          onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        ></textarea>
                      </div>

                      {/* 11. BANNER / POSTER EVENT */}
                      <div className="md:col-span-2 p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Banner / Poster Event (Upload Image)
                          </label>
                          {posterPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setPosterFile(null);
                                setPosterPreview('');
                                setEventPosterBase64('');
                                setEventForm((prev) => ({ ...prev, posterUrl: '', bannerUrl: '' }));
                              }}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hapus Banner</span>
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePosterFileChange}
                          disabled={isSavingEvent || isUploadingPoster}
                          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                        />
                        {posterPreview && (
                          <div className="relative h-32 w-full rounded-xl overflow-hidden border border-gray-300 shadow-2xs">
                            <img src={posterPreview} alt="Poster Preview" className="w-full h-full object-cover" />
                            {isUploadingPoster && (
                              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white gap-1.5">
                                <Loader2 className="w-6 h-6 animate-spin text-white" />
                                <span className="text-xs font-bold">Mengunggah gambar ke Cloudinary...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL FOOTER BUTTONS WITH 3-STEP FLOW */}
                <div className="pt-4 flex items-center justify-between space-x-3 border-t border-gray-100 mt-4">
                  {step === 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEventModalOpen(false)}
                        className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        disabled={!sportCategory}
                        onClick={handleStep1Next}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 cursor-pointer transition-all"
                      >
                        <span>Selanjutnya</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <button
                        type="button"
                        onClick={handleStep2Back}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Kembali</span>
                      </button>

                      <button
                        type="button"
                        disabled={!tournamentFormat}
                        onClick={handleStep2Next}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 cursor-pointer transition-all"
                      >
                        <span>Selanjutnya</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <button
                        type="button"
                        onClick={handleStep3Back}
                        disabled={isSavingEvent || isUploadingPoster}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer transition-all disabled:opacity-50"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Kembali</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingEvent || isUploadingPoster}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 cursor-pointer disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {isUploadingPoster ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Mengunggah gambar...</span>
                          </>
                        ) : isSavingEvent ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Menyimpan Event...</span>
                          </>
                        ) : editingEvent ? (
                          'Simpan Perubahan'
                        ) : (
                          'Simpan & Buat Event'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: BUAT / EDIT SPONSOR */}
      {/* ==================================================== */}
      {isSponsorModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <Handshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-gray-900">
                    {editingSponsor ? 'Edit Data Sponsor' : 'Tambah Mitra / Sponsor Baru'}
                  </h3>
                  <p className="text-xs text-gray-500">Catat komitmen sponsor dan nomor kontak brand partner.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSponsorModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSponsor} className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Perusahaan */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nama Perusahaan / Brand *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Yonex Sunrise Indonesia"
                  value={sponsorForm.companyName}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, companyName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Event Terkait (Dynamic Mapping) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Event Terkait
                </label>
                <select
                  value={sponsorForm.eventId}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, eventId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer bg-white"
                >
                  <option value="">Sponsor Global (Semua Event)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              {/* Kategori Sponsor */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Kategori Sponsor *
                </label>
                <select
                  value={sponsorForm.category}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer bg-white"
                >
                  <option value="Sponsor Utama">Sponsor Utama (Title Sponsor)</option>
                  <option value="Gold">Gold Partner</option>
                  <option value="Silver">Silver Partner</option>
                  <option value="Official Partner">Official Partner</option>
                  <option value="Media Partner">Media Partner</option>
                </select>
              </div>

              {/* Status CRM Deal */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Status CRM Deal
                </label>
                <select
                  value={sponsorForm.status}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer bg-white"
                >
                  <option value="Negosiasi">Negosiasi</option>
                  <option value="Deal">Deal</option>
                  <option value="Lunas">Lunas</option>
                </select>
              </div>

              {/* Nilai Kontrak */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nilai Kontrak / Sponsorship (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="5000000"
                  value={sponsorForm.contractValue}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, contractValue: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Bpk. Hendra S."
                  value={sponsorForm.contactPerson}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, contactPerson: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* No. WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  No. WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  placeholder="081234567890"
                  value={sponsorForm.whatsappNumber}
                  onChange={(e) => setSponsorForm({ ...sponsorForm, whatsappNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* ACTIONS */}
              <div className="md:col-span-2 pt-4 flex items-center justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSponsorModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSponsor}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSponsor ? 'Menyimpan...' : editingSponsor ? 'Simpan Perubahan' : 'Simpan Mitra Sponsor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: BUAT / EDIT DOKUMEN */}
      {/* ==================================================== */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-gray-900">
                    {editingDoc ? 'Edit Dokumen Regulasi' : 'Tambah Dokumen Regulasi Baru'}
                  </h3>
                  <p className="text-xs text-gray-500">Unggah petunjuk teknis atau peraturan pertandingan turnamen.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDocModalOpen(false);
                  setDocFile(null);
                }}
                disabled={isSavingDoc || isUploadingDoc}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-4">
              {/* Judul Dokumen */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nama / Judul Dokumen *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Technical Handbook & Peraturan Pertandingan"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Event Terkait & Jenis Dokumen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Event Terkait *
                  </label>
                  <select
                    required
                    value={docForm.eventId}
                    onChange={(e) => setDocForm({ ...docForm, eventId: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                  >
                    <option value="" disabled>Pilih Event</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Tipe Dokumen
                  </label>
                  <select
                    value={docForm.documentType}
                    onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                  >
                    <option value="Technical Handbook">Technical Handbook</option>
                    <option value="Peraturan Pertandingan">Peraturan Pertandingan</option>
                    <option value="Formulir Pendaftaran">Formulir Pendaftaran</option>
                    <option value="Bagan / Fixture">Bagan / Fixture</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Unggah Dokumen (PDF, Word) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Unggah Dokumen (PDF, Word) {!editingDoc && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDocFile(e.target.files[0]);
                    }
                  }}
                  disabled={isSavingDoc || isUploadingDoc}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer bg-white"
                />
                {docFile ? (
                  <p className="mt-1.5 text-[11px] text-green-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">File terpilih: {docFile.name} ({(docFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </p>
                ) : docForm.fileUrl ? (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                    <span className="text-gray-600 truncate mr-2">
                      Dokumen terunggah: <strong className="text-gray-800">{docForm.fileName || 'Dokumen Regulasi'}</strong>
                    </span>
                    <a
                      href={docForm.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Lihat File</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Format didukung: PDF (.pdf), Word (.doc, .docx). File akan diunggah otomatis ke Cloudinary saat disimpan.
                  </p>
                )}
              </div>

              {/* Ringkasan / Peraturan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ringkasan / Teks Poin Peraturan
                </label>
                <textarea
                  rows="3"
                  placeholder="Ringkasan poin utama peraturan pertandingan..."
                  value={docForm.contentSummary}
                  onChange={(e) => setDocForm({ ...docForm, contentSummary: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                ></textarea>
              </div>

              {/* ACTIONS */}
              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDocModalOpen(false);
                    setDocFile(null);
                  }}
                  disabled={isSavingDoc || isUploadingDoc}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingDoc || isUploadingDoc}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {(isSavingDoc || isUploadingDoc) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isUploadingDoc
                      ? 'Mengunggah...'
                      : isSavingDoc
                      ? 'Menyimpan...'
                      : editingDoc
                      ? 'Simpan Perubahan'
                      : 'Simpan Dokumen'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT DETAIL & PARTICIPANTS MODAL */}
      {isDetailModalOpen && selectedDetailEvent && (
        <EventDetailModal
          event={selectedDetailEvent}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDetailEvent(null);
          }}
          userProfile={userProfile}
        />
      )}

      {/* MODAL 4: CATAT PEMBAYARAN TERMIN SPONSOR (B2B) */}
      {paymentModalSponsor && (
        <SponsorPaymentModal
          isOpen={Boolean(paymentModalSponsor)}
          onClose={() => setPaymentModalSponsor(null)}
          sponsor={paymentModalSponsor}
          tenantId={tenantId}
          tenantProfile={tenantProfile}
          userProfile={userProfile}
          onPaymentSuccess={() => {
            setPaymentModalSponsor(null);
          }}
        />
      )}
    </div>
  );
}
