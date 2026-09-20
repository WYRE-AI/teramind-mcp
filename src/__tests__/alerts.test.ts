import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAlertTool } from '../tools/alerts.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleAlertTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_alerts forwards the required period bounds and optional filters', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, timestamp: '2026-01-01T00:00:00Z' }]));

    const result = await runWithCredentials(creds, () =>
      handleAlertTool('teramind_list_alerts', {
        periodStart: '2026-01-01T00:00:00Z',
        periodEnd: '2026-01-02T00:00:00Z',
        agents: '1,2',
        computers: '3',
        departments: '4',
        limit: 25,
        offset: 0,
      })
    );

    expect(result.isError).toBeUndefined();
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/tm-api/v1/alerts');
    expect(url.searchParams.get('periodStart')).toBe('2026-01-01T00:00:00Z');
    expect(url.searchParams.get('periodEnd')).toBe('2026-01-02T00:00:00Z');
    expect(url.searchParams.get('agents')).toBe('1,2');
    expect(url.searchParams.get('computers')).toBe('3');
    expect(url.searchParams.get('departments')).toBe('4');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(JSON.parse(textOf(result))[0].id).toBe(1);
  });

  it('surfaces a 429 as a readable rate-limit error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429));

    const result = await runWithCredentials(creds, () =>
      handleAlertTool('teramind_list_alerts', {
        periodStart: '2026-01-01T00:00:00Z',
        periodEnd: '2026-01-02T00:00:00Z',
      })
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/rate-limited/i);
  });
});
