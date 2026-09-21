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
            "dimensiones": sorted(df["sector"].unique().tolist()),
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


def transform_delito_por_departamento(df: pd.DataFrame, meta: dict) -> dict:
    """Un solo indicador (total_casos) agregado por año/mes/departamento.

    Forma compartida por los datasets de delitos de alto impacto de MinDefensa
    que traen un único conteo (homicidios, secuestro, ...).
    """
    df["mes_num"] = pd.to_numeric(df["mes_num"], errors="coerce")
    df["total_casos"] = pd.to_numeric(df["total_casos"], errors="coerce").fillna(0)
    df["mes"] = df["mes_num"].map(lambda n: MESES[int(n) - 1])
    df = df.sort_values(["anio", "mes_num", "departamento"])

    return {
        "meta": meta,
        "filtros": {
            "anios": sorted(df["anio"].unique().tolist()),
            "meses": MESES,
            "dimensiones": sorted(df["departamento"].unique().tolist()),
        },
        "registros": [
            {
                "anio": row["anio"],
                "mes": row["mes"],
                "mes_num": int(row["mes_num"]),
                "departamento": row["departamento"],
                "total_casos": row["total_casos"],
            }
            for _, row in df.iterrows()
        ],
    }


def transform_fuerza_publica(df: pd.DataFrame, meta: dict) -> dict:
    df["mes_num"] = pd.to_numeric(df["mes_num"], errors="coerce")
    df["total"] = pd.to_numeric(df["total"], errors="coerce").fillna(0)

    pivot = (
        df.pivot_table(
            index=["anio", "mes_num", "departamento"],
            columns="accion",
            values="total",
            aggfunc="sum",
            fill_value=0,
        )
        .reset_index()
        .rename(columns={"HERIDO": "heridos", "ASESINADO": "asesinados"})
    )
    for col in ("heridos", "asesinados"):
        if col not in pivot:
            pivot[col] = 0
    pivot["mes"] = pivot["mes_num"].map(lambda n: MESES[int(n) - 1])
    pivot = pivot.sort_values(["anio", "mes_num", "departamento"])

    return {
        "meta": meta,
        "filtros": {
            "anios": sorted(pivot["anio"].unique().tolist()),
            "meses": MESES,
            "dimensiones": sorted(pivot["departamento"].unique().tolist()),
        },
        "registros": [
            {
                "anio": row["anio"],
                "mes": row["mes"],
                "mes_num": int(row["mes_num"]),
                "departamento": row["departamento"],
                "heridos": row["heridos"],
                "asesinados": row["asesinados"],
            }
            for _, row in pivot.iterrows()
        ],
    }


TRANSFORMS = {
    "gastos_pgn_mensual": transform_gastos_pgn_mensual,
    "homicidios": transform_delito_por_departamento,
    "secuestro": transform_delito_por_departamento,
    "hurto_residencias": transform_delito_por_departamento,
    "hurto_comercio": transform_delito_por_departamento,
    "hurto_vehiculos": transform_delito_por_departamento,
    "fuerza_publica": transform_fuerza_publica,
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
