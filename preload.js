const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.invoke("minimize-window"),
  close: () => ipcRenderer.invoke("close-window"),
  restart: () => ipcRenderer.invoke("restart-app"),

  triggerF1Menu: () => ipcRenderer.invoke("trigger-f1-menu"),

  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  getPreferences: () => ipcRenderer.invoke("get-preferences"),
  getCurrentLanguage: () => ipcRenderer.invoke("get-current-language"),
  getAppTranslations: () => ipcRenderer.invoke("get-app-translations"),
  resetApp: () => ipcRenderer.invoke("reset-application"),

  openSettings: () => ipcRenderer.invoke("open-settings"),
  closeSettings: () => ipcRenderer.invoke("close-settings"),

  getPlugins: () => ipcRenderer.invoke("get-plugins"),
  selectPluginFile: () => ipcRenderer.invoke("select-plugin-file"),
  removePlugin: (path) => ipcRenderer.invoke("remove-plugin", path),
  togglePlugin: (path) => ipcRenderer.invoke("toggle-plugin", path),

  getCustomUrls: () => ipcRenderer.invoke("get-custom-urls"),
  saveCustomUrls: (urls) => ipcRenderer.invoke("save-custom-urls", urls),

  openExternal: (url) => ipcRenderer.invoke("open-external-link", url),
  showContextMenu: (menuItems) => ipcRenderer.invoke("show-context-menu", menuItems),

  syncData: (payload) => ipcRenderer.send("bridge-sync-data", payload),

  authSignInWithGitHub: () => ipcRenderer.invoke("supabase-sign-in-github"),
  authSignInWithDiscord: () => ipcRenderer.invoke("supabase-sign-in-discord"),
  authSignOut: () => ipcRenderer.invoke("supabase-sign-out"),
  authGetUser: () => ipcRenderer.invoke("supabase-get-user"),
  authIsUserLoggedIn: () => ipcRenderer.invoke("supabase-is-user-logged-in"),
  authRestoreSession: () => ipcRenderer.invoke("supabase-restore-session"),
  saveSource: (userId, source) => ipcRenderer.invoke("supabase-save-source", userId, source),
  loadSources: (userId) => ipcRenderer.invoke("supabase-load-sources", userId),
  collectCookiesForUrl: (sourceUrl) => ipcRenderer.invoke("collect-source-cookies", sourceUrl),
  restoreCookiesForUrl: (sourceUrl, cookies) => ipcRenderer.invoke("restore-source-cookies", sourceUrl, cookies)
});

ipcRenderer.on("streamix-storage-command", (event, command) => {
  window.postMessage({ type: "streamix-storage-command", ...command }, "*");
});

ipcRenderer.on("supabase-auth-state-changed", (event, payload) => {
  window.dispatchEvent(new CustomEvent("supabase-auth-state-changed", { detail: payload }));
});
