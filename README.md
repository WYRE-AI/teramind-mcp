# Teramind MCP Server

MCP server for [Teramind](https://teramind.co/)'s insider-threat/employee-monitoring API - computer inventory, agent (user) inventory, departments, alerts, anomaly-rule and behavior-policy configuration, and monitoring-profile metadata - for AI assistants and the WYRE Conduit gateway.

**This connector is PII-dense by construction** (insider-threat/employee-monitoring product) and requires security review before merge - see [Scope](#scope) and [Credential scope](#credential-scope-read-this-before-connecting-a-real-account) below.

## Authentication

Teramind authenticates with a JWT **Access Token**, self-generated per-account in the Teramind dashboard (User menu -> Access Tokens), sent as the `x-access-token` header. There is no OAuth flow.

Teramind's API is **per-customer-instance** (cloud or on-premise/private-cloud) - there is no shared multi-tenant base URL like most other connectors in this catalog. Every credential set also carries the customer's own instance URL (e.g. `https://yourcompany.teramind.co`). In gateway mode both arrive per-request via the `X-Teramind-Access-Token` / `X-Teramind-Instance-Url` headers; in local/stdio mode they're read once from `TERAMIND_ACCESS_TOKEN` / `TERAMIND_INSTANCE_URL`.

## Configuration

| Env var | Description |
|---|---|
| `TERAMIND_ACCESS_TOKEN` | JWT access token issued by the Teramind dashboard's Access Tokens menu. |
| `TERAMIND_INSTANCE_URL` | The customer's Teramind instance base URL, e.g. `https://yourcompany.teramind.co`. |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the vars above) or `gateway` (credentials arrive per-request via `X-Teramind-Access-Token` / `X-Teramind-Instance-Url`, injected by the Conduit gateway). |
| `CONDUIT_S2S_SECRET` | When set, the HTTP transport requires a valid `X-Gateway-S2S` header (Conduit sidecar auth) on every `/mcp` request. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

## Tools

### Computers
- `teramind_list_computers` - list monitored computers (hostname, FQDN, MAC/IP, OS, monitoring status).
- `teramind_get_computer` - get full detail for a single computer.

### Agents (users)
- `teramind_list_agents` - list monitored agents (Teramind's term for a monitored employee/user identity): id, name, email, avatar, online status.
- `teramind_get_agent` - get full detail for a single agent.

### Departments
- `teramind_list_departments` - list departments (org-structure metadata).
- `teramind_get_department` - get full detail for a single department.

### Alerts
- `teramind_list_alerts` - list fired rule-violation events in a time window, optionally filtered by agent/computer/department.

### Anomaly rules
- `teramind_list_anomaly_rules` - list configured ML-based anomaly-detection rules (type, risk quotient, trigger conditions).
- `teramind_get_anomaly_rule` - get full detail for a single anomaly rule.
- `teramind_list_anomaly_rule_tags` - list the tags available to categorize anomaly rules.

### Behavior policies
- `teramind_list_behavior_policies` - list behavior policies (what activity type each policy watches and its match conditions).
- `teramind_get_behavior_policy` - get full detail for a single behavior policy.
- `teramind_list_behavior_policy_groups` - list behavior policy groups (the containers that organize behavior policies).
- `teramind_get_behavior_policy_group` - get full detail for a single behavior policy group.

### Monitoring
- `teramind_list_monitoring_profiles` - list monitoring profiles (which data types are configured to be captured, and for whom).

### Account
- `teramind_get_account` - get the authenticated account's own settings (credential sanity check).

## Scope

**This is a deliberately narrow, read-only v1 surface, scoped MORE conservatively than this catalog's usual bar given the sensitivity of an insider-threat/employee-monitoring product.** Teramind's documented API (fetched directly from its published Postman collection, `apidoc.dev.teramind.co`) has **239 operations** across dozens of product areas (monitoring, BI reporting, time tracking, scheduling, productivity classification, LDAP, task management, scheduling). This connector implements **16**: literal HTTP `GET` reads covering only computer/user/session inventory, department metadata, and rule/alert configuration. Every tool is classified `isAdmin: true` in the Conduit gateway regardless of verb, given the sensitivity of employee-monitoring data.

**No literal `GET` endpoint exists for session inventory.** Teramind's session data (`Sessions report`, `Login session` BI grid) is only reachable through `POST` query/grid-style endpoints, not a plain resource `GET` - documented here as a finding, not fabricated as a tool. Session data is out of this connector's v1 scope as a consequence, not a separate exclusion decision.

### Hard-excluded: anything that returns actual monitored content, or mints/reveals a credential - by name, even where the verb is `GET`

Per this connector's scope boundary, the distinction is: metadata **about** monitoring (who is monitored, when, what rule fired) is in scope; the actual captured content of what was monitored, or a mechanism to obtain a live credential, is **not**, regardless of read/write verb.

| Endpoint | Rationale |
|---|---|
| `GET /tm-api/agent/:id/avatar/:scale` | Returns the agent's avatar/headshot image - biometric-adjacent photo content. |
| `GET /tm-api/activity/email/:id/info` | Email-activity metadata (participants/subject) - content-adjacent; excluded alongside its two siblings below rather than judged separately. |
| `GET /tm-api/activity/email/:id/body-html-document` | Returns the full captured email body as rendered HTML. Raw captured content. |
| `GET /tm-api/activity/email/:id/body` | Returns the full captured email body. Raw captured content. |
| `GET /tm-api/player/settings` | Session-recording player/playback settings for a specific agent+computer. |
| `GET /tm-api/player-tags` | Annotations/bookmarks tied to recorded-session timelines. |
| `GET /tm-api/player-tags/timeline` | Timeline tags for a specific agent/computer's recorded sessions over a period. |
| `GET /tm-api/player/export-video/status/:id` | Status of a screen-recording video export job. |
| `GET /tm-api/player/available-video-data` | Enumerates which recorded video segments exist for a computer/period - an inventory of available screen recordings. |
| `GET /tm-api/report/export/download/:id` | Generic report-export download - the export could be of ANY report type this API supports, including keystrokes, emails, instant messages, or video, so it is excluded as a class rather than judged per export. |
| `GET /tm-api/report/export/status` | Status of a report-export job - same generic content-bearing concern as the download endpoint above. |
| `GET /tm-api/short-token` | Mints a new short-lived, live access token. Credential issuance, not content - held to the same bar as a credential-return endpoint in every other connector in this catalog. |
| `GET /tm-api/token` | Lists the account's active JWT token IDs - credential/session-management data. |

No `GET` endpoint anywhere in Teramind's documented API returns raw keystroke logs, chat/IM content, printed-document content, or social-media activity content - those are exclusively reachable through the `POST /tm-api/report/*/grid` and `POST /tm-api/wip/tma-query` (BI) families, which this connector excludes as a category below. **This connector's `GET`-only scope therefore rules out keystroke/screenshot/chat-content exposure by construction**, not merely by the per-endpoint judgment calls above - see [Credential scope](#credential-scope-read-this-before-connecting-a-real-account) for what this claim does and does not cover.

### Excluded by category (out of the named scope: computer/user/session inventory + rule/alert data)

| Category | Why excluded |
|---|---|
| Activities (aggregated activity) | Activity/productivity data, not inventory or rule/alert metadata. |
| BI / BI Filter (37 ops) | All `POST` query/chart endpoints; several return captured content (keystrokes, emails, IM, social media, printed documents, web search, console commands). |
| Reports / Report settings / Reports batch (~55 ops) | All `POST` grid/settings endpoints; several return captured content (keystrokes, emails, IM, printing, social media, console commands, video export). |
| Video export (remaining 2 ops) | `POST` write actions that generate exports of screen-recording content. |
| Time Tracking Reports, Time tracker tasks, Tasks, Schedule | Employee clock-in/task/shift-scheduling features, unrelated to monitoring inventory or rule/alert data. |
| LDAP | Directory-service connection config - out of scope, and a plausible vector for exposing bind-account details even as a plain read. |
| SMTP, Ingestion | Single `POST` write actions (send test email, create VoIP events); no read surface. |
| Shared lists | Rule-input datasets (e.g. keyword/URL watchlists referenced by rules) of ambiguous sensitivity - excluded as a judgment call rather than included by default. |
| Productivity Profile, `instance/tma-categories` | Productivity-classification taxonomy - arguably rule-adjacent, but not named in this connector's scope; excluded to stay tight rather than included as a stretch. |
| `instance/tma-state`, `time`, `license/usage` | Generic utility/status endpoints, none of which fit computer/user/session inventory or rule/alert data. |
| Every `POST`/`PUT`/`DELETE`/`PATCH` on Agent, Computer, Department, Behavior Policy, Anomaly Rule, Authorization, Monitoring Profile | Write, provisioning, enable/disable-monitoring, or account-mutation operations. Never implemented, regardless of verb. |
| Anomaly-rule / behavior-policy templates, tags-and-misc bundle, demo policy | Catalogs for AUTHORING new rules, not this org's actual configured monitoring - out of scope for a read-only inventory connector (`teramind_list_anomaly_rule_tags` is the one exception kept, as a simple, low-risk taxonomy lookup directly useful for interpreting `teramind_list_anomaly_rules` output). |

They can be added as a follow-up if there's demand, after a deliberate scope decision - not by default.

### Field-level restriction, not just endpoint-level

`GET /tm-api/v1/agents[/:id]` supports an optional `fields` query parameter that can return `salary_type` and `default_wage` (compensation data) and `ldap_attrs` (raw directory attributes) - HR/PII data well beyond "who is monitored." **This connector's `client.ts` never passes that parameter**, so only the default identity fields (`agent_id`, `name`, `email_address`, `avatar`, `online`) are ever returned, regardless of what a caller requests through the tool's input schema (there is no `fields` parameter exposed on `teramind_list_agents` / `teramind_get_agent` at all).

### Judgment call flagged for reviewer attention: alert content

`teramind_list_alerts` is squarely in this connector's named scope ("rule/alert data"), and its response shape is documented by Teramind to include `description`/`caption`/`values` fields describing why a rule fired. Depending on the rule type, those fields **may carry a short excerpt of the triggering context** (e.g. a matched keyword, or a visited URL) rather than pure metadata - this is passed through as Teramind returns it, unmodified. This was judged in-scope because alerts are explicitly named in this connector's scope and the excerpt (if present) is bounded to what a human already configured a rule to flag, not raw unfiltered activity capture - but it is flagged here explicitly, per this task's instruction, rather than decided unilaterally as a closed question.

## Credential scope (read this before connecting a real account)

**This is the single most important finding in this README.** Two claims, deliberately kept at different confidence levels:

**(1) STRUCTURALLY VERIFIED** - this connector's own code never calls a content-capture, credential-issuance, or write endpoint. Confirmed against `client.ts`: exactly 16 functions exist, one per tool, each a literal `GET` against one of the endpoints listed in the [Tools](#tools) section above; there is no wildcard/passthrough/generic-request function anywhere in `src/`. **This connector is read-only and non-content-capturing by construction.**

**(2) VENDOR-DOCUMENTED, NOT INDEPENDENTLY VERIFIED** - whether the underlying access token *itself* can be restricted to a metadata-only scope is a separate question from what this connector's code calls, and the answer is more nuanced than a clean yes/no:

- Per Teramind's own Knowledge Base ("User Menu"; "How to change a user's access level" - both fetched directly, 2026-09-20), **an access token inherits the full permissions of whichever account created it**, fixed at creation time. Teramind does not offer a token-scoping mechanism independent of account role.
- **The default case - a single full "Administrator" account, which is what a fresh self-serve cloud trial signup produces - has NO restrictions.** A token created there can reach every one of Teramind's 239 documented operations, including screen recordings, keystroke logs, and email/chat content capture. This connector's code never calls those endpoints, but **the credential itself is not restricted** unless the customer takes deliberate, manual, vendor-side action beyond anything this connector or Conduit controls or verifies.
- Teramind does document a reduced role, **"Operational Administrator,"** that CAN create its own access tokens and is explicitly documented as unable to "browse any recordings or view monitoring data" and unable to see "Alerts" (per Teramind's "How to change a user's access level" article, quoted directly). This is the closest documented approximation to a metadata-only token - but (a) it is a manual account-configuration choice the customer must make, not anything this connector or the Conduit connect flow enforces or checks at connect time; (b) Teramind's documentation describes this as menu/UI-level access, and no independent test was performed sending a request with an Operational-Administrator-scoped token against one of this connector's excluded endpoints to confirm a real server-side 403 versus a UI-only restriction; and (c) that role is explicitly documented as also blocking Alerts, which this connector treats as in-scope - so even the reduced role doesn't map cleanly onto this connector's own scope boundary.
- A further role, **"Infrastructure Administrator,"** is more restrictive still, but (a) cannot create its own access tokens at all (only be assigned one after creation by an Administrator), and (b) per Teramind's docs is "not able to list employee or computer accounts" - i.e. it would also block this connector's own computer/agent inventory tools, so it is not a usable configuration for this connector's purpose either.

**Net finding: by default, nothing about the Teramind access token credential itself prevents it from reaching every endpoint this connector deliberately excludes.** The connector's own code is the actual control boundary (per point 1 above), not the credential. **Recommendation for whoever operates Gate 3 review or advises customers connecting this vendor:** consider documenting that customers should create the token under a dedicated Operational Administrator account rather than a full Administrator, as defense-in-depth against a differently-configured client reusing the same stored token - while treating this connector's own code (which never calls a content-capture endpoint) as the primary, verified control.

## Request limits

- HTTP request bodies are capped at 256 KiB (262144 bytes). After the `X-Gateway-S2S` check passes, a `Content-Length` above the cap returns 413 with a JSON-RPC error; bodies without `Content-Length` are capped by the MCP SDK transport. Unauthenticated requests still get 401 first.
- `tools/call` arguments are capped at 10,000 elements (every array item and object key at any depth). Larger inputs return an `isError` tool result and are never dispatched.

These limits address CVE-2026-111768 / GHSA-46jr-4wx8-v453 (memory exhaustion during validation) and GHSA-f897-62hf-6gxq (no request body / batch cap).

## Development

```bash
npm install
npm run build
npm test
npm run lint   # tsc --noEmit
```

## Docker

```bash
docker build -t teramind-mcp .
docker run -p 8080:8080 -e TERAMIND_ACCESS_TOKEN=... -e TERAMIND_INSTANCE_URL=https://yourcompany.teramind.co teramind-mcp
```
