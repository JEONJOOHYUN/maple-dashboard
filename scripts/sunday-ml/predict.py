"""Weekly Sunday model job, step 2 of 3: two pretrained tabular models on out/rows.csv (export.mjs) -> out/scores.json.

Models (both read the training rows in context, no fitting of weights here):
  TabICL v2  Hugging Face jingang/TabICL, checkpoint tabicl-classifier-v2-20260212.ckpt (BSD-3-Clause, no login)
  TabPFN v2  Hugging Face Prior-Labs/TabPFN-v2-clf (Prior Labs License 1.1: show "Built with PriorLabs-TabPFN")
Each: every column after date / bundle / y in file order, the bundle index as a categorical column, n_estimators 8,
seeds 0 1 2 averaged; the scores are the mean of the two models (backtests 2026-11-15,
C:/dev/_work/maple-sunday-data/hf/run2.py). CPU is enough: about 10 s (TabICL) and 30 s (TabPFN) per seed for ~2,400 rows.
Run: uv run --project scripts/sunday-ml python scripts/sunday-ml/predict.py
"""

import argparse
import json
import os
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
# TabPFN refuses more than 1,000 rows on a CPU unless told this is fine (it is, at ~2,400 rows: about 30 s a seed).
os.environ.setdefault("TABPFN_ALLOW_CPU_LARGE_DATASET", "true")
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
    from tabpfn import TabPFNClassifier
    from tabpfn.constants import ModelVersion

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
    p_icl = np.zeros(len(target))
    for seed in SEEDS:
        clf = TabICLClassifier(device=a.device, n_estimators=N_ESTIMATORS, random_state=seed, checkpoint_version=CHECKPOINT)
        clf.fit(xtr, y)
        p_icl += clf.predict_proba(xte)[:, list(clf.classes_).index(1)]
    p_icl /= len(SEEDS)

    ntr, nte = train[cols].to_numpy(dtype=float), target[cols].to_numpy(dtype=float)
    p_pfn = np.zeros(len(target))
    for seed in SEEDS:
        clf = TabPFNClassifier.create_default_for_version(
            ModelVersion.V2, device=a.device, n_estimators=N_ESTIMATORS, random_state=seed, categorical_features_indices=[cols.index("bid")]
        )
        clf.fit(ntr, y)
        p_pfn += clf.predict_proba(nte)[:, list(clf.classes_).index(1)]
    p_pfn /= len(SEEDS)
    p = (p_icl + p_pfn) / 2

    scores = {b: round(float(v), 6) for b, v in zip(target.bundle, p)}
    out = {"sunday": meta["sunday"], "model": meta["model"], "data_end": meta["data_end"], "data_hash": meta["data_hash"], "scores": scores}
    (OUT / "scores.json").write_text(json.dumps(out), encoding="utf-8")
    top = sorted(scores.items(), key=lambda kv: -kv[1])[:5]
    print(f"{meta['sunday']}: {len(scores)} bundles in {time.time() - t0:.0f}s, top {top}")


if __name__ == "__main__":
    main()
