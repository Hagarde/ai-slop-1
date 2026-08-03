# CountryDoku

Un jeu de logique quotidien inspiré de Metrodoku : placez un pays dans chaque case en respectant les deux critères qui se croisent.

La première version propose une grille de démonstration centrée sur des critères linguistiques, géographiques, économiques et historiques.

## Lancer le site localement

Le projet ne nécessite aucune dépendance. Ouvrez `index.html` dans un navigateur, ou utilisez un serveur statique, par exemple :

```powershell
python -m http.server 8000
```

Puis ouvrez <http://localhost:8000>.

## Déploiement

Le workflow `.github/workflows/deploy-pages.yml` publie le site sur GitHub Pages à chaque envoi sur `main`. Dans les réglages GitHub du dépôt, choisissez **Settings → Pages → Source: GitHub Actions**.
