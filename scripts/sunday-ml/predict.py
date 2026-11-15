"""Weekly Sunday model job, step 2 of 3: TabICL v2 on out/rows.csv (export.mjs) -> out/scores.json.

Model: Hugging Face jingang/TabICL, checkpoint tabicl-classifier-v2-20260212.ckpt (BSD-3-Clause, no login).
Settings are the 2026-11-15 backtest's (C:/dev/_work/maple-sunday-data/hf/run.py, kind "flat"): every column after
date / bundle / y in file order, the bundle index as a categorical column, n_estimators 8, seeds 0 1 2 averaged.
CPU is enough: about 10 s per seed for ~2,400 rows. Run: uv run --project scripts/sunday-ml python scripts/sunday-ml/predict.py
"""

import argparse
import json
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
OUT = Path(__file__).parent / "out"
CHECKPOINT = "tabicl-classifier-v2-20260212.ckpt"
SEEDS = (0, 1, 2)
N_ESTIMATORS = 8


def frame(df: pd.DataFrame, cols: list[str], cats: list[int]) -> pd.DataFrame:
    x = df[cols].copy()
    x["bid"] = pd.Categorical(x["bid"].astype(int), categories=cats)
    return x


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="cpu")
    a = ap.parse_args()
    from tabicl import TabICLClassifier

    meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
    rows = pd.read_csv(OUT / "rows.csv")
    cols = [c for c in rows.columns if c not in ("date", "bundle", "y")]
    train = rows[rows.y.notna()]
    target = rows[rows.y.isna()]
    if target.empty or train.empty:
        raise SystemExit("rows.csv has no training rows or no bundles to score")
    cats = sorted(set(train["bid"].astype(int)) | set(target["bid"].astype(int)))
    xtr, xte = frame(train, cols, cats), frame(target, cols, cats)
    y = train.y.astype(int).to_numpy()

    t0 = time.time()
    p = np.zeros(len(target))
    for seed in SEEDS:
        clf = TabICLClassifier(device=a.device, n_estimators=N_ESTIMATORS, random_state=seed, checkpoint_version=CHECKPOINT)
        clf.fit(xtr, y)
        proba = clf.predict_proba(xte)
        p += proba[:, list(clf.classes_).index(1)]
    p /= len(SEEDS)

    scores = {b: round(float(v), 6) for b, v in zip(target.bundle, p)}
    out = {"sunday": meta["sunday"], "model": meta["model"], "data_end": meta["data_end"], "data_hash": meta["data_hash"], "scores": scores}
    (OUT / "scores.json").write_text(json.dumps(out), encoding="utf-8")
    top = sorted(scores.items(), key=lambda kv: -kv[1])[:5]
    print(f"{meta['sunday']}: {len(scores)} bundles in {time.time() - t0:.0f}s, top {top}")


if __name__ == "__main__":
    main()
