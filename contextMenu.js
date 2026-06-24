const { Menu, MenuItem, shell } = require('electron');
const { locales } = require('./locales');
const Store = require('electron-store');
const store = new Store();

module.exports = (win) => {
    win.webContents.on('context-menu', (event, params) => {
        const config = store.get('config') || {};
        const lang = config.language || 'fr';
        const t = (locales[lang] || locales.fr).contextMenu;

        const menu = new Menu();

        if (params.linkURL) {
            menu.append(new MenuItem({
                label: t.openLink,
                click: () => shell.openExternal(params.linkURL)
            }));
            menu.append(new MenuItem({
                label: t.copyLink,
                click: () => {
                    const clipboard = require('electron').clipboard;
                    clipboard.writeText(params.linkURL);
                }
            }));
            menu.append(new MenuItem({ type: 'separator' }));
        }

        if (params.selectionText) {
            menu.append(new MenuItem({ role: 'copy', label: t.copy }));
            if (params.isEditable) {
                menu.append(new MenuItem({ role: 'cut', label: t.cut }));
            }
            menu.append(new MenuItem({ type: 'separator' }));
        }

        if (params.isEditable) {
            menu.append(new MenuItem({ role: 'paste', label: t.paste }));
            menu.append(new MenuItem({ role: 'selectAll', label: t.selectAll }));
            menu.append(new MenuItem({ type: 'separator' }));
        }

        if (win.webContents.canGoBack()) {
            menu.append(new MenuItem({
                label: t.back,
                click: () => win.webContents.goBack()
            }));
        }

        if (win.webContents.canGoForward()) {
            menu.append(new MenuItem({
                label: t.forward,
                click: () => win.webContents.goForward()
            }));
        }

        menu.append(new MenuItem({
            label: t.reload,
            click: () => win.webContents.reload()
        }));

        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
            label: t.inspect,
            click: () => {
                win.webContents.inspectElement(params.x, params.y);
            }
        }));

        menu.popup(win);
    });
};
