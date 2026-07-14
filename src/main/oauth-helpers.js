const path = require('node:path');

function normalizeOAuthHost(platform = process.platform, env = process.env) {
  if (env.SUPABASE_REDIRECT_HOST) {
    return env.SUPABASE_REDIRECT_HOST;
  }

  return 'localhost';
}

function resolveOAuthCallbackConfig(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const port = options.port || env.SUPABASE_REDIRECT_PORT || '9999';
  const pathName = options.path || env.SUPABASE_REDIRECT_PATH || '/auth/callback';

  if (env.SUPABASE_REDIRECT_URL) {
    return {
      host: normalizeOAuthHost(platform, env),
      port,
      path: pathName,
      redirectUrl: env.SUPABASE_REDIRECT_URL,
      useLoopback: true,
    };
  }

  const host = normalizeOAuthHost(platform, env);
  const redirectUrl = `http://${host}:${port}${pathName}`;

  return {
    host,
    port,
    path: pathName,
    redirectUrl,
    useLoopback: true,
  };
}

function isOAuthCallbackRequest(requestUrl, expectedPath = '/auth/callback') {
  if (!requestUrl) return false;

  const pathname = requestUrl.pathname || '';
  const normalizedPath = pathname.replace(/\/$/, '');
  const candidates = new Set([
    normalizedPath,
    expectedPath,
    '/auth/callback',
    '/callback',
    '/auth/callback/',
    '/callback/'
  ]);

  if (candidates.has(normalizedPath) || candidates.has(expectedPath)) {
    return true;
  }

  const search = requestUrl.search || '';
  const hash = requestUrl.hash || '';
  const hasAuthTokens = /(?:^|[?&#])(access_token|refresh_token|error)=/.test(`${search}${hash}`);

  return hasAuthTokens && (normalizedPath === '/callback' || normalizedPath === '/auth/callback' || normalizedPath === '' || normalizedPath === '/');
}

module.exports = {
  normalizeOAuthHost,
  resolveOAuthCallbackConfig,
  isOAuthCallbackRequest,
};
