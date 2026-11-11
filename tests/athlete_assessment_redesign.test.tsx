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

  // Assert container and Opta Polar-Area header
  assert.ok(markup.includes('Scouting Polar-Area Chart'));
  assert.ok(markup.includes('Opta Nightingale Rose'));

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

test('AssessmentIndicatorsAccordion: renders collapsible category sections with stepper and presets', () => {
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
    />
  );

  // Header and title
  assert.ok(markup.includes('Lembar Penilaian Indikator (7 Kategori)'));
  assert.ok(markup.includes('Fase 3: U-14 &amp; U-16') || markup.includes('Fase 3: U-14 & U-16'));

  // Category labels and indicator counts
  assert.ok(markup.includes('Kondisi Fisik'));
  assert.ok(markup.includes('Kemampuan Teknik'));
  assert.ok(markup.includes('2 Indikator'));

  // Preset buttons
  assert.ok(markup.includes('Reset'));
  assert.ok(markup.includes('50'));
  assert.ok(markup.includes('75'));
  assert.ok(markup.includes('90'));

  // Indicator titles and scores
  assert.ok(markup.includes('Daya Tahan Aerobik'));
  assert.ok(markup.includes('85'));
  assert.ok(markup.includes('Kecepatan Sprint'));
  assert.ok(markup.includes('75'));
});

test('ScoutingPolarAreaPanel: renders Edit Penilaian navigation button when onOpenEdit prop is passed', () => {
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

  assert.ok(markup.includes('Edit Penilaian'), 'Should render Edit Penilaian button when onOpenEdit is provided');
  assert.ok(markup.includes('Ketuk untuk edit lembar penilaian indikator') || markup.includes('Ketuk untuk edit penilaian'));
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

