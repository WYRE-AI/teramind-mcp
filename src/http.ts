import { createServer as createHttpServer, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { runWithCredentials } from './client.js';
import { logger } from './utils/logger.js';
import {
  isUsableConduitS2sSecret,
  resolveHttpListenHost,
  verifyS2sHeader,
  S2S_HEADER,
} from './s2s-verify.js';

/**
 * HTTP transport fails closed (CWE-306).
 *
 * An empty CONDUIT_S2S_SECRET used to skip the X-Gateway-S2S check. Startup
 * now refuses to listen unless the secret is set and is not a known
 * placeholder or unresolved `${...}` template. MCP_ALLOW_INSECURE_DEV=1 is
 * the only bypass: it logs a warning, does not enforce S2S, and binds
 * 127.0.0.1 only. A wider MCP_HTTP_HOST is ignored in that mode.
 *
 * A real secret honors MCP_HTTP_HOST, including 0.0.0.0. When that variable
 * is unset the process keeps the historical 0.0.0.0 bind so container
 * deploys stay reachable. The secret value is never logged.
 *
 * Gateway mode requires X-Teramind-Access-Token and X-Teramind-Instance-Url
 * on every /mcp request and does not fall back to TERAMIND_* in the
 * environment. /health stays unauthenticated and does not read credentials.
 * The stdio transport does not use S2S auth.
 */

const MISSING_S2S_SECRET_ERROR =
  'Refusing to start HTTP transport: CONDUIT_S2S_SECRET is empty. ' +
  'An empty secret would accept unauthenticated /mcp requests (CWE-306). ' +
  'Set CONDUIT_S2S_SECRET to the gateway-provisioned secret (openssl rand -hex 32), ' +
  'or set MCP_ALLOW_INSECURE_DEV=1 for local development only.';

const PLACEHOLDER_S2S_SECRET_ERROR =
  'Refusing to start HTTP transport: CONDUIT_S2S_SECRET is a known placeholder value, not a real service-to-service secret. ' +
  'An empty or placeholder secret would accept unauthenticated /mcp requests (CWE-306). ' +
  'Generate a secret with `openssl rand -hex 32` and set CONDUIT_S2S_SECRET to that value, ' +
  'or set MCP_ALLOW_INSECURE_DEV=1 for local development only.';

function refuseStart(message: string): never {
  logger.error(message);
  process.exit(1);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Fail closed. Read at HTTP startup, not module load, so tests can set the
 * env first. A known placeholder or unresolved template is not a usable
 * secret; MCP_ALLOW_INSECURE_DEV=1 may bypass that the same way it bypasses
 * an empty secret, and the bypass does not check X-Gateway-S2S. The secret
 * value is never logged.
 */
function resolveS2sSecret(env: NodeJS.ProcessEnv = process.env): { secret: string; insecureDev: boolean; placeholder: boolean } {
  const trimmed = (env.CONDUIT_S2S_SECRET ?? '').trim();
  if (isUsableConduitS2sSecret(trimmed)) {
    return { secret: trimmed, insecureDev: false, placeholder: false };
  }

  const placeholder = trimmed.length > 0;
  if (env.MCP_ALLOW_INSECURE_DEV === '1') {
    return { secret: '', insecureDev: true, placeholder };
  }

  refuseStart(placeholder ? PLACEHOLDER_S2S_SECRET_ERROR : MISSING_S2S_SECRET_ERROR);
}

export async function startHttpTransport(): Promise<Server> {
  const { secret: s2sSecret, insecureDev, placeholder } = resolveS2sSecret();
  const port = parseInt(process.env.MCP_HTTP_PORT || '8080', 10);
  const { host, overriddenHost } = resolveHttpListenHost({
    s2sSecret,
    explicitHost: process.env.MCP_HTTP_HOST,
  });

  if (insecureDev) {
    // error level so LOG_LEVEL=warn|error cannot hide the bypass.
    const why = placeholder
      ? 'CONDUIT_S2S_SECRET is a known placeholder'
      : 'CONDUIT_S2S_SECRET is empty';
    logger.error(
      `SECURITY WARNING: ${why} and MCP_ALLOW_INSECURE_DEV=1. ` +
        'HTTP /mcp is not enforcing X-Gateway-S2S and listens on 127.0.0.1 only. ' +
        'Do not use this outside local development.',
    );
    if (overriddenHost) {
      logger.error(
        `WARNING: MCP_HTTP_HOST=${overriddenHost} is not 127.0.0.1. ` +
          'MCP_ALLOW_INSECURE_DEV=1 without a usable CONDUIT_S2S_SECRET cannot listen there. ' +
          'Binding 127.0.0.1 only.',
      );
    }
  }

  const isGatewayMode = process.env.AUTH_MODE === 'gateway';

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health') {
      // /health is container LIVENESS, not credential-readiness. In gateway
      // mode, credentials arrive per-request via X-Teramind-Access-Token /
      // X-Teramind-Instance-Url, not at startup. This handler must not read
      // vendor credentials.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          transport: 'http',
          mode: isGatewayMode ? 'gateway' : 'standalone',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/mcp', '/health'] }));
      return;
    }

    // Empty s2sSecret is only reachable when MCP_ALLOW_INSECURE_DEV=1; startup
    // refuses otherwise. A configured secret is always enforced, before any
    // credential extraction.
    if (s2sSecret && !verifyS2sHeader(headerValue(req.headers[S2S_HEADER]), s2sSecret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Missing or invalid X-Gateway-S2S header: this endpoint only accepts requests signed by the gateway.',
        })
      );
      return;
    }

    const handle = async () => {
      // SECURITY-CRITICAL invariant: this transport MUST stay stateless
      // (sessionIdGenerator: undefined + enableJsonResponse: true).
      // Per-request tenant credentials are carried in an AsyncLocalStorage
      // context opened by runWithCredentials() below. A stateless
      // request->single-response flow keeps the tool call inside that
      // context - switching to a stateful/SSE transport would let a
      // long-lived connection serve later messages under a stale/foreign
      // credential context.
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    };

    // Gateway mode: credentials must arrive on every request via headers.
    // Reject explicitly if missing. Falling through would resolve TERAMIND_*
    // from the process environment, which is not request-scoped.
    if (isGatewayMode) {
      const accessToken = headerValue(req.headers['x-teramind-access-token']);
      const instanceUrl = headerValue(req.headers['x-teramind-instance-url']);
      if (!accessToken || !instanceUrl) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error:
              'Missing credentials. Gateway must inject X-Teramind-Access-Token and X-Teramind-Instance-Url headers.',
          })
        );
        return;
      }
      await runWithCredentials({ accessToken, instanceUrl }, handle);
      return;
    }

    await handle();
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject);
      logger.info(`HTTP streaming server listening on ${host}:${port}`);
      resolve();
    });
  });

  return httpServer;
}

// Vitest imports this module to call startHttpTransport. Skip the CLI
// entrypoint there. `node dist/http.js` still starts HTTP or falls through
// to stdio, matching the previous module-load behavior.
if (process.env.VITEST !== 'true') {
  const transport = process.env.MCP_TRANSPORT;
  if (transport === 'http') {
    startHttpTransport().catch((error) => {
      logger.error('Fatal startup error', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
  } else {
    import('./index.js');
  }
}
