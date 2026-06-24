const { app, BrowserWindow, ipcMain, Menu, shell, dialog, session } = require("electron")
const path = require("node:path")
const fs = require("fs")
const { locales } = require("./locales")
const Store = require("electron-store")
const { loadDotEnv } = require("./env-loader")

loadDotEnv([
  path.join(__dirname, '.env'),
  path.join(app?.getPath?.('userData') || __dirname, '.env')
]);

// Import du menu clic droit
const setupContextMenu = require("./contextMenu")

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
    customUrls: [],
    siteData: {}
  }
})

let mainWindow
let settingsWindow = null
let supabaseApi = null
let supabaseHandlersRegistered = false
let unsubscribeAuth = null

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
  return ["fr", "en", "es", "de", "ja"].includes(shortCode) ? shortCode : "en";
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

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "assets", "icon.png"),
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

  // 1. Activation du menu clic droit
  setupContextMenu(mainWindow);

  // 1.5. Ouvrir DevTools avec F12 (pour debug)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // 2. CORRECTION GOOGLE 403 & SIGNATURE APP
  let ua = mainWindow.webContents.getUserAgent();
  ua = ua.replace(/Electron\/[0-9\.]+\s?/, "");
  ua = ua.replace(/StreamixApp\s?/, "").trim();
  const finalUA = `${ua} StreamixApp`;
  mainWindow.webContents.setUserAgent(finalUA);

  // 3. SÉCURITÉ : Autoriser Google et autres domaines
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

  // Démarrage
  const url = config.sourceUrl || "";
  const validSites = ["franime.fr", "anime-sama.pw", "mangas-origines.fr"];
  if (url && validSites.some(site => url.includes(site))) {
    mainWindow.loadURL(url)
  } else {
    loadSetupScreen()
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F1" && input.type === "keyDown" && !input.control && !input.alt && !input.shift && !input.meta) {
      event.preventDefault();
      injectF1MenuScript(mainWindow);
    }
  });

  // --- INJECTIONS (Overlay & CSS & PLUGINS) ---
  mainWindow.webContents.on("did-finish-load", () => {
    const currentUrl = mainWindow.webContents.getURL()
    if (currentUrl.startsWith("file:")) return

      const config = store.get("config")

      // A. Animation CSS
      if (config.animationsEnabled !== false) {
        try {
          const cssPath = path.join(__dirname, 'animations.css');
          if (fs.existsSync(cssPath)) {
            const cssContent = fs.readFileSync(cssPath, 'utf8');
            mainWindow.webContents.insertCSS(cssContent);
          }
        } catch (e) { console.error(e); }
      }

      const isWindowsStyle = config.windowStyle === "windows"

      // B. Overlay & Drag Zone
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

        /* CORRECTION DRAG ZONE : Hauteur 32px exacte */
        #streamix-drag-zone { position: fixed; top: 0; left: 0; width: 100%; height: 32px; z-index: 2147483646; -webkit-app-region: drag; pointer-events: none; }
        \`;
        root.appendChild(style);

        const dragZone = document.createElement('div'); dragZone.id = 'streamix-drag-zone'; root.appendChild(dragZone);

        const homeBtn = document.createElement('button'); homeBtn.className = 'streamix-btn'; homeBtn.id = 'streamix-home-btn';
        homeBtn.style.cssText = 'position: fixed !important; top: 10px !important; left: 10px !important; background: transparent !important; backdrop-filter: none !important;';
        homeBtn.innerHTML = '<img src="https://i.imgur.com/lv3zp1J.png" alt="Home">';
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

      // C. Bridge Sync
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

      // --- D. INJECTION DES PLUGINS ---
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

  // Navigation & Google Auth
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

// --- SCRIPT F1 ---
function injectF1MenuScript(win) {
  if (!win || win.isDestroyed()) return;
  const config = store.get("config");

  const lang = config.language || 'fr';
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
        if (menu.style.display === 'none') {
          menu.style.display = 'block';
          if(${animsEnabled}) { menu.style.animation = 'none'; menu.offsetHeight; menu.style.animation = null; }
        } else {
          menu.style.display = 'none';
        }
        return;
      }
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

function loadSetupScreen() { mainWindow.loadFile(path.join(__dirname, "setup.html")); }

function registerSupabaseHandlers() {
  if (supabaseHandlersRegistered) return;

  try {
    supabaseApi = require("./supabase");
  } catch (error) {
    console.error("Supabase bridge initialization failed:", error);
    return;
  }

  ipcMain.handle("supabase-sign-in-github", async () => {
    return await supabaseApi.signInWithGitHub();
  });

  ipcMain.handle("supabase-sign-in-discord", async () => {
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
  Menu.setApplicationMenu(null);

  ipcMain.handle("minimize-window", () => mainWindow.minimize());
  ipcMain.handle("close-window", () => mainWindow.close());
  ipcMain.handle("restart-app", () => { app.relaunch(); app.exit(0); });
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
      if (supabaseApi?.clearPersistedAuth) {
        supabaseApi.clearPersistedAuth();
      }
      if (supabaseApi?.signOut) {
        await supabaseApi.signOut().catch(() => {});
      }
    } catch (error) {
      console.warn("Reset auth cleanup error:", error);
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
  });

  ipcMain.on("bridge-sync-data", (event, payload) => {
    if ((payload.type === 'init' || payload.type === 'update') && payload.allData) {
      store.set("siteData", payload.allData);
    }
  });

  ipcMain.handle("save-config", (event, newConfig) => {
    // Site selection: map to URLs
    const siteMap = {
      "franime": "https://franime.fr/",
      "anime-sama": "https://anime-sama.pw/",
      "mangas-origines": "https://mangas-origines.fr/"
    };
    
    // Si sourceUrl n'est pas déjà fourni (pour les URLs custom), le mapper depuis selectedSite
    if (!newConfig.sourceUrl && newConfig.selectedSite && siteMap[newConfig.selectedSite]) {
      newConfig.sourceUrl = siteMap[newConfig.selectedSite];
    }

    const currentConfig = store.get("config");
    const restartNeeded =
    (newConfig.windowStyle !== currentConfig.windowStyle) ||
    (newConfig.language !== currentConfig.language);

    syncAppLanguage(newConfig.language || currentConfig.language);
    store.set("config", { ...currentConfig, ...newConfig });

    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();

    if (restartNeeded) {
      app.relaunch();
      app.exit(0);
      return;
    }

    if (newConfig.sourceUrl) { mainWindow.loadURL(newConfig.sourceUrl); } else { app.relaunch(); app.exit(0); }
  });

  ipcMain.handle("get-preferences", () => store.get("config"));
  ipcMain.handle("get-current-language", () => syncAppLanguage(store.get("config")?.language));
  ipcMain.handle("get-app-translations", () => locales);
  ipcMain.handle("get-plugins", () => store.get("plugins"));

  // --- HELPER: Copier plugin dans dossier de l'app (userData) ---
  const copyPluginToAppFolder = (sourcePath) => {
    const pluginsDir = path.join(app.getPath('userData'), 'plugins');
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }
    
    const fileName = path.basename(sourcePath);
    const destPath = path.join(pluginsDir, fileName);
    
    // Copier le fichier
    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  };

  // --- SÉLECTION DES PLUGINS AMÉLIORÉE (AUTEUR + GITHUB + VERSION) ---
  ipcMain.handle("select-plugin-file", async () => {
    const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
      filters: [{ name: "JavaScript", extensions: ["js"] }],
      properties: ["openFile"]
    });

    if (result.canceled) return { success: false };

    const pPath = result.filePaths[0];
    const plugins = store.get("plugins", []);

    if (plugins.find(p => p.path === pPath)) return { success: false, error: "Déjà installé" };

    // Copier le plugin dans le dossier de l'app
    let appPluginPath;
    try {
      appPluginPath = copyPluginToAppFolder(pPath);
    } catch (e) {
      console.error("Erreur copie plugin:", e);
      return { success: false, error: "Erreur lors de la copie du plugin" };
    }

    // DÉTECTION METADATA à partir du chemin source
    let detectedAuthor = null;
    let detectedGithub = null;
    let detectedVersion = null;

    try {
      const content = fs.readFileSync(pPath, 'utf8');

      // Auteur
      const matchAuthor = content.match(/\/\/\s*@author\s+(.*)/i);
      if (matchAuthor && matchAuthor[1]) detectedAuthor = matchAuthor[1].trim();

      // Github
      const matchGithub = content.match(/\/\/\s*@github\s+(.*)/i);
      if (matchGithub && matchGithub[1]) detectedGithub = matchGithub[1].trim();

      // Version (Nouveau)
      const matchVersion = content.match(/\/\/\s*@version\s+(.*)/i);
      if (matchVersion && matchVersion[1]) detectedVersion = matchVersion[1].trim();

    } catch (e) {
      console.error("Erreur lecture metadata:", e);
    }

    const newPlugin = {
      name: path.basename(pPath, '.js'),
                 path: appPluginPath,
                 enabled: true,
                 author: detectedAuthor,
                 github: detectedGithub,
                 version: detectedVersion // Sauvegarde de la version
    };

    plugins.push(newPlugin);
    store.set("plugins", plugins);

    return { success: true, plugin: newPlugin };
  });

  ipcMain.handle("remove-plugin", (e, pPath) => {
    let plugins = store.get("plugins", []);
    plugins = plugins.filter(p => p.path !== pPath);
    store.set("plugins", plugins);
    
    // Supprimer le fichier du dossier de l'app
    try {
      if (fs.existsSync(pPath)) {
        fs.unlinkSync(pPath);
      }
    } catch (err) {
      console.error("Erreur suppression fichier plugin:", err);
    }
    
    return { success: true };
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

  ipcMain.handle("get-custom-urls", () => {
    return store.get("customUrls", []);
  });

  ipcMain.handle("save-custom-urls", (event, urls) => {
    store.set("customUrls", urls);
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
    settingsWindow.loadFile(path.join(__dirname, "settings.html"));
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
