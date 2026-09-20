import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleBehaviorPolicyTool } from '../tools/behavior-policies.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleBehaviorPolicyTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_behavior_policies hits /tm-api/behavior-policy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ behavior_policy_id: 1 }]));

    const result = await runWithCredentials(creds, () =>
      handleBehaviorPolicyTool('teramind_list_behavior_policies', {})
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-policy');
    expect(result.isError).toBeUndefined();
  });

  it('teramind_get_behavior_policy scopes the request to the policy ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ behavior_policy_id: 3 }));

    const result = await runWithCredentials(creds, () =>
      handleBehaviorPolicyTool('teramind_get_behavior_policy', { id: '3' })
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-policy/3');
    expect(result.isError).toBeUndefined();
  });

  it('teramind_list_behavior_policy_groups hits /tm-api/behavior-group', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ behavior_group_id: 1 }]));

    const result = await runWithCredentials(creds, () =>
      handleBehaviorPolicyTool('teramind_list_behavior_policy_groups', {})
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-group');
    expect(result.isError).toBeUndefined();
  });

  it('teramind_get_behavior_policy_group scopes the request to the group ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ behavior_group_id: 4 }));

    const result = await runWithCredentials(creds, () =>
      handleBehaviorPolicyTool('teramind_get_behavior_policy_group', { id: '4' })
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/behavior-group/4');
    expect(result.isError).toBeUndefined();
  });

  it('surfaces an unexpected status as a readable API error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

    const result = await runWithCredentials(creds, () =>
      handleBehaviorPolicyTool('teramind_list_behavior_policies', {})
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/HTTP 500/);
  });
});
