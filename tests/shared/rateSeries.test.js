'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { appendSample, computeRate, hourlyToRate, parseLocalHour } = require('../../src/shared/rateSeries');

test('appendSample prunes samples older than maxAge and dedupes same-timestamp', () => {
  let s = [];
  s = appendSample(s, { t: 1000, total: 10, output: 4, cost: 0.1 }, 5000);
  s = appendSample(s, { t: 2000, total: 30, output: 9, cost: 0.3 }, 5000);
  s = appendSample(s, { t: 2000, total: 31, output: 9, cost: 0.31 }, 5000); // same t replaces
  assert.equal(s.length, 2);
  assert.equal(s[1].total, 31);
  s = appendSample(s, { t: 9000, total: 50, output: 12, cost: 0.5 }, 5000); // cutoff 4000 drops t=1000,2000
  assert.deepEqual(s.map((x) => x.t), [9000]);
});

test('computeRate buckets per-minute deltas and zero-fills empty buckets', () => {
  // cumulative totals climbing 0 -> 60 -> 120 over 2 minutes => 60 tokens/min each minute
  const series = [
    { t: 0, total: 0, output: 0, cost: 0 },
    { t: 60000, total: 60, output: 30, cost: 0.6 },
    { t: 120000, total: 120, output: 60, cost: 1.2 }
  ];
  const pts = computeRate(series, { windowMs: 120000, buckets: 2, metric: 'total', nowMs: 120000 });
  assert.equal(pts.length, 2);
  assert.equal(Math.round(pts[0].value), 60);
  assert.equal(Math.round(pts[1].value), 60);
  // cost metric
  const cpts = computeRate(series, { windowMs: 120000, buckets: 2, metric: 'cost', nowMs: 120000 });
  assert.ok(Math.abs(cpts[1].value - 0.6) < 1e-6);
});

test('computeRate clamps the midnight reset (negative cumulative delta) to zero', () => {
  // total drops 500 -> 5 at midnight: that bucket must be 0, not a huge negative spike
  const series = [
    { t: 0, total: 500, output: 200, cost: 5 },
    { t: 60000, total: 5, output: 2, cost: 0.05 }
  ];
  const pts = computeRate(series, { windowMs: 60000, buckets: 1, metric: 'total', nowMs: 60000 });
  assert.equal(pts[0].value, 0);
});

test('parseLocalHour parses tokscale local-time hour strings', () => {
  const ms = parseLocalHour('2026-06-13 14:00');
  assert.equal(new Date(ms).getHours(), 14);
  assert.ok(Number.isNaN(parseLocalHour('garbage')));
});

test('hourlyToRate zero-fills gaps and converts hourly totals to per-minute', () => {
  const h0 = parseLocalHour('2026-06-13 10:00');
  const entries = [{ hour: '2026-06-13 10:00', input: 600, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1 }];
  const pts = hourlyToRate(entries, { sinceMs: h0, untilMs: h0 + 3600000, metric: 'total' });
  assert.ok(pts.length >= 1);
  assert.equal(Math.round(pts[0].value), 10); // 600 tokens / 60 min
});
