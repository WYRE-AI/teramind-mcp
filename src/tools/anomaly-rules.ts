import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getAnomalyRule, getCredentials, listAnomalyRuleTags, listAnomalyRules } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const ANOMALY_RULE_TOOLS: Tool[] = [
  {
    name: 'teramind_list_anomaly_rules',
    description:
      'List configured ML-based anomaly-detection rules (Teramind UI: "Anomaly Rules") - rule name, type/subtype, risk quotient, trigger conditions, and assignment scope. Rule CONFIGURATION metadata only - describes what is being watched for, never the captured activity that triggered a rule. Rule IDs from this response are required by teramind_get_anomaly_rule.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'teramind_get_anomaly_rule',
    description: 'Get full detail for a single anomaly rule. Requires a rule ID from teramind_list_anomaly_rules.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Anomaly rule ID, from teramind_list_anomaly_rules.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teramind_list_anomaly_rule_tags',
    description: 'List the tags available to categorize anomaly rules.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const TOOL_NAMES = new Set(ANOMALY_RULE_TOOLS.map((t) => t.name));
export function isAnomalyRuleTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAnomalyRuleTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_anomaly_rules') {
      return textResult(await listAnomalyRules(creds!));
    }

    if (name === 'teramind_get_anomaly_rule') {
      return textResult(await getAnomalyRule(creds!, args.id as string));
    }

    if (name === 'teramind_list_anomaly_rule_tags') {
      return textResult(await listAnomalyRuleTags(creds!));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
