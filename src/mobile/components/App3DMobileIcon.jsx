import React from 'react';

/**
 * 3D Claymorphic Mobile Icons mapping
 * Extracted directly from official design asset sheet
 */
export const ICON_3D_MAP = {
  beranda: '/icons/3d/beranda.png',
  home: '/icons/3d/beranda.png',
  booking: '/icons/3d/booking.png',
  jadwal: '/icons/3d/booking.png',
  akademi: '/icons/3d/akademi.png',
  academy: '/icons/3d/akademi.png',
  kasir: '/icons/3d/kasir.png',
  pos: '/icons/3d/kasir.png',
  siswa: '/icons/3d/siswa.png',
  student: '/icons/3d/siswa.png',
  spp: '/icons/3d/spp.png',
  presensi: '/icons/3d/presensi.png',
  attendance: '/icons/3d/presensi.png',
  evaluasi: '/icons/3d/evaluasi.png',
  evaluation: '/icons/3d/evaluasi.png',
  event: '/icons/3d/event.png',
  events: '/icons/3d/event.png',
  turnamen: '/icons/3d/event.png',
  keuangan: '/icons/3d/keuangan.png',
  finance: '/icons/3d/keuangan.png',
  ai_insight: '/icons/3d/ai_insight.png',
  intelligence: '/icons/3d/ai_insight.png',
  wali_murid: '/icons/3d/wali_murid.png',
  parents: '/icons/3d/wali_murid.png',
  profil_gor: '/icons/3d/profil_gor.png',
  profil: '/icons/3d/profil_gor.png',
  setting: '/icons/3d/profil_gor.png',
  tarif_spp: '/icons/3d/tarif_spp.png',
  tarifs: '/icons/3d/tarif_spp.png',
  staf_pelatih: '/icons/3d/staf_pelatih.png',
  staf: '/icons/3d/staf_pelatih.png',
  pelatih: '/icons/3d/staf_pelatih.png',
  coach: '/icons/3d/staf_pelatih.png',
};

/**
 * App3DMobileIcon Component
 * Renders high-fidelity 3D claymorphic icons for mobile views.
 */
export default function App3DMobileIcon({
  name,
  className = 'w-6 h-6',
  alt,
  active = false,
  style,
}) {
  const iconSrc = ICON_3D_MAP[name?.toLowerCase()] || ICON_3D_MAP.beranda;

  return (
    <img
      src={iconSrc}
      alt={alt || name || 'icon'}
      className={`object-contain select-none transition-all duration-200 pointer-events-none ${
        active ? 'scale-110 drop-shadow-[0_4px_8px_rgba(26,54,93,0.3)]' : 'drop-shadow-xs'
      } ${className}`}
      style={style}
      loading="lazy"
      draggable={false}
    />
  );
}
