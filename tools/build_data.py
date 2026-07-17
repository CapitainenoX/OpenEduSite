#!/usr/bin/env python3
"""Construit assets/data.json à partir des fichiers YAML du dossier data/.

Usage :
    python3 tools/build_data.py [--check]

--check : valide seulement, n'écrit rien (utile en CI).

Le chemin d'un fichier fournit des valeurs par défaut :
    data/national/<niveau>/site.yml            → academies: [toutes]
    data/academies/<academie>/<niveau>/site.yml → academies: [<academie>]
Les champs "niveaux" et "academies" présents dans le fichier priment
toujours sur le dossier.
"""

import json
import sys
import unicodedata
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUT_FILE = ROOT / "assets" / "data.json"

CATEGORIES = {
    "institutionnel": "Sites institutionnels",
    "ent": "ENT & espaces numériques",
    "vie-scolaire": "Vie scolaire",
    "gestion-administrative": "Gestion administrative",
    "ressources-pedagogiques": "Ressources pédagogiques",
    "preparation-cours": "Préparation de cours",
    "exercices-entrainement": "Exercices & entraînement",
    "evaluation": "Évaluation",
    "orientation": "Orientation",
    "formation-enseignants": "Formation des enseignants",
    "outils-numeriques": "Outils numériques",
    "langues": "Langues",
    "sciences": "Sciences & mathématiques",
    "lettres-histoire": "Lettres & histoire-géo",
    "arts-culture": "Arts & culture",
    "emi-citoyennete": "EMI & citoyenneté",
    "inclusion-ash": "Inclusion & besoins particuliers",
    "parents": "Parents",
    "annuaires-portails": "Annuaires & portails",
}

NIVEAUX = [
    "tous", "maternelle", "cp", "ce1", "ce2", "cm1", "cm2",
    "college", "lycee", "superieur",
]

PUBLICS = ["enseignant", "eleve", "parent", "direction"]

REQUIRED = ["nom", "url", "description", "categorie", "tags", "publics"]


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return "".join(c if c.isalnum() else "-" for c in text.lower()).strip("-")


def norm_list(value):
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    return [str(v).strip().lower() for v in value if str(v).strip()]


def defaults_from_path(path: Path):
    """Déduit (academies, niveaux) de l'emplacement du fichier."""
    rel = path.relative_to(DATA_DIR).parts
    academies, niveaux = ["toutes"], ["tous"]
    if rel[0] == "national" and len(rel) >= 3:
        niveaux = [rel[1]]
    elif rel[0] == "academies" and len(rel) >= 3:
        academies = [rel[1]]
        if len(rel) >= 4:
            niveaux = [rel[2]]
    if niveaux == ["tous-niveaux"]:
        niveaux = ["tous"]
    return academies, niveaux


def load_entry(path: Path, errors: list):
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        errors.append(f"{path}: YAML invalide ({exc})")
        return None
    if not isinstance(raw, dict):
        errors.append(f"{path}: le fichier ne contient pas un objet YAML")
        return None

    missing = [f for f in REQUIRED if not raw.get(f)]
    if missing:
        errors.append(f"{path}: champs requis manquants : {', '.join(missing)}")
        return None

    cat = str(raw["categorie"]).strip().lower()
    if cat not in CATEGORIES:
        errors.append(f"{path}: catégorie inconnue « {cat} »")
        return None

    url = str(raw["url"]).strip()
    if not url.startswith(("http://", "https://")):
        errors.append(f"{path}: url invalide « {url} »")
        return None

    def_academies, def_niveaux = defaults_from_path(path)
    niveaux = norm_list(raw.get("niveaux")) or def_niveaux
    niveaux = ["tous" if n == "tous-niveaux" else n for n in niveaux]
    bad = [n for n in niveaux if n not in NIVEAUX]
    if bad:
        errors.append(f"{path}: niveaux inconnus : {', '.join(bad)}")
        return None

    publics = [p for p in norm_list(raw.get("publics")) if p in PUBLICS] or ["enseignant"]

    gratuit = raw.get("gratuit", None)
    if isinstance(gratuit, str):
        gratuit = gratuit.strip().lower()
        gratuit = {"true": True, "false": False, "oui": True, "non": False}.get(gratuit, "partiel")

    return {
        "id": slugify(path.stem),
        "nom": str(raw["nom"]).strip(),
        "url": url,
        "description": " ".join(str(raw["description"]).split()),
        "categorie": cat,
        "tags": sorted(set(norm_list(raw.get("tags")))),
        "publics": publics,
        "niveaux": sorted(set(niveaux), key=NIVEAUX.index),
        "academies": norm_list(raw.get("academies")) or def_academies,
        "officiel": bool(raw.get("officiel", False)),
        "gratuit": gratuit if gratuit is not None else True,
    }


def merge(a: dict, b: dict) -> dict:
    """Fusionne deux entrées ayant la même URL."""
    for key in ("tags", "publics", "niveaux", "academies"):
        a[key] = sorted(set(a[key]) | set(b[key]),
                        key=(NIVEAUX.index if key == "niveaux" else str))
    if "toutes" in a["academies"]:
        a["academies"] = ["toutes"]
    if "tous" in a["niveaux"]:
        a["niveaux"] = ["tous"]
    if len(b["description"]) > len(a["description"]):
        a["description"] = b["description"]
    a["officiel"] = a["officiel"] or b["officiel"]
    return a


def main():
    check_only = "--check" in sys.argv
    errors: list = []
    by_url: dict = {}
    files = sorted(p for p in DATA_DIR.rglob("*.yml") if p.name != "TEMPLATE.yml")

    for path in files:
        entry = load_entry(path, errors)
        if entry is None:
            continue
        key = entry["url"].rstrip("/").lower()
        if key in by_url:
            by_url[key] = merge(by_url[key], entry)
        else:
            by_url[key] = entry

    sites = sorted(by_url.values(), key=lambda s: s["nom"].lower())

    academies = sorted({a for s in sites for a in s["academies"] if a != "toutes"})
    payload = {
        "generated_from": len(files),
        "count": len(sites),
        "categories": CATEGORIES,
        "niveaux": NIVEAUX,
        "academies": academies,
        "sites": sites,
    }

    if errors:
        print(f"⚠ {len(errors)} fichier(s) ignoré(s) :", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)

    if check_only:
        print(f"{len(sites)} sites valides sur {len(files)} fichiers.")
        sys.exit(1 if errors else 0)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"✔ {OUT_FILE.relative_to(ROOT)} : {len(sites)} sites "
          f"({len(files)} fichiers, {len(errors)} erreurs)")


if __name__ == "__main__":
    main()
