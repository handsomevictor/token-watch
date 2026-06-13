'use strict';
// Mock preload for offscreen README screenshot generation. Exposes the same
// `window.tokenMonitor` surface the renderer expects, but backed by synthetic
// data (no real usage, no network, no IPC). Used only by scripts/capture/capture.js.
const { contextBridge } = require('electron');

const now = Date.UTC(2026, 5, 13, 18, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

const MODELS = {
  'claude-opus-4-8': { rate: 0.62 },
  'claude-sonnet-4-6': { rate: 0.18 },
  'gpt-5.3-codex': { rate: 0.30 }
};

function period(scale) {
  const models = {}; const modelCosts = {}; const modelOutputs = {}; const modelCacheReads = {}; const modelCacheWrites = {};
  const mk = (m, tok) => { models[m] = tok; modelCosts[m] = +(tok / 1e6 * MODELS[m].rate).toFixed(4); modelOutputs[m] = Math.round(tok * 0.12); modelCacheReads[m] = Math.round(tok * 0.6); modelCacheWrites[m] = Math.round(tok * 0.08); };
  mk('claude-opus-4-8', 9_600_000 * scale);
  mk('claude-sonnet-4-6', 3_100_000 * scale);
  mk('gpt-5.3-codex', 1_900_000 * scale);
  const totalTokens = Object.values(models).reduce((a, b) => a + b, 0);
  const costUsd = +Object.values(modelCosts).reduce((a, b) => a + b, 0).toFixed(2);
  const claudeTok = models['claude-opus-4-8'] + models['claude-sonnet-4-6'];
  const codexTok = models['gpt-5.3-codex'];
  const clients = { claude: claudeTok, codex: codexTok };
  const clientCosts = { claude: +(modelCosts['claude-opus-4-8'] + modelCosts['claude-sonnet-4-6']).toFixed(2), codex: modelCosts['gpt-5.3-codex'] };
  const mkSession = (id, client, project, title, tok, model, ago) => [`${client}:${id}`, {
    client, sessionId: id, project, title,
    totalTokens: tok, costUsd: +(tok / 1e6 * MODELS[model].rate).toFixed(2),
    messageCount: Math.round(tok / 90000), inputTokens: Math.round(tok * 0.28), outputTokens: Math.round(tok * 0.12),
    cacheReadTokens: Math.round(tok * 0.5), cacheWriteTokens: Math.round(tok * 0.08), reasoningTokens: 0,
    models: { [model]: tok }, modelCosts: { [model]: +(tok / 1e6 * MODELS[model].rate).toFixed(2) }, providers: {},
    startedAt: iso(now - ago - 3600000), lastUsedAt: iso(now - ago)
  }];
  const sessions = Object.fromEntries([
    mkSession('a1b2c3d4-1111', 'claude', 'token-watch', 'Add usage rate graph + aggregation', 5_400_000 * scale, 'claude-opus-4-8', 600000),
    mkSession('e5f6a7b8-2222', 'claude', 'hyperliquid-skill', 'Build Hyperliquid trading skill', 3_200_000 * scale, 'claude-sonnet-4-6', 5400000),
    mkSession('rollout-2026-06-13T09-00-00-3333', 'codex', 'api-gateway', 'Refactor auth middleware', 1_900_000 * scale, 'gpt-5.3-codex', 9000000)
  ]);
  return {
    totalTokens, costUsd, inputTokens: Math.round(totalTokens * 0.28), outputTokens: Math.round(totalTokens * 0.12),
    cacheReadTokens: Math.round(totalTokens * 0.55), cacheWriteTokens: Math.round(totalTokens * 0.08), reasoningTokens: 0,
    clients, clientCosts, clientCacheReads: {}, clientCacheWrites: {}, clientOutputs: {},
    models, modelCosts, modelOutputs, modelCacheReads, modelCacheWrites,
    clientModels: { claude: { 'claude-opus-4-8': models['claude-opus-4-8'], 'claude-sonnet-4-6': models['claude-sonnet-4-6'] }, codex: { 'gpt-5.3-codex': models['gpt-5.3-codex'] } },
    clientModelCosts: { claude: { 'claude-opus-4-8': modelCosts['claude-opus-4-8'], 'claude-sonnet-4-6': modelCosts['claude-sonnet-4-6'] }, codex: { 'gpt-5.3-codex': modelCosts['gpt-5.3-codex'] } },
    sessions
  };
}

function daily() {
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const ms = now - i * 86400000;
    const tok = Math.round(2_000_000 + Math.sin(i / 3) * 1_500_000 + (i % 7 === 0 ? 0 : 1_200_000));
    out.push({ date: dayKey(ms), tokens: Math.max(0, tok), cost: +(Math.max(0, tok) / 1e6 * 0.4).toFixed(2), perClient: { claude: { tokens: tok * 0.7, cost: tok / 1e6 * 0.4 * 0.7 }, codex: { tokens: tok * 0.3, cost: tok / 1e6 * 0.4 * 0.3 } }, perModel: {} });
  }
  return out;
}

const STATS = {
  updatedAt: iso(now),
  periods: { today: period(1), month: period(11), allTime: period(140) },
  devices: [{ deviceId: 'victor-mac', hostname: 'victor-mac', platform: 'darwin', stale: false }],
  historyPreview: { daily: daily(), monthly: [], summary: { activeDays: 23, currentStreak: 6, longestStreak: 11, peakDayTokens: 8_700_000 } }
};

const SETTINGS = {
  currency: 'USD', language: 'en', glassOpacity: 82, glassBlur: 30, systemGlass: true, showLiveDot: true,
  showToolIcons: true, titleIconOnly: false, settingsInTitlebar: false, windowBehavior: 'floating',
  clients: 'claude,codex,cursor', hiddenClients: '', pinnedClients: '', clientDisplayOrder: '',
  viewDisplayOrder: '', hiddenViews: '', historyEnabled: true, numberAnimation: false, modelSortByCost: false,
  alwaysOnTopAboveAll: false, usageRefreshMs: 300000, dailyBudget: 0, monthlyBudget: 0,
  dataDirs: { claude: '' }, limitsEnabled: true, limitProviders: 'claude,codex', limitProviderOrder: '',
  showLimitSource: false, trayContent: 'tokens', showTrayIcon: true, trayMode: false, zoomFactor: 1,
  lastViewState: { period: 'today', breakdown: 'tool' }, deviceId: 'victor-mac', hubUrl: '', secret: '',
  themeColors: {}, vendorColors: {}, appUpdate: { lastCheckedAt: null, lastKnownLatest: null, dismissedVersion: null }
};

function rateSeries(windowKey, metric) {
  const map = { '1h': 3600000, '3h': 3 * 3600000, '6h': 6 * 3600000, '12h': 12 * 3600000, '1d': 86400000, '1w': 7 * 86400000 };
  const win = map[windowKey] || 3600000;
  const n = 80; const pts = [];
  for (let i = 0; i < n; i++) {
    const t = now - win + (i / (n - 1)) * win;
    const base = metric === 'cost' ? 0.9 : metric === 'output' ? 9000 : 70000;
    const v = Math.max(0, base * (0.5 + 0.5 * Math.sin(i / 6) + 0.3 * Math.sin(i / 2.3)) * (i > n * 0.15 ? 1 : 0.2));
    pts.push({ t: Math.round(t), value: v });
  }
  return { window: windowKey, metric, bucketMs: win / n, points: pts };
}

const noop = () => {};
const reg = () => noop;
const api = {
  getAppInfo: async () => ({ platform: 'darwin', osRelease: '24.0.0', appVersion: '0.11.1', loginItemSupported: false }),
  getSettings: async () => JSON.parse(JSON.stringify(SETTINGS)),
  updateSettings: async (patch) => Object.assign(SETTINGS, patch || {}),
  previewAppearance: noop,
  getStats: async () => JSON.parse(JSON.stringify(STATS)),
  getSessionDetail: async () => ({ found: false, exchanges: [], totals: {} }),
  getStreamStatus: async () => ({ connected: true, mode: 'local' }),
  getServiceStatus: async () => ({ providers: [] }),
  openDashboard: noop,
  getDashboardHistory: async () => JSON.parse(JSON.stringify(STATS.historyPreview)),
  getUsageRate: async (window, metric) => rateSeries(window || '1h', metric || 'total'),
  dashboard: { minimize: noop, close: noop },
  getHubInfo: async () => ({ url: null, secret: '', mode: 'local', running: false, hostUrls: [], secretRequired: false }),
  regenerateHubSecret: async () => ({ secret: 'x' }),
  onHubPush: reg, onStatsPush: reg, onSettingsPush: reg, onTokscalePush: reg, onAppUpdatePush: reg, onFloatingBubbleState: reg,
  getAppInfoSync: noop,
  getAppUpdateState: async () => ({ lastCheckedAt: null, lastKnownLatest: null, dismissedVersion: null }),
  checkAppUpdateNow: async () => ({}), dismissAppUpdate: noop,
  expandFloatingBubble: noop, moveFloatingBubble: noop, signalContentReady: noop, setViewState: noop,
  peekFloatingBubble: noop, collapseFloatingBubbleIfIdle: noop, setFloatingBubbleCollapsedSize: noop,
  setTrayIcons: noop, getTokscaleStatus: async () => ({ supported: true, current: { source: 'bundled', version: '3.1.2' } }),
  checkTokscaleNpm: async () => ({ supported: true, newer: false }), downloadTokscaleFromNpm: async () => ({}), resetTokscaleToBundled: async () => ({}),
  getStreamStatusSync: noop, openExternal: noop, openUserData: noop,
  cursor: { loginManual: noop, logout: noop, status: async () => ({}) },
  opencode: { saveCookie: noop, logout: noop, status: async () => ({}) },
  pricing: { get: async () => ({ models: {} }), set: async () => ({ models: {} }) },
  dataDir: { listCandidates: async () => [{ path: '/Users/you/.claude', label: '.claude', source: 'default' }], browse: async () => null },
  showNotification: noop, minimize: noop, close: noop
};

contextBridge.exposeInMainWorld('tokenMonitor', api);
