"""Convierte los snapshots crudos en data/raw a JSON listo para graficar en data/processed.

Cada dataset tiene su propia forma, así que las transformaciones se registran una por una
en TRANSFORMS (clave = id del dataset en datasets.yaml) en lugar de intentar generalizarlas
antes de tener el primer caso real.
"""

import json
from pathlib import Path

import pandas as pd

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"

MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
ORDEN_MES = {mes: i + 1 for i, mes in enumerate(MESES)}


def transform_gastos_pgn_mensual(df: pd.DataFrame, meta: dict) -> dict:
    montos = ["apropiacion_vigente", "compromisos", "obligaciones", "pagos"]
    df[montos] = df[montos].apply(pd.to_numeric, errors="coerce").fillna(0)
    df["mes_num"] = df["nombremes"].map(ORDEN_MES)
    df["pct_pagado"] = (
        df["pagos"] / df["apropiacion_vigente"].replace(0, pd.NA) * 100
    ).fillna(0).round(1)
    df = df.sort_values(["anio", "mes_num", "sector"])

    return {
        "meta": meta,
        "filtros": {
            "anios": sorted(df["anio"].unique().tolist()),
            "meses": MESES,
            "sectores": sorted(df["sector"].unique().tolist()),
        },
        "registros": [
            {
                "anio": row["anio"],
                "mes": row["nombremes"],
                "mes_num": row["mes_num"],
                "sector": row["sector"],
                "apropiacion_vigente": round(row["apropiacion_vigente"], 2),
                "compromisos": round(row["compromisos"], 2),
                "obligaciones": round(row["obligaciones"], 2),
                "pagos": round(row["pagos"], 2),
                "pct_pagado": row["pct_pagado"],
            }
            for _, row in df.iterrows()
        ],
    }


TRANSFORMS = {
    "gastos_pgn_mensual": transform_gastos_pgn_mensual,
}


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    for dataset_id, transform_fn in TRANSFORMS.items():
        snapshot = json.loads((RAW_DIR / f"{dataset_id}.json").read_text(encoding="utf-8"))
        df = pd.DataFrame.from_records(snapshot["records"])
        result = transform_fn(df, snapshot["meta"])
        out_path = PROCESSED_DIR / f"{dataset_id}.json"
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{dataset_id}] procesado -> {out_path}")


if __name__ == "__main__":
    main()
