import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAnomalyRuleTool } from '../tools/anomaly-rules.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleAnomalyRuleTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_anomaly_rules hits /tm-api/behavior-rule', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ behavior_rule_id: 1, name: 'Excessive downloads' }]));

    const result = await runWithCredentials(creds, () => handleAnomalyRuleTool('teramind_list_anomaly_rules', {}));

    expect(result.isError).toBeUndefined();
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-rule');
    expect(JSON.parse(textOf(result))[0].behavior_rule_id).toBe(1);
  });

  it('teramind_get_anomaly_rule scopes the request to the rule ID in the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ behavior_rule_id: 9 }));

    const result = await runWithCredentials(creds, () => handleAnomalyRuleTool('teramind_get_anomaly_rule', { id: '9' }));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-rule/9');
    expect(result.isError).toBeUndefined();
  });

  it('teramind_list_anomaly_rule_tags hits /tm-api/behavior-rule/tags', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(['risk', 'compliance']));

    const result = await runWithCredentials(creds, () =>
      handleAnomalyRuleTool('teramind_list_anomaly_rule_tags', {})
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-rule/tags');
    expect(result.isError).toBeUndefined();
  });
});
