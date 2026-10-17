/**
 * HTTP transport fail-closed auth (CWE-306).
 *
 * Startup requires a usable CONDUIT_S2S_SECRET unless MCP_ALLOW_INSECURE_DEV=1.
 * A known placeholder or unresolved ${...} template always refuses to start,
 * even with that flag set -- it only bypasses a genuinely empty secret, and
 * forces 127.0.0.1 even when MCP_HTTP_HOST is wider. /mcp rejects a
 * missing or invalid X-Gateway-S2S header. AUTH_MODE=gateway rejects requests
 * that omit credential headers and must not fall back to TERAMIND_* in
 * process.env.
 */

import { createHmac } from 'node:crypto';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getCredentialsMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>();
  return {
    ...actual,
    getCredentials: () => {
      getCredentialsMock();
      return actual.getCredentials();
    },
  };
});

import { startHttpTransport } from '../http.js';

const S2S_SECRET = 's2s-do-not-log-7f3a';
const ENV_ACCESS_TOKEN = 'env-token-must-not-be-used';
const ENV_INSTANCE_URL = 'https://env.teramind.co';
const HEADER_ACCESS_TOKEN = 'header-access-token';
const HEADER_INSTANCE_URL = 'https://header.teramind.co';

const ENV_KEYS = [
  'CONDUIT_S2S_SECRET',
  'MCP_ALLOW_INSECURE_DEV',
  'MCP_HTTP_PORT',
  'MCP_HTTP_HOST',
  'AUTH_MODE',
  'TERAMIND_ACCESS_TOKEN',
  'TERAMIND_INSTANCE_URL',
  'LOG_LEVEL',
  'MCP_TRANSPORT',
] as const;

const savedEnv = new Map<string, string | undefined>();
const servers: Server[] = [];

function mintS2sHeader(secret: string, unixSeconds = Math.floor(Date.now() / 1000)): string {
  const message = `t=${unixSeconds}`;
  const hex = createHmac('sha256', secret).update(message).digest('hex');
  return `${message},v1=${hex}`;
}

function captureStderr(): { text: () => string; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
  });
  return {
    text: () => lines.join('\n'),
    restore: () => spy.mockRestore(),
  };
}

interface HttpResult {
  status: number;
  body: string;
}

function sendHttp(options: {
  port: number;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port: options.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.setTimeout(5000, () => {
      req.destroy(new Error(`timeout ${options.method} ${options.path}`));
    });
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

async function listen(): Promise<{ port: number; address: string }> {
  const server = await startHttpTransport();
  servers.push(server);
  const bound = server.address() as AddressInfo | null;
  if (!bound || typeof bound === 'string') {
    throw new Error('HTTP server did not bind a TCP port');
  }
  return { port: bound.port, address: bound.address };
}

function mcpHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...extra,
  };
}

const accountCall = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'teramind_get_account', arguments: {} },
});

function exitSpy() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${String(code)}`);
  }) as typeof process.exit);
}

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  process.env.MCP_HTTP_PORT = '0';
  process.env.MCP_HTTP_HOST = '127.0.0.1';
  process.env.LOG_LEVEL = 'info';
  delete process.env.CONDUIT_S2S_SECRET;
  delete process.env.MCP_ALLOW_INSECURE_DEV;
  delete process.env.AUTH_MODE;
  delete process.env.TERAMIND_ACCESS_TOKEN;
  delete process.env.TERAMIND_INSTANCE_URL;
  delete process.env.MCP_TRANSPORT;
  getCredentialsMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server?.listening) continue;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

describe('HTTP startup', () => {
  it('refuses to start when CONDUIT_S2S_SECRET is empty', async () => {
    const logs = captureStderr();
    const exit = exitSpy();

    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(exit).toHaveBeenCalledWith(1);
      const text = logs.text();
      expect(text).toContain('Refusing to start HTTP transport');
      expect(text).toContain('CONDUIT_S2S_SECRET is empty');
      expect(text).toContain('CWE-306');
      expect(text).not.toContain(S2S_SECRET);
    } finally {
      logs.restore();
    }
  });

  it('refuses to start when CONDUIT_S2S_SECRET is whitespace', async () => {
    process.env.CONDUIT_S2S_SECRET = '   ';
    const logs = captureStderr();
    const exit = exitSpy();

    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(exit).toHaveBeenCalledWith(1);
      expect(logs.text()).toContain('CONDUIT_S2S_SECRET is empty');
    } finally {
      logs.restore();
    }
  });

  it('still refuses when MCP_ALLOW_INSECURE_DEV is not exactly 1', async () => {
    process.env.MCP_ALLOW_INSECURE_DEV = 'true';
    const logs = captureStderr();
    exitSpy();

    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(logs.text()).toContain('Refusing to start HTTP transport');
    } finally {
      logs.restore();
    }
  });

  it.each([
    'changeme',
    'Change-Me',
    '  your-s2s-secret  ',
    '${user_config.conduit_s2s_secret}',
  ])('refuses known placeholder %j and does not log it', async (placeholder) => {
    process.env.CONDUIT_S2S_SECRET = placeholder;
    const logs = captureStderr();
    const exit = exitSpy();

    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(exit).toHaveBeenCalledWith(1);
      const text = logs.text();
      expect(text).toContain('known placeholder');
      expect(text).toContain('openssl rand -hex 32');
      expect(text).not.toContain(placeholder.trim());
      expect(text).not.toContain(S2S_SECRET);
    } finally {
      logs.restore();
    }
  });

  it('refuses the placeholder word secret without echoing the configured value', async () => {
    process.env.CONDUIT_S2S_SECRET = 'secret';
    const logs = captureStderr();
    exitSpy();

    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      const text = logs.text();
      expect(text).toContain('known placeholder');
      expect(text).not.toContain('CONDUIT_S2S_SECRET=secret');
      expect(text).not.toContain('CONDUIT_S2S_SECRET is secret');
    } finally {
      logs.restore();
    }
  });

  it('allows startup with a warning when MCP_ALLOW_INSECURE_DEV=1 and binds 127.0.0.1', async () => {
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    delete process.env.MCP_HTTP_HOST;
    const logs = captureStderr();
    const exit = exitSpy();

    try {
      const server = await listen();
      expect(exit).not.toHaveBeenCalled();
      expect(server.address).toBe('127.0.0.1');
      const text = logs.text();
      expect(text).toContain('SECURITY WARNING');
      expect(text).toContain('CONDUIT_S2S_SECRET is empty');
      expect(text).toContain('MCP_ALLOW_INSECURE_DEV=1');
      expect(text).toContain('127.0.0.1');
      expect(text).not.toContain('is not 127.0.0.1');
      expect(text).not.toContain(S2S_SECRET);
    } finally {
      logs.restore();
    }
  });

  it('refuses a placeholder even when MCP_ALLOW_INSECURE_DEV=1', async () => {
    process.env.CONDUIT_S2S_SECRET = '  Your-S2S-Secret  ';
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    delete process.env.MCP_HTTP_HOST;
    const logs = captureStderr();
    const exit = exitSpy();

    try {
      await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
      expect(exit).toHaveBeenCalledWith(1);
      const text = logs.text();
      expect(text).toContain('Refusing to start HTTP transport');
      expect(text).toContain('known placeholder');
      expect(text).toContain('MCP_ALLOW_INSECURE_DEV=1');
      expect(text).not.toContain('SECURITY WARNING');
      expect(text).not.toContain('Your-S2S-Secret');
      expect(text).not.toContain('your-s2s-secret');
    } finally {
      logs.restore();
    }
  });

  it.each(['0.0.0.0', 'localhost', '::1'])(
    'forces 127.0.0.1 when the dev bypass host is %s',
    async (host) => {
      process.env.MCP_ALLOW_INSECURE_DEV = '1';
      process.env.MCP_HTTP_HOST = host;
      const logs = captureStderr();
      const exit = exitSpy();

      try {
        const server = await listen();
        expect(exit).not.toHaveBeenCalled();
        expect(server.address).toBe('127.0.0.1');
        const text = logs.text();
        expect(text).toContain(`MCP_HTTP_HOST=${host} is not 127.0.0.1`);
        expect(text).toContain('Binding 127.0.0.1 only');
        expect(text).not.toContain(S2S_SECRET);
      } finally {
        logs.restore();
      }
    },
  );

  it('honors a non-loopback MCP_HTTP_HOST when CONDUIT_S2S_SECRET is set', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_HTTP_HOST = '0.0.0.0';
    const logs = captureStderr();

    try {
      const server = await listen();
      expect(server.address).toBe('0.0.0.0');
      expect(logs.text()).not.toContain('Binding 127.0.0.1 only');
      expect(logs.text()).not.toContain(S2S_SECRET);
    } finally {
      logs.restore();
    }
  });

  it('keeps the 0.0.0.0 bind when a secret is set and MCP_HTTP_HOST is unset', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    delete process.env.MCP_HTTP_HOST;
    const server = await listen();
    expect(server.address).toBe('0.0.0.0');
  });

  it('still enforces S2S and honors MCP_HTTP_HOST when a real secret is set beside the dev flag', async () => {
    process.env.CONDUIT_S2S_SECRET = `  ${S2S_SECRET}  `;
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    process.env.MCP_HTTP_HOST = '0.0.0.0';
    process.env.AUTH_MODE = 'gateway';
    const logs = captureStderr();
    const server = await listen();

    expect(server.address).toBe('0.0.0.0');
    expect(logs.text()).not.toContain('SECURITY WARNING');
    expect(logs.text()).not.toContain(S2S_SECRET);

    const response = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({
        'x-teramind-access-token': HEADER_ACCESS_TOKEN,
        'x-teramind-instance-url': HEADER_INSTANCE_URL,
      }),
      body: accountCall,
    });
    expect(response.status).toBe(401);
    expect(response.body).toContain('X-Gateway-S2S');
    expect(getCredentialsMock).not.toHaveBeenCalled();
    logs.restore();
  });
});

describe('HTTP /mcp authentication', () => {
  beforeEach(() => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.AUTH_MODE = 'gateway';
    process.env.MCP_HTTP_HOST = '127.0.0.1';
    process.env.TERAMIND_ACCESS_TOKEN = ENV_ACCESS_TOKEN;
    process.env.TERAMIND_INSTANCE_URL = ENV_INSTANCE_URL;
  });

  it('returns 401 when the S2S header is missing or invalid and does not log the secret', async () => {
    const logs = captureStderr();
    const server = await listen();
    try {
      const missing = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders({
          'x-teramind-access-token': HEADER_ACCESS_TOKEN,
          'x-teramind-instance-url': HEADER_INSTANCE_URL,
        }),
        body: accountCall,
      });
      const invalid = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders({
          'x-gateway-s2s': mintS2sHeader('wrong-secret'),
          'x-teramind-access-token': HEADER_ACCESS_TOKEN,
          'x-teramind-instance-url': HEADER_INSTANCE_URL,
        }),
        body: accountCall,
      });

      expect(missing.status).toBe(401);
      expect(invalid.status).toBe(401);
      expect(missing.body).toContain('X-Gateway-S2S');
      expect(invalid.body).toContain('X-Gateway-S2S');
      expect(missing.body).not.toContain(S2S_SECRET);
      expect(invalid.body).not.toContain(S2S_SECRET);
      expect(missing.body).not.toContain(ENV_ACCESS_TOKEN);
      expect(missing.body).not.toContain(ENV_INSTANCE_URL);
      expect(logs.text()).not.toContain(S2S_SECRET);
      expect(getCredentialsMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('returns 401 in gateway mode without credential headers and does not use env credentials', async () => {
    const server = await listen();
    const response = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({ 'x-gateway-s2s': mintS2sHeader(S2S_SECRET) }),
      body: accountCall,
    });

    expect(response.status).toBe(401);
    expect(response.body).toContain('Missing credentials');
    expect(response.body).toContain('X-Teramind-Access-Token');
    expect(response.body).toContain('X-Teramind-Instance-Url');
    expect(response.body).not.toContain(ENV_ACCESS_TOKEN);
    expect(response.body).not.toContain(ENV_INSTANCE_URL);
    expect(response.body).not.toContain(S2S_SECRET);
    expect(getCredentialsMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    const partial = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({
        'x-gateway-s2s': mintS2sHeader(S2S_SECRET),
        'x-teramind-access-token': HEADER_ACCESS_TOKEN,
      }),
      body: accountCall,
    });
    expect(partial.status).toBe(401);
    expect(getCredentialsMock).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only gateway credential headers', async () => {
    const server = await listen();
    const response = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({
        'x-gateway-s2s': mintS2sHeader(S2S_SECRET),
        'x-teramind-access-token': '   ',
        'x-teramind-instance-url': '   ',
      }),
      body: accountCall,
    });

    expect(response.status).toBe(401);
    expect(response.body).toContain('Missing credentials');
    expect(getCredentialsMock).not.toHaveBeenCalled();
  });

  it('accepts a valid S2S header plus credential headers and uses those credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ account_id: 42, name: 'Header Tenant' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const logs = captureStderr();
    const server = await listen();
    try {
      const response = await sendHttp({
        port: server.port,
        method: 'POST',
        path: '/mcp',
        headers: mcpHeaders({
          'x-gateway-s2s': mintS2sHeader(S2S_SECRET),
          'x-teramind-access-token': HEADER_ACCESS_TOKEN,
          'x-teramind-instance-url': HEADER_INSTANCE_URL,
        }),
        body: accountCall,
      });

      expect(response.status).toBe(200);
      expect(response.body).not.toContain(S2S_SECRET);
      expect(response.body).not.toContain(ENV_ACCESS_TOKEN);
      expect(response.body).not.toContain(ENV_INSTANCE_URL);
      const payload = JSON.parse(response.body) as {
        result?: { content?: Array<{ text?: string }> };
      };
      const text = payload.result?.content?.[0]?.text ?? '';
      expect(JSON.parse(text).account_id).toBe(42);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${HEADER_INSTANCE_URL}/tm-api/account`);
      expect((init.headers as Record<string, string>)['x-access-token']).toBe(HEADER_ACCESS_TOKEN);
      expect(logs.text()).not.toContain(S2S_SECRET);
      expect(logs.text()).not.toContain(HEADER_ACCESS_TOKEN);
      expect(getCredentialsMock).toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('serves /health without authentication and without reading credentials', async () => {
    const server = await listen();
    const response = await sendHttp({
      port: server.port,
      method: 'GET',
      path: '/health',
    });
    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { status?: string; mode?: string; credentials?: unknown };
    expect(body.status).toBe('ok');
    expect(body.mode).toBe('gateway');
    expect(body.credentials).toBeUndefined();
    expect(response.body).not.toContain(S2S_SECRET);
    expect(response.body).not.toContain(ENV_ACCESS_TOKEN);
    expect(response.body).not.toContain(ENV_INSTANCE_URL);
    expect(getCredentialsMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses env credentials in AUTH_MODE=env after S2S succeeds', async () => {
    process.env.AUTH_MODE = 'env';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ account_id: 7 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const server = await listen();
    const response = await sendHttp({
      port: server.port,
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders({ 'x-gateway-s2s': mintS2sHeader(S2S_SECRET) }),
      body: accountCall,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENV_INSTANCE_URL}/tm-api/account`);
    expect((init.headers as Record<string, string>)['x-access-token']).toBe(ENV_ACCESS_TOKEN);
  });
});
