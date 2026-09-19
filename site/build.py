"""Genera el sitio estático (site/dist) a partir de las plantillas y de data/processed."""

import json
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

SITE_DIR = Path(__file__).parent
PROCESSED_DIR = SITE_DIR.parent / "data" / "processed"
DIST_DIR = SITE_DIR / "dist"


def load_datasets() -> dict:
    return {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in PROCESSED_DIR.glob("*.json")
    }


def main() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)
    shutil.copytree(SITE_DIR / "static", DIST_DIR / "static")

    env = Environment(loader=FileSystemLoader(SITE_DIR / "templates"))
    template = env.get_template("index.html")
    html = template.render(datasets=load_datasets())
    (DIST_DIR / "index.html").write_text(html, encoding="utf-8")
    print(f"Sitio generado en {DIST_DIR}")


if __name__ == "__main__":
    main()
