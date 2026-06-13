'use strict';

// A rolling time-series of CUMULATIVE "today" usage samples, used to derive a
// usage-RATE chart (tokens/min, cost/min, output/min) for fine windows (<=12h).
// Each sample is { t: epochMs, total, output, cost } captured every collector tick.
// Rate is delta/elapsed between consecutive samples — ticks are irregular, so we
// must NOT assume a fixed cadence. At local midnight the "today" totals reset to ~0,
// producing a negative delta; we clamp negatives to 0 so a reset never spikes the chart.

const METRIC_FIELD = { total: 'total', cost: 'cost', output: 'output' };

function appendSample(series, sample, maxAgeMs) {
  const list = Array.isArray(series) ? series.slice() : [];
  const t = Number(sample && sample.t);
  if (!Number.isFinite(t)) return list;
  const entry = {
    t,
    total: Math.max(0, Number(sample.total) || 0),
    output: Math.max(0, Number(sample.output) || 0),
    cost: Math.max(0, Number(sample.cost) || 0)
  };
  // Replace the last sample if it shares the same timestamp (idempotent re-tick).
  if (list.length && list[list.length - 1].t === t) list[list.length - 1] = entry;
  else list.push(entry);
  if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
    const cutoff = t - maxAgeMs;
    while (list.length && list[0].t < cutoff) list.shift();
  }
  return list;
}

// Bucket the window [now-windowMs, now] into `buckets` equal slices and return
// per-bucket rate-per-minute for the chosen metric. Empty buckets are zero-filled.
function computeRate(series, { windowMs, buckets = 60, bucketMs: bucketMsOpt, metric = 'total', nowMs } = {}) {
  const field = METRIC_FIELD[metric] || 'total';
  const now = Number.isFinite(nowMs) ? nowMs : (Array.isArray(series) && series.length ? series[series.length - 1].t : 0);
  const start = now - windowMs;
  // Explicit bucketMs (the user-chosen aggregation granularity) wins; else split the
  // window into `buckets` slices.
  if (Number.isFinite(bucketMsOpt) && bucketMsOpt > 0) buckets = Math.max(1, Math.round(windowMs / bucketMsOpt));
  const bucketMs = windowMs / buckets;
  const bucketMin = bucketMs / 60000;
  const points = [];
  for (let i = 0; i < buckets; i++) {
    points.push({ t: Math.round(start + (i + 0.5) * bucketMs), delta: 0 });
  }
  const list = (Array.isArray(series) ? series : []).filter((s) => Number.isFinite(s.t));
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    const span = cur.t - prev.t;
    if (span <= 0) continue;
    const delta = Math.max(0, (Number(cur[field]) || 0) - (Number(prev[field]) || 0));
    if (delta <= 0) continue;
    // Spread the interval's activity proportionally across the buckets it overlaps,
    // so a steady interval renders as a flat rate (not a single spike) regardless of
    // how coarse the sampling cadence is relative to the bucket size.
    const a = Math.max(prev.t, start);
    const b = Math.min(cur.t, now);
    if (b <= a) continue;
    const rate = delta / span; // value per ms, constant across the interval
    const firstBucket = Math.max(0, Math.floor((a - start) / bucketMs));
    const lastBucket = Math.min(buckets - 1, Math.floor((b - start) / bucketMs));
    for (let bk = firstBucket; bk <= lastBucket; bk++) {
      const bucketStart = start + bk * bucketMs;
      const overlap = Math.min(b, bucketStart + bucketMs) - Math.max(a, bucketStart);
      if (overlap > 0) points[bk].delta += rate * overlap;
    }
  }
  return points.map((p) => ({ t: p.t, value: bucketMin > 0 ? p.delta / bucketMin : 0 }));
}

// Convert tokscale `hourly --json` entries into per-hour rate points (per-minute)
// for coarse windows (1d/1w). Entries are sparse with local-time "YYYY-MM-DD HH:00".
function hourlyToRate(entries, { sinceMs, untilMs, metric = 'total' } = {}) {
  const valueOf = (e) => {
    if (metric === 'cost') return Number(e.cost) || 0;
    if (metric === 'output') return Number(e.output) || 0;
    return (Number(e.input) || 0) + (Number(e.output) || 0) + (Number(e.cacheRead) || 0) + (Number(e.cacheWrite) || 0);
  };
  const byHour = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    const ms = parseLocalHour(e.hour);
    if (!Number.isFinite(ms)) continue;
    if (Number.isFinite(sinceMs) && ms < sinceMs) continue;
    if (Number.isFinite(untilMs) && ms > untilMs) continue;
    byHour.set(ms, (byHour.get(ms) || 0) + valueOf(e));
  }
  const start = Number.isFinite(sinceMs) ? Math.floor(sinceMs / 3600000) * 3600000 : null;
  const end = Number.isFinite(untilMs) ? untilMs : (byHour.size ? Math.max(...byHour.keys()) : null);
  const points = [];
  if (start == null || end == null) {
    for (const [ms, v] of [...byHour.entries()].sort((a, b) => a[0] - b[0])) points.push({ t: ms, value: v / 60 });
    return points;
  }
  for (let ms = start; ms <= end; ms += 3600000) {
    points.push({ t: ms + 1800000, value: (byHour.get(ms) || 0) / 60 });
  }
  return points;
}

// Parse tokscale's local-time "YYYY-MM-DD HH:00" into epoch ms (local timezone).
function parseLocalHour(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return NaN;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0).getTime();
}

module.exports = { appendSample, computeRate, hourlyToRate, parseLocalHour };
