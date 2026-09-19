"""Descarga los datasets registrados en datasets.yaml desde la API de datos.gov.co."""

import json
from datetime import datetime, timezone
from pathlib import Path

import yaml
from sodapy import Socrata

DOMAIN = "www.datos.gov.co"
DATASETS_FILE = Path(__file__).parent / "datasets.yaml"
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"


def load_dataset_registry() -> list[dict]:
    with open(DATASETS_FILE, encoding="utf-8") as f:
        return yaml.safe_load(f)["datasets"]


def fetch_dataset(client: Socrata, entry: dict) -> None:
    soql_params = {
        key: entry[key] for key in ("select", "group", "order", "where") if key in entry
    }
    records = client.get(entry["dataset_id"], limit=entry.get("limit", 50000), **soql_params)
    snapshot = {
        "meta": {
            "id": entry["id"],
            "ministerio": entry["ministerio"],
            "dataset_id": entry["dataset_id"],
            "fuente": f"https://{DOMAIN}/d/{entry['dataset_id']}",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "row_count": len(records),
            "consulta_soql": soql_params or None,
        },
        "records": records,
    }
    out_path = RAW_DIR / f"{entry['id']}.json"
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{entry['id']}] {len(records)} filas -> {out_path}")


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    client = Socrata(DOMAIN, None)  # sin app token: suficiente para volúmenes bajos/moderados
    for entry in load_dataset_registry():
        fetch_dataset(client, entry)


if __name__ == "__main__":
    main()
