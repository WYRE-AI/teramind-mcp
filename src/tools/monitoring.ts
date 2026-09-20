import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listMonitoringProfiles } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const MONITORING_TOOLS: Tool[] = [
  {
    name: 'teramind_list_monitoring_profiles',
    description:
      'List monitoring profiles - named configurations describing WHICH data types are captured (e.g. web activity, email, keystrokes) and for which agents, plus whether the profile is private. This is metadata ABOUT the scope of monitoring (what is configured to be watched, and for whom) - never the captured content itself.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const TOOL_NAMES = new Set(MONITORING_TOOLS.map((t) => t.name));
export function isMonitoringTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleMonitoringTool(
  name: string,
  _args: Record<string, unknown>
): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_monitoring_profiles') {
      return textResult(await listMonitoringProfiles(creds!));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
