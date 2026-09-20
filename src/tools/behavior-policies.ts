import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getBehaviorPolicy,
  getBehaviorPolicyGroup,
  getCredentials,
  listBehaviorPolicies,
  listBehaviorPolicyGroups,
} from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const BEHAVIOR_POLICY_TOOLS: Tool[] = [
  {
    name: 'teramind_list_behavior_policies',
    description:
      'List behavior policies (Teramind UI: "behavior policy rule") - what activity type each policy watches (e.g. web/email/print), its match conditions, and configured actions/reactions. Rule CONFIGURATION metadata only - the condition a policy matches on, never the captured activity that matched it. Policy IDs from this response are required by teramind_get_behavior_policy.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'teramind_get_behavior_policy',
    description: 'Get full detail for a single behavior policy. Requires a policy ID from teramind_list_behavior_policies.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Behavior policy ID, from teramind_list_behavior_policies.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teramind_list_behavior_policy_groups',
    description:
      'List behavior policy groups (Teramind UI: "Behavior policy") - the containers that organize behavior policies. Group IDs from this response are required by teramind_get_behavior_policy_group.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'teramind_get_behavior_policy_group',
    description:
      'Get full detail for a single behavior policy group. Requires a group ID from teramind_list_behavior_policy_groups.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Behavior policy group ID, from teramind_list_behavior_policy_groups.' },
      },
      required: ['id'],
    },
  },
];

const TOOL_NAMES = new Set(BEHAVIOR_POLICY_TOOLS.map((t) => t.name));
export function isBehaviorPolicyTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleBehaviorPolicyTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_behavior_policies') {
      return textResult(await listBehaviorPolicies(creds!));
    }

    if (name === 'teramind_get_behavior_policy') {
      return textResult(await getBehaviorPolicy(creds!, args.id as string));
    }

    if (name === 'teramind_list_behavior_policy_groups') {
      return textResult(await listBehaviorPolicyGroups(creds!));
    }

    if (name === 'teramind_get_behavior_policy_group') {
      return textResult(await getBehaviorPolicyGroup(creds!, args.id as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
