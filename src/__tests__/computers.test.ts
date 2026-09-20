import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleComputerTool } from '../tools/computers.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleComputerTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_computers sends the access token header and hits the right path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ computer_id: 1, name: 'WKSTN-01' }]));

    const result = await runWithCredentials(creds, () => handleComputerTool('teramind_list_computers', {}));

    expect(result.isError).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/tm-api/computer');
    expect((init.headers as Record<string, string>)['x-access-token']).toBe('token-1');
    expect(JSON.parse(textOf(result))[0].computer_id).toBe(1);
  });

  it('teramind_get_computer scopes the request to the computer ID in the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ computer_id: 5, is_monitored: true }));

    const result = await runWithCredentials(creds, () =>
      handleComputerTool('teramind_get_computer', { computer_id: '5' })
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/computer/5');
    expect(result.isError).toBeUndefined();
  });

  it('surfaces a 401 as a readable auth error rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401));

    const result = await runWithCredentials(creds, () => handleComputerTool('teramind_list_computers', {}));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/rejected the access token/i);
  });

  it('returns a credential error without calling fetch when no credentials are configured', async () => {
    const result = await handleComputerTool('teramind_list_computers', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/TERAMIND_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
