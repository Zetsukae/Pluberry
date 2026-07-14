# Pluberry

> **A centralized, secure, and immersive streaming experience.**

![Version](https://img.shields.io/badge/version-1.3.26-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20MacOS-lightgrey?style=flat-square)
![Status](https://img.shields.io/badge/status-Stable-success?style=flat-square)

**Pluberry** is an open-source desktop application built with **Electron**. It centralizes your favorite streaming sources (anime, series) into a unified, secure interface that removes the usual browser distractions.

---

## Download

Pluberry is available for **Windows**, **Linux**, and **macOS**.

| System | Type | Link |
| :--- | :--- | :--- |
| **Windows** | `.exe` installer | Available |
| **Linux** | Portable `.AppImage` | Available |
| **MacOS** | Portable `.dmg` | Available |

> *Windows download links may be added a few days after Linux. Check the [Releases] tab regularly.*

---

## Features

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

## Screenshot
<img width="1081" height="567" alt="{ACAC6F5F-8435-4C36-84BB-42FC286D8F3A}" src="https://github.com/user-attachments/assets/1cc72138-7268-4b49-a22b-a2cf5b807809" />
<p align="center">This is the setup menu.</p>
<p align="center"><small><em>Further screenshots are omitted to respect intellectual property and copyright policies.</em></small></p>

---

## Installation (Core Development)

If you want to contribute to the application source code or build your own version.

### Prerequisites
* **Node.js** (v16 or higher)
* **npm** or **yarn**

### 1. Clone the repository
```bash
git clone https://github.com/Zetsukae/Pluberry.git
cd Pluberry
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

# For macOS
npm run build:mac
```

---

## Technical Structure

```
Pluberry/
├── main.js                   # Main Electron process entry point
├── preload.js                # Secure renderer bridge
├── contextMenu.js            # Right-click context menu handler
├── locales.js                # FR / EN / ES / DE / JA translations
├── env-loader.js             # Environment configuration loader
├── supabase.js               # Supabase auth and source sync integration
├── src/
│   └── main/
│       ├── app-config.js    # Shared resource-path helpers
│       └── oauth-helpers.js # OAuth callback helpers for loopback auth
├── test/                     # Automated regression tests
├── settings.html             # Settings UI
├── setup.html                # First-run setup UI
├── animations.css            # UI animations
├── assets/                   # Icons, images, and static assets
├── launcher/                 # App launcher / configuration files
└── dist/                     # Build outputs (installer / bundle)
```

### What's New
* Full Supabase authentication support with GitHub / Discord
* Online source syncing and cloud backup
* Separate environment configuration via `env-loader.js`
* Multi-platform build output in `dist/`
* Cleaner structure separating core logic, UI, and backend integration

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
* **Discord** : [Join the community](https://discord.gg/u3SwvGVvGD)
* **Web Site** : [Pluberry Official Website](https://pluberry.com/)
