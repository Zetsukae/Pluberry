const http = require('node:http');
const path = require('node:path');
const { app, shell, BrowserWindow } = require('electron');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const Store = require('electron-store');
const { locales } = require('../locales');
const { loadDotEnv } = require('./env-loader');
const { resolveOAuthCallbackConfig, isOAuthCallbackRequest } = require('../main/oauth-helpers');

loadDotEnv([
  path.join(__dirname, '.env'),
  path.join(app?.getPath?.('userData') || __dirname, '.env')
]);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const oAuthConfig = resolveOAuthCallbackConfig({
  platform: process.platform,
  env: process.env,
  port: process.env.SUPABASE_REDIRECT_PORT || '9999',
  path: process.env.SUPABASE_REDIRECT_PATH || '/auth/callback',
});
const OAUTH_CALLBACK_HOST = oAuthConfig.host;
const OAUTH_CALLBACK_PORT = String(oAuthConfig.port);
const OAUTH_CALLBACK_PATH = oAuthConfig.path;
const SUPABASE_REDIRECT_URL = process.env.SUPABASE_REDIRECT_URL || oAuthConfig.redirectUrl;

const authStore = new Store({ name: 'pluberry-supabase-auth', fileExtension: 'json', cwd: process.cwd() });

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase: SUPABASE_URL or SUPABASE_ANON_KEY not set in environment');
}

const customStorage = {
  getItem: (key) => {
    return authStore.get(key) || null;
  },
  setItem: (key, value) => {
    authStore.set(key, value);
  },
  removeItem: (key) => {
    authStore.delete(key);
  }
};

const CUSTOM_PROTOCOL = process.env.PLUBERRY_PROTOCOL || 'pluberry';
const CUSTOM_PROTOCOL_SUCCESS_URL = `${CUSTOM_PROTOCOL}://auth-success`;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storage: customStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

function normalizeLocaleCode(value) {
  if (!value || typeof value !== 'string') return 'en';
  const normalized = value.trim().toLowerCase();
  const shortCode = normalized.split(/[-_]/)[0];
  return ['fr', 'en', 'es', 'de', 'ja'].includes(shortCode) ? shortCode : 'en';
}

function resolveLanguage(requestUrl, headers = {}) {
  const fromQuery = requestUrl?.searchParams?.get('lang') || requestUrl?.searchParams?.get('language') || requestUrl?.searchParams?.get('locale');
  if (fromQuery) return normalizeLocaleCode(fromQuery);

  const envLang = process.env.PLUBERRY_APP_LANG || process.env.APP_LANG;
  if (envLang) return normalizeLocaleCode(envLang);

  const acceptLanguage = headers['accept-language'] || headers['Accept-Language'] || '';
  if (acceptLanguage) {
    const match = acceptLanguage
      .split(',')
      .map((entry) => entry.trim().split(';')[0])
      .map(normalizeLocaleCode)
      .find((code) => ['fr', 'en', 'es', 'de', 'ja'].includes(code));
    if (match) return match;
  }

  return 'en';
}

function extractOAuthTokens(requestUrl) {
  try {
    const searchParams = requestUrl?.searchParams || new URLSearchParams();
    const hashParams = new URLSearchParams((requestUrl?.hash || '').replace(/^#/, ''));

    return {
      accessToken: searchParams.get('access_token') || hashParams.get('access_token') || '',
      refreshToken: searchParams.get('refresh_token') || hashParams.get('refresh_token') || '',
      error: searchParams.get('error') || hashParams.get('error') || ''
    };
  } catch (error) {
    console.warn('Supabase: unable to parse OAuth callback params:', error);
    return { accessToken: '', refreshToken: '', error: '' };
  }
}

function getAuthPageContent({ success, lang, details }) {
  const safeLang = 'en';
  const locale = locales.en;
  const t = locale.auth || {};
  if (!t.successFallback) t.successFallback = 'Return to Pluberry';
  // Normalize any remaining product-name occurrences in the localized strings
  try {
    Object.keys(t).forEach((k) => {
      if (typeof t[k] === 'string') t[k] = t[k].replace(/Streamix/g, 'Pluberry');
    });
  } catch (_) {}

  if (success) {
    return `<!doctype html><html lang="${safeLang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${t.successTitle || 'Connection successful'}</title><style>body{margin:0;font-family:Inter,Arial,sans-serif;background:#0d1117;color:#f0f6fc;display:grid;place-items:center;height:100vh} .card{background:linear-gradient(135deg,#161b22,#1f2937);border:1px solid #30363d;border-radius:18px;padding:32px 36px;max-width:440px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35)} h1{margin:0 0 10px;font-size:24px;font-weight:600} p{margin:0;color:#8b949e;line-height:1.6} .pill{display:inline-block;margin-top:16px;padding:8px 12px;border-radius:999px;background:rgba(35,134,54,.15);color:#3fb950;font-size:13px;border:1px solid rgba(63,185,80,.25)} .btn{display:inline-block;margin-top:14px;padding:10px 14px;border-radius:8px;background:#238636;color:#fff;border:none;cursor:pointer;font-weight:600}</style></head><body><div class="card"><h1>${t.successTitle || 'Connection successful'}</h1><p>${t.successMessage || 'Your session has been established.'}</p><div class="pill" id="statusText">${t.successStatus || 'Returning to the app...'}</div><div id="manualFallback" style="display:none;margin-top:14px"><button class="btn" onclick="window.location.href='${CUSTOM_PROTOCOL_SUCCESS_URL}'">${t.successFallback || 'Return to Streamix'}</button></div></div><script>const returnUrl='${CUSTOM_PROTOCOL_SUCCESS_URL}'; const statusText=document.getElementById('statusText'); const manualFallback=document.getElementById('manualFallback'); const startRedirect=()=>{ try{ window.location.replace(returnUrl); } catch(err){} setTimeout(()=>{ try{ window.open(returnUrl, '_self'); } catch(err){} }, 250); setTimeout(()=>{ manualFallback.style.display='block'; statusText.textContent='${(t.successFallbackText || 'If the app does not open automatically, use the button below.').replace(/'/g, "\\'")}' }, 1200); }; window.addEventListener('load', startRedirect); setTimeout(()=>{ try{ window.close(); } catch(err){} }, 2200);</script></body></html>`;
  }

  return `<!doctype html><html lang="${safeLang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${t.errorTitle || 'Connection failed'}</title><style>body{margin:0;font-family:Inter,Arial,sans-serif;background:#0d1117;color:#f0f6fc;display:grid;place-items:center;height:100vh} .card{background:#161b22;border:1px solid #30363d;border-radius:16px;padding:28px 32px;max-width:420px;text-align:center;box-shadow:0 10px 35px rgba(0,0,0,.35)} h1{margin:0 0 10px;font-size:22px} p{margin:0;color:#8b949e;line-height:1.5}</style></head><body><div class="card"><h1>${t.errorTitle || 'Connection failed'}</h1><p>${details?.message || t.errorMessage || 'The connection could not be completed.'}</p></div></body></html>`;
}

function focusPluberryWindows() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

// More aggressive focus helper that attempts to ensure the app gains focus
function focusAndSteal() {
  try {
    focusPluberryWindows();
  } catch (err) {
    // ignore
  }

  try {
    // Try to focus the currently focused BrowserWindow if available
    const focused = BrowserWindow.getFocusedWindow && BrowserWindow.getFocusedWindow();
    if (focused && !focused.isDestroyed()) {
      try { focused.show(); } catch (e) {}
      try { focused.focus(); } catch (e) {}
    }
  } catch (e) {}

  try {
    // Try to request the OS focus for the application (Electron supports options on some platforms)
    if (typeof app.focus === 'function') {
      try { app.focus({ steal: true }); } catch (e) { try { app.focus(); } catch (_) {} }
    }
  } catch (e) {}
}

function registerDeepLinkProtocol() {
  // Avoid registering the protocol during development to prevent incorrect
  // executable paths (like C:\\WINDOWS\\system32) from being used. Only
  // register when the app is packaged, unless explicitly forced via env.
  if (typeof app?.setAsDefaultProtocolClient !== 'function') return;
  if (!app.isPackaged && !process.env.SUPABASE_FORCE_PROTOCOL_REGISTER) {
    console.info('Skipping protocol registration in development mode');
    return;
  }
  // Protocol registration occurs only for packaged apps by default.

  // Try to remove any previous registration for this protocol before setting it.
  try {
    if (typeof app.removeAsDefaultProtocolClient === 'function') {
      try {
        app.removeAsDefaultProtocolClient(CUSTOM_PROTOCOL);
        console.info('Removed existing protocol registration (if any) for', CUSTOM_PROTOCOL);
      } catch (e) {
        console.warn('Failed to remove existing protocol registration:', e);
      }
    }
  } catch (err) {
    console.warn('Protocol removal check failed:', err);
  }
  try {
    if (process.defaultApp) {
      // When running in development, avoid passing an invalid argv that points
      // to system folders (e.g. C:\\WINDOWS\\system32) which breaks protocol registration.
      let appArg = process.argv[1];
      if (!appArg || String(appArg).toLowerCase().includes('system32') || !fs.existsSync(String(appArg))) {
        // Fallback: register protocol without extra args (works for packaged apps and avoids invalid paths)
        app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath);
      } else {
        app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath, [appArg]);
      }
    } else {
      app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL);
    }
  } catch (err) {
    console.warn('Supabase: unable to register custom protocol:', err);
  }
}

function registerDeepLinkHandler() {
  if (typeof app?.on !== 'function' || app.__pluberryAuthProtocolRegistered) return;
  app.__pluberryAuthProtocolRegistered = true;
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url && url.startsWith(`${CUSTOM_PROTOCOL}://`)) {
      focusPluberryWindows();
    }
  });
}

registerDeepLinkProtocol();
registerDeepLinkHandler();

function buildOAuthOptions() {
  const options = {
    flowType: 'implicit'
  };

  if (SUPABASE_REDIRECT_URL) {
    options.redirectTo = SUPABASE_REDIRECT_URL;
  }

  return options;
}

let oauthCallbackServer = null;

function startOAuthCallbackServer() {
  if (oauthCallbackServer) {
    return Promise.resolve(oauthCallbackServer);
  }

  return new Promise((resolve, reject) => {
    oauthCallbackServer = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url || '/', 'http://localhost:9999');
        const normalizedPathname = requestUrl.pathname.replace(/\/$/, '');
        const lang = resolveLanguage(requestUrl, req.headers);

        const isCallbackRequest = isOAuthCallbackRequest(requestUrl, OAUTH_CALLBACK_PATH);
        if (!isCallbackRequest) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }

        const { accessToken, refreshToken, error: oauthError } = extractOAuthTokens(requestUrl);

        if (oauthError) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getAuthPageContent({ success: false, lang, details: { message: oauthError } }));
          return;
        }

        if (!accessToken && !req.url.includes('?') && !req.url.includes('#')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
            <body>
              <p>Finishing sign-in...</p>
              <script>
                if (window.location.hash) {
                  const params = window.location.hash.substring(1);
                  window.location.search = params;
                } else {
                  document.body.innerHTML = "<h1>Error</h1><p>No authentication token found.</p>";
                }
              </script>
            </body>
            </html>
          `);
          return;
        }

        if (accessToken) {
          const sessionPayload = refreshToken
            ? { access_token: accessToken, refresh_token: refreshToken }
            : { access_token: accessToken };

          const { error: sessionError } = await supabase.auth.setSession(sessionPayload);

          try {
            focusPluberryWindows();
          } catch (focusError) {
            console.warn('Supabase: unable to focus app after auth callback:', focusError);
          }

          res.writeHead(sessionError ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getAuthPageContent({ success: !sessionError, lang, details: sessionError || null }));

          if (oauthCallbackServer) {
            oauthCallbackServer.close(() => {
              oauthCallbackServer = null;
            });
          }
          return;
        }

        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>No token received</h1><p>Raw URL received by Node: ${req.url}</p>`);

      } catch (err) {
        console.error('OAuth callback error:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('OAuth callback failed.');
      }
    });

    oauthCallbackServer.once('error', reject);
    oauthCallbackServer.listen(Number(OAUTH_CALLBACK_PORT), OAUTH_CALLBACK_HOST, () => {
      oauthCallbackServer.off('error', reject);
      resolve(oauthCallbackServer);
    });
  });
}

async function signInWithGitHub() {
  if (!supabase?.auth?.signInWithOAuth) {
    return { error: new Error('Supabase is not configured in this build.') };
  }

  try {
    console.log('[2] Starting GitHub OAuth...');
    await startOAuthCallbackServer();
    const result = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: buildOAuthOptions()
    });
    if (result?.data?.url) {
      shell.openExternal(result.data.url);
    }
    return result;
  } catch (err) {
    console.error('{X} GitHub OAuth error:', err);
    return { error: err };
  }
}

async function signInWithDiscord() {
  if (!supabase?.auth?.signInWithOAuth) {
    return { error: new Error('Supabase is not configured in this build.') };
  }

  try {
    console.log('[2] Starting Discord OAuth...');
    await startOAuthCallbackServer();
    const result = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: buildOAuthOptions()
    });
    if (result?.data?.url) {
      shell.openExternal(result.data.url);
    }
    return result;
  } catch (err) {
    console.error('{X} Discord OAuth error:', err);
    return { error: err };
  }
}

async function signOut() {
  if (!supabase?.auth?.signOut) {
    return { error: new Error('Supabase is not configured in this build.') };
  }
  try {
    const result = await supabase.auth.signOut();
    clearPersistedAuth();
    return result;
  } catch (error) {
    clearPersistedAuth();
    throw error;
  }
}

function clearPersistedAuth() {
  try {
    if (typeof authStore?.clear === 'function') {
      authStore.clear();
    } else {
      authStore.delete('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL || '');
      authStore.delete('supabase.auth.token');
      authStore.delete('supabase.auth.refresh_token');
      authStore.delete('supabase.auth.expires_at');
      authStore.delete('supabase.auth.user');
      authStore.delete('supabase.auth.session');
    }
  } catch (error) {
    console.warn('Supabase clearPersistedAuth warning:', error);
  }
}

async function getUser() {
  if (!supabase?.auth?.getUser) {
    return { data: { user: null }, error: new Error('Supabase is not configured in this build.') };
  }
  return await supabase.auth.getUser();
}

async function isUserLoggedIn() {
  if (!supabase?.auth?.getUser) {
    return false;
  }
  const user = await supabase.auth.getUser();
  return user?.data?.user ? true : false;
}

function onAuthStateChange(callback) {
  if (!supabase?.auth?.onAuthStateChange) {
    return () => {};
  }
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

// Restore the session manually if needed during startup.
async function restoreSession() {
  if (!supabase?.auth?.getSession) {
    return { data: { session: null }, error: new Error('Supabase is not configured in this build.') };
  }
  const { data, error } = await supabase.auth.getSession();
  return data?.session || null;
}

// Source CRUD helpers.
async function saveSource(userId, source) {
  if (!userId) return { error: new Error('No userId provided') };
  const loggedIn = await isUserLoggedIn();
  if (!loggedIn) {
    return { error: new Error('Please log in to save sources') };
  }

  if (source.id) {
    return await supabase
      .from('sources')
      .update({ name: source.name || null, data: source })
      .eq('id', source.id)
      .eq('user_id', userId)
      .select();
  } else {
    return await supabase
      .from('sources')
      .insert([{ user_id: userId, name: source.name || null, data: source }])
      .select();
  }
}

async function loadSources(userId) {
  if (!userId) return { error: new Error('No userId provided') };
  return await supabase.from('sources').select('*').eq('user_id', userId);
}

async function deleteSources(userId) {
  if (!userId) return { error: new Error('No userId provided') };
  const loggedIn = await isUserLoggedIn();
  if (!loggedIn) return { error: new Error('Please log in to delete sources') };
  return await supabase.from('sources').delete().eq('user_id', userId).select('id');
}

module.exports = {
  supabase,
  signInWithGitHub,
  signInWithDiscord,
  signOut,
  getUser,
  isUserLoggedIn,
  onAuthStateChange,
  restoreSession,
  saveSource,
  loadSources,
  deleteSources,
  clearPersistedAuth,
};
