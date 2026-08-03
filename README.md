# CountryDoku

Un jeu de logique quotidien inspiré de Metrodoku : placez un pays dans chaque case en respectant les deux critères qui se croisent.

Le site contient une base locale de 193 États membres de l’ONU (les deux États observateurs ne sont pas inclus). Chaque fiche contient le drapeau et sa palette de couleurs, l’hémisphère, les frontières terrestres, les langues officielles, la population, les devises et les régions.

Les grilles sont générées côté navigateur. L’algorithme combine six critères, calcule les candidats à chaque intersection puis utilise une recherche avec retour arrière pour garantir qu’au moins une solution de neuf pays distincts existe. Après chaque réponse, il vérifie aussi qu’une solution reste possible.

## Lancer le site localement

Le projet ne nécessite aucune dépendance. Ouvrez `index.html` dans un navigateur, ou utilisez un serveur statique, par exemple :

```powershell
python -m http.server 8000
```

Puis ouvrez <http://localhost:8000>.

## Actualiser les données

`data/countries.json` est l’instantané utilisé par le site. Pour le régénérer après avoir téléchargé les deux sources indiquées dans `scripts/build-country-data.mjs`, exécutez :

```powershell
node scripts/build-country-data.mjs
```

Le script filtre les États membres de l’ONU, enrichit les populations et extrait les couleurs dominantes des drapeaux.

## Déploiement

Le workflow `.github/workflows/deploy-pages.yml` publie le site sur GitHub Pages à chaque envoi sur `main`. Dans les réglages GitHub du dépôt, choisissez **Settings → Pages → Source: GitHub Actions**.
