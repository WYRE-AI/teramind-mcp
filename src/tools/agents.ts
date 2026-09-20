import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getAgent, getCredentials, listAgents } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'teramind_list_agents',
    description:
      "List Teramind agents (Teramind's term for a monitored employee/user identity - not the software agent installed on a computer): id, name, email, avatar, online status. Agent IDs from this response are required by teramind_get_agent and are usable as filters on teramind_list_alerts. This connector never requests the underlying API's optional extended fields (salary_type, default_wage, ldap_attrs) - only these basic identity fields are ever returned.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'teramind_get_agent',
    description:
      'Get full detail for a single monitored agent (user). Requires an agent ID from teramind_list_agents. Same field restriction as teramind_list_agents - no compensation or LDAP attribute data.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID, from teramind_list_agents.' },
      },
      required: ['agent_id'],
    },
  },
];

const TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));
export function isAgentTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAgentTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_agents') {
      return textResult(await listAgents(creds!));
    }

    if (name === 'teramind_get_agent') {
      return textResult(await getAgent(creds!, args.agent_id as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
