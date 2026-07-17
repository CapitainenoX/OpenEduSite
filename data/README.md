# 📂 La base de données des sites

Chaque site référencé = **un fichier YAML** déposé dans le bon dossier.
Aucun code à modifier : copiez [`TEMPLATE.yml`](TEMPLATE.yml), remplissez-le,
déposez-le au bon endroit, et le site apparaît à la prochaine publication.

## Arborescence

```
data/
├── TEMPLATE.yml            ← modèle à copier
├── national/               ← sites valables partout en France
│   ├── tous-niveaux/
│   ├── maternelle/
│   ├── cp/  ce1/  ce2/  cm1/  cm2/
│   ├── college/
│   ├── lycee/
│   └── superieur/
└── academies/              ← sites propres à une académie
    ├── aix-marseille/
    │   ├── tous-niveaux/
    │   ├── maternelle/ … cm2/
    │   ├── college/
    │   └── lycee/
    ├── amiens/
    ├── besancon/
    │   …même structure pour chaque académie…
    └── versailles/
```

## Règles

- **Nom de fichier** : `nom-du-site.yml` — minuscules, tirets, sans accents.
- **Un site présent à plusieurs niveaux** : un seul fichier, placé dans
  `tous-niveaux/` avec le champ `niveaux: [cm1, cm2]` (par exemple).
- **Un site national** va dans `national/`, jamais dans une académie.
- **Doublons** : si deux fichiers ont la même `url`, ils sont fusionnés
  automatiquement à la construction.

## Vérifier sa contribution

```bash
python3 tools/build_data.py        # reconstruit assets/data.json
```

Le script signale les fichiers invalides (champ manquant, catégorie
inconnue, YAML mal formé) sans bloquer le reste.
