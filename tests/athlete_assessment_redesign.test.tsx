import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScoutingPolarAreaPanel, { OPTA_CATEGORY_CONFIG, getCategoryTheme } from '../src/components/ScoutingPolarAreaPanel';
import AssessmentIndicatorsAccordion from '../src/components/AssessmentIndicatorsAccordion';

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

test('ScoutingPolarAreaPanel: renders Opta Polar-Area Nightingale Rose Chart and 7 category breakdown', () => {
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
  assert.ok(markup.includes('Scouting Radar &amp; Category Breakdown') || markup.includes('Scouting Radar & Category Breakdown'));
  assert.ok(markup.includes('Opta Polar-Area'));

  // Assert Overall score badge
  assert.ok(markup.includes('80 / 100'));
  assert.ok(markup.includes('A Sangat Baik'));

  // Assert Concentric scale rings (25, 50, 75, 100)
  assert.ok(markup.includes('25'));
  assert.ok(markup.includes('50'));
  assert.ok(markup.includes('75'));
  assert.ok(markup.includes('100'));

  // Assert all 7 categories are rendered in the breakdown list
  assert.ok(markup.includes('Kondisi Fisik'));
  assert.ok(markup.includes('Kemampuan Teknik'));
  assert.ok(markup.includes('Pemahaman Taktik'));
  assert.ok(markup.includes('Mentalitas'));
  assert.ok(markup.includes('Komunikasi Lapangan'));
  assert.ok(markup.includes('Perkembangan Atlet'));
  assert.ok(markup.includes('Khusus Posisi'));

  // Assert individual scores are displayed in tabular numbers
  assert.ok(markup.includes('85'));
  assert.ok(markup.includes('78'));
  assert.ok(markup.includes('72'));
  assert.ok(markup.includes('90'));
  assert.ok(markup.includes('68'));
  assert.ok(markup.includes('80'));
  assert.ok(markup.includes('88'));

  // Assert SVG rose wedges are drawn
  assert.ok(markup.includes('rose-wedges'));
  assert.ok(markup.includes('center-hub'));
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
