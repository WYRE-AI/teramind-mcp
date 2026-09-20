import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getComputer, getCredentials, listComputers } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const COMPUTER_TOOLS: Tool[] = [
  {
    name: 'teramind_list_computers',
    description:
      'List computers under Teramind monitoring - hostname, FQDN, MAC/IP addresses, OS, monitoring status (is_monitored), and agent-software install/update state. Computer IDs from this response are required by teramind_get_computer. Inventory metadata only - never screen recordings or captured activity content.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'teramind_get_computer',
    description:
      'Get full detail for a single monitored computer. Requires a computer ID from teramind_list_computers.',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: { type: 'string', description: 'Computer ID, from teramind_list_computers.' },
      },
      required: ['computer_id'],
    },
  },
];

const TOOL_NAMES = new Set(COMPUTER_TOOLS.map((t) => t.name));
export function isComputerTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleComputerTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_computers') {
      return textResult(await listComputers(creds!));
    }

    if (name === 'teramind_get_computer') {
      return textResult(await getComputer(creds!, args.computer_id as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
