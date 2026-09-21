"""Genera el sitio estático (site/dist): una portada con navegación por categoría
y una página por dataset, a partir de etl/datasets.yaml y data/processed/.
"""

import hashlib
import json
import shutil
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader

SITE_DIR = Path(__file__).parent
ETL_DIR = SITE_DIR.parent / "etl"
PROCESSED_DIR = SITE_DIR.parent / "data" / "processed"
DIST_DIR = SITE_DIR / "dist"


def load_dataset_registry() -> list[dict]:
    with open(ETL_DIR / "datasets.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)["datasets"]


def load_processed(dataset_id: str) -> dict | None:
    path = PROCESSED_DIR / f"{dataset_id}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def build_nav(registry: list[dict]) -> list[dict]:
    categorias: dict[str, dict[str | None, list[dict]]] = {}
    for entry in registry:
        if not (PROCESSED_DIR / f"{entry['id']}.json").exists():
            continue
        subgrupos = categorias.setdefault(entry["categoria"], {})
        subgrupos.setdefault(entry.get("subcategoria"), []).append(entry)

    nav = []
    for cat_nombre, subgrupos in sorted(categorias.items()):
        grupos = [
            {"nombre": sub_nombre, "datasets": sorted(items, key=lambda e: e["titulo"])}
            for sub_nombre, items in sorted(
                subgrupos.items(), key=lambda kv: (kv[0] is None, kv[0] or "")
            )
        ]
        nav.append({"nombre": cat_nombre, "grupos": grupos})
    return nav


def compute_asset_version() -> str:
    h = hashlib.sha1()
    for name in ("style.css", "dashboard.js"):
        h.update((SITE_DIR / "static" / name).read_bytes())
    return h.hexdigest()[:10]


def main() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)
    shutil.copytree(SITE_DIR / "static", DIST_DIR / "static")

    env = Environment(loader=FileSystemLoader(SITE_DIR / "templates"))
    env.globals["asset_version"] = compute_asset_version()
    registry = load_dataset_registry()
    nav = build_nav(registry)

    index_html = env.get_template("index.html").render(nav=nav, prefix="")
    (DIST_DIR / "index.html").write_text(index_html, encoding="utf-8")

    fuentes = []
    dataset_template = env.get_template("dataset.html")
    for entry in registry:
        processed = load_processed(entry["id"])
        if processed is None:
            continue
        page_dir = DIST_DIR / entry["id"]
        page_dir.mkdir(parents=True, exist_ok=True)
        html = dataset_template.render(
            nav=nav, prefix="../", active_id=entry["id"], entry=entry, d=processed
        )
        (page_dir / "index.html").write_text(html, encoding="utf-8")
        fuentes.append({"entry": entry, "meta": processed["meta"]})

    fuentes.sort(key=lambda f: f["entry"]["titulo"])
    metodologia_html = env.get_template("metodologia.html").render(
        nav=nav, prefix="../", active_id="metodologia", fuentes=fuentes
    )
    metodologia_dir = DIST_DIR / "metodologia"
    metodologia_dir.mkdir(parents=True, exist_ok=True)
    (metodologia_dir / "index.html").write_text(metodologia_html, encoding="utf-8")

    print(f"Sitio generado en {DIST_DIR} ({len(registry)} datasets)")


if __name__ == "__main__":
    main()
