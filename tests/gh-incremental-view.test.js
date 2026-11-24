import test from 'node:test';
import assert from 'node:assert/strict';
import { applyViewPatch, createIncrementalView } from '../src/pages/ghgame/incremental-view.js';

const meta = (token, extra = {}) => ({ version: 1, game_id: 99, role: 'admin', token, kind: 'full', fixed: true, ...extra });

test('server patches append, settle, delete and truncate without changing old views', () => {
  const old = { rows: [{ status: 'current' }, { status: 'future' }], summary: 1, obsolete: true };
  const patch = { op: 'object', remove: ['obsolete'], set: {
    rows: { op: 'array', length: 1, set: [[0, { op: 'object', remove: [], set: { status: { op: 'replace', value: 'hit' } } }]] },
    summary: { op: 'replace', value: 2 },
  } };
  assert.deepEqual(applyViewPatch(old, patch), { rows: [{ status: 'hit' }], summary: 2 });
  assert.equal(old.rows[0].status, 'current');
  assert.equal(old.rows.length, 2);
});

test('fixed options and unchanged rows retain identity across round deltas', () => {
  const view = createIncrementalView();
  const fixed = { config: { martin_z2: { pattern_only: ['PB'] } } };
  const row = { status: 'hit' };
  view.accept({ game_id: 99, config: { fixed: true }, round_state_lower: { user_options_snapshot: fixed, rows: [row] }, _view: meta('a') });
  const next = view.accept({ game_id: 99, _view: meta('b', { kind: 'patch', base: 'a' }), patch: {
    op: 'object', remove: [], set: { round_state_lower: { op: 'object', remove: [], set: {
      rows: { op: 'array', length: 2, set: [[1, { op: 'replace', value: { status: 'current' } }]] },
    } } },
  } });
  assert.equal(next.round_state_lower.user_options_snapshot, fixed);
  assert.equal(next.round_state_lower.rows[0], row);
  assert.equal(next.round_state_lower.rows.length, 2);
  assert.equal(view.request(99).response_base, 'b');
});

test('cache eviction full dynamic view retains fixed options but removes old dynamic keys', () => {
  const view = createIncrementalView();
  view.accept({ game_id: 99, config: { fixed: 1 }, round_state_lower: { user_options_snapshot: { fixed: 1 }, old: 1 }, oldRoot: true, _view: meta('a') });
  const next = view.accept({ game_id: 99, round_state_lower: { round_num: 2 }, _view: meta('b', { fixed: false, base: 'a' }) });
  assert.deepEqual(next.config, { fixed: 1 });
  assert.deepEqual(next.round_state_lower, { round_num: 2, user_options_snapshot: { fixed: 1 } });
  assert.equal(next.oldRoot, undefined);
});

test('a switched game or role cannot inherit a previous fixed snapshot', () => {
  const view = createIncrementalView();
  view.accept({ game_id: 99, config: { private: true }, _view: meta('a') });
  const next = view.accept({ game_id: 100, round_state_upper: {}, _view: meta('b', { game_id: 100, fixed: false }) });
  assert.equal(next.config, undefined);
  assert.equal(view.request(99).response_base, undefined);
  assert.throws(() => view.accept({ game_id: 100, _view: meta('c', { game_id: 100, role: 'user', fixed: false }) }), { code: 'GH_VIEW_RESYNC' });
  view.reset();
  const downgraded = view.accept({ game_id: 100, _view: meta('c', { game_id: 100, role: 'user', fixed: true }) });
  assert.equal(downgraded.config, undefined);
});

test('stale base is rejected without updating the current token', () => {
  const view = createIncrementalView();
  view.accept({ game_id: 99, _view: meta('a') });
  assert.throws(() => view.accept({ game_id: 99, _view: meta('b', { kind: 'patch', base: 'older' }), patch: null }), { code: 'GH_VIEW_RESYNC' });
  assert.equal(view.request(99).response_base, 'a');
  assert.equal(view.request(99, { full: true }).response_base, undefined);
  assert.throws(() => view.accept({ game_id: 99, _view: meta('c', { kind: 'full', fixed: false, base: 'older' }) }), { code: 'GH_VIEW_RESYNC' });
});

test('legacy live options can change while a fixed-game snapshot is never inferred', () => {
  const view = createIncrementalView();
  view.reset({ game_id: 99, round_state_lower: { user_options_snapshot: { live: 1 } } });
  const next = view.accept({ game_id: 99, options_dynamic: true, round_state_lower: { user_options_snapshot: { live: 2 } }, _view: meta('a', { fixed: false }) });
  assert.deepEqual(next.round_state_lower.user_options_snapshot, { live: 2 });
  view.reset();
  assert.deepEqual(view.request(99), { incremental_response: true });
});

test('server property names are applied as own properties', () => {
  const set = JSON.parse('{"__proto__":{"op":"replace","value":{"polluted":true}}}');
  const result = applyViewPatch({}, { op: 'object', remove: [], set });
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(result, '__proto__'), true);
});
