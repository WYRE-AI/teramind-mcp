import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listAlerts } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const ALERT_TOOLS: Tool[] = [
  {
    name: 'teramind_list_alerts',
    description:
      "List alerts (fired rule-violation events) in a time window - which rule fired, when, for which agent/computer, and the rule's own description/caption fields. periodStart and periodEnd are required (ISO 8601 datetime, e.g. 2026-01-01T00:00:00Z); optionally scope to specific agents/computers/departments (comma-separated IDs). NOTE: depending on the rule type that fired, a rule's description/caption/values fields MAY include a short excerpt of the triggering context (e.g. a matched keyword or URL) rather than pure metadata - this is Teramind's documented alert response shape, passed through as received.",
    inputSchema: {
      type: 'object',
      properties: {
        periodStart: { type: 'string', format: 'date-time', description: 'ISO datetime, inclusive lower bound.' },
        periodEnd: { type: 'string', format: 'date-time', description: 'ISO datetime, inclusive upper bound.' },
        agents: { type: 'string', description: 'Comma-separated agent IDs to filter by. From teramind_list_agents.' },
        computers: {
          type: 'string',
          description: 'Comma-separated computer IDs to filter by. From teramind_list_computers.',
        },
        departments: {
          type: 'string',
          description: 'Comma-separated department IDs to filter by. From teramind_list_departments.',
        },
        limit: { type: 'number', description: 'Max results. Defaults to 50.' },
        offset: { type: 'number', description: 'Pagination offset. Defaults to 0.' },
      },
      required: ['periodStart', 'periodEnd'],
    },
  },
];

const TOOL_NAMES = new Set(ALERT_TOOLS.map((t) => t.name));
export function isAlertTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAlertTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_alerts') {
      return textResult(
        await listAlerts(creds!, {
          periodStart: args.periodStart as string,
          periodEnd: args.periodEnd as string,
          agents: args.agents as string | undefined,
          computers: args.computers as string | undefined,
          departments: args.departments as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        })
      );
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
