import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getAccount, getCredentials } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const ACCOUNT_TOOLS: Tool[] = [
  {
    name: 'teramind_get_account',
    description:
      "Get the authenticated account's own settings (account name, timezone, currency) - a credential sanity check, not employee/agent data. Does not reveal what permission tier the access token's creating account holds; see this connector's README Credential scope section.",
    inputSchema: { type: 'object', properties: {} },
  },
];

const TOOL_NAMES = new Set(ACCOUNT_TOOLS.map((t) => t.name));
export function isAccountTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAccountTool(
  name: string,
  _args: Record<string, unknown>
): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_get_account') {
      return textResult(await getAccount(creds!));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
