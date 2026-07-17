# OpenEduSite 🇫🇷

**L'annuaire des sites de l'éducation en France** — tous les sites utiles aux
enseignants (et aux familles), réunis, décrits et classés : institutionnels,
ENT, vie scolaire, ressources pédagogiques, exercices, orientation, inclusion…

- 🔍 **Recherche par mots-clés** avec synonymes : tapez « ENT » ou « élèves »
  et trouvez Pronote, ONDE, EcoleDirecte…
- 🎚️ **Filtres** par niveau (maternelle → supérieur), académie, catégorie,
  public, sites officiels ou gratuits.
- 🌗 **Trois thèmes** : clair, sombre et **obsidienne**.
- 📄 **Base de données en fichiers** : ajouter un site = déposer un fichier
  YAML, sans toucher au code.

## Publier sur GitHub Pages

1. *Settings → Pages → Source* : « Deploy from a branch », branche `main`,
   dossier `/ (root)`.
2. C'est tout — le site est un site statique servi tel quel.

## Ajouter ou corriger un site

Voir [`data/README.md`](data/README.md) : on copie
[`data/TEMPLATE.yml`](data/TEMPLATE.yml), on le remplit, on le dépose dans le
dossier de l'académie et du niveau concernés (`data/national/…` pour les sites
valables partout). Le fichier `assets/data.json` est régénéré automatiquement
par GitHub Actions à chaque modification de `data/` — ou à la main :

```bash
python3 tools/build_data.py
```

## Structure

```
index.html            page unique de l'annuaire
assets/css/style.css  styles (3 thèmes)
assets/js/app.js      recherche, filtres, affichage — sans dépendance
assets/data.json      base compilée (générée, ne pas éditer à la main)
data/                 la base : 1 fichier YAML = 1 site
tools/build_data.py   compilation et validation de la base
```
