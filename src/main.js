const { app, BrowserWindow, ipcMain, Menu, shell, dialog, session } = require("electron")
const path = require("node:path")
const fs = require("fs")
const https = require("node:https")
const http = require("node:http")
const { locales } = require("./locales")
const Store = require("electron-store")
const { loadDotEnv } = require("./backend/env-loader")
const { getResourcePath, getAppAssetPath } = require("./main/app-config")
const { getLatestSource, getSourceUrl } = require("./main/source-sync")
const DiscordRPC = require("discord-rpc")

loadDotEnv([
  path.join(__dirname, '.env'),
  path.join(app?.getPath?.('userData') || __dirname, '.env')
]);

// Load the right-click menu handler.
const setupContextMenu = require("./contextMenu")

const PLUGIN_STORE_URL = "https://raw.githubusercontent.com/Zetsukae/Pluberry/website/sources/index.html";

function fetchRemoteText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.get(url, {
      headers: { "User-Agent": "Pluberry-App" }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchRemoteText(new URL(res.headers.location, url).toString()).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
  });
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value = "") {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function getStoreDownloadUrlFromAnchorBlock(html = "") {
  const anchors = html.matchAll(/<a\b[^>]*>/gi);

  for (const match of anchors) {
    const tag = match[0];
    if (!/class="[^"]*\bstore\b[^"]*"/i.test(tag)) continue;

    const hrefMatch = tag.match(/href="([^"]+)"/i);
    if (hrefMatch?.[1]) {
      return hrefMatch[1];
    }
  }

  return null;
}

function extractBlockFromMarker(html, marker, openTag = "div") {
  const startIndex = html.indexOf(marker);
  if (startIndex === -1) return null;

  const contentStart = html.indexOf(">", startIndex);
  if (contentStart === -1) return null;

  let depth = 1;
  let pos = contentStart + 1;

  while (pos < html.length) {
    const nextOpen = html.indexOf(`<${openTag}`, pos);
    const nextClose = html.indexOf(`</${openTag}>`, pos);

    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + 1;
    } else {
      depth -= 1;
      pos = nextClose + openTag.length + 3;
      if (depth === 0) {
        return html.slice(contentStart + 1, nextClose);
      }
    }
  }

  return null;
}

function parseOfficialPluginStore(html) {
  const plugins = [];
  const seen = new Set();
  let searchIndex = 0;

  while (true) {
    const start = html.indexOf('<div class="source-card">', searchIndex);
    if (start === -1) break;

    const cardBlock = extractBlockFromMarker(html.slice(start), '<div class="source-card">', 'div');
    if (!cardBlock) {
      searchIndex = start + 1;
      continue;
    }

    const officialContent = extractBlockFromMarker(cardBlock, '<div class="card-content official">', 'div');
    if (!officialContent) {
      searchIndex = start + 1;
      continue;
    }

    const titleMatch = officialContent.match(/<h3 class="card-title">([\s\S]*?)<\/h3>/i);
    const descriptionMatch = officialContent.match(/<p class="card-description">([\s\S]*?)<\/p>/i);
    const creatorMatch = officialContent.match(/<span class="creator-name">([\s\S]*?)<\/span>/i);
    const imageMatch = cardBlock.match(/<img[^>]+src="([^"]+)"/i);
    const downloadUrl = getStoreDownloadUrlFromAnchorBlock(cardBlock) || "";
    const githubMatch = cardBlock.match(/<a[^>]+href="(https:\/\/github\.com\/[^\"]+)"/i);

    const name = stripHtml(titleMatch?.[1] || "");
    const description = stripHtml(descriptionMatch?.[1] || "");
    const creator = stripHtml(creatorMatch?.[1] || "");
    const image = imageMatch?.[1] || "";
    const githubUrl = githubMatch?.[1] || "";

    if (!downloadUrl || !name || seen.has(downloadUrl)) {
      searchIndex = start + 1;
      continue;
    }

    seen.add(downloadUrl);
    plugins.push({
      name,
      description,
      creator,
      image,
      downloadUrl,
      githubUrl,
      source: "store"
    });

    searchIndex = start + 1;
  }

  return plugins;
}

function getPluginMetadata(filePath) {
  let author = null;
  let github = null;
  let version = null;

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const authorMatch = content.match(/\/\/\s*@author\s+(.*)/i);
    const githubMatch = content.match(/\/\/\s*@github\s+(.*)/i);
    const versionMatch = content.match(/\/\/\s*@version\s+(.*)/i);

    if (authorMatch?.[1]) author = authorMatch[1].trim();
    if (githubMatch?.[1]) github = githubMatch[1].trim();
    if (versionMatch?.[1]) version = versionMatch[1].trim();
  } catch (error) {
    console.warn("Unable to read plugin metadata:", error);
  }

  return { author, github, version };
}

function copyPluginToAppFolder(sourcePath) {
  const pluginsDir = path.join(app.getPath('userData'), 'plugins');
  
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
  
  const fileName = path.basename(sourcePath);
  const destPath = path.join(pluginsDir, fileName);
  
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}

function downloadPluginToAppFolder(downloadUrl, fallbackName = "plugin.js") {
  return new Promise((resolve, reject) => {
    const pluginsDir = path.join(app.getPath('userData'), 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const parsedUrl = new URL(downloadUrl);
    let fileName = path.basename(parsedUrl.pathname || fallbackName);
    fileName = fileName.replace(/[\\/]/g, "").replace(/^\.+/, "");
    if (!fileName.toLowerCase().endsWith(".js")) fileName += ".js";

    const destPath = path.join(pluginsDir, fileName);
    const client = parsedUrl.protocol === "https:" ? https : http;
    const req = client.get(downloadUrl, { headers: { "User-Agent": "Pluberry-App" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadPluginToAppFolder(new URL(res.headers.location, downloadUrl).toString(), fallbackName).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(destPath)));
      file.on("error", (error) => {
        fs.rmSync(destPath, { force: true });
        reject(error);
      });
    });

    req.on("error", reject);
  });
}

const store = new Store({
  defaults: {
    config: {
      language: "",
      sourceUrl: "",
      windowStyle: "default",
      homeButtonBehavior: "menu",
      experimentalEnabled: false,
      animationsEnabled: true
    },
    plugins: [],
    siteData: {}
  }
})

let mainWindow
let settingsWindow = null
let supabaseApi = null
let supabaseHandlersRegistered = false
let unsubscribeAuth = null
let discordClient = null
let discordReady = false
let discordActivity = null
let failedSourceUrl = ""

async function restoreSourcesFromCloud({ navigate = false } = {}) {
  if (!supabaseApi?.restoreSession || !supabaseApi?.getUser || !supabaseApi?.loadSources) {
    return { success: false, sourceUrl: "" };
  }

  try {
    const session = await supabaseApi.restoreSession();
    if (!session) return { success: false, sourceUrl: "" };

    const userResult = await supabaseApi.getUser();
    const userId = userResult?.data?.user?.id;
    if (!userId) return { success: false, sourceUrl: "" };

    const sourcesResult = await supabaseApi.loadSources(userId);
    if (sourcesResult?.error || !Array.isArray(sourcesResult?.data)) {
      return { success: false, sourceUrl: "" };
    }

    const entries = sourcesResult.data;
    const latestSource = getLatestSource(entries);
    const currentConfig = store.get("config") || {};
    const sourceUrl = currentConfig.sourceUrl || getSourceUrl(latestSource);

    if (!currentConfig.sourceUrl && sourceUrl) {
      store.set("config", { ...currentConfig, sourceUrl });
    }

    if (navigate && sourceUrl && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(sourceUrl);
    }

    return { success: Boolean(sourceUrl), sourceUrl };
  } catch (error) {
    console.warn("Unable to restore sources from Supabase:", error);
    return { success: false, sourceUrl: "" };
  }
}

async function collectCookiesForSource(sourceUrl) {
  if (!sourceUrl) return [];

  try {
    const targetSession = mainWindow?.webContents?.session || session.defaultSession;
    const cookies = await targetSession.cookies.get({ url: sourceUrl });
    return cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      session: cookie.session,
      expirationDate: cookie.expirationDate,
      sourceUrl
    }));
  } catch (error) {
    console.error("Failed to collect source cookies:", error);
    return [];
  }
}

// Queue to store a deep-link received before the main window is ready
let queuedDeepLink = null;

function handleDeepLink(url) {
  console.log('Deep link received :', url);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      try { mainWindow.show(); } catch (e) {}
      try { mainWindow.focus(); } catch (e) {}
      try { app.focus({ steal: true }); } catch (e) { try { app.focus(); } catch(_) {} }
      mainWindow.webContents.send('deep-link', url);
    } catch (err) {
      console.warn('Failed to forward deep link to renderer:', err);
    }
  } else {
    queuedDeepLink = url;
  }
}

async function restoreCookiesForSource(sourceUrl, cookies = []) {
  if (!sourceUrl || !Array.isArray(cookies) || cookies.length === 0) return { restored: 0 };

  try {
    const targetSession = mainWindow?.webContents?.session || session.defaultSession;
    let restored = 0;

    for (const cookie of cookies) {
      try {
        await targetSession.cookies.set({
          url: sourceUrl,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: !!cookie.secure,
          httpOnly: !!cookie.httpOnly,
          sameSite: cookie.sameSite || 'no_restriction',
          expirationDate: cookie.expirationDate,
          session: cookie.session === true
        });
        restored += 1;
      } catch (cookieError) {
        console.warn("Failed to restore cookie:", cookie.name, cookieError);
      }
    }

    return { restored };
  } catch (error) {
    console.error("Failed to restore source cookies:", error);
    return { restored: 0 };
  }
}

function getSystemLanguage() {
  const raw = app?.getLocale?.() || process.env.LANG || process.env.LANGUAGE || "en";
  const normalized = String(raw).trim().toLowerCase();
  const shortCode = normalized.split(/[-_.]/)[0];
  return ["fr", "en"].includes(shortCode) ? shortCode : "en";
}

function syncAppLanguage(language) {
  const requestedLang = language || store.get("config")?.language;
  const resolvedLang = requestedLang || getSystemLanguage();
  process.env.STREAMIX_APP_LANG = resolvedLang;
  return resolvedLang;
}

function createWindow() {
  const config = store.get("config")
  syncAppLanguage(config.language)
  const isWindowsStyle = config.windowStyle === "windows"

  const windowIconPath = process.platform === "win32"
    ? getAppAssetPath("icon.ico")
    : getAppAssetPath("icon.png");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: windowIconPath,
                                 webPreferences: {
                                   nodeIntegration: false,
                                   contextIsolation: true,
                                   webSecurity: true,
                                   devTools: true,
                                   preload: path.join(__dirname, "preload.js"),
                                 },
                                 show: false,
                                 autoHideMenuBar: true,
                                 frame: isWindowsStyle,
                                 backgroundColor: '#0a0a0a'
  })

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || !validatedURL || validatedURL.startsWith("file:")) return;
    failedSourceUrl = validatedURL;
    loadOfflineScreen();
  });

  // Enable the context menu.
  setupContextMenu(mainWindow);

  // Allow DevTools shortcuts for debugging.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.key === '`' && input.type === 'keyDown' && !input.control && !input.alt && !input.shift && !input.meta) {
      event.preventDefault();
      injectDebugMenuScript(mainWindow);
    }
  });

  // Improve web requests and app identity for supported sites.
  let ua = mainWindow.webContents.getUserAgent();
  ua = ua.replace(/Electron\/[0-9\.]+\s?/, "");
  ua = ua.replace(/StreamixApp\s?/, "").trim();
  const finalUA = `${ua} StreamixApp`;
  mainWindow.webContents.setUserAgent(finalUA);

  // Allow Google and related domains when needed.
  if (config.sourceUrl) {
    const filter = { urls: [config.sourceUrl + "*", "https://accounts.google.com/*", "https://www.google.com/*"] };
    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      // Allow Google requests
      if (details.url.includes('google.com') || details.url.includes('accounts.google.com')) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }
      details.requestHeaders['X-Streamix-Key'] = 'zetsukaedagoat';
      callback({ requestHeaders: details.requestHeaders });
    });
  }

  // Start the app with the configured source or setup screen.
  const url = config.sourceUrl || "";
  // Validate that the configured URL uses http or https.
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    mainWindow.loadURL(url)
  } else {
    loadSetupScreen()
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
    // If a deep-link was received before the window was ready, handle it now
    if (queuedDeepLink) {
      handleDeepLink(queuedDeepLink);
      queuedDeepLink = null;
    }
  })

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F1" && input.type === "keyDown" && !input.control && !input.alt && !input.shift && !input.meta) {
      event.preventDefault();
      injectF1MenuScript(mainWindow);
    }
  });

  mainWindow.webContents.on("did-navigate", (_event, url) => {
    updateDiscordPresence(getDiscordActivityFromUrl(url, mainWindow.webContents.getTitle()));
  });

  mainWindow.webContents.on("did-navigate-in-page", (_event, url) => {
    updateDiscordPresence(getDiscordActivityFromUrl(url, mainWindow.webContents.getTitle()));
  });

  mainWindow.webContents.on("page-title-updated", (_event, title) => {
    updateDiscordPresence(getDiscordActivityFromUrl(mainWindow.webContents.getURL(), title));
  });

  // Inject overlay, styles, and plugins after the page is ready.
  mainWindow.webContents.on("did-finish-load", () => {
    const currentUrl = mainWindow.webContents.getURL()
    if (currentUrl.startsWith("file:")) return

      const config = store.get("config")

      // Inject animation CSS.
      if (config.animationsEnabled !== false) {
        try {
          const cssPath = path.join(__dirname, "animations", "animations.css");
          if (fs.existsSync(cssPath)) {
            const cssContent = fs.readFileSync(cssPath, "utf8");
            mainWindow.webContents.insertCSS(cssContent);
          }
        } catch (e) { console.error(e); }
      }

      // Inject custom scrollbar styling.
      try {
        const scrollbarCss = `
          ::-webkit-scrollbar {
            width: 10px;
            display: none !important;
          }
          html.streamix-scrollbar-visible ::-webkit-scrollbar,
          body.streamix-scrollbar-visible ::-webkit-scrollbar,
          html.streamix-scrollbar-visible *::-webkit-scrollbar,
          body.streamix-scrollbar-visible *::-webkit-scrollbar {
            display: block !important;
            width: 10px !important;
            background: rgba(255,255,255,0.10) !important;
          }
          html.streamix-scrollbar-visible ::-webkit-scrollbar-track,
          body.streamix-scrollbar-visible ::-webkit-scrollbar-track,
          html.streamix-scrollbar-visible *::-webkit-scrollbar-track,
          body.streamix-scrollbar-visible *::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05) !important;
            border-radius: 12px !important;
            box-shadow: inset 5px 0 12px rgba(255,255,255,0.15) !important;
          }
          html.streamix-scrollbar-visible ::-webkit-scrollbar-thumb,
          body.streamix-scrollbar-visible ::-webkit-scrollbar-thumb,
          html.streamix-scrollbar-visible *::-webkit-scrollbar-thumb,
          body.streamix-scrollbar-visible *::-webkit-scrollbar-thumb {
            background: rgba(140, 140, 140, 0.85) !important;
            border-radius: 8px !important;
            border: 2px solid rgba(255,255,255,0.12) !important;
            box-shadow: inset 2px 0 6px rgba(255,255,255,0.18) !important;
          }
          html.streamix-scrollbar-visible ::-webkit-scrollbar-thumb:hover,
          body.streamix-scrollbar-visible ::-webkit-scrollbar-thumb:hover,
          html.streamix-scrollbar-visible *::-webkit-scrollbar-thumb:hover,
          body.streamix-scrollbar-visible *::-webkit-scrollbar-thumb:hover {
            background: rgba(150, 150, 150, 0.95) !important;
          }
        `;
        mainWindow.webContents.insertCSS(scrollbarCss);
      } catch (e) { console.error(e); }

      const isWindowsStyle = config.windowStyle === "windows"

      // Inject the overlay and drag zone.
      const overlayScript = `
      (function() {
        if (document.getElementById('streamix-overlay-root')) return;
        const root = document.createElement('div'); root.id = 'streamix-overlay-root'; document.body.appendChild(root);

        const style = document.createElement('style');
        style.textContent = \`
        .streamix-btn {
          width: 32px !important; height: 32px !important; border: none !important; border-radius: 8px !important;
          cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important;
          background: rgba(0, 0, 0, 0.5) !important; color: #ffffff !important; backdrop-filter: blur(10px) !important;
          -webkit-app-region: no-drag !important; pointer-events: auto !important; z-index: 2147483647 !important;
          transition: background 0.3s ease !important;
        }
        .streamix-btn:hover { background: rgba(255, 255, 255, 0.2) !important; }
        .streamix-btn img { pointer-events: none !important; width: 30px !important; height: 30px !important; }

        /* Keep the drag zone aligned with the injected controls. */
        #streamix-drag-zone { position: fixed; top: 0; left: 0; width: 100%; height: 32px; z-index: 2147483646; -webkit-app-region: drag; pointer-events: none; }
        \`;
        root.appendChild(style);

        const dragZone = document.createElement('div'); dragZone.id = 'streamix-drag-zone'; root.appendChild(dragZone);

        const homeBtn = document.createElement('button'); homeBtn.className = 'streamix-btn'; homeBtn.id = 'streamix-home-btn';
        homeBtn.style.cssText = 'position: fixed !important; top: 10px !important; left: 10px !important; background: transparent !important; backdrop-filter: none !important;';
        homeBtn.innerHTML = '<img src="https://i.imgur.com/d4fqsPg.png" alt="Home">';
        homeBtn.onclick = () => window.electronAPI.triggerF1Menu();
        root.appendChild(homeBtn);

        if (${!isWindowsStyle}) {
          const c = document.createElement('div');
          c.id = 'window-controls';
          c.style.cssText = 'position: fixed !important; top: 10px !important; right: 10px !important; display: flex !important; gap: 8px !important; z-index: 2147483647 !important;';
          const m = document.createElement('button'); m.className = 'streamix-btn'; m.textContent = '─'; m.onclick = () => window.electronAPI.minimize();
          const x = document.createElement('button'); x.className = 'streamix-btn'; x.textContent = '✕'; x.onclick = () => window.electronAPI.close();
          c.appendChild(m); c.appendChild(x); root.appendChild(c);
        }
      })();
      `;
      mainWindow.webContents.executeJavaScript(overlayScript).catch(() => {});

      // Sync bridge data with the renderer.
      const bridgeScript = `
      (function() {
        if (window.StreamixStorage) {
          const initialData = window.StreamixStorage.getAll();
          if(window.electronAPI && window.electronAPI.syncData) {
            window.electronAPI.syncData({ type: 'init', data: initialData });
          }
          window.addEventListener("streamix-storage-change", (event) => {
            if(window.electronAPI && window.electronAPI.syncData) {
              window.electronAPI.syncData({
                type: 'update',
                key: event.detail.key,
                value: event.detail.value,
                allData: event.detail.allData
              });
            }
          });
        }
      })();
      `;
      mainWindow.webContents.executeJavaScript(bridgeScript).catch(() => {});

      updateDiscordPresence(getDiscordActivityFromUrl(mainWindow.webContents.getURL(), mainWindow.webContents.getTitle()));

      // Inject enabled plugins.
      const plugins = store.get("plugins", []) || [];
      plugins.forEach(plugin => {
        if (plugin.enabled && plugin.path) {
          try {
            if (fs.existsSync(plugin.path)) {
              const pluginContent = fs.readFileSync(plugin.path, 'utf8');
              const safeScript = `(function(){ try { ${pluginContent} } catch(e) { console.error("Erreur plugin ${plugin.name}:", e); } })();`;

              mainWindow.webContents.executeJavaScript(safeScript)
              .then(() => console.log(`Plugin injecté : ${plugin.name}`))
              .catch(e => console.error(`Echec injection plugin ${plugin.name}:`, e));
            }
          } catch (err) {
            console.error(`Impossible de lire le plugin ${plugin.name}:`, err);
          }
        }
      });
  })

  // Handle navigation and OAuth-related popups.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const config = store.get("config");
    try {
      const targetUrl = new URL(url);
      const targetHostname = targetUrl.hostname.toLowerCase();
      const sourceUrl = config.sourceUrl ? new URL(config.sourceUrl) : null;
      const sourceHostname = sourceUrl ? sourceUrl.hostname.toLowerCase() : null;
      const isExternalOAuthProvider = [
        "github.com",
        "www.github.com",
        "discord.com",
        "www.discord.com"
      ].includes(targetHostname);

      if (
        (sourceHostname && targetHostname.includes(sourceHostname)) ||
        url.includes("anime-sama") ||
        url.includes("accounts.google.com") ||
        isExternalOAuthProvider
      ) {
        if (isExternalOAuthProvider) {
          shell.openExternal(url);
        } else {
          mainWindow.loadURL(url);
        }
        return { action: "deny" };
      }
    } catch (e) { }
    shell.openExternal(url);
    return { action: "deny" };
  })
}

// F1 overlay menu script.
function injectF1MenuScript(win) {
  if (!win || win.isDestroyed()) return;
  const config = store.get("config");

  const lang = syncAppLanguage(config.language);
  const t = (locales[lang] || locales.fr).f1Menu;
  const homeUrl = config.sourceUrl || "about:blank";
  const animsEnabled = config.animationsEnabled !== false;

  const txtHome = JSON.stringify(t.home);
  const txtRefresh = JSON.stringify(t.refresh);
  const txtPrev = JSON.stringify(t.previous);
  const txtNext = JSON.stringify(t.next);
  const txtSettings = JSON.stringify(t.settings);
  const txtQuit = JSON.stringify(t.quit);
  const safeHomeUrl = JSON.stringify(homeUrl);

  const menuScript = `
  (function() {
    try {
      let menu = document.getElementById('custom-menu');
      if (menu) {
        const debugMenu = document.getElementById('streamix-debug-menu');
        if (debugMenu) debugMenu.style.display = 'none';
        if (menu.style.display === 'none') {
          menu.style.display = 'block';
          if(${animsEnabled}) { menu.style.animation = 'none'; menu.offsetHeight; menu.style.animation = null; }
        } else {
          menu.style.display = 'none';
        }
        return;
      }
      const debugMenu = document.getElementById('streamix-debug-menu');
      if (debugMenu) debugMenu.style.display = 'none';
      menu = document.createElement('div'); menu.id = 'custom-menu';
      const animStyle = ${animsEnabled} ? '' : 'animation: none !important; transition: none !important;';
      menu.style.cssText = 'position:fixed;top:50px;left:10px;z-index:2147483647;background:rgba(22, 27, 34, 0.95);backdrop-filter:blur(15px);border:1px solid #30363d;border-radius:6px;padding:6px 0;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.5);color:#c9d1d9;font-family:sans-serif; -webkit-app-region: no-drag;' + animStyle;

      const createItem = (text, action, sep) => {
        if (sep) { const s = document.createElement('div'); s.style.cssText = 'height:1px;background:#30363d;margin:4px 0;'; menu.appendChild(s); return; }
        const btn = document.createElement('button');
        btn.textContent = text;
        const itemAnimStyle = ${animsEnabled} ? '' : 'animation: none !important; opacity: 1 !important;';
        btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 16px;background:none;border:none;color:#c9d1d9;font-size:13px;cursor:pointer;transition:background 0.2s;' + itemAnimStyle;
        btn.onmouseover = () => btn.style.background = '#1f6feb'; btn.onmouseout = () => btn.style.background = 'none';
        btn.onclick = () => { action(); menu.style.display = 'none'; }; menu.appendChild(btn);
      };

      createItem(${txtHome}, () => window.location.href = ${safeHomeUrl});
      createItem(${txtRefresh}, () => window.location.reload());
      createItem(${txtPrev}, () => window.history.back());
      createItem(${txtNext}, () => window.history.forward());
      createItem(null, null, true);
      createItem(${txtSettings}, () => window.electronAPI.openSettings());
      createItem(${txtQuit}, () => window.electronAPI.close());

      document.body.appendChild(menu);
      setTimeout(() => { document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target.id !== 'streamix-home-btn') { menu.style.display = 'none'; } }); }, 100);

    } catch(e) {
      console.error("Streamix Menu Error:", e);
    }
  })();
  `;
  win.webContents.executeJavaScript(menuScript).catch(console.error);
}

function injectDebugMenuScript(win) {
  if (!win || win.isDestroyed()) return;

  const config = store.get("config");
  const lang = syncAppLanguage(config.language);
  const t = (locales[lang] || locales.fr).debugMenu || {};
  const txtTitle = JSON.stringify(t.title || 'Debug Menu');
  const txtClear = JSON.stringify(t.clearPlugins || 'Clear plugins');
  const txtReset = JSON.stringify(t.resetData || 'Erase all data');
  const txtClose = JSON.stringify(t.close || 'Close');
  const txtConfirmClear = JSON.stringify(t.confirmClearPlugins || 'Remove all installed plugins?');
  const txtConfirmReset = JSON.stringify(t.confirmReset || 'Erase all application data?');
  const txtPluginsCleared = JSON.stringify(t.pluginsCleared || 'Plugins cleared.');
  const txtResetting = JSON.stringify(t.resetTriggered || 'Resetting application...');
  const txtShowScrollbar = JSON.stringify(t.showScrollbar || 'Show scrollbar');
  const txtHideScrollbar = JSON.stringify(t.hideScrollbar || 'Hide scrollbar');
  const txtScrollbarVisible = JSON.stringify(t.scrollbarVisible || 'Scrollbar visible');
  const txtScrollbarHidden = JSON.stringify(t.scrollbarHidden || 'Scrollbar hidden');
  const showScrollbars = config.showScrollbarOnDebug === true;

  const debugMenuScript = `
  (function() {
    try {
      let menu = document.getElementById('streamix-debug-menu');
      if (menu) {
        const f1Menu = document.getElementById('custom-menu');
        if (f1Menu) f1Menu.style.display = 'none';
        const currentlyVisible = menu.style.display !== 'none';
        menu.style.display = currentlyVisible ? 'none' : 'block';
        return;
      }

      const f1Menu = document.getElementById('custom-menu');
      if (f1Menu) f1Menu.style.display = 'none';
      menu = document.createElement('div');
      menu.id = 'streamix-debug-menu';
      menu.style.cssText = 'position:fixed;top:60px;left:10px;z-index:2147483647;background:rgba(20,24,29,0.96);border:1px solid #30363d;border-radius:12px;padding:14px;min-width:240px;box-shadow:0 16px 40px rgba(0,0,0,0.45);color:#c9d1d9;font-family:sans-serif;-webkit-app-region:no-drag;';

      const title = document.createElement('div');
      title.textContent = ${txtTitle};
      title.style.cssText = 'font-size:14px;font-weight:700;margin-bottom:12px;';
      menu.appendChild(title);

      const status = document.createElement('div');
      status.style.cssText = 'font-size:12px;color:#8b949e;min-height:18px;margin-top:8px;';
      menu.appendChild(status);

      const createButton = (text, action) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = text;
        btn.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;margin:6px 0;border:none;border-radius:10px;background:#161b22;color:#c9d1d9;cursor:pointer;transition:background 0.2s;';
        btn.onmouseover = () => btn.style.background = '#1f6feb';
        btn.onmouseout = () => btn.style.background = '#161b22';
        btn.onclick = action;
        menu.appendChild(btn);
        return btn;
      };

      let showScrollbars = ${showScrollbars};
      const updateScrollbarDisplay = () => {
        if (showScrollbars) {
          document.body.classList.add('streamix-scrollbar-visible');
          document.documentElement.classList.add('streamix-scrollbar-visible');
        } else {
          document.body.classList.remove('streamix-scrollbar-visible');
          document.documentElement.classList.remove('streamix-scrollbar-visible');
        }
      };

      const toggleBtn = createButton(showScrollbars ? ${txtHideScrollbar} : ${txtShowScrollbar}, async () => {
        showScrollbars = !showScrollbars;
        toggleBtn.textContent = showScrollbars ? ${txtHideScrollbar} : ${txtShowScrollbar};
        status.textContent = showScrollbars ? ${txtScrollbarVisible} : ${txtScrollbarHidden};
        if (window.electronAPI && window.electronAPI.setDebugPreference) {
          try { await window.electronAPI.setDebugPreference('showScrollbarOnDebug', showScrollbars); } catch (e) { console.error('Failed to save debug preference', e); }
        }
        updateScrollbarDisplay();
      });

      createButton(${txtClear}, async () => {
        if (window.confirm(${txtConfirmClear})) {
          const result = await window.electronAPI.clearPlugins();
          if (result?.success) {
            status.textContent = ${txtPluginsCleared};
            if (window.electronAPI && window.electronAPI.restart) {
              await window.electronAPI.restart();
            }
          } else {
            status.textContent = result?.error || 'Failed to clear plugins';
          }
        }
      });

      createButton(${txtReset}, () => {
        if (window.confirm(${txtConfirmReset})) {
          status.textContent = ${txtResetting};
          window.electronAPI.resetApp();
        }
      });

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = ${txtClose};
      closeBtn.style.cssText = 'display:block;width:100%;text-align:center;padding:8px 12px;margin-top:10px;border:none;border-radius:10px;background:#21262d;color:#8b949e;cursor:pointer;';
      closeBtn.onclick = () => { menu.style.display = 'none'; updateScrollbarDisplay(); };
      menu.appendChild(closeBtn);

      document.body.appendChild(menu);
      updateScrollbarDisplay();
      setTimeout(() => {
        document.addEventListener('mousedown', (e) => {
          if (menu && !menu.contains(e.target)) {
            menu.style.display = 'none';
            updateScrollbarDisplay();
          }
        });
      }, 50);
    } catch (e) {
      console.error('Streamix Debug Menu Error:', e);
    }
  })();
  `;

  win.webContents.executeJavaScript(debugMenuScript).catch(console.error);
}

function loadSetupScreen() {
  const setupPath = path.join(__dirname, "interface", "setup.html");
  mainWindow.loadFile(setupPath).catch(err => {
    console.error("Failed to load setup.html from:", setupPath, err);
    // Emergency fallback: display an error if setup.html cannot be loaded.
    mainWindow.webContents.loadURL("data:text/html,<h1>Erreur: Impossible de charger le fichier de configuration</h1>").catch(console.error);
  });
}

function loadOfflineScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const offlinePath = path.join(__dirname, "interface", "offline.html");
  mainWindow.loadFile(offlinePath).catch(err => {
    console.error("Failed to load offline.html:", err);
  });
}

function getDiscordActivityFromUrl(url = "", title = "") {
  const fallbackTitle = title && title.trim() ? title.trim() : "Pluberry";

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./i, "");

    if (!hostname || hostname === "about:blank") {
      return {
        details: "Using Pluberry",
        state: "Preparing your stream",
        largeImageKey: "icon",
        largeImageText: "Pluberry",
        instance: false
      };
    }

    return {
      details: "Browsing",
      state: hostname || fallbackTitle,
      largeImageKey: "icon",
      largeImageText: "Pluberry",
      instance: false
    };
  } catch (error) {
    return {
      details: "Using Pluberry",
      state: fallbackTitle,
      largeImageKey: "icon",
      largeImageText: "Pluberry",
      instance: false
    };
  }
}

function setupDiscordRichPresence() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const clientId = process.env.DISCORD_CLIENT_ID?.trim() || "1520501049327353946";
  if (!clientId) {
    console.warn("[Discord RPC] No DISCORD_CLIENT_ID configured. Create a Discord application and set the environment variable to enable Rich Presence.");
    return;
  }

  if (!/^\d+$/.test(clientId)) {
    console.warn("[Discord RPC] DISCORD_CLIENT_ID must be a numeric Discord application ID.");
    return;
  }

  try {
    const rpc = new DiscordRPC.Client({ transport: "ipc" });
    discordClient = rpc;

    rpc.on("ready", () => {
      discordReady = true;
      console.log("[Discord RPC] Connected");
      updateDiscordPresence(discordActivity || getDiscordActivityFromUrl(mainWindow.webContents.getURL(), mainWindow.webContents.getTitle()));
    });

    rpc.on("disconnected", () => {
      discordReady = false;
      discordClient = null;
    });

    rpc.login({ clientId }).catch((error) => {
      console.warn("[Discord RPC] Login failed. Verify the client ID and that Discord is running:", error);
      discordReady = false;
      discordClient = null;
    });
  } catch (error) {
    console.warn("[Discord RPC] unavailable:", error);
  }
}

function updateDiscordPresence(activity = null) {
  discordActivity = activity;

  if (!discordClient || !discordReady) return;

  try {
    if (!activity) {
      discordClient.clearActivity().catch(() => {});
      return;
    }

    discordClient.setActivity(activity).catch(() => {});
  } catch (error) {
    console.warn("Failed to update Discord presence:", error);
  }
}

function registerSupabaseHandlers() {
  if (supabaseHandlersRegistered) return;

  try {
    supabaseApi = require("./backend/supabase");
  } catch (error) {
    console.error("Supabase bridge initialization failed:", error);
    return;
  }

  ipcMain.handle("supabase-sign-in-github", async () => {
    return await supabaseApi.signInWithGitHub();
  });

  ipcMain.handle("supabase-sign-in-discord", async (event) => {
    return await supabaseApi.signInWithDiscord();
  });

  ipcMain.handle("supabase-restore-session", async () => {
    const result = await supabaseApi.restoreSession();
    if (result?.data?.session) {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send("supabase-auth-state-changed", { session: result.data.session });
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("supabase-auth-state-changed", { session: result.data.session });
      }
    }
    return result;
  });

  ipcMain.handle("supabase-sign-out", async () => {
    return await supabaseApi.signOut();
  });

  ipcMain.handle("supabase-get-user", async () => {
    return await supabaseApi.getUser();
  });

  ipcMain.handle("supabase-is-user-logged-in", async () => {
    return await supabaseApi.isUserLoggedIn();
  });

  ipcMain.handle("supabase-save-source", async (event, userId, source) => {
    return await supabaseApi.saveSource(userId, source);
  });

  ipcMain.handle("supabase-load-sources", async (event, userId) => {
    return await supabaseApi.loadSources(userId);
  });

  ipcMain.handle("restore-synced-sources", async () => {
    return await restoreSourcesFromCloud({ navigate: true });
  });

  ipcMain.handle("sync-custom-urls", async (event, urls) => {
    try {
      const session = await supabaseApi?.restoreSession?.();
      const userId = session ? (await supabaseApi.getUser())?.data?.user?.id : null;
      if (!userId || !Array.isArray(urls)) {
        return { success: false, error: "Supabase session unavailable" };
      }

      for (const [index, url] of urls.entries()) {
        const result = await supabaseApi.saveSource(userId, {
          name: url,
          data: url,
          sourceUrl: url,
          timestamp: new Date(Date.now() + index).toISOString(),
          isCurrent: index === urls.length - 1
        });
        if (result?.error) throw result.error;
      }
      store.delete("customUrls");
      return { success: true };
    } catch (error) {
      console.warn("Unable to sync custom URLs to Supabase:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle("collect-source-cookies", async (event, sourceUrl) => {
    return await collectCookiesForSource(sourceUrl);
  });

  ipcMain.handle("restore-source-cookies", async (event, sourceUrl, cookies) => {
    return await restoreCookiesForSource(sourceUrl, cookies);
  });

  unsubscribeAuth = supabaseApi.onAuthStateChange((event, session) => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("supabase-auth-state-changed", { event, session });
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("supabase-auth-state-changed", { event, session });
    }
  });

  app.on("before-quit", () => {
    if (typeof unsubscribeAuth === "function") {
      unsubscribeAuth();
    }
  });

  supabaseHandlersRegistered = true;
}

app.whenReady().then(() => {
  registerSupabaseHandlers();
  createWindow();
  restoreSourcesFromCloud({ navigate: true }).catch(error => {
    console.warn("Background source restoration failed:", error);
  });
  setupDiscordRichPresence();
  Menu.setApplicationMenu(null);

  // --- DEEP LINK CONFIGURATION ---
  const PROTOCOL_PREFIX = process.env.STREAMIX_PROTOCOL || 'streamix';

  // Register the custom protocol handler
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_PREFIX, process.execPath, [ path.resolve(process.argv[1]) ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_PREFIX);
  }

  // 1. Lock to ensure a single instance (Windows / Linux)
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    // If an instance is already running, quit this one
    app.quit();
  } else {
    // When a second instance is attempted (e.g., user clicks a link on Windows/Linux)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // 1. Bring main window to front
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.show();
      }

      // 2. Retrieve the clicked URL (usually the last argument on Windows/Linux)
      const url = commandLine.pop();
      if (url && url.startsWith(`${PROTOCOL_PREFIX}://`)) {
        handleDeepLink(url);
      }
    });

    // 2. Handle open-url on macOS
    app.on('open-url', (event, url) => {
      event.preventDefault();
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.show();
      }
      handleDeepLink(url);
    });
  }

  // --- END DEEP LINK CONFIGURATION ---

  ipcMain.handle("minimize-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });
  ipcMain.handle("close-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
  ipcMain.handle("restart-app", () => { app.relaunch(); app.exit(0); });
  ipcMain.handle("hide-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.minimize();
      } catch (error) {
        console.warn("Unable to minimize window:", error);
      }

      return true;
    }
    return false;
  });
  ipcMain.handle("show-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      } catch (error) {
        console.warn("Unable to show window:", error);
      }

      return true;
    }
    return false;
  });
  ipcMain.handle("focus-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return true;
    }
    return false;
  });
  ipcMain.handle("retry-source", async () => {
    if (!failedSourceUrl || !mainWindow || mainWindow.isDestroyed()) {
      return { success: false };
    }
    const sourceUrl = failedSourceUrl;
    try {
      await mainWindow.loadURL(sourceUrl);
      failedSourceUrl = "";
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });
  ipcMain.handle("open-external-link", (e, url) => shell.openExternal(url));
  ipcMain.handle("show-context-menu", (event, menuItems) => {
    const menu = Menu.buildFromTemplate(menuItems.map(item => ({
      label: item.label,
      click: item.click
    })));
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });
  ipcMain.handle("reset-application", async () => {
    try {
      const session = await supabaseApi?.restoreSession?.();
      const userId = session ? (await supabaseApi.getUser())?.data?.user?.id : null;
      if (userId && supabaseApi?.deleteSources) {
        const result = await supabaseApi.deleteSources(userId);
        if (result?.error) throw result.error;
      }
      if (supabaseApi?.clearPersistedAuth) {
        supabaseApi.clearPersistedAuth();
      }
      if (supabaseApi?.signOut) {
        await supabaseApi.signOut().catch(() => {});
      }
    } catch (error) {
      console.warn("Reset remote data cleanup error:", error);
      return { success: false, error: error.message || String(error) };
    }

    store.clear();
    store.set("config", {
      language: "",
      sourceUrl: "",
      windowStyle: "default",
      homeButtonBehavior: "menu",
      experimentalEnabled: false,
      animationsEnabled: true
    });
    app.relaunch();
    app.exit(0);
    return { success: true };
  });

  ipcMain.on("bridge-sync-data", (event, payload) => {
    if ((payload.type === 'init' || payload.type === 'update') && payload.allData) {
      store.set("siteData", payload.allData);
    }
  });

  ipcMain.handle("save-config", (event, newConfig) => {
    // Map built-in site names to their URLs.
    const siteMap = {
      "netflix": "https://www.netflix.com/",
      "disneyplus": "https://www.disneyplus.com/",
      "crunchyroll": "https://www.crunchyroll.com/fr/",
    };
    
    // Derive sourceUrl from the selected built-in site when needed.
    if (!newConfig.sourceUrl && newConfig.selectedSite && siteMap[newConfig.selectedSite]) {
      newConfig.sourceUrl = siteMap[newConfig.selectedSite];
    }

    if (newConfig.sourceUrl) {
      try {
        const normalizedUrl = new URL(newConfig.sourceUrl);
        if (!normalizedUrl.pathname || normalizedUrl.pathname === '') {
          normalizedUrl.pathname = '/';
        }
        const hostname = (normalizedUrl.hostname || '').toLowerCase();
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        // Require a dot in hostname for remote hosts to avoid invalid single-label hosts like "ohdowiwq"
        if (!isLocalhost && hostname.indexOf('.') === -1) {
          return { success: false, error: 'invalid_url' };
        }
        newConfig.sourceUrl = normalizedUrl.toString();
      } catch (error) {
        // Return an error so the renderer can show a localized message.
        return { success: false, error: 'invalid_url' };
      }
    }

    const currentConfig = store.get("config");
    const restartNeeded =
    (newConfig.windowStyle !== currentConfig.windowStyle) ||
    (newConfig.language !== currentConfig.language);

    syncAppLanguage(newConfig.language || currentConfig.language);
    store.set("config", { ...currentConfig, ...newConfig });

    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();

    if (restartNeeded) {
      // Return success before relaunching the application.
      app.relaunch();
      app.exit(0);
      return { success: true };
    }

    if (newConfig.sourceUrl) { mainWindow.loadURL(newConfig.sourceUrl); } else { app.relaunch(); app.exit(0); }

    return { success: true };
  });

  ipcMain.handle("get-preferences", () => store.get("config"));
  ipcMain.handle("get-current-language", () => syncAppLanguage(store.get("config")?.language));
  ipcMain.handle("get-app-translations", () => locales);
  ipcMain.handle("get-setup-translations", () => {
    const currentLang = syncAppLanguage(store.get("config")?.language);
    return { 
      language: currentLang, 
      translations: locales[currentLang] || locales.en 
    };
  });
  ipcMain.handle("get-app-version", () => app.getVersion?.() || store.get("config")?.version || "0.0.0");
  ipcMain.handle("set-debug-preference", (event, key, value) => {
    const currentConfig = store.get("config") || {};
    store.set("config", { ...currentConfig, [key]: value });
  });
  ipcMain.handle("get-plugins", () => store.get("plugins"));
  ipcMain.handle("get-settings-plugins", () => {
    const plugins = store.get("plugins", []) || [];
    const pluginEntries = [
      { name: "ILOVERAINBOW", path: path.join(__dirname, "plugins", "iloverainbow.js") },
      ...plugins
    ];

    return pluginEntries
      .filter(plugin => plugin.name === "ILOVERAINBOW" || plugin.enabled !== false)
      .map(plugin => {
        try {
          return fs.existsSync(plugin.path)
            ? { name: plugin.name, code: fs.readFileSync(plugin.path, "utf8") }
            : null;
        } catch (error) {
          console.warn(`Unable to read settings plugin ${plugin.name}:`, error);
          return null;
        }
      })
      .filter(Boolean);
  });
  ipcMain.handle("get-plugin-settings", (event, pluginName) => {
    return store.get(`pluginSettings.${pluginName}`, {});
  });
  ipcMain.handle("save-plugin-settings", (event, pluginName, settings) => {
    if (!pluginName || !settings || typeof settings !== "object" || Array.isArray(settings)) {
      return { success: false, error: "Invalid plugin settings" };
    }
    store.set(`pluginSettings.${pluginName}`, settings);
    return { success: true };
  });
  ipcMain.handle("get-plugin-store", async () => {
    try {
      const html = await fetchRemoteText(PLUGIN_STORE_URL);
      return { success: true, plugins: parseOfficialPluginStore(html) };
    } catch (error) {
      console.error("Unable to load plugin store:", error);
      return { success: false, error: "Impossible de charger le store" };
    }
  });
  ipcMain.handle("install-plugin-from-store", async (event, plugin) => {
    if (!plugin?.downloadUrl) {
      return { success: false, error: "Lien de téléchargement manquant" };
    }

    const plugins = store.get("plugins", []);
    const alreadyInstalled = plugins.find(p => p.downloadUrl === plugin.downloadUrl || p.name === plugin.name);
    if (alreadyInstalled) {
      return { success: true, plugin: alreadyInstalled, alreadyInstalled: true };
    }

    try {
      const appPluginPath = await downloadPluginToAppFolder(plugin.downloadUrl, `${plugin.name || "plugin"}.js`);
      const metadata = getPluginMetadata(appPluginPath);
      const newPlugin = {
        name: plugin.name || path.basename(appPluginPath, ".js"),
        path: appPluginPath,
        enabled: true,
        author: metadata.author || plugin.creator || null,
        github: metadata.github || plugin.githubUrl || null,
        version: metadata.version || null,
        downloadUrl: plugin.downloadUrl,
        source: plugin.source || "store"
      };

      plugins.push(newPlugin);
      store.set("plugins", plugins);
      return { success: true, plugin: newPlugin };
    } catch (error) {
      console.error("Erreur installation plugin store:", error);
      return { success: false, error: "Échec du téléchargement du plugin" };
    }
  });

  // Preserve author, GitHub, and version metadata when installing plugins.
  ipcMain.handle("select-plugin-file", async () => {
    const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
      filters: [{ name: "JavaScript", extensions: ["js"] }],
      properties: ["openFile"]
    });

    if (result.canceled) return { success: false };

    const pPath = result.filePaths[0];
    const plugins = store.get("plugins", []);

    if (plugins.find(p => p.path === pPath)) return { success: false, error: "Déjà installé" };

    // Copy the plugin into the application data directory.
    let appPluginPath;
    try {
      appPluginPath = copyPluginToAppFolder(pPath);
    } catch (e) {
      console.error("Erreur copie plugin:", e);
      return { success: false, error: "Erreur lors de la copie du plugin" };
    }

    const metadata = getPluginMetadata(pPath);

    const newPlugin = {
      name: path.basename(pPath, '.js'),
                 path: appPluginPath,
                 enabled: true,
                 author: metadata.author,
                 github: metadata.github,
                 version: metadata.version
    };

    plugins.push(newPlugin);
    store.set("plugins", plugins);

    return { success: true, plugin: newPlugin };
  });

  ipcMain.handle("remove-plugin", (e, pPath) => {
    let plugins = store.get("plugins", []);
    plugins = plugins.filter(p => p.path !== pPath);
    store.set("plugins", plugins);
    
    // Remove the plugin file from the application data directory.
    try {
      if (fs.existsSync(pPath)) {
        fs.unlinkSync(pPath);
      }
    } catch (err) {
      console.error("Erreur suppression fichier plugin:", err);
    }
    
    return { success: true };
  });

  ipcMain.handle("clear-plugins", async () => {
    try {
      const plugins = store.get("plugins", []) || [];
      for (const plugin of plugins) {
        if (plugin?.path && fs.existsSync(plugin.path)) {
          try {
            fs.unlinkSync(plugin.path);
          } catch (err) {
            console.error("Error deleting plugin file:", plugin.path, err);
          }
        }
      }
      store.set("plugins", []);
      return { success: true };
    } catch (error) {
      console.error("Error clearing plugins:", error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("toggle-plugin", (e, pPath) => {
    let plugins = store.get("plugins", []);
    const plugin = plugins.find(p => p.path === pPath);
    if (plugin) {
      plugin.enabled = !plugin.enabled;
      store.set("plugins", plugins);
      return { success: true, enabled: plugin.enabled };
    }
    return { success: false };
  });

  ipcMain.handle("get-custom-urls", async () => {
    try {
      const session = await supabaseApi?.restoreSession?.();
      const userId = session ? (await supabaseApi.getUser())?.data?.user?.id : null;
      if (!userId) return store.get("customUrls", []);

      const result = await supabaseApi.loadSources(userId);
      if (result?.error || !Array.isArray(result?.data)) return [];
      return result.data.map(getSourceUrl).filter(Boolean).filter((url, index, urls) => urls.indexOf(url) === index);
    } catch (error) {
      console.warn("Unable to load custom URLs from Supabase:", error);
      return [];
    }
  });

  ipcMain.handle("save-custom-urls", async (event, urls) => {
    const session = await supabaseApi?.restoreSession?.();
    const userId = session ? (await supabaseApi.getUser())?.data?.user?.id : null;
    if (!userId && Array.isArray(urls)) {
      store.set("customUrls", urls);
    }
    return { success: true };
  });

  ipcMain.handle("trigger-f1-menu", async () => { injectF1MenuScript(mainWindow); });

  ipcMain.handle("open-settings", () => {
    if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); return; }
    settingsWindow = new BrowserWindow({
      width: 800, height: 600, resizable: false, parent: mainWindow, modal: false,
      frame: false, show: false, backgroundColor: "#0d1117",
      webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, "preload.js") }
    });
    settingsWindow.loadFile(path.join(__dirname, "interface", "settings.html"));
    settingsWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'i')) {
        settingsWindow.webContents.toggleDevTools();
      }
      if (input.key === 'Escape' && input.type === 'keyDown') settingsWindow.close();
    });
      settingsWindow.once("ready-to-show", () => { settingsWindow.show(); settingsWindow.focus(); });
      settingsWindow.on("closed", () => { settingsWindow = null; });
  });

  ipcMain.handle("close-settings", () => { if (settingsWindow) settingsWindow.close(); });

});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
