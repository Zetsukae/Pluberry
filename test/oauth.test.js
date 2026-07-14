const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveOAuthCallbackConfig, isOAuthCallbackRequest } = require('../src/main/oauth-helpers');

test('uses a localhost redirect URL for OAuth by default', () => {
  const config = resolveOAuthCallbackConfig({
    platform: 'darwin',
    port: '9999',
    path: '/auth/callback',
    env: {}
  });

  assert.equal(config.host, 'localhost');
  assert.equal(config.redirectUrl, 'http://localhost:9999/auth/callback');
});

test('respects an explicit redirect override', () => {
  const config = resolveOAuthCallbackConfig({
    platform: 'linux',
    port: '9999',
    path: '/auth/callback',
    env: { SUPABASE_REDIRECT_URL: 'https://example.com/auth/callback' }
  });

  assert.equal(config.redirectUrl, 'https://example.com/auth/callback');
  assert.equal(config.host, 'localhost');
});

test('accepts callback requests that carry auth tokens even on a fallback path', () => {
  const requestUrl = new URL('http://127.0.0.1:9999/callback?access_token=abc123');
  assert.equal(isOAuthCallbackRequest(requestUrl, '/auth/callback'), true);
});
