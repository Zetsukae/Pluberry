// URLs de téléchargement directs
const DOWNLOAD_URLS = {
    windows: "https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-1.2.26-BeyondAdvance/Pluberry.Setup.1.2.26.exe",
    linux: "https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-1.2.26-BeyondAdvance/Pluberry-1.2.26.AppImage",
    macos: "https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-1.2.26-BeyondAdvance/Pluberry-1.2.26-universal.dmg",
    other: "https://github.com/Zetsukae/Pluberry/releases"
};

const RELEASES_API_URL = "https://api.github.com/repos/Zetsukae/Pluberry/releases/latest";
const FALLBACK_VERSION = "1.2.26";
const FALLBACK_TAG = "v1.2.26";

function getVersionFromTag(tagName) {
    const match = tagName.match(/(\d+(?:\.\d+){1,3})/);
    return match ? match[1] : null;
}

function getDisplayTag(tagName, version) {
    if (!tagName) return `v${version}`;
    if (tagName.startsWith('v')) return tagName;
    return `v${version}`;
}

function buildDownloadUrls(version) {
    return {
        windows: `https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-${version}-BeyondAdvance/Pluberry.Setup.${version}.exe`,
        linux: `https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-${version}-BeyondAdvance/Pluberry-${version}.AppImage`,
        macos: `https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-${version}-BeyondAdvance/Pluberry-${version}-universal.dmg`,
        other: "https://github.com/Zetsukae/Pluberry/releases"
    };
}

function buildDownloadUrlsFromRelease(release, version) {
    const urls = buildDownloadUrls(version);
    const releaseUrl = release.html_url || urls.other;

    urls.other = releaseUrl;
    urls.windows = releaseUrl;
    urls.linux = releaseUrl;
    urls.macos = releaseUrl;

    (release.assets || []).forEach((asset) => {
        const assetName = asset.name.toLowerCase();
        if (assetName.endsWith('.exe')) urls.windows = asset.browser_download_url;
        if (assetName.endsWith('.appimage')) urls.linux = asset.browser_download_url;
        if (assetName.endsWith('.dmg')) urls.macos = asset.browser_download_url;
    });

    return urls;
}

function setVersionInfo(tagName, version) {
    const versionTag = document.getElementById('versionTag');
    const versionText = document.getElementById('versionText');
    const downloadTitle = document.getElementById('downloadTitle');
    const downloadSubtitle = document.getElementById('downloadSubtitle');

    if (versionTag) {
        versionTag.textContent = `${tagName} Stable`;
    }

    if (versionText) {
        versionText.textContent = 'Latest stable release';
    }

    if (downloadTitle) {
        downloadTitle.textContent = `Pluberry ${tagName}`;
    }

    if (downloadSubtitle) {
        downloadSubtitle.textContent = `${version} • latest stable version`;
    }
}

async function loadLatestStableRelease() {
    try {
        const response = await fetch(RELEASES_API_URL, {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            throw new Error('Unable to fetch GitHub releases');
        }

        const release = await response.json();
        const version = getVersionFromTag(release.tag_name);

        if (!version) {
            throw new Error('Release tag does not match expected pattern');
        }

        const displayTag = getDisplayTag(release.tag_name, version);
        Object.assign(DOWNLOAD_URLS, buildDownloadUrlsFromRelease(release, version));
        setVersionInfo(displayTag, version);
    } catch (error) {
        console.warn('Unable to load latest stable release, using fallback values:', error);
        Object.assign(DOWNLOAD_URLS, buildDownloadUrls(FALLBACK_VERSION));
        setVersionInfo(FALLBACK_TAG, FALLBACK_VERSION);
    } finally {
        updateDownloadLinks();
    }
}

/**
 * Détecte le système d'exploitation
 */
function getOS() {
    const platform = window.navigator.platform;
    const userAgent = window.navigator.userAgent;
    if (['Win32', 'Win64', 'Windows'].includes(platform)) return 'Windows';
    if (/Linux/.test(platform)) return 'Linux';
    if (['Macintosh', 'MacIntel'].includes(platform)) return 'macOS';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    return 'unknown';
}

/**
 * Met à jour les boutons
 */
function updateDownloadLinks() {
    const os = getOS();
    const heroBtn = document.getElementById('heroDownloadBtn');
    const heroText = document.getElementById('heroDownloadText');
    const mainBtn = document.getElementById('mainDownloadBtn');
    const mainText = document.getElementById('mainDownloadText');

    if (!heroBtn || !mainBtn) return;

    let url = DOWNLOAD_URLS.other;
    let message = "Voir les versions";
    let available = true;
    const isAndroid = os === 'Android';

    if (os === 'Windows') {
        url = DOWNLOAD_URLS.windows;
        message = "Download for Windows";
    } else if (os === 'Linux') {
        url = DOWNLOAD_URLS.linux;
        message = "Download for Linux";
    } else if (os === 'macOS') {
        url = DOWNLOAD_URLS.macos;
        message = "Download for macOS";
    } else if (os === 'iOS') {
        message = `Not available on ${os}`;
        available = false;
    } else if (isAndroid) {
        url = "notAvailable/";
        message = "Not available on Android";
        available = false;
    }

    [heroBtn, mainBtn].forEach(btn => {
        btn.href = url;
        if (isAndroid) {
            btn.style.opacity = "0.7";
            btn.style.cursor = "pointer";
            btn.onclick = (e) => {
                e.preventDefault();
                window.location.href = url;
            };
        } else if (!available) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
            btn.onclick = (e) => e.preventDefault();
        } else {
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
            btn.onclick = null;
        }
    });

    if (heroText) heroText.innerText = message;
    if (mainText) mainText.innerText = message;
}

function createBubbles() {
    const container = document.getElementById("bubbles")
    if (!container) return
    const bubbleCount = 12
    for (let i = 0; i < bubbleCount; i++) { createBubble(container) }
    setInterval(() => {
        if (container.children.length < 16) { createBubble(container) }
    }, 4000)
}

function createBubble(container) {
    const bubble = document.createElement("div")
    bubble.className = "bubble"
    const size = Math.random() * 80 + 40
    bubble.style.width = `${size}px`
    bubble.style.height = `${size * 0.6}px`
    bubble.style.left = `${Math.random() * 100}%`
    const opacity = Math.random() * 0.18 + 0.08
    bubble.style.opacity = `${opacity}`
    const duration = Math.random() * 22 + 22
    bubble.style.animationDuration = `${duration}s`
    bubble.style.animationDelay = `${Math.random() * 6}s`
    container.appendChild(bubble)
    setTimeout(() => { if (bubble.parentNode) { bubble.parentNode.removeChild(bubble) } }, (duration + 6) * 1000)
}

function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const savedTheme = localStorage.getItem('pluberry-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyTheme(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
        toggle.setAttribute('aria-pressed', String(isDark));
        toggle.setAttribute('aria-label', isDark ? 'Activer le mode clair' : 'Activer le mode sombre');
        toggle.setAttribute('title', isDark ? 'Activer le mode clair' : 'Activer le mode sombre');
    }

    applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);
    toggle.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark-mode');
        applyTheme(isDark);
        localStorage.setItem('pluberry-theme', isDark ? 'dark' : 'light');
    });
}

document.addEventListener("DOMContentLoaded", () => {
    createBubbles();
    setupThemeToggle();
    Object.assign(DOWNLOAD_URLS, buildDownloadUrls(FALLBACK_VERSION));
    updateDownloadLinks();
    loadLatestStableRelease();

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            const href = this.getAttribute("href");
            if (href === "#") return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
});
