import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScheduleItems } from '../src/utils/helpers.js';

test('parseScheduleItems correctly extracts day, time, and court', () => {
  const sampleClass = {
    className: 'Tier 1',
    sport: 'Futsal',
    schedules: [
      { day: 'Selasa', startTime: '15:00', endTime: '17:00', courtName: 'Futsal 4' },
      { day: 'Kamis', startTime: '15:00', endTime: '17:00', courtName: 'Futsal 4' },
      { day: 'Sabtu', startTime: '08:00', endTime: '10:00', courtName: 'Futsal 2' },
    ],
  };

  const items = parseScheduleItems(sampleClass);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    day: 'Selasa',
    time: '15:00 - 17:00',
    court: 'Futsal 4',
  });
  assert.deepEqual(items[1], {
    day: 'Kamis',
    time: '15:00 - 17:00',
    court: 'Futsal 4',
  });
  assert.deepEqual(items[2], {
    day: 'Sabtu',
    time: '08:00 - 10:00',
    court: 'Futsal 2',
  });
});

test('parseScheduleItems handles string format correctly', () => {
  const str = 'Selasa (15:00-17:00, Futsal 4); Kamis (15:00-17:00, Futsal 4)';
  const items = parseScheduleItems(str);
  assert.equal(items.length, 2);
  assert.equal(items[0].day, 'Selasa');
  assert.equal(items[0].time, '15:00-17:00');
  assert.equal(items[0].court, 'Futsal 4');
});

test('attendance segmented control active and inactive classes mapping', () => {
  const getButtonClass = (status, currentStatus) => {
    const base = 'px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer';
    if (status === currentStatus) {
      const activeMap = {
        Hadir: 'bg-emerald-500 text-white shadow-sm',
        Izin: 'bg-blue-500 text-white shadow-sm',
        Sakit: 'bg-amber-500 text-white shadow-sm',
        Alpa: 'bg-rose-500 text-white shadow-sm',
      };
      return `${base} ${activeMap[status]}`;
    }
    return `${base} bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800`;
  };

  const hadirActive = getButtonClass('Hadir', 'Hadir');
  assert.match(hadirActive, /bg-emerald-500 text-white shadow-sm/);

  const izinInactive = getButtonClass('Izin', 'Hadir');
  assert.match(izinInactive, /bg-transparent text-slate-600 dark:text-slate-400/);
  assert.match(izinInactive, /dark:hover:bg-slate-800/);

  const izinActive = getButtonClass('Izin', 'Izin');
  assert.match(izinActive, /bg-blue-500 text-white shadow-sm/);

  const sakitActive = getButtonClass('Sakit', 'Sakit');
  assert.match(sakitActive, /bg-amber-500 text-white shadow-sm/);

  const alpaActive = getButtonClass('Alpa', 'Alpa');
  assert.match(alpaActive, /bg-rose-500 text-white shadow-sm/);
});
