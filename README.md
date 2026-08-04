# 🌍 CountryDoku — Le Jeu Quotidien de Géographie & Morpion 1v1

[![GitHub Pages](https://img.shields.io/badge/Hébergement-GitHub%20Pages-1f6f50?style=for-the-badge&logo=github)](https://hagarde.github.io/ai-slop-1/)
[![Live Demo](https://img.shields.io/badge/Demo-En%20Ligne-2e7d32?style=for-the-badge&logo=googlechrome)](https://hagarde.github.io/ai-slop-1/)
[![WebRTC](https://img.shields.io/badge/Multijoueur-WebRTC%20PeerJS-1565c0?style=for-the-badge&logo=webrtc)](https://peerjs.com/)
[![UN Members](https://img.shields.io/badge/Données-193%20États%20ONU-ff9800?style=for-the-badge)](https://www.un.org/)

**CountryDoku** est une application web moderne et ergonomique de culture géographique inspirée du concept *MetroDoku* / *Immaculate Grid*. Le jeu propose de compléter une grille 3x3 croisant des critères géographiques, démographiques, politiques et héraldiques sur les 193 États membres des Nations Unies.

---

## 📖 Sommaire
1. [🎮 Guide du Joueur](#-guide-du-joueur)
   - [Mode Solo (Défi Quotidien)](#mode-solo-défi-quotidien)
   - [Mode Multijoueur 1v1 (Morpion Géographique)](#mode-multijoueur-1v1-morpion-géographique)
   - [Recherche & Infobulles](#recherche--infobulles)
2. [💻 Guide du Développeur](#-guide-du-développeur)
   - [Technologies Utilises](#technologies-utilisées)
   - [Structure du Projet](#structure-du-projet)
   - [Lancement en Local](#lancement-en-local)
   - [Algorithme de Résolution de Grille (Backtracking)](#algorithme-de-résolution-de-grille-backtracking)
   - [Audit & Qualité des Données](#audit--qualité-des-données)
   - [Déploiement GitHub Pages](#déploiement-github-pages)

---

## 🎮 Guide du Joueur

### Mode Solo (Défi Quotidien)
- **Objectif** : Compléter les 9 cases de la grille en trouvant un pays valide pour chaque croisement de critères (ligne × colonne).
- **Vies** : Vous disposez de **3 vies (❤️❤️❤️)**. Chaque pays incorrect retire 1 vie.
- **Grille Solvable Garantis** : Chaque grille générée possède au moins une solution valide complète de 9 pays distincts.
- **Règle d'Unicité** : Un même pays ne peut être utilisé qu'une seule fois par grille.

### Mode Multijoueur 1v1 (Morpion Géographique)
- **Principe** : Affrontez un ami en temps réel sur la même grille dans un duel de style **Tic-Tac-Toe**.
- **Création de Salon** :
  1. Cliquez sur **"🎮 Multijoueur 1v1"** puis **"Créer un salon 1v1"**.
  2. Le jeu génère un code unique (ex: `8X42K`) et copie automatiquement le lien d'invitation dans votre presse-papier.
  3. Envoyez le lien à votre ami (WhatsApp, Discord, SMS...).
- **Règles du Match** :
  - **Joueur 1 (🟢 Vert)** vs **Joueur 2 (🔵 Bleu)** au tour par tour.
  - **Minuteur de 30 secondes (⏱️ 30s)** par tour. Si le temps expire, la main passe à l'adversaire.
  - **Capture de Case** : Trouver un pays valide capture la case avec votre couleur (`🟢 J1` ou `🔵 J2`).
  - **Mauvaise Réponse** : Passer ou se tromper donne la main à l'adversaire.
  - **Victoire** : Le premier joueur qui aligne **3 cases (horizontalement, verticalement ou en diagonale)** remporte la partie !

### Recherche & Infobulles
- **Recherche Intelligente** : Tapez le nom d'un pays en français ou en anglais, ou un acronyme courant (`USA`, `UK`, `EAU`, `RDC`...). Les résultats s'affichent par ordre de pertinence.
- **Info-bulles (`ⓘ`)** : Cliquez ou tapotez sur l'icône `ⓘ` à côté de n'importe quel critère pour ouvrir son explication détaillée et des exemples.

---

## 💻 Guide du Développeur

### Technologies Utilisées
- **Frontend** : HTML5 sémantique, CSS3 moderne (Variables CSS, Flexbox, CSS Grid flexible `minmax(72px, 23%)`, animations fluides), JavaScript ES6+ Vanilla.
- **Multijoueur WebRTC** : [PeerJS](https://peerjs.com/) (relais P2P DataChannel sans serveur backend payant).
- **Données** : Dataset enrichi des 193 pays membres de l'ONU (`data/countries.json`).
- **Typographie** : *Outfit* et *DM Mono* via Google Fonts.

---

### Structure du Projet

```
CountryDoku/
├── index.html               # Structure HTML5, modaux (Recherche, Rules, 1v1, Victory)
├── styles.css               # Design system, variables CSS, grille responsive & thèmes 1v1
├── app.js                   # Moteur de jeu, résolveur backtracking, contrôleur WebRTC 1v1
├── data/
│   └── countries.json       # Base de données enrichie des 193 États membres de l'ONU
├── scripts/
│   ├── enrich.js            # Script d'enrichissement initial (HSL, drapeaux, superficies)
│   ├── enrich-v2.js         # Script d'enrichissement (OCDE, sommets > 4000m, symboles)
│   └── audit-countries.js   # Script d'audit et de fiabilisation 100% des données ONU
└── README.md                # Documentation explicative joueur & développeur
```

---

### Lancement en Local

Aucun outil de build lourd (`npm`, `webpack` ou `vite`) n'est nécessaire. Un simple serveur HTTP statique suffit :

```bash
# Avec Python 3
python -m http.server 8000

# Ou avec Node.js npx
npx serve .
```

Ouvrez ensuite votre navigateur sur `http://localhost:8000`.

---

### Algorithme de Résolution de Grille (Backtracking)

Pour garantir qu'une grille générée est 100% faisable et qu'aucun coup joué ne bloque la grille prématurément, `app.js` utilise un **algorithme de backtracking avec forward-checking** (`solveGrid()`) :

```javascript
function solveGrid(candidateLists, locked = {}) {
  const order = [...candidateLists.keys()].sort((a, b) => candidateLists[a].length - candidateLists[b].length);
  const solution = Array(9).fill(null);
  const used = new Set();
  
  // verrouillage des cases déjà complétées...
  function visit(position) {
    if (position === order.length) return true;
    const cell = order[position];
    if (solution[cell]) return visit(position + 1);
    for (const country of candidateLists[cell]) {
      if (used.has(country.code)) continue;
      solution[cell] = country; used.add(country.code);
      if (visit(position + 1)) return true;
      solution[cell] = null; used.delete(country.code);
    }
    return false;
  }
  return visit(0) ? solution : null;
}
```

---

### Audit & Qualité des Données

L'ensemble des données relatives aux 193 pays a été audité via `scripts/audit-countries.js` :
- **43 pays enclavés** (sans littoral).
- **38 pays membres de l'OCDE**.
- **13 pays traversés par l'Équateur**.
- **40 pays avec sommets > 4 000 m**.
- **26 correspondances d'initiale** entre le pays et sa capitale en français (ex: *Algérie ➔ Alger*, *Brésil ➔ Brasília*, *Mexique ➔ Mexico*...).

Pour exécuter l'audit :
```bash
node scripts/audit-countries.js
```

---

### Déploiement GitHub Pages

Le déploiement est automatisé à chaque commit sur la branche `main` grâce au workflow GitHub Actions (`.github/workflows/deploy-pages.yml`).

Le site est hébergé en direct sur : **[https://hagarde.github.io/ai-slop-1/](https://hagarde.github.io/ai-slop-1/)**

---

### 📄 Licence
Ce projet est sous licence MIT — Libre d'utilisation et de réutilisation.
