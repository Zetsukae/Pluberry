// URLs de téléchargement directs
const DOWNLOAD_URLS = {
    windows: "https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-1.2.26-BeyondAdvance/Pluberry.Setup.1.2.26.exe",
    linux: "https://github.com/Zetsukae/Pluberry/releases/download/Pluberry-1.2.26-BeyondAdvance/Pluberry-1.2.26.AppImage",
    other: "https://github.com/Zetsukae/Pluberry/releases"
};

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
    } else if (['macOS', 'iOS'].includes(os)) {
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
        }
    });

    if (heroText) heroText.innerText = message;
    if (mainText) mainText.innerText = message;
}

/**
 * Nuages doux animés
 */
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

document.addEventListener("DOMContentLoaded", () => {
    createBubbles();
    updateDownloadLinks();

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
