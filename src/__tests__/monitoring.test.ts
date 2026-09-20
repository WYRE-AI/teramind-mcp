import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMonitoringTool } from '../tools/monitoring.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse } from './test-helpers.js';

describe('handleMonitoringTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_monitoring_profiles hits /tm-api/v1/monitoring-profile', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ tracking_profile_id: 1, name: 'Default' }]));

    const result = await runWithCredentials(creds, () =>
      handleMonitoringTool('teramind_list_monitoring_profiles', {})
    );

    expect(result.isError).toBeUndefined();
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/v1/monitoring-profile');
  });
});
