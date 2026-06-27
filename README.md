# Pluberry

> **A centralized, secure, and immersive streaming experience.**

![Version](https://img.shields.io/badge/version-1.2.26-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey?style=flat-square)
![Status](https://img.shields.io/badge/status-Stable-success?style=flat-square)

**Pluberry** is an open-source desktop application built with **Electron**. It centralizes your favorite streaming sources (anime, series) into a unified, secure interface that removes the usual browser distractions.

---

## Download

Pluberry is available for **Windows** and **Linux**.

| System | Type | Link |
| :--- | :--- | :--- |
| **Windows** | `.exe` installer | Available |
| **Linux** | Portable `.AppImage` | Available |

> *Windows download links may be added a few days after Linux. Check the [Releases] tab regularly.*

---

## Features

### Advanced Security
* **Source Protection**: Uses a unique header (`X-Streamix-Key`) and a custom User-Agent signature (`StreamixApp`) to restrict access to supported sources.
* **Secure Browsing**: Restricts navigation to **GitHub Pages** domains (`.github.io`) to avoid loading malicious scripts.
* **Isolation**: Each source runs in a sandboxed environment.

### UI & Localization
* **Multilingual**: Fully translated interface in **French, English, Spanish, German, and Japanese**.
* **Window Styles**:
  * **Immersive**: Borderless window with app-themed colors.
  * **Native**: Standard operating system window.
* **Animations**: Smooth UI animations with CSS (optional disable).

### User Experience
* **Overlay Menu (F1)**: Quick access to Home, Refresh, and Settings via `F1` or the floating button.
* **Context Menu**: Full right-click menu (Copy, Paste, Back, Forward, Open in Browser).
* **Cinema Mode**: Automatically removes visual distractions on supported sites.

---

## Installation (Core Development)

If you want to contribute to the application source code or build your own version.

### Prerequisites
* **Node.js** (v16 or higher)
* **npm** or **yarn**

### 1. Clone the repository
```bash
git clone [https://github.com/zetsukae/streamix](https://github.com/zetsukae/streamix)
cd streamix
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run in dev mode
```bash
npm start
```

### 4. Build the application
```bash
# For Windows
npm run build:win

# For Linux
npm run build:linux
```

---

## Technical Structure

```
pluberry/
├── main.js                   # Main process (security, windows, IPC)
├── preload.js                # Secure renderer bridge (ContextBridge)
├── contextMenu.js            # Right-click context menu handler
├── locales.js                # Translations FR / EN / ES / DE / JA
├── env-loader.js             # Environment variables loader
├── supabase.js               # Supabase integration and auth handling
├── streamix-supabase-auth.json # Supabase config and keys
├── supabase_schema.sql       # Supabase database schema
├── settings.html             # Settings interface
├── setup.html                # First-launch setup interface
├── animations.css            # UI animations
├── assets/                   # Icons, images, and static assets
├── launcher/                 # App launcher / configuration files
└── dist/                     # Build outputs (AppImage / installers)
```

### What's New
* Full Supabase authentication support with GitHub / Discord
* Online source syncing and cloud backup
* Separate environment configuration via `env-loader.js`
* Multi-platform build output in `dist/`
* Cleaner structure separating core logic, UI, and backend integration

### Security Mechanism
The application automatically injects the following into requests to sources:
* **Header**: `X-Streamix-Key: zetsukaedagoat`
* **User-Agent**: Appends the `StreamixApp` suffix

This allows source providers to verify the request comes from the official app while blocking standard browser access.

---

## Legal Notice

**Pluberry** is open-source software acting as a **specialized web browser**.

* Pluberry does not own, host, distribute, or control any audiovisual content.
* The sources available through the app are independent third-party services.
* The user is solely responsible for how they use the software and must comply with applicable copyright laws.

---

## Credits

Project conceived and developed by **Zetsukae**.

* **License**: MIT
* **Discord** : [Rejoindre la communauté](https://discord.gg/u3SwvGVvGD)
* **Site Web** : [uniware.site](https://uniware.site)
