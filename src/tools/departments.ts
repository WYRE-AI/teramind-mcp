import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getDepartment, listDepartments } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const DEPARTMENT_TOOLS: Tool[] = [
  {
    name: 'teramind_list_departments',
    description:
      'List departments configured in Teramind - org-structure metadata used to group agents/computers. Department IDs from this response are usable as filters on teramind_list_alerts.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'teramind_get_department',
    description: 'Get full detail for a single department. Requires a department ID from teramind_list_departments.',
    inputSchema: {
      type: 'object',
      properties: {
        department_id: { type: 'string', description: 'Department ID, from teramind_list_departments.' },
      },
      required: ['department_id'],
    },
  },
];

const TOOL_NAMES = new Set(DEPARTMENT_TOOLS.map((t) => t.name));
export function isDepartmentTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleDepartmentTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'teramind_list_departments') {
      return textResult(await listDepartments(creds!));
    }

    if (name === 'teramind_get_department') {
      return textResult(await getDepartment(creds!, args.department_id as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
