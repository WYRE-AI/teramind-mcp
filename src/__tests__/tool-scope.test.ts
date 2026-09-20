import { describe, expect, it } from 'vitest';
import { ALL_TOOLS } from '../tools/index.js';

/**
 * Hard scope boundary (see README's Scope and Credential scope sections for
 * the full accounting against Teramind's 239-operation API): this connector
 * must NEVER expose a tool that returns raw captured monitoring content
 * (screen recordings, screenshots, keystroke logs, session video/playback,
 * email/chat body content), mints/reveals a live credential, or
 * mutates/deletes/provisions anything. Pin the exact tool set so an
 * accidental addition - a copy-pasted "get_available_video_data",
 * "get_short_token", "delete_computer", "enable_computer_monitoring", or any
 * other content-capturing/credential/write tool - fails this test
 * immediately rather than silently shipping.
 */
describe('ALL_TOOLS scope boundary', () => {
  const EXPECTED_TOOL_NAMES = [
    // Computers
    'teramind_list_computers',
    'teramind_get_computer',
    // Agents (users)
    'teramind_list_agents',
    'teramind_get_agent',
    // Departments
    'teramind_list_departments',
    'teramind_get_department',
    // Alerts
    'teramind_list_alerts',
    // Anomaly rules
    'teramind_list_anomaly_rules',
    'teramind_get_anomaly_rule',
    'teramind_list_anomaly_rule_tags',
    // Behavior policies
    'teramind_list_behavior_policies',
    'teramind_get_behavior_policy',
    'teramind_list_behavior_policy_groups',
    'teramind_get_behavior_policy_group',
    // Monitoring
    'teramind_list_monitoring_profiles',
    // Account
    'teramind_get_account',
  ].sort();

  it("exposes exactly this connector's 16 read-only tools - nothing more, nothing less", () => {
    const names = ALL_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
    expect(names).toHaveLength(16);
  });

  it('never exposes a content-capturing, credential-issuing, write, or provisioning tool', () => {
    // Forbidden as a whole underscore-token, not a substring - so this does
    // NOT false-positive on legitimate tokens like 'account' (get_account)
    // or 'policy'/'policies' (behavior_policy).
    const FORBIDDEN_TOKENS = new Set([
      'video',
      'recording',
      'recordings',
      'screenshot',
      'screenshots',
      'keystroke',
      'keystrokes',
      'player',
      'session', // no session-inventory or session-recording tool exists in this connector
      'email', // email activity/body content
      'body',
      'avatar',
      'token', // short-token / JWT-token-listing endpoints (credential material)
      'credential',
      'credentials',
      'export',
      'delete',
      'create',
      'update',
      'enable',
      'disable',
      'restore',
      'password',
    ]);

    for (const tool of ALL_TOOLS) {
      const tokens = tool.name.split('_');
      for (const token of tokens) {
        expect(
          FORBIDDEN_TOKENS.has(token),
          `Tool "${tool.name}" contains forbidden token "${token}" - this connector must stay read-only, metadata-only, and non-credential-exposing.`
        ).toBe(false);
      }
    }
  });

  it('every tool name is prefixed with teramind_', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name.startsWith('teramind_')).toBe(true);
    }
  });

  it('teramind_list_agents and teramind_get_agent never expose a fields parameter in their input schema', () => {
    // Field-level restriction (README's Scope section): the underlying
    // endpoint's optional `fields` param can return salary_type/
    // default_wage/ldap_attrs. Pin that this connector's tool schemas never
    // grow one.
    const agentTools = ALL_TOOLS.filter((t) => t.name === 'teramind_list_agents' || t.name === 'teramind_get_agent');
    expect(agentTools).toHaveLength(2);
    for (const tool of agentTools) {
      const props = (tool.inputSchema as { properties?: Record<string, unknown> }).properties || {};
      expect(Object.keys(props)).not.toContain('fields');
    }
  });
});
