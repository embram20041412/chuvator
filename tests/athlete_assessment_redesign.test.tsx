import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScoutingPolarAreaPanel, { OPTA_CATEGORY_CONFIG, getCategoryTheme } from '../src/components/ScoutingPolarAreaPanel';
import AssessmentIndicatorsAccordion from '../src/components/AssessmentIndicatorsAccordion';
import AthleteAssessmentEditView from '../src/components/AthleteAssessmentEditView';

test('Opta Category Theme Mapping: accurately maps all 7 sports performance pillars', () => {
  const categories = ['fisik', 'teknik', 'taktik', 'mental', 'komunikasi', 'perkembangan', 'posisi'];
  
  categories.forEach((key) => {
    const theme = getCategoryTheme(key);
    assert.ok(theme, `Theme for ${key} should exist`);
    assert.ok(theme.color.startsWith('#'), `Theme ${key} should have hex color`);
    assert.ok(theme.label, `Theme ${key} should have label`);
  });

  // Verify specific Opta colors requested in specification
  assert.strictEqual(OPTA_CATEGORY_CONFIG.fisik.color, '#10B981');     // Emerald
  assert.strictEqual(OPTA_CATEGORY_CONFIG.teknik.color, '#2455E8');    // Electric Blue
  assert.strictEqual(OPTA_CATEGORY_CONFIG.taktik.color, '#8B5CF6');    // Purple
  assert.strictEqual(OPTA_CATEGORY_CONFIG.mental.color, '#F59E0B');    // Amber
  assert.strictEqual(OPTA_CATEGORY_CONFIG.komunikasi.color, '#0EA5E9');// Sky Blue
  assert.strictEqual(OPTA_CATEGORY_CONFIG.perkembangan.color, '#EC4899');// Pink
  assert.strictEqual(OPTA_CATEGORY_CONFIG.posisi.color, '#6366F1');    // Indigo
});

test('ScoutingPolarAreaPanel: renders focused Opta Polar-Area Chart without duplicate category list', () => {
  const mockCategories = [
    { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: 6, score: 85, indicators: ['Sprint', 'Stamina'] },
    { key: 'teknik', label: '2. Kemampuan Teknik', shortLabel: 'Teknik', count: 6, score: 78, indicators: ['Passing', 'Control'] },
    { key: 'taktik', label: '3. Pemahaman Taktik', shortLabel: 'Taktik', count: 5, score: 72, indicators: ['Positioning', 'Vision'] },
    { key: 'mental', label: '4. Mentalitas', shortLabel: 'Mental', count: 5, score: 90, indicators: ['Focus', 'Bravery'] },
    { key: 'komunikasi', label: '5. Komunikasi Lapangan', shortLabel: 'Komunikasi', count: 4, score: 68, indicators: ['Voice', 'Call'] },
    { key: 'perkembangan', label: '6. Perkembangan Atlet', shortLabel: 'Perkembangan', count: 4, score: 80, indicators: ['Discipline', 'Progress'] },
    { key: 'posisi', label: '7. Khusus Posisi (Striker)', shortLabel: 'Khusus Posisi', count: 5, score: 88, indicators: ['Finishing', 'Heading'], isSpecial: true }
  ];

  const markup = renderToStaticMarkup(
    <ScoutingPolarAreaPanel
      categoryList={mockCategories}
      overallScore={80}
      overallGrade={{ grade: 'A Sangat Baik', badge: 'bg-emerald-100 text-emerald-800' }}
      activeCategoryKey="fisik"
      sportName="Sepakbola"
    />
  );

  // Assert container and Polar-Area header without internal Opta Nightingale Rose subtitle
  assert.ok(markup.includes('Profil Performa Polar Area'));
  assert.strictEqual(markup.includes('Opta Nightingale Rose'), false, 'Internal Opta Nightingale Rose label should be removed');

  // Assert Overall score badge in header and center hub
  assert.ok(markup.includes('80 / 100'));
  assert.ok(markup.includes('A Sangat Baik'));

  // Assert Concentric scale rings (25, 50, 75, 100)
  assert.ok(markup.includes('25'));
  assert.ok(markup.includes('50'));
  assert.ok(markup.includes('75'));
  assert.ok(markup.includes('100'));

  // Assert SVG rose wedges and center hub are rendered
  assert.ok(markup.includes('rose-wedges'));
  assert.ok(markup.includes('center-hub'));

  // Assert peripheral labels and scores are present on the chart
  assert.ok(markup.includes('Fisik'));
  assert.ok(markup.includes('85'));
  assert.ok(markup.includes('Teknik'));
  assert.ok(markup.includes('78'));

  // IMPORTANT: Verify that the duplicate category breakdown list and "Nilai" buttons are ELIMINATED
  assert.strictEqual(markup.includes('Ringkasan Skor 7 Kategori'), false, 'Duplicate category list should be removed');
  assert.strictEqual(markup.includes('Nilai'), false, 'Duplicate Nilai buttons should be removed from chart panel');
});

test('AssessmentIndicatorsAccordion: renders collapsible domain sections and strips internal technical jargon', () => {
  const mockCategories = [
    { key: 'fisik', label: 'Kondisi Fisik', shortLabel: 'Fisik', count: 2, score: 80, indicators: ['Daya Tahan Aerobik', 'Kecepatan Sprint'] },
    { key: 'teknik', label: 'Kemampuan Teknik', shortLabel: 'Teknik', count: 2, score: 60, indicators: ['First Touch', 'Akurasi Passing'] }
  ];

  const mockScores = {
    'Daya Tahan Aerobik': 85,
    'Kecepatan Sprint': 75,
    'First Touch': 60,
    'Akurasi Passing': 0
  };

  const markup = renderToStaticMarkup(
    <AssessmentIndicatorsAccordion
      categoryList={mockCategories}
      scores={mockScores}
      activeCategoryKey="fisik"
      onSetCategoryPreset={() => {}}
      tierLabel="Fase 3: U-14 & U-16"
      isArchived={false}
      lockedToMasterLibrary={true}
    />
  );

  // Header and title
  assert.ok(markup.includes('Rincian Indikator Domain'));
  assert.ok(markup.includes('Fase 3: U-14 &amp; U-16') || markup.includes('Fase 3: U-14 & U-16'));

  // Category labels and indicator counts
  assert.ok(markup.includes('Kondisi Fisik'));
  assert.ok(markup.includes('Kemampuan Teknik'));

  // Indicator titles and scores
  assert.ok(markup.includes('Daya Tahan Aerobik'));
  assert.ok(markup.includes('85'));
  assert.ok(markup.includes('Kecepatan Sprint'));
  assert.ok(markup.includes('75'));

  // Verify internal implementation strings are removed from visible UI
  assert.strictEqual(markup.includes('Terhubung ke Master Test Library'), false);
  assert.strictEqual(markup.includes('Auto-Synced Test'), false);
  assert.strictEqual(markup.includes('Input manual dikunci'), false);
});

test('ScoutingPolarAreaPanel: renders navigation action button when onOpenEdit or onOpenMasterLibrary prop is passed', () => {
  const mockCategories = [
    { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: 2, score: 85, indicators: ['Sprint', 'Stamina'] }
  ];

  const markup = renderToStaticMarkup(
    <ScoutingPolarAreaPanel
      categoryList={mockCategories}
      overallScore={85}
      overallGrade={{ grade: 'A Sangat Baik', badge: 'bg-emerald-100 text-emerald-800' }}
      activeCategoryKey="fisik"
      sportName="Sepakbola"
      onOpenEdit={() => {}}
      isArchived={false}
    />
  );

  assert.ok(markup.includes('Rincian'), 'Should render Rincian action button in Polar Area header');
});

test('AthleteAssessmentEditView: renders dedicated assessment edit view with back button, preview score, and actions', () => {
  const mockCategories = [
    { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: 2, score: 80, indicators: ['Sprint', 'Stamina'] }
  ];

  const markup = renderToStaticMarkup(
    <AthleteAssessmentEditView
      studentName="Budi Santoso"
      sportLabel="Sepakbola Tier 3"
      categoryList={mockCategories}
      initialScores={{ Sprint: 80, Stamina: 80 }}
      activeCategoryKey="fisik"
      onSave={() => {}}
      onCancel={() => {}}
      tierLabel="Sepakbola Fase 3"
    />
  );

  assert.ok(markup.includes('Edit Penilaian Indikator'));
  assert.ok(markup.includes('Budi Santoso'));
  assert.ok(markup.includes('Sepakbola Tier 3'));
  assert.ok(markup.includes('Preview Rata-Rata:'));
  assert.ok(markup.includes('Simpan Perubahan Nilai'));
  assert.ok(markup.includes('Batal'));
  assert.ok(markup.includes('Sprint'));
  assert.ok(markup.includes('Stamina'));
});

test('AthleteAssessmentEditView: consolidates Position & Tactical Role Configuration', () => {
  const mockCategories = [
    { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: 2, score: 80, indicators: ['Sprint', 'Stamina'] },
    { key: 'posisi', label: '7. Khusus Posisi (ST)', shortLabel: 'Khusus Posisi', count: 1, score: 85, indicators: ['Finishing'], isSpecial: true }
  ];

  const markup = renderToStaticMarkup(
    <AthleteAssessmentEditView
      studentName="Rizky Pratama"
      sportLabel="SepakBola • Fase 3"
      sportType="football"
      activeTier={3}
      categoryList={mockCategories}
      initialScores={{ Sprint: 80, Stamina: 80, Finishing: 85 }}
      selectedPosition="ST"
      secondaryPosition="RW"
      selectedSpecialization="Poacher"
      selectedStyleCode="STY07"
      availablePositions={[
        { code: 'ST', label: 'ST — Striker' },
        { code: 'CM', label: 'CM — Central Midfielder' }
      ]}
      secondaryPositions={[
        { code: 'NONE', label: 'Tidak Ada' },
        { code: 'RW', label: 'RW — Right Winger' }
      ]}
      playingStyles={[
        { code: 'STY07', name: 'Target Man', desc: 'Penyerang tengah pemantul bola' }
      ]}
      getPositionConfigFn={() => ({ specializations: ['Poacher', 'False 9'] })}
      getStyleConfigFn={() => ({ code: 'STY07', name: 'Target Man', desc: 'Penyerang tengah pemantul bola' })}
      onSave={() => {}}
      onCancel={() => {}}
      tierLabel="SepakBola Fase 3"
    />
  );

  // Verify Position & Tactical Role Config section is rendered inside Edit View
  assert.ok(markup.includes('Konfigurasi Posisi &amp; Peran Taktis') || markup.includes('Konfigurasi Posisi & Peran Taktis'));
  assert.ok(markup.includes('1. Posisi Utama'));
  assert.ok(markup.includes('2. Posisi Alternatif'));
  assert.ok(markup.includes('3. Spesialisasi Peran'));
  assert.ok(markup.includes('4. Profil Gaya Bermain Taktis (STY)'));
});

test('AssessmentIndicatorsAccordion singleDomainMode: remains hidden when closed and renders only selected domain when opened', () => {
  const mockCategories = [
    { key: 'fisik', label: 'Kondisi Fisik', shortLabel: 'Fisik', count: 2, score: 80, indicators: ['Daya Tahan Aerobik', 'Kecepatan Sprint'] },
    { key: 'teknik', label: 'Kemampuan Teknik', shortLabel: 'Teknik', count: 2, score: 60, indicators: ['First Touch', 'Akurasi Passing'] }
  ];

  const mockScores = {
    'Daya Tahan Aerobik': 85,
    'Kecepatan Sprint': 75,
    'First Touch': 60,
    'Akurasi Passing': 0
  };

  // 1. Closed by default (selectedDomainKey = null) -> renders empty string
  const closedMarkup = renderToStaticMarkup(
    <AssessmentIndicatorsAccordion
      singleDomainMode={true}
      selectedDomainKey={null}
      categoryList={mockCategories}
      scores={mockScores}
      tierLabel="Fase 3: U-14 & U-16"
      isArchived={false}
      lockedToMasterLibrary={true}
    />
  );
  assert.strictEqual(closedMarkup, '', 'singleDomainMode should render nothing when selectedDomainKey is null');

  // 2. Open Fisik (selectedDomainKey = "fisik") -> renders only Fisik indicators
  const fisikMarkup = renderToStaticMarkup(
    <AssessmentIndicatorsAccordion
      singleDomainMode={true}
      selectedDomainKey="fisik"
      categoryList={mockCategories}
      scores={mockScores}
      tierLabel="Fase 3: U-14 & U-16"
      isArchived={false}
      lockedToMasterLibrary={true}
    />
  );
  assert.ok(fisikMarkup.includes('rincian-indikator-domain-fisik'));
  assert.ok(fisikMarkup.includes('Daya Tahan Aerobik'));
  assert.strictEqual(fisikMarkup.includes('First Touch'), false, 'Should not render Teknik indicators when Fisik is selected');

  // 3. Switch to Teknik (selectedDomainKey = "teknik") -> renders only Teknik indicators
  const teknikMarkup = renderToStaticMarkup(
    <AssessmentIndicatorsAccordion
      singleDomainMode={true}
      selectedDomainKey="teknik"
      categoryList={mockCategories}
      scores={mockScores}
      tierLabel="Fase 3: U-14 & U-16"
      isArchived={false}
      lockedToMasterLibrary={true}
    />
  );
  assert.ok(teknikMarkup.includes('rincian-indikator-domain-teknik'));
  assert.ok(teknikMarkup.includes('First Touch'));
  assert.strictEqual(teknikMarkup.includes('Daya Tahan Aerobik'), false, 'Should not render Fisik indicators when Teknik is selected');
});
