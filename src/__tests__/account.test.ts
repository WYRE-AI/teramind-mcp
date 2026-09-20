import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountTool } from '../tools/account.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleAccountTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_get_account sends the access token and hits /tm-api/account', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ account_id: 42, name: 'Acme Corp' }));

    const result = await runWithCredentials(creds, () => handleAccountTool('teramind_get_account', {}));

    expect(result.isError).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/tm-api/account');
    expect((init.headers as Record<string, string>)['x-access-token']).toBe('token-1');
    expect(JSON.parse(textOf(result)).account_id).toBe(42);
  });
});
