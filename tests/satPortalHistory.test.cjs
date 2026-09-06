const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('reanudar actualiza el historial original y conserva folios y conteos durante el CAPTCHA', () => {
  const source = fs.readFileSync('src/components/adminApp/SatMassDownload/SatMassDownload.ts', 'utf8');
  const functions = source.slice(source.indexOf('function portalHistoryStatusFromState('), source.indexOf('function markPortalSessionClosed('));
  const original = {
    id: 'original', clientId: 1, folios: ['FOLIO-ORIGINAL'], imported: 4,
    duplicate: 1, rejected: 0, downloads: 1, createdAt: '2026-09-01T00:00:00Z'
  };
  const context = {
    activePortalHistoryId: { value: 'original' }, hiddenPortalHistoryIds: new Set(),
    portalHistory: { value: [original] }, PORTAL_HISTORY_LIMIT: 12,
    portalHistoryBaseline: { imported: 4, duplicate: 1, rejected: 0, downloads: 1 },
    persistPortalHistory() {},
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const state = {
    id: 'new-browser-session', clientId: 1, phase: 'login', downloads: [], downloadFolios: [],
    query: { direction: 'emitida', startDate: '2026-08-01', endDate: '2026-08-31' },
    automation: {},
  };
  context.rememberPortalState(state);
  assert.equal(context.portalHistory.value.length, 1);
  assert.equal(context.portalHistory.value[0].id, 'original');
  assert.equal(context.portalHistory.value[0].folios[0], 'FOLIO-ORIGINAL');
  assert.equal(context.portalHistory.value[0].imported, 4);
  assert.equal(context.portalHistory.value[0].createdAt, original.createdAt);
  state.phase = 'complete';
  state.downloads = [{ imported: 2, duplicate: 0, rejected: 0 }];
  context.rememberPortalState(state);
  context.rememberPortalState(state);
  assert.equal(context.portalHistory.value.length, 1);
  assert.equal(context.portalHistory.value[0].imported, 6);
  assert.equal(context.portalHistory.value[0].downloads, 2);
});
