import React, { useState } from 'react';
import { 
  Bell, 
  Settings, 
  Trophy, 
  Users, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Filter,
  ArrowLeft
} from 'lucide-react';
import {
  MobilePage,
  MobileHeader,
  MobileSectionHeader,
  MobileCard,
  MobilePrimaryButton,
  MobileSecondaryButton,
  MobileIconButton,
  MobileInput,
  MobileSearchBar,
  MobileBadge,
  MobileAvatar,
  MobileListItem,
  MobileEmptyState,
  MobileLoadingState,
  MobileBottomSheet,
  MobileModal,
  MobileToast
} from './index';

export default function MobileDesignSystemPreview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('Kediri Sports Center');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', variant: 'info' });
  const [isLoading, setIsLoading] = useState(false);

  const triggerToast = (message, variant = 'info') => {
    setToast({ open: true, message, variant });
  };

  const handleSimulateLoad = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      triggerToast('Data sampel berhasil dimuat', 'success');
    }, 1500);
  };

  return (
    <MobilePage>
      {/* Toast Notification */}
      <MobileToast
        isOpen={toast.open}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        message={toast.message}
        variant={toast.variant}
      />

      {/* Header */}
      <MobileHeader
        title="CHUVATOR Mobile"
        subtitle="Phase 1 Design System Foundation"
        leftAction={<MobileIconButton icon={<ArrowLeft className="w-5 h-5" />} ariaLabel="Kembali" onClick={() => window.history.back()} />}
        rightAction={
          <>
            <MobileIconButton icon={<Bell className="w-5 h-5" />} ariaLabel="Notifikasi" onClick={() => triggerToast('3 Notifikasi baru', 'info')} />
            <MobileIconButton icon={<Settings className="w-5 h-5" />} ariaLabel="Pengaturan" onClick={() => setIsSheetOpen(true)} />
          </>
        }
      />

      {/* Hero Overview Card */}
      <MobileSectionHeader title="Status System Tokens" icon={<Trophy className="w-5 h-5 text-emerald-600" />} />
      <MobileCard>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <MobileAvatar name="Chuvator Arena" size="lg" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 my-0">CHUVATOR Mobile v1.0</h3>
              <p className="text-xs text-slate-500 my-0 mt-0.5">Isolated Design Tokens &amp; Component Foundation</p>
            </div>
          </div>
          <MobileBadge variant="emerald">ISOLATED</MobileBadge>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Sistem komponen mobile terisolasi khusus di bawah scope <code className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded">.chua-mobile-app</code> tanpa mengubah UI desktop.
        </p>
        <div className="flex items-center gap-2">
          <MobileBadge variant="blue">Navy: #101D38</MobileBadge>
          <MobileBadge variant="emerald">Blue: #2455E8</MobileBadge>
          <MobileBadge variant="warning">Emerald: #16A779</MobileBadge>
        </div>
      </MobileCard>

      {/* Search & Inputs */}
      <MobileSectionHeader title="Mobile Input & Search" icon={<Filter className="w-5 h-5 text-blue-600" />} />
      <MobileCard>
        <MobileSearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Cari atlet, jadwal, atau pesanan..."
        />
        <MobileInput
          label="Nama Fasilitas Olahraga"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Masukkan nama arena..."
          helperText="Maksimal 50 karakter"
        />
        <MobileInput
          label="Email Penanggung Jawab"
          value="manager@chuasport.com"
          readOnly
          error={null}
        />
      </MobileCard>

      {/* Interactive Action Buttons */}
      <MobileSectionHeader title="Mobile Button System" />
      <div className="space-y-3 mb-6">
        <MobilePrimaryButton onClick={() => setIsModalOpen(true)}>
          Buka Mobile Modal Dialog
        </MobilePrimaryButton>
        <MobileSecondaryButton onClick={() => setIsSheetOpen(true)}>
          Buka Mobile Bottom Sheet
        </MobileSecondaryButton>
        <div className="flex items-center gap-2">
          <MobilePrimaryButton
            className="flex-1"
            loading={isLoading}
            onClick={handleSimulateLoad}
          >
            Simulasi Loading State
          </MobilePrimaryButton>
          <MobileIconButton
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            ariaLabel="Aksi Cepat"
            onClick={() => triggerToast('Aksi cepat berhasil dijalankan!', 'success')}
          />
        </div>
      </div>

      {/* List Items */}
      <MobileSectionHeader title="Mobile List Items" icon={<Users className="w-5 h-5 text-blue-600" />} />
      <MobileCard className="p-0 overflow-hidden">
        <MobileListItem
          title="Tawang Basketball Academy"
          subtitle="24 Atlet Aktif · Pelatih: Coach Rizky"
          leftElement={<MobileAvatar name="Tawang Academy" size="md" />}
          rightElement={<MobileBadge variant="blue">AKADEMI</MobileBadge>}
          showChevron
          onClick={() => triggerToast('Membuka detail Tawang Academy', 'info')}
        />
        <MobileListItem
          title="Booking Lapangan Badminton #2"
          subtitle="Hari ini, 19:00 - 21:00 WIB"
          leftElement={<Calendar className="w-5 h-5 text-blue-600" />}
          rightElement={<MobileBadge variant="emerald">LUNAS</MobileBadge>}
          showChevron
          onClick={() => triggerToast('Membuka detail booking', 'info')}
        />
        <MobileListItem
          title="Tagihan SPP Bulan November"
          subtitle="Jatuh tempo: 15 November 2026"
          leftElement={<AlertCircle className="w-5 h-5 text-amber-500" />}
          rightElement={<MobileBadge variant="warning">PENDING</MobileBadge>}
          showChevron
          onClick={() => triggerToast('Membuka rincian SPP', 'warning')}
        />
      </MobileCard>

      {/* Loading & Empty States */}
      <MobileSectionHeader title="Mobile State Components" />
      {isLoading ? (
        <MobileLoadingState message="Memuat sampel data komponen..." />
      ) : (
        <MobileEmptyState
          title="Contoh Empty State Foundational"
          description="Komponen ini siap digunakan di modul mobile mana pun jika data belum tersedia."
          action={
            <MobilePrimaryButton className="w-auto px-6 mt-2" onClick={() => triggerToast('Tombol aksi empty state diklik', 'success')}>
              Tambah Data Baru
            </MobilePrimaryButton>
          }
        />
      )}

      {/* Bottom Sheet Drawer */}
      <MobileBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Pengaturan Mobile Shell"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 my-0">
            Ini adalah contoh <code className="text-blue-600 font-mono">MobileBottomSheet</code> dengan drag handle, rounded top 28px, dan area scroll terisolasi.
          </p>
          <MobileListItem
            title="Opsi Otorisasi User"
            subtitle="Multi-Tenant Scope Enabled"
            leftElement={<Users className="w-5 h-5 text-slate-600" />}
            showChevron
            onClick={() => triggerToast('Setelan Otorisasi', 'info')}
          />
          <MobilePrimaryButton onClick={() => setIsSheetOpen(false)}>
            Tutup Sheet
          </MobilePrimaryButton>
        </div>
      </MobileBottomSheet>

      {/* Center Modal Dialog */}
      <MobileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Konfirmasi Komponen Modal"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 my-0">
            Ini adalah <code className="text-blue-600 font-mono">MobileModal</code> terisolasi yang aman digunakan di HP tanpa mengganggu layout desktop.
          </p>
          <div className="flex gap-2">
            <MobileSecondaryButton onClick={() => setIsModalOpen(false)}>
              Batal
            </MobileSecondaryButton>
            <MobilePrimaryButton
              onClick={() => {
                setIsModalOpen(false);
                triggerToast('Konfirmasi modal berhasil!', 'success');
              }}
            >
              Ya, Konfirmasi
            </MobilePrimaryButton>
          </div>
        </div>
      </MobileModal>
    </MobilePage>
  );
}
