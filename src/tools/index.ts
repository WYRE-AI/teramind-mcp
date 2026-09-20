import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { COMPUTER_TOOLS, handleComputerTool, isComputerTool } from './computers.js';
import { AGENT_TOOLS, handleAgentTool, isAgentTool } from './agents.js';
import { DEPARTMENT_TOOLS, handleDepartmentTool, isDepartmentTool } from './departments.js';
import { ALERT_TOOLS, handleAlertTool, isAlertTool } from './alerts.js';
import { ANOMALY_RULE_TOOLS, handleAnomalyRuleTool, isAnomalyRuleTool } from './anomaly-rules.js';
import { BEHAVIOR_POLICY_TOOLS, handleBehaviorPolicyTool, isBehaviorPolicyTool } from './behavior-policies.js';
import { MONITORING_TOOLS, handleMonitoringTool, isMonitoringTool } from './monitoring.js';
import { ACCOUNT_TOOLS, handleAccountTool, isAccountTool } from './account.js';
import type { CallToolResult } from './types.js';

export const ALL_TOOLS: Tool[] = [
  ...COMPUTER_TOOLS,
  ...AGENT_TOOLS,
  ...DEPARTMENT_TOOLS,
  ...ALERT_TOOLS,
  ...ANOMALY_RULE_TOOLS,
  ...BEHAVIOR_POLICY_TOOLS,
  ...MONITORING_TOOLS,
  ...ACCOUNT_TOOLS,
];

export async function dispatchToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (isComputerTool(name)) return handleComputerTool(name, args);
  if (isAgentTool(name)) return handleAgentTool(name, args);
  if (isDepartmentTool(name)) return handleDepartmentTool(name, args);
  if (isAlertTool(name)) return handleAlertTool(name, args);
  if (isAnomalyRuleTool(name)) return handleAnomalyRuleTool(name, args);
  if (isBehaviorPolicyTool(name)) return handleBehaviorPolicyTool(name, args);
  if (isMonitoringTool(name)) return handleMonitoringTool(name, args);
  if (isAccountTool(name)) return handleAccountTool(name, args);
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
}
