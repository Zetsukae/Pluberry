# Streamix 📺

> **L'expérience de streaming centralisée, sécurisée et immersive.**

![Version](https://img.shields.io/badge/version-1.2.26-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey?style=flat-square)
![Status](https://img.shields.io/badge/status-Stable-success?style=flat-square)

**Streamix** est une application de bureau open-source basée sur **Electron**. Elle permet de centraliser vos sources de streaming favorites (animes, séries) dans une interface unifiée, sécurisée et débarrassée des distractions habituelles des navigateurs web.

---

## 📥 Téléchargement

Streamix est disponible pour **Windows** et **Linux**.

| Système | Type | Lien |
| :--- | :--- | :--- |
| **Windows** | Installeur `.exe` | Patch en cours |
| **Linux** | Portable `.AppImage` | Disponible |

> *Les liens de téléchargement de Windows peuvent être ajoutés quelques jours après Linux, regardez souvent l'onglet [Releases].*

---

## ✨ Fonctionnalités

### 🔒 Sécurité Avancée
* **Protection des Sources** : Utilisation d'un header unique (`X-Streamix-Key`) et d'une signature User-Agent (`StreamixApp`) pour restreindre l'accès aux sources.
* **Navigation Sécurisée** : Restriction stricte aux domaines **GitHub Pages** (`.github.io`) pour éviter le chargement de scripts malveillants.
* **Isolation** : Chaque source tourne dans un environnement sandboxé.

### 🌍 Interface & Internationalisation
* **Multilingue** : Interface entièrement traduite en **Français 🇫🇷, Anglais 🇺🇸, Espagnol 🇪🇸, Allemand 🇩🇪 et Japonais 🇯🇵**.
* **Styles de Fenêtre** :
  * **Immersif** : Fenêtre sans bordure, aux couleurs de l'application.
  * **Natif** : Fenêtre standard de votre système d'exploitation.
* **Animations** : Interface fluide avec animations CSS (désactivables).

### 🎮 Expérience Utilisateur
* **Menu Overlay (F1)** : Accès rapide aux fonctions (Accueil, Actualiser, Paramètres) via la touche `F1` ou le bouton flottant.
* **Menu Contextuel** : Clic droit complet (Copier, Coller, Précédent, Suivant, Ouvrir dans le navigateur).
* **Mode Cinéma** : Suppression automatique des distractions visuelles sur les sites supportés.

---

## 🧩 Guide de Développement de Plugins

Vous souhaitez étendre les fonctionnalités de Streamix ? Ce guide vous explique comment créer vos propres extensions (`.js`) pour ajouter des fonctionnalités ou modifier l'apparence de l'application.

### 1. Structure d'un Plugin

Un plugin Streamix est un simple fichier JavaScript (`.js`). Pour qu'il soit correctement reconnu par l'application, il doit inclure des **métadonnées** spécifiques sous forme de commentaires au tout début du fichier.

#### Les Métadonnées (En-tête)

Ces informations permettent à Streamix d'afficher votre nom, votre lien et la version du plugin dans les paramètres.

```javascript
// @author VotrePseudo
// @github [https://github.com/VotrePseudo](https://github.com/VotrePseudo)
// @version 1.0
```

* **`@author`** : Votre nom ou pseudo (Obligatoire pour le crédit).
* **`@github`** : Le lien vers votre profil GitHub (Optionnel). Si présent, votre nom deviendra un lien bleu cliquable.
* **`@version`** : Le numéro de version du plugin (ex: `1.0`, `2.1.5`). Un badge sera affiché à côté du nom.

### 2. Écrire le Code

Le code de votre plugin est injecté directement dans la fenêtre principale de l'application. Vous avez accès au **DOM** (l'interface HTML) et à l'objet `window`.

#### Bonnes Pratiques

Il est fortement recommandé d'envelopper votre code dans une **fonction auto-exécutée (IIFE)**. Cela évite que vos variables ne rentrent en conflit avec celles de l'application ou d'autres plugins.

```javascript
(function() {
    'use strict';
    // Votre code ici...
    console.log("Mon plugin démarre !");
})();
```

#### Ce que vous pouvez faire
* **Manipuler le DOM** : Ajouter des boutons, cacher des éléments, changer des couleurs.
* **Écouter des événements** : Détecter les clics, les touches du clavier.
* **Utiliser l'API Streamix** : Si disponible, via `window.electronAPI`.

### 3. Exemple Complet : "Hello World"

Voici un exemple simple qui affiche une petite notification verte au démarrage de l'application.

```javascript
// @author Zetsukae
// @github [https://github.com/Zetsukae](https://github.com/Zetsukae)
// @version 1.0

(function() {
    'use strict';

    console.log("Plugin Hello World chargé !");

    // Créer un élément de notification
    const notif = document.createElement('div');
    notif.innerText = "Bienvenue sur Streamix ! 🚀";
    
    // Appliquer du style
    Object.assign(notif.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: '#238636', // Vert GitHub
        color: 'white',
        padding: '10px 20px',
        borderRadius: '8px',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        fontFamily: 'sans-serif',
        opacity: '0',
        transition: 'opacity 0.5s'
    });

    // Ajouter à la page
    document.body.appendChild(notif);

    // Animation d'apparition
    setTimeout(() => { notif.style.opacity = '1'; }, 100);

    // Disparition après 5 secondes
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    }, 5000);

})();
```

### 4. Installation et Test

1.  Ouvrez **Streamix**.
2.  Appuyez sur `F1` ou cliquez sur le bouton Home pour ouvrir le menu.
3.  Allez dans **Paramètres** > **Extensions**.
4.  Cliquez sur **"Ajouter un plugin (.js)"**.
5.  Sélectionnez votre fichier `.js`.
6.  Le plugin apparaîtra dans la liste avec votre nom en bleu (si GitHub renseigné) et sa version.
7.  **Redémarrez** ou **Actualisez** l'application pour que le plugin prenne effet.

> **⚠️ Avertissement de Sécurité**
> Les plugins ont accès à toute l'interface de l'application. N'installez jamais un plugin dont vous ne connaissez pas la provenance ou si vous n'avez pas confiance en l'auteur.

---

## 🛠️ Installation (Développement Core)

Si vous souhaitez contribuer au code source de l'application elle-même ou compiler votre propre version.

### Prérequis
* **Node.js** (v16 ou supérieur)
* **npm** ou **yarn**

### 1. Cloner le projet
```bash
git clone [https://github.com/zetsukae/streamix](https://github.com/zetsukae/streamix)
cd streamix
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Lancer en mode dev
```bash
npm start
```

### 4. Compiler l'application (Build)
```bash
# Pour Windows
npm run build:win

# Pour Linux
npm run build:linux
```

---

## ⚙️ Structure Technique

```
streamix/
├── main.js          # Processus Principal (Sécurité, Fenêtres, IPC)
├── preload.js       # Pont sécurisé (ContextBridge)
├── contextMenu.js   # Gestion du menu clic droit
├── locales.js       # Fichier de traductions (FR, EN, ES, DE, JA)
├── settings.html    # Interface des paramètres
├── setup.html       # Interface de premier lancement
├── animations.css   # Gère les animations de l'Application
├── assets/          # Icônes et images
└── dist/            # Dossier de sortie des builds
```

### Mécanisme de Sécurité
L'application injecte automatiquement les éléments suivants dans les requêtes vers les sources :
* **Header** : `X-Streamix-Key: zetsukaedagoat`
* **User-Agent** : Ajout du suffixe `StreamixApp`

Cela permet aux développeurs de sources web de vérifier que la requête provient bien de l'application officielle tout en bloquant l'accès via un navigateur standard.

---

## ⚖️ Avertissement Légal

**Streamix** est un logiciel open source agissant comme un **navigateur web spécialisé**.

* Streamix ne détient, n’héberge, ne distribue ni ne contrôle aucun contenu audiovisuel.
* Les sources accessibles via l’application sont des services tiers indépendants.
* L’utilisateur est seul responsable de l’utilisation qu’il fait du logiciel et doit s’assurer de respecter la législation en vigueur dans son pays concernant le droit d'auteur.

---

## ❤️ Crédits

Projet imaginé et développé par **Zetsukae**.

* **Licence** : MIT
* **Discord** : [Rejoindre la communauté](https://discord.gg/u3SwvGVvGD)
* **Site Web** : [uniware.site](https://uniware.site)
