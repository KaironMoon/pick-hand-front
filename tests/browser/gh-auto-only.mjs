/**
 * Browser regression using the real GH page and mocked HTTP/WebSocket responses.
 * Start Vite on 127.0.0.1:9035, then call the default export with a Playwright Page.
 * All API traffic is fulfilled locally; this test never places a real casino bet.
 */
export default async function verifyGhAutoOnly(page) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const mock = {
    user: { username: 'auto-test', nickname: '오토 테스트', role: 'user', auto_only: true },
    running: false, seq: 'PB', gameId: 9001, session: 'mock-auto-1', pnl: 0,
    actualTable: { cells: [] }, calls: [],
    users: [
      { id: 2, username: 'auto-test', nickname: '오토 테스트', role: 'user', auto_only: true, is_active: true, created_at: '2026-10-20T00:00:00Z' },
      { id: 1, username: 'admin-test', nickname: '관리자 테스트', role: 'admin', auto_only: false, is_active: true, created_at: '2026-10-20T00:00:00Z' },
    ],
  };
  const state = () => ({
    game_id: mock.gameId, config: {}, seq: mock.seq,
    round_state_upper: {
      round_num: mock.seq.length + 1, shoe_results: mock.seq,
      round_amount_table: { cells: [] }, actual_bet_table: mock.actualTable,
    },
    cum_pnl: { gh: mock.pnl }, bet: {}, user_martin: {},
  });
  const handler = async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    mock.calls.push({ path, method: request.method(), body: request.postDataJSON() });
    let json = {};
    if (path.endsWith('/auth/me')) json = mock.user;
    else if (path === '/api/v1/users') json = mock.users;
    else if (/^\/api\/v1\/users\/\d+$/.test(path) && request.method() === 'PUT') {
      const row = mock.users.find(user => user.id === Number(path.split('/').at(-1)));
      Object.assign(row, request.postDataJSON());
      json = row;
    }
    else if (path.endsWith('/blocked-games')) json = { blocked_games: ['t9'] };
    else if (path.endsWith('/maintenance/status')) json = { enabled: false };
    else if (path.endsWith('/gh/games/slots')) json = {
      slots: [{ slot_no: 1, occupied: true, game_id: mock.gameId, auto_running: mock.running }],
      auto_pnl_total_p: mock.pnl,
    };
    else if (path.endsWith('/state') || path.endsWith('/gh/games/round')) json = state();
    else if (path.endsWith('/auto/status')) json = {
      running: mock.running, auto_session_id: mock.running ? mock.session : null,
      phase: mock.running ? 'betting' : 'completed', game_id: mock.gameId,
      play_mode: 'one', pnl_actual_p: mock.pnl, pnl_total_p: mock.pnl,
    };
    else if (path.endsWith('/auto/stop')) { mock.running = false; json = { ok: true }; }
    else if (path.endsWith('/manual-pick-signals')) json = { enabled: false };
    await route.fulfill({ json });
  };
  await page.route('**/api/**', handler);
  await page.addInitScript(() => {
    if (!location.protocol.startsWith('http')) return;
    sessionStorage.setItem('pick_hand_token', 'local-test-token');
    const NativeWS = window.WebSocket;
    window.__autoOnlyTestSockets = [];
    window.WebSocket = class {
      constructor(url, protocols) {
        if (!url.includes('/ws/auto')) return new NativeWS(url, protocols);
        this.readyState = 1;
        window.__autoOnlyTestSockets.push(this);
        setTimeout(() => this.onopen?.({}), 0);
      }
      send() {}
      close() { this.readyState = 3; }
    };
  });
  const open = () => page.goto(`http://127.0.0.1:9035/ghgame/user?gameId=${mock.gameId}&slot=1`);
  const p = () => page.getByRole('button', { name: 'P 결과 입력', exact: true });
  const b = () => page.getByRole('button', { name: 'B 결과 입력', exact: true });
  const road = () => page.getByRole('img', { name: '글로벌히트 빅로드', exact: true });
  const emit = async (type, data = {}) => {
    await page.waitForFunction(() => window.__autoOnlyTestSockets.some(s => s.readyState === 1));
    await page.evaluate(({ type, data }) => {
      const socket = window.__autoOnlyTestSockets.findLast(s => s.readyState === 1);
      socket.onmessage({ data: JSON.stringify({ type, data }) });
    }, { type, data: { game_id: mock.gameId, auto_session_id: mock.session, ...data } });
  };
  const checkBlocked = async () => {
    check(await p().isDisabled() && await b().isDisabled(), 'Auto-only P/B must be disabled');
    const before = mock.calls.filter(call => call.path.endsWith('/gh/games/round')).length;
    await p().evaluate(element => element.click());
    await b().evaluate(element => element.click());
    await page.waitForTimeout(100);
    check(mock.calls.filter(call => call.path.endsWith('/gh/games/round')).length === before,
      'Disabled P/B must not submit a manual round');
    check(await road().count() === 0, 'Auto-only user must not render BigRoad');
  };
  try {
    await open();
    await page.getByText('시스템 정지중 입니다', { exact: true }).waitFor();
    await checkBlocked();
    check(await page.getByText('시작하려면 시스템을 설정 하세요', { exact: true }).isVisible(), 'Stopped guidance');

    mock.running = true;
    await page.getByText('시스템 작동중 입니다', { exact: true }).waitFor();
    await checkBlocked();
    check(await page.getByText('중단하려면 정지 버튼을 누르세요', { exact: true }).isVisible(), 'Running guidance');

    // A placed bet still updates the actual amount board while BigRoad is absent.
    await emit('bet_attempt', { placed: true, direction: 'P', amount_p: 12.3, amount_won: 123000, ext_game_id: 'round-3' });
    await page.getByText('12.3', { exact: true }).first().waitFor();

    // Result and settlement events must still refetch and apply the server state.
    mock.seq = 'PBP';
    mock.pnl = 4.2;
    mock.actualTable = { cells: [], server_current_bet_p: 7.3, server_total_pnl_p: 4.2 };
    await emit('round_committed', { round_count: 3, pnl_actual_p: 4.2 });
    await page.waitForFunction(() => {
      const p = document.querySelector('[aria-label="P 결과 입력"]');
      return p?.nextElementSibling?.textContent === '2';
    });
    await emit('bet_settled');
    await page.getByText('7.3', { exact: true }).first().waitFor();
    check((await page.getByText('전체 PNL', { exact: true }).locator('..').innerText()).includes('4.2'), 'Server PNL must refresh');
    await checkBlocked();

    // Follow the existing game-switched and auto-restarted path for a new shoe.
    const previousGame = mock.gameId;
    mock.gameId = 9002;
    mock.seq = '';
    mock.actualTable = { cells: [], server_total_pnl_p: 0 };
    await emit('game_switched', { game_id: previousGame, new_game_id: mock.gameId });
    await page.waitForURL('**/ghgame/user?gameId=9002*');
    await page.waitForFunction(() => document.querySelector('[aria-label="P 결과 입력"]')?.nextElementSibling?.textContent === '0');
    await emit('auto_restarted', { phase: 'betting', auto_session_id: 'mock-auto-2', source_auto_session_id: mock.session });
    mock.session = 'mock-auto-2';
    await page.getByText('시스템 작동중 입니다', { exact: true }).waitFor();
    await checkBlocked();

    await page.getByRole('button', { name: 'stop', exact: true }).click();
    await page.getByText('시스템 정지중 입니다', { exact: true }).waitFor();
    check(mock.calls.some(call => call.path.endsWith('/auto/stop') && call.body?.auto_session_id === 'mock-auto-2'), 'Stop must use the restarted session');
    await checkBlocked();

    // Existing members and administrators retain their BigRoad and manual input.
    for (const user of [
      { username: 'member-test', nickname: '일반 테스트', role: 'user', auto_only: false },
      { username: 'admin-test', nickname: '관리자 테스트', role: 'admin', auto_only: true },
    ]) {
      mock.user = user;
      await open();
      await road().waitFor();
      check(await p().isEnabled() && await b().isEnabled(), `${user.role} manual controls must remain enabled`);
      check(await page.getByText('시스템 정지중 입니다', { exact: true }).count() === 0, 'Non-auto user should not see notice');
      const before = mock.calls.filter(call => call.path.endsWith('/gh/games/round')).length;
      await p().click();
      await page.waitForTimeout(150);
      check(mock.calls.filter(call => call.path.endsWith('/gh/games/round')).length === before + 1, `${user.role} manual input must still submit`);
    }
    await page.goto('http://127.0.0.1:9035/users');
    await page.getByText('user (오토 전용)', { exact: true }).waitFor();
    const memberRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'auto-test', exact: true }) });
    await memberRow.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    const checkbox = page.getByRole('checkbox', { name: '글로벌히트 오토 전용' });
    check(await checkbox.isChecked(), 'User list editor must load the stored attribute');
    await checkbox.uncheck();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    check(mock.users[0].auto_only === false, 'User list editor must save the attribute');
    check(await page.getByText('user (오토 전용)', { exact: true }).count() === 0, 'User list badge must refresh');
    const adminRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'admin-test', exact: true }) });
    await adminRow.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    check(await checkbox.count() === 0, 'Administrator editor must not offer auto-only');
    await page.getByRole('button', { name: '취소', exact: true }).click();

    return { passed: ['stopped notice', 'running notice', 'P/B blocked', 'BigRoad absent', 'bet amount event', 'result event', 'server PNL settlement', 'new shoe transition', 'stop current session', 'normal member unchanged', 'admin exempt', 'user list edit and save', 'admin editor exempt'], mockedApiRequests: mock.calls.length };
  } finally {
    await page.goto('about:blank');
    await page.unroute('**/api/**', handler);
  }
}
