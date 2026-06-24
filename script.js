// URLs de téléchargement directs
const DOWNLOAD_URLS = {
    windows: "https://github.com/Zetsukae/streamix/releases/download/Streamix-1.2.26-BeyondAdvance/Streamix.1.2.26.exe",
    linux: "https://github.com/Zetsukae/streamix/releases/download/Streamix-1.2.26-BeyondAdvance/Streamix-1.2.26.AppImage",
    other: "https://github.com/Zetsukae/streamix/releases"
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

    if (os === 'Windows') {
        url = DOWNLOAD_URLS.windows;
        message = "Download for Windows";
    } else if (os === 'Linux') {
        url = DOWNLOAD_URLS.linux;
        message = "Download for Linux";
    } else if (['macOS', 'Android', 'iOS'].includes(os)) {
        message = `Not available on ${os}`;
        available = false;
    }

    [heroBtn, mainBtn].forEach(btn => {
        btn.href = url;
        if (!available) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
            btn.onclick = (e) => e.preventDefault();
        }
    });

    if (heroText) heroText.innerText = message;
    if (mainText) mainText.innerText = message;
}

/**
 * Bulles animées
 */
function createBubbles() {
    const container = document.getElementById("bubbles")
    if (!container) return
    const bubbleCount = 15
    for (let i = 0; i < bubbleCount; i++) { createBubble(container) }
    setInterval(() => {
        if (container.children.length < 20) { createBubble(container) }
    }, 3000)
}

function createBubble(container) {
    const bubble = document.createElement("div")
    bubble.className = "bubble"
    const size = Math.random() * 50 + 10
    bubble.style.width = `${size}px`
    bubble.style.height = `${size}px`
    bubble.style.left = `${Math.random() * 100}%`
    const duration = Math.random() * 15 + 15
    bubble.style.animationDuration = `${duration}s`
    bubble.style.animationDelay = `${Math.random() * 5}s`
    container.appendChild(bubble)
    setTimeout(() => { if (bubble.parentNode) { bubble.parentNode.removeChild(bubble) } }, (duration + 5) * 1000)
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
