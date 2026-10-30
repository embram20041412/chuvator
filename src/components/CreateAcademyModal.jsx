import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as supabaseAcademyService from '../services/supabaseAcademyService';
import { X, School, Trophy, Layers, Sparkles, Plus, Check } from 'lucide-react';
import { sportCategoryOptions } from '../pages/AcademyPage';

// Quick sport shortcut options for 1-click selection
const QUICK_SPORTS = [
  { sport: 'Tenis', label: 'Tenis (Tennis)', category: 'racket', icon: '🎾' },
  { sport: 'Badminton', label: 'Badminton', category: 'racket', icon: '🏸' },
  { sport: 'Futsal', label: 'Futsal', category: 'field', icon: '⚽' },
  { sport: 'SepakBola', label: 'Sepak Bola', category: 'field', icon: '⚽' },
  { sport: 'Minisoccer', label: 'Minisoccer', category: 'field', icon: '⚽' },
  { sport: 'BolaBasket 5v5', label: 'Bola Basket', category: 'court', icon: '🏀' },
  { sport: 'Bola Voli indoor', label: 'Bola Voli', category: 'net', icon: '🏐' }
];

export default function CreateAcademyModal({ isOpen, onClose, userProfile, onAcademyCreated }) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('racket');
  const [sport, setSport] = useState('Tenis');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Auto-detect sport from academy name when typing
  const handleNameChange = (val) => {
    setName(val);
    const lower = val.toLowerCase();
    if ((lower.includes('tenis') || lower.includes('tennis')) && !lower.includes('meja') && !lower.includes('table')) {
      if (sport !== 'Tenis') {
        setCategory('racket');
        setSport('Tenis');
      }
    } else if (lower.includes('badminton') || lower.includes('bulutangkis') || lower.includes('bulu tangkis')) {
      if (sport !== 'Badminton') {
        setCategory('racket');
        setSport('Badminton');
      }
    } else if (lower.includes('futsal')) {
      if (sport !== 'Futsal') {
        setCategory('field');
        setSport('Futsal');
      }
    } else if (lower.includes('minisoccer') || lower.includes('mini soccer')) {
      if (sport !== 'Minisoccer') {
        setCategory('field');
        setSport('Minisoccer');
      }
    } else if (lower.includes('sepakbola') || lower.includes('sepak bola') || lower.includes('football') || lower.includes('soccer')) {
      if (sport !== 'SepakBola') {
        setCategory('field');
        setSport('SepakBola');
      }
    }
  };

  const handleSelectQuickSport = (quick) => {
    setCategory(quick.category);
    setSport(quick.sport);
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Sync specific sport dropdown when sport category changes
  useEffect(() => {
    const catObj = sportCategoryOptions.find((c) => c.id === category);
    if (catObj && catObj.sports.length > 0) {
      if (!catObj.sports.includes(sport)) {
        setSport(catObj.sports[0]);
      }
    }
  }, [category]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama akademi wajib diisi.');
      return;
    }

    if (!tenantId) {
      setErrorMsg('Sesi pengguna tidak valid. Silakan muat ulang halaman.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const newAcad = await supabaseAcademyService.createAcademy({
        tenantId,
        name: name.trim(),
        category,
        sport,
        description: description.trim()
      });

      const newId = newAcad.id;
      setName('');
      setDescription('');
      if (onAcademyCreated) {
        onAcademyCreated(newId, name.trim());
      }
      onClose();
    } catch (err) {
      console.error('Error creating academy:', err);
      setErrorMsg('Gagal membuat akademi baru. Silakan periksa koneksi internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategoryObj = sportCategoryOptions.find((c) => c.id === category) || sportCategoryOptions[0];

  const modalContent = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Decorative Sporty Gradient Bar */}
        <div className="h-2 bg-gradient-to-r from-[#354944] via-[#2B3D38] to-[#C89D32]" />

        {/* Modal Header (Sticky) */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#354944] text-[#C89D32] flex items-center justify-center font-bold shrink-0 border border-[#C89D32]/30 shadow-2xs">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 tracking-tight">Buat Ruang Akademi Baru</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pilih Cabang Olahraga Spesifik (Tenis, Badminton, Futsal, dll.)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-left">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Sport Selector Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Pilihan Cepat Cabang Olahraga
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SPORTS.map((qs) => {
                const isSelected = sport === qs.sport;
                return (
                  <button
                    key={qs.sport}
                    type="button"
                    onClick={() => handleSelectQuickSport(qs)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{qs.icon}</span>
                    <span>{qs.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-[#C89D32] ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input 1: Nama Akademi */}
          <div>
            <label htmlFor="academyName" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Akademi <span className="text-rose-500">*</span>
            </label>
            <input
              id="academyName"
              name="academyName"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Misal: Akademi Tenis Junior, Cilandak Tennis School"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#354944] focus:border-[#354944] transition-all"
            />
          </div>

          {/* Input 2: Kategori Olahraga */}
          <div>
            <label htmlFor="academyCategory" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Kategori Olahraga <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-[#354944] dark:text-[#C89D32] font-extrabold normal-case">Kelompok Format</span>
            </label>
            <select
              id="academyCategory"
              name="academyCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#354944] focus:border-[#354944] transition-all cursor-pointer"
            >
              {sportCategoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Input 3: Cabang Olahraga Spesifik (Dinamis berdasarkan Kategori) */}
          <div>
            <label htmlFor="academySport" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Cabang Olahraga Spesifik <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-[#354944] dark:text-[#C89D32] font-extrabold normal-case">
                Tersinkron ke Profil: <strong>{sport}</strong>
              </span>
            </label>
            <select
              id="academySport"
              name="academySport"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#354944] focus:border-[#354944] transition-all cursor-pointer"
            >
              {currentCategoryObj.sports.map((sp) => (
                <option key={sp} value={sp}>
                  {sp} {sp === 'Tenis' ? '(Tennis Court)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Input 4: Deskripsi Singkat */}
          <div>
            <label htmlFor="academyDescription" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Deskripsi Singkat <span className="text-slate-400 font-normal">(Opsional)</span>
            </label>
            <textarea
              id="academyDescription"
              name="academyDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Misal: Sekolah pembinaan bakat tenis lapangan usia dini U-10 hingga atlet turnamen junior."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#354944] focus:border-[#354944] transition-all"
            />
          </div>
          </div>

          {/* Action Buttons (Sticky Footer) */}
          <div className="p-4 sm:p-5 flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-[#C89D32]" />
                  <span>Simpan &amp; Aktifkan ({sport})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
