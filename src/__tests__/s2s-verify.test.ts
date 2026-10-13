import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  KNOWN_S2S_PLACEHOLDERS,
  isUsableConduitS2sSecret,
  resolveHttpListenHost,
  verifyS2sHeader,
} from '../s2s-verify.js';

function mintHeader(secret: string, unixSeconds = Math.floor(Date.now() / 1000)): string {
  const message = `t=${unixSeconds}`;
  const hex = createHmac('sha256', secret).update(message).digest('hex');
  return `${message},v1=${hex}`;
}

describe('verifyS2sHeader', () => {
  const secret = 's2s-do-not-log-7f3a';

  it('accepts a fresh header signed with the same secret', () => {
    expect(verifyS2sHeader(mintHeader(secret), secret)).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(verifyS2sHeader(undefined, secret)).toBe(false);
  });

  it('rejects when the secret is empty', () => {
    expect(verifyS2sHeader(mintHeader(secret), '')).toBe(false);
  });

  it('rejects a header signed with a different secret', () => {
    expect(verifyS2sHeader(mintHeader('other-secret'), secret)).toBe(false);
  });
});

describe('isUsableConduitS2sSecret', () => {
  it('rejects empty and whitespace', () => {
    expect(isUsableConduitS2sSecret(undefined)).toBe(false);
    expect(isUsableConduitS2sSecret('')).toBe(false);
    expect(isUsableConduitS2sSecret('   ')).toBe(false);
  });

  it.each([...KNOWN_S2S_PLACEHOLDERS])('rejects known placeholder %j', (placeholder) => {
    expect(isUsableConduitS2sSecret(placeholder)).toBe(false);
    expect(isUsableConduitS2sSecret(`  ${placeholder.toUpperCase()}  `)).toBe(false);
  });

  it('rejects an unresolved template and nothing else that merely contains one', () => {
    expect(isUsableConduitS2sSecret('${user_config.conduit_s2s_secret}')).toBe(false);
    expect(isUsableConduitS2sSecret('  ${CONDUIT_S2S_SECRET}  ')).toBe(false);
    expect(isUsableConduitS2sSecret('prefix-${not-the-whole-value}')).toBe(true);
  });

  it('accepts a real secret', () => {
    expect(isUsableConduitS2sSecret('s2s-do-not-log-7f3a')).toBe(true);
    expect(isUsableConduitS2sSecret('  s2s-do-not-log-7f3a  ')).toBe(true);
  });
});

describe('resolveHttpListenHost', () => {
  it('defaults to 127.0.0.1 when there is no usable secret', () => {
    expect(resolveHttpListenHost({ s2sSecret: '', explicitHost: undefined })).toEqual({
      host: '127.0.0.1',
      overriddenHost: undefined,
    });
    expect(resolveHttpListenHost({ s2sSecret: '', explicitHost: '   ' })).toEqual({
      host: '127.0.0.1',
      overriddenHost: undefined,
    });
  });

  it.each(['0.0.0.0', '10.1.2.3', 'localhost', '::1', '[::1]'])(
    'forces 127.0.0.1 and records the override when the dev host is %j',
    (explicitHost) => {
      expect(resolveHttpListenHost({ s2sSecret: '', explicitHost })).toEqual({
        host: '127.0.0.1',
        overriddenHost: explicitHost,
      });
    },
  );

  it('does not treat an explicit 127.0.0.1 as an override', () => {
    expect(resolveHttpListenHost({ s2sSecret: '', explicitHost: ' 127.0.0.1 ' })).toEqual({
      host: '127.0.0.1',
      overriddenHost: undefined,
    });
  });

  it('honors MCP_HTTP_HOST when a secret is configured, and defaults to 0.0.0.0', () => {
    expect(resolveHttpListenHost({ s2sSecret: 'real-secret', explicitHost: undefined })).toEqual({
      host: '0.0.0.0',
      overriddenHost: undefined,
    });
    expect(resolveHttpListenHost({ s2sSecret: 'real-secret', explicitHost: '10.1.2.3' })).toEqual({
      host: '10.1.2.3',
      overriddenHost: undefined,
    });
    expect(resolveHttpListenHost({ s2sSecret: 'real-secret', explicitHost: '127.0.0.1' })).toEqual({
      host: '127.0.0.1',
      overriddenHost: undefined,
    });
  });
});
