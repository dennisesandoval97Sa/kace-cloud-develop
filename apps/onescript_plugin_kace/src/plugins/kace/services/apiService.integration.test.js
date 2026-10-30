import http from 'node:http';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ApiService } from './apiService.js';

// Integration tests: NO axios mock. The real axios adapter (XHR under jsdom, like the
// browser) talks to a local HTTP server, so they prove the retry/refresh interceptor
// works with the installed axios version.
describe('ApiService (real axios against a local server)', () => {
  let server;
  let baseUrl;
  let hits;
  let respond;
  let authService;

  const buildService = (overrides = {}) =>
    new ApiService({
      apiUrl: baseUrl,
      fingerprint: 'fp-test',
      tenantId: 'tenant-test',
      authService,
      maxRetries: 2,
      retryDelayMs: 1,
      ...overrides,
    });

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      hits += 1;
      respond(req, res, hits);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    // Make sure the HTTP mocks never intercept these requests.
    vi.stubEnv('VITE_MOCK_HTTP', 'false');
    vi.stubEnv('VITE_MOCK_SUBCASES_SEARCH', 'false');
    hits = 0;
    authService = {
      validateToken: vi.fn().mockResolvedValue(undefined),
      getSessionToken: vi.fn().mockReturnValue('token-test'),
      refreshTokenFlow: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const json = (res, status, body = { ok: true }) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  it('retries transient 503 responses and resolves once the server recovers', async () => {
    respond = (_req, res, n) => (n < 3 ? json(res, 503) : json(res, 200));

    const response = await buildService().get('/retry-503', {
      __singleFlight: false,
    });

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(hits).toBe(3);
  });

  it('retries a network error (dropped socket) and resolves on the next attempt', async () => {
    respond = (req, res, n) =>
      n === 1 ? req.socket.destroy() : json(res, 200);

    const response = await buildService().get('/retry-network', {
      __singleFlight: false,
    });

    expect(response.status).toBe(200);
    expect(hits).toBe(2);
  });

  it('does not retry a 404 and rejects with the response status', async () => {
    respond = (_req, res) => json(res, 404, { message: 'not found' });

    await expect(
      buildService().get('/missing', { __singleFlight: false })
    ).rejects.toMatchObject({ response: { status: 404 } });

    expect(hits).toBe(1);
  });

  it('rejects after maxRetries + 1 attempts when the server keeps returning 503', async () => {
    respond = (_req, res) => json(res, 503);

    await expect(
      buildService({ maxRetries: 2 }).get('/always-503', {
        __singleFlight: false,
      })
    ).rejects.toMatchObject({ response: { status: 503 } });

    expect(hits).toBe(3);
  });

  it('refreshes the token once on 401 and retries the request', async () => {
    respond = (_req, res, n) => (n === 1 ? json(res, 401) : json(res, 200));

    const response = await buildService().get('/needs-refresh', {
      __singleFlight: false,
    });

    expect(response.status).toBe(200);
    expect(authService.refreshTokenFlow).toHaveBeenCalledTimes(1);
    expect(hits).toBe(2);
  });
});
