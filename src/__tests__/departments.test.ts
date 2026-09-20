import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDepartmentTool } from '../tools/departments.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleDepartmentTool', () => {
  const fetchMock = vi.fn();
  const creds = { accessToken: 'token-1', instanceUrl: 'https://acme.teramind.co' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teramind_list_departments hits /tm-api/department', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ department_id: 1, name: 'Engineering' }]));

    const result = await runWithCredentials(creds, () => handleDepartmentTool('teramind_list_departments', {}));

    expect(result.isError).toBeUndefined();
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/department');
    expect(JSON.parse(textOf(result))[0].name).toBe('Engineering');
  });

  it('teramind_get_department scopes the request to the department ID in the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ department_id: 2, name: 'Sales' }));

    const result = await runWithCredentials(creds, () =>
      handleDepartmentTool('teramind_get_department', { department_id: '2' })
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/tm-api/department/2');
    expect(result.isError).toBeUndefined();
  });
});
