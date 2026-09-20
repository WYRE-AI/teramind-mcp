import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAgentTool } from '../tools/agents.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleAgentTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_agents hits /tm-api/v1/agents and never sends a fields param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ agent_id: 100, name: 'Agent Name' }]));

    const result = await runWithCredentials(creds, () => handleAgentTool('teramind_list_agents', {}));

    expect(result.isError).toBeUndefined();
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/tm-api/v1/agents');
    // Field-level restriction (README's Scope section): this connector must
    // never request salary_type/default_wage/ldap_attrs via the fields param.
    expect(url.searchParams.has('fields')).toBe(false);
    expect(JSON.parse(textOf(result))[0].agent_id).toBe(100);
  });

  it('teramind_get_agent scopes the request to the agent ID in the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ agent_id: 7, online: true }));

    const result = await runWithCredentials(creds, () => handleAgentTool('teramind_get_agent', { agent_id: '7' }));

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/tm-api/v1/agents/7');
    expect(url.searchParams.has('fields')).toBe(false);
    expect(result.isError).toBeUndefined();
  });

  it('returns a credential error without calling fetch when no credentials are configured', async () => {
    const result = await handleAgentTool('teramind_list_agents', {});

    expect(result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
