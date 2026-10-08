import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatInr, validInrRate, type InrRate } from '../src/services/inrPricing.ts'
const now = Date.parse('2026-10-08T12:00:00Z')
const rate: InrRate = { base: 'USD', quote: 'INR', rate: 96.61, date: '2026-10-08' }
test('converts amounts with Indian grouping rather than relabelling dollars', () => {
  assert.equal(formatInr(470, rate), '₹45,407')
  assert.equal(formatInr(2000, rate), '₹1,93,220')
  assert.equal(formatInr(470, { ...rate, base: 'INR', rate: 1 }), '₹470')
  assert.equal(formatInr(1000, { ...rate, base: 'THB', rate: 3 }), '₹3,000')
})
test('rejects the wrong pair, invalid rates and stale references', () => {
  assert.equal(validInrRate(rate, 'USD', now), true)
  for (const invalid of [null, { ...rate, base: 'THB' }, { ...rate, quote: 'EUR' }, { ...rate, rate: 0 }, { ...rate, rate: -1 }, { ...rate, rate: Infinity }, { ...rate, date: 'bad' }, { ...rate, date: '2026-09-01' }, { ...rate, date: '2027-01-01' }]) assert.equal(validInrRate(invalid, 'USD', now), false)
})
test('unavailable conversion and unknown prices never display misleading rupee amounts', () => {
  assert.equal(formatInr(470, null), 'INR estimate unavailable')
  for (const amount of [NaN, Infinity, -100, 0]) assert.equal(formatInr(amount, rate), 'Check price')
})
