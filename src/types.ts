/**
 * Teramind authenticates with a JWT Access Token, self-generated per-account
 * in the dashboard (User menu -> Access Tokens), passed in the
 * `x-access-token` header. There is no OAuth flow.
 *
 * IMPORTANT (see README's "Credential scope" section): Teramind's API is
 * per-customer-instance (cloud or on-premise/private-cloud) - there is no
 * single shared base URL, so every credential set also carries the
 * customer's own instance URL, same shape as this org's IT Glue/Syncro
 * connectors (a customer-suppliable base URL rather than a fixed constant).
 *
 * ALSO IMPORTANT: per Teramind's own Knowledge Base ("User Menu" /
 * "How to change a user's access level"), an access token INHERITS THE FULL
 * PERMISSIONS of whichever account created it. By default (a single
 * Administrator account - the common case for a fresh self-serve trial) a
 * token can reach every endpoint in Teramind's API, including screen
 * recordings, keystroke logs, and email/chat content capture. This
 * connector's own code never calls those endpoints (see client.ts - only
 * the functions below exist, no passthrough/wildcard call anywhere), but
 * the credential itself is not restricted by this connector or by Conduit.
 */
export interface TeramindCredentials {
  accessToken: string;
  instanceUrl: string;
}

/** Thrown when Teramind rejects the access token (HTTP 401) - distinct from rate limiting so callers get an honest error. */
export class TeramindAuthError extends Error {}

/** Thrown when Teramind rate-limits the request (HTTP 429) - distinct from an auth failure. */
export class TeramindRateLimitError extends Error {}

/** Thrown for any other non-2xx / unexpected vendor response. */
export class TeramindApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

// ---------------------------------------------------------------------
// Computer
// ---------------------------------------------------------------------

export interface Computer {
  computer_id: number;
  computer_uid?: string;
  account_id?: number;
  name?: string;
  fqdn?: string;
  macs?: string[];
  deleted?: number;
  os?: string;
  client?: string;
  ip?: string;
  client_mode?: number;
  pinged_at?: string;
  sid?: string;
  keep_recordings?: number;
  machine_type?: number;
  auto_enable_mon?: number;
  auto_clear_print_spool?: boolean | number;
  uuid?: string | number;
  uninstall_pending?: boolean;
  update_pending?: boolean;
  is_monitored?: boolean;
  is_deleted?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Agent (Teramind's term for a monitored employee/user identity - distinct
// from the "Teramind Agent" software installed on a computer)
// ---------------------------------------------------------------------

/**
 * This connector deliberately never passes the underlying endpoint's
 * optional `fields` query parameter - see README's Scope section. Without
 * it, Teramind returns only agent_id/name/email_address/avatar/online;
 * WITH it, the same endpoint can also return salary_type, default_wage
 * (compensation data), and ldap_attrs (raw directory attributes) - HR/PII
 * data well beyond "who is monitored", so this connector's client.ts never
 * requests it.
 */
export interface Agent {
  agent_id: number;
  name?: string;
  email_address?: string;
  avatar?: string;
  online?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------

export interface Department {
  department_id: number;
  account_id?: number;
  name?: string;
  description?: string;
  time_created?: string;
  guid?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------

export interface ListAlertsParams {
  periodStart: string;
  periodEnd: string;
  agents?: string;
  computers?: string;
  departments?: string;
  limit?: number;
  offset?: number;
}

export interface Alert {
  id: number;
  timestamp?: string;
  agent?: Record<string, unknown>;
  computer?: Record<string, unknown>;
  rule?: Record<string, unknown>;
  description?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Anomaly rules (behavior-rule) - ML-based anomaly-detection rule config
// ---------------------------------------------------------------------

export interface AnomalyRule {
  behavior_rule_id: number;
  name?: string;
  account_id?: number;
  agent_id?: number;
  rule_type?: number;
  rule_subtype?: number;
  deleted?: number;
  risk_quotient?: number;
  [key: string]: unknown;
}

export interface AnomalyRuleTag {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Behavior policies / groups - rule-based monitoring policy config
// ---------------------------------------------------------------------

export interface BehaviorPolicy {
  behavior_policy_id: number;
  behavior_group_id?: number;
  entity_group_id?: number;
  name?: string;
  category?: number;
  description?: string;
  active?: boolean;
  draft?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
}

export interface BehaviorPolicyGroup {
  behavior_group_id: number;
  entity_group_id?: number;
  name?: string;
  created?: string;
  deleted?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Monitoring profiles - which data types are captured for whom (config
// metadata ABOUT monitoring scope, not captured content itself)
// ---------------------------------------------------------------------

export interface MonitoringProfile {
  tracking_profile_id: number;
  name?: string;
  description?: string;
  private?: boolean;
  date_created?: string;
  agent_ids?: number[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Account (the authenticated caller's own account - also used by validate())
// ---------------------------------------------------------------------

export interface AccountInfo {
  account_id: number;
  name?: string;
  timezone?: string;
  currency?: string;
  [key: string]: unknown;
}
