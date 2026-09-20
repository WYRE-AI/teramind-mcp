import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './utils/logger.js';
import {
  TeramindApiError,
  TeramindAuthError,
  TeramindRateLimitError,
} from './types.js';
import type {
  AccountInfo,
  Agent,
  AnomalyRule,
  BehaviorPolicy,
  BehaviorPolicyGroup,
  Computer,
  Department,
  ListAlertsParams,
  MonitoringProfile,
  TeramindCredentials,
} from './types.js';

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({accessToken, instanceUrl}); getCredentials()
// reads from it. Falls back to process.env for stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<TeramindCredentials>();

export function runWithCredentials<T>(creds: TeramindCredentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): TeramindCredentials | null {
  const scoped = credStore.getStore();
  if (scoped?.accessToken && scoped?.instanceUrl) return scoped;
  const accessToken = process.env.TERAMIND_ACCESS_TOKEN;
  const instanceUrl = process.env.TERAMIND_INSTANCE_URL;
  if (!accessToken || !instanceUrl) {
    logger.warn('Missing credentials', { hasAccessToken: !!accessToken, hasInstanceUrl: !!instanceUrl });
    return null;
  }
  return { accessToken, instanceUrl };
}

function apiBase(creds: TeramindCredentials): string {
  return creds.instanceUrl.replace(/\/+$/, '');
}

function buildQuery(params: Record<string, unknown> = {}): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    qs.append(key, String(value));
  }
  return qs;
}

async function doGet<T>(
  creds: TeramindCredentials,
  path: string,
  query?: Record<string, unknown>
): Promise<T> {
  const qs = query ? buildQuery(query).toString() : '';
  const url = `${apiBase(creds)}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-access-token': creds.accessToken, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  // 401 (invalid/revoked token) and 429 (rate-limited) are distinct failure
  // modes with distinct remediations - grouping them under one generic
  // auth-error class hides a transient rate limit behind a message that
  // reads like a bad/expired token.
  if (res.status === 401) {
    throw new TeramindAuthError(`Teramind rejected the access token (HTTP 401): ${path}`);
  }
  if (res.status === 429) {
    throw new TeramindRateLimitError(`Teramind rate-limited the request (HTTP 429): ${path}`);
  }
  if (!res.ok) {
    throw new TeramindApiError(`Teramind ${path} failed: HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------
// Computer - device inventory
// ---------------------------------------------------------------------

/** GET /tm-api/computer - list monitored computers. */
export async function listComputers(creds: TeramindCredentials): Promise<Computer[]> {
  return doGet(creds, '/tm-api/computer');
}

/** GET /tm-api/computer/:id - get a single computer. */
export async function getComputer(creds: TeramindCredentials, id: string): Promise<Computer> {
  return doGet(creds, `/tm-api/computer/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------
// Agent - Teramind's term for a monitored employee/user identity.
//
// Deliberately never passes the underlying endpoint's optional `fields`
// query parameter - see types.ts's Agent interface comment and README's
// Scope section. Without it, only agent_id/name/email_address/avatar/online
// are returned.
// ---------------------------------------------------------------------

/** GET /tm-api/v1/agents - list monitored agents (users). */
export async function listAgents(creds: TeramindCredentials): Promise<Agent[]> {
  return doGet(creds, '/tm-api/v1/agents');
}

/** GET /tm-api/v1/agents/:id - get a single agent (user). */
export async function getAgent(creds: TeramindCredentials, id: string): Promise<Agent> {
  return doGet(creds, `/tm-api/v1/agents/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------
// Departments - org structure metadata
// ---------------------------------------------------------------------

/** GET /tm-api/department - list departments. */
export async function listDepartments(creds: TeramindCredentials): Promise<Department[]> {
  return doGet(creds, '/tm-api/department');
}

/** GET /tm-api/department/:id - get a single department. */
export async function getDepartment(creds: TeramindCredentials, id: string): Promise<Department> {
  return doGet(creds, `/tm-api/department/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------
// Alerts - fired rule-violation events
// ---------------------------------------------------------------------

/** GET /tm-api/v1/alerts - list alerts in a time window, optionally filtered by agent/computer/department. */
export async function listAlerts(creds: TeramindCredentials, params: ListAlertsParams): Promise<unknown> {
  return doGet(creds, '/tm-api/v1/alerts', { ...params });
}

// ---------------------------------------------------------------------
// Anomaly rules (behavior-rule) - ML-based anomaly-detection rule config
// ---------------------------------------------------------------------

/** GET /tm-api/behavior-rule - list configured anomaly rules. */
export async function listAnomalyRules(creds: TeramindCredentials): Promise<AnomalyRule[]> {
  return doGet(creds, '/tm-api/behavior-rule');
}

/** GET /tm-api/behavior-rule/:id - get a single anomaly rule. */
export async function getAnomalyRule(creds: TeramindCredentials, id: string): Promise<AnomalyRule> {
  return doGet(creds, `/tm-api/behavior-rule/${encodeURIComponent(id)}`);
}

/** GET /tm-api/behavior-rule/tags - list the tags available to categorize anomaly rules. */
export async function listAnomalyRuleTags(creds: TeramindCredentials): Promise<unknown> {
  return doGet(creds, '/tm-api/behavior-rule/tags');
}

// ---------------------------------------------------------------------
// Behavior policies / groups - rule-based monitoring policy config
// ---------------------------------------------------------------------

/** GET /tm-api/behavior-policy - list behavior policies (UI: "behavior policy rule"). */
export async function listBehaviorPolicies(creds: TeramindCredentials): Promise<BehaviorPolicy[]> {
  return doGet(creds, '/tm-api/behavior-policy');
}

/** GET /tm-api/behavior-policy/:id - get a single behavior policy. */
export async function getBehaviorPolicy(creds: TeramindCredentials, id: string): Promise<BehaviorPolicy> {
  return doGet(creds, `/tm-api/behavior-policy/${encodeURIComponent(id)}`);
}

/** GET /tm-api/behavior-group - list behavior policy groups (UI: "Behavior policy"). */
export async function listBehaviorPolicyGroups(creds: TeramindCredentials): Promise<BehaviorPolicyGroup[]> {
  return doGet(creds, '/tm-api/behavior-group');
}

/** GET /tm-api/behavior-group/:id - get a single behavior policy group. */
export async function getBehaviorPolicyGroup(
  creds: TeramindCredentials,
  id: string
): Promise<BehaviorPolicyGroup> {
  return doGet(creds, `/tm-api/behavior-group/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------
// Monitoring profiles - which data types are captured for whom (config
// metadata ABOUT monitoring scope, not captured content itself)
// ---------------------------------------------------------------------

/** GET /tm-api/v1/monitoring-profile - list monitoring profiles. */
export async function listMonitoringProfiles(creds: TeramindCredentials): Promise<MonitoringProfile[]> {
  return doGet(creds, '/tm-api/v1/monitoring-profile');
}

// ---------------------------------------------------------------------
// Account - the authenticated caller's own account (also used by validate())
// ---------------------------------------------------------------------

/** GET /tm-api/account - get the authenticated account's own settings (identity/credential sanity check). */
export async function getAccount(creds: TeramindCredentials): Promise<AccountInfo> {
  return doGet(creds, '/tm-api/account');
}
