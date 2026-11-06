/**
 * The calendar's date maths (#1666): the pure helpers calendar.ts exports.
 * Every one works on UTC calendar dates written as YYYY-MM-DD, so these run
 * the same in any timezone the suite happens to run in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const {
  parseDate, formatDate, addDays, addMonths, compareDates, sameDay, monthWeeks, addToRange,
} = await import(join(HERE, '..', 'packages', 'registry', 'components', 'calendar.ts'));

const d = (s) => parseDate(s);

test('parseDate reads a date or a month, and refuses an impossible one', () => {
  assert.deepEqual(d('2025-06-12'), { y: 2025, m: 5, d: 12 });
  assert.deepEqual(d('2025-06'), { y: 2025, m: 5, d: 1 }, 'a month means its first day');
  assert.equal(d('2025-02-30'), null, 'February has no 30th');
  assert.equal(d('2025-6-1'), null, 'two-digit month and day only');
  assert.equal(d(''), null);
  assert.equal(formatDate({ y: 2025, m: 0, d: 5 }), '2025-01-05');
});

test('addDays and addMonths cross month and year ends, and addMonths clamps the day', () => {
  assert.equal(formatDate(addDays(d('2025-12-31'), 1)), '2026-01-01');
  assert.equal(formatDate(addDays(d('2025-03-01'), -1)), '2025-02-28');
  assert.equal(formatDate(addDays(d('2024-03-01'), -1)), '2024-02-29', 'a leap year');
  assert.equal(formatDate(addMonths(d('2025-01-31'), 1)), '2025-02-28', 'clamped to the last day');
  assert.equal(formatDate(addMonths(d('2025-01-15'), -1)), '2024-12-15');
  assert.equal(formatDate(addMonths(d('2025-06-12'), 12)), '2026-06-12');
});

test('compareDates orders days, and sameDay tolerates a missing side', () => {
  assert.ok(compareDates(d('2025-06-01'), d('2025-06-02')) < 0);
  assert.ok(compareDates(d('2025-07-01'), d('2025-06-30')) > 0);
  assert.equal(compareDates(d('2025-06-01'), d('2025-06-01')), 0);
  assert.equal(sameDay(d('2025-06-01'), null), false);
});

test('monthWeeks fills whole weeks from the start day, only as many rows as the month needs', () => {
  const june = monthWeeks(2025, 5, 0);
  assert.equal(june.length, 5, 'June 2025 needs five Sunday-first rows');
  assert.equal(formatDate(june[0][0]), '2025-06-01', 'the 1st is a Sunday');
  assert.equal(formatDate(june[4][6]), '2025-07-05', 'the last row runs into July');
  const mondayFirst = monthWeeks(2025, 5, 1);
  assert.equal(formatDate(mondayFirst[0][0]), '2025-05-26', 'Monday-first starts in May');
  assert.equal(mondayFirst.length, 6, 'and then needs six rows');
  assert.ok(monthWeeks(2026, 1, 0).length === 4, 'February 2026 fits exactly four Sunday-first rows');
  for (const week of june) assert.equal(week.length, 7);
});

test('addToRange starts, ends, swaps a backwards end, and restarts a complete range', () => {
  const r0 = { from: null, to: null };
  const r1 = addToRange(r0, d('2025-06-10'));
  assert.deepEqual([formatDate(r1.from), r1.to], ['2025-06-10', null], 'the first pick starts it');
  const r2 = addToRange(r1, d('2025-06-15'));
  assert.deepEqual([formatDate(r2.from), formatDate(r2.to)], ['2025-06-10', '2025-06-15'], 'the second ends it');
  const back = addToRange(r1, d('2025-06-05'));
  assert.deepEqual([formatDate(back.from), formatDate(back.to)], ['2025-06-05', '2025-06-10'], 'an earlier end swaps');
  const r3 = addToRange(r2, d('2025-06-20'));
  assert.deepEqual([formatDate(r3.from), r3.to], ['2025-06-20', null], 'a pick on a complete range starts anew');
});
