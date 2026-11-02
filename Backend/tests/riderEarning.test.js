import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRiderEarningFromRules } from '../src/modules/food/orders/services/riderEarning.util.js';

// The rules currently configured in admin: flat ₹20 up to 3 km, then ₹6/km beyond 3 km.
const LIVE_RULES = [
  { name: 'Rule 1', minDistance: 0, maxDistance: 3, commissionPerKm: 0, basePayout: 20 },
  { name: 'Rule 2', minDistance: 3, maxDistance: null, commissionPerKm: 6, basePayout: 0 },
];

test('short trip inside the flat 0-3 km slab pays the flat base only', () => {
  assert.equal(computeRiderEarningFromRules(1, LIVE_RULES), 20);
  assert.equal(computeRiderEarningFromRules(1.4, LIVE_RULES), 20);
  assert.equal(computeRiderEarningFromRules(2.9, LIVE_RULES), 20);
});

test('the slab boundary itself still pays the flat base', () => {
  assert.equal(computeRiderEarningFromRules(3, LIVE_RULES), 20);
});

test('distance beyond the flat slab adds per-km only for the extra kilometres', () => {
  assert.equal(computeRiderEarningFromRules(5, LIVE_RULES), 20 + 2 * 6);
  assert.equal(computeRiderEarningFromRules(10, LIVE_RULES), 20 + 7 * 6);
});

test('a per-km value on the first slab is charged from 0 km (the ₹27-for-1.4 km case)', () => {
  const misconfigured = [
    { minDistance: 0, maxDistance: 3, commissionPerKm: 5, basePayout: 20 },
    { minDistance: 3, maxDistance: null, commissionPerKm: 6, basePayout: 0 },
  ];
  assert.equal(computeRiderEarningFromRules(1.4, misconfigured), 27);
  // Leaving per-km at 0 is what makes the slab flat.
  assert.equal(computeRiderEarningFromRules(1.4, LIVE_RULES), 20);
});

test('zero or unusable distance earns nothing', () => {
  assert.equal(computeRiderEarningFromRules(0, LIVE_RULES), 0);
  assert.equal(computeRiderEarningFromRules(null, LIVE_RULES), 0);
  assert.equal(computeRiderEarningFromRules(NaN, LIVE_RULES), 0);
});

test('no rules at all earns nothing', () => {
  assert.equal(computeRiderEarningFromRules(5, []), 0);
  assert.equal(computeRiderEarningFromRules(5, null), 0);
});

test('a missing 0 km slab falls back to the lowest slab instead of paying nothing', () => {
  const noZeroSlab = [
    { minDistance: 1, maxDistance: 4, commissionPerKm: 0, basePayout: 25 },
  ];
  assert.equal(computeRiderEarningFromRules(2, noZeroSlab), 25);
});

test('rules given out of order are still slabbed correctly', () => {
  assert.equal(computeRiderEarningFromRules(5, [...LIVE_RULES].reverse()), 32);
});
