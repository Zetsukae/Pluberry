let pendingUrl = ""

function createBubbles() {
  const container = document.getElementById("bubbles")
  if (!container) return
  const bubbleCount = 12

  for (let i = 0; i < bubbleCount; i++) {
    createBubble(container)
  }

  setInterval(() => {
    if (container.children.length < 16) {
      createBubble(container)
    }
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

  setTimeout(
    () => {
      if (bubble.parentNode) {
        bubble.parentNode.removeChild(bubble)
      }
    },
    (duration + 6) * 1000,
  )
}

// Initialiser les nuages au chargement
document.addEventListener("DOMContentLoaded", createBubbles)

function showWarningModal(url) {
  pendingUrl = url
  document.getElementById("warning-modal").classList.add("show")
}

function closeWarningModal() {
  document.getElementById("warning-modal").classList.remove("show")
  pendingUrl = ""
}

function confirmCopy() {
  if (pendingUrl) {
    copySource(pendingUrl)
    closeWarningModal()
  }
}

function copySource(url) {
  navigator.clipboard
    .writeText(url)
    .then(() => {
      showToast()
    })
    .catch((err) => {
      console.error("Erreur lors de la copie:", err)
      const textArea = document.createElement("textarea")
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      showToast()
    })
}

function showToast() {
  const toast = document.getElementById("toast")
  toast.classList.add("show")

  setTimeout(() => {
    toast.classList.remove("show")
  }, 3000)
}

// Add smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute("href"))
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
      })
    }
  })
})
