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
        }

        if (win.webContents.canGoBack() || win.webContents.canGoForward() || true) {
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
        }

        menu.append(new MenuItem({ type: 'separator' }));

        menu.append(new MenuItem({
            label: t.copy,
            click: () => {
                const clipboard = require('electron').clipboard;
                clipboard.writeText(params.selectionText || '');
            }
        }));

        menu.append(new MenuItem({
            label: t.paste,
            click: () => {
                if (params.isEditable) {
                    win.webContents.paste();
                }
            }
        }));

        menu.append(new MenuItem({
            label: t.openLink,
            click: () => shell.openExternal(win.webContents.getURL())
        }));

        menu.popup(win);
    });
};
