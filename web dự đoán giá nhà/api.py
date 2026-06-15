"""
api.py — Flask backend serving REAL trained models to the JS web front-end.

Endpoints
    GET  /health           liveness + which models are loaded
    GET  /metrics          real MAE/RMSE/R²/MAPE per model (from training)
    POST /predict          predict price from the web form payload

The web sends its existing payload (legal/furniture/direction as multiplier
strings, province as a NEW 2025 name). This server maps those to the model's
training features, predicts, builds a 90% interval from the model's residual
std, and returns per-feature contributions via occlusion (leave-one-to-baseline).

Run:  python api.py        # serves on http://localhost:5000
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"

META = json.loads((MODELS / "meta.json").read_text(encoding="utf-8"))
METRICS = json.loads((MODELS / "metrics.json").read_text(encoding="utf-8"))
EDA_STATS = json.loads((MODELS / "eda_stats.json").read_text(encoding="utf-8"))
NUMERIC = META["numeric"]
CATEGORICAL = META["categorical"]
UNKNOWN = META["unknown_token"]
NEW2OLD = META["new_to_old_primary"]          # tỉnh mới -> tỉnh cũ chính (fallback)
DISTRICT_TO_OLD = META["district_to_old"]     # {tỉnh mới: {quận/huyện: tỉnh cũ}}
PROVINCES_WITH_DATA = set(META.get("provinces_with_data", []))
PRICE_MIN, PRICE_MAX = META["price_range_billion"]

PIPELINES = {
    name: joblib.load(MODELS / f"{name.replace(' ', '_').lower()}.pkl")
    for name in METRICS
}

# ── web multiplier strings -> model categorical values ───────────────────────
LEGAL_MAP = {  # web legal multiplier -> dataset "Legal status"
    "1.15": "Have certificate", "1.10": "Have certificate",
    "1.0": "Sale contract", "0.90": "Sale contract", "0.80": UNKNOWN,
}
FURNITURE_MAP = {  # web furniture multiplier -> dataset "Furniture state"
    "1.20": "Full", "1.10": "Full", "1.0": "Basic", "0.90": UNKNOWN,
}
DIRECTION_MAP = {  # web direction multiplier -> dataset "House direction"
    "1.08": "Đông - Nam", "1.06": "Nam", "1.04": "Đông",
    "1.02": "Tây - Nam", "1.0": "Bắc", "0.98": "Tây", "0.97": "Tây - Bắc",
}
# model feature -> Vietnamese label shown on the SHAP-style chart
FEATURE_LABEL = {
    "Area": "Diện tích", "Floors": "Số tầng",
    "Bedrooms": "Phòng ngủ", "Bathrooms": "Phòng tắm",
    "Frontage": "Mặt tiền", "Access Road": "Đường vào",
    "province": "Tỉnh/TP", "district": "Quận/Huyện",
    "Legal status": "Pháp lý",
    "Furniture state": "Nội thất", "House direction": "Hướng nhà",
}


def _num(v, default):
    """Parse a numeric web value; fall back to baseline default when empty/invalid."""
    try:
        f = float(v)
        return f if f > 0 else default
    except (TypeError, ValueError):
        return default


def confidence_from_r2(r2: float) -> str:
    return "High" if r2 >= 0.6 else "Medium" if r2 >= 0.4 else "Low"


def to_features(p: dict) -> dict:
    """Map a web payload dict to a single model-feature row."""
    province_new = p.get("province", "")
    base = META["baseline_numeric"]
    district = str(p.get("districtOld") or "").strip()
    # Tỉnh cũ suy từ quận/huyện đã chọn (đúng cặp tỉnh-quận như khi train);
    # nếu không chọn quận/huyện -> tỉnh cũ chính của tỉnh mới.
    old_prov = (DISTRICT_TO_OLD.get(province_new, {}).get(district)
                or NEW2OLD.get(province_new, province_new))
    return {
        "Area": _num(p.get("area"), base["Area"]),
        "Floors": _num(p.get("floors"), base["Floors"]),
        "Bedrooms": _num(p.get("bedrooms"), base["Bedrooms"]),
        "Bathrooms": _num(p.get("bathrooms"), base["Bathrooms"]),
        "Frontage": _num(p.get("frontage"), base["Frontage"]),
        "Access Road": _num(p.get("accessRoad"), base["Access Road"]),
        "province": old_prov,
        "district": district or UNKNOWN,
        "Legal status": LEGAL_MAP.get(str(p.get("legal", "")), UNKNOWN),
        "Furniture state": FURNITURE_MAP.get(str(p.get("furniture", "")), UNKNOWN),
        "House direction": DIRECTION_MAP.get(str(p.get("direction", "")), UNKNOWN),
    }


def occlusion_contributions(pipe, row: dict) -> dict:
    """pred(actual) - pred(feature set to training baseline), per feature group."""
    cols = NUMERIC + CATEGORICAL
    base = {**META["baseline_numeric"], **META["baseline_categorical"]}
    rows = [row]                      # index 0 = the actual input
    for c in cols:                    # one occluded variant per feature
        variant = dict(row)
        variant[c] = base[c]
        rows.append(variant)
    preds = pipe.predict(pd.DataFrame(rows, columns=cols))
    full = float(preds[0])
    return {FEATURE_LABEL.get(c, c): round(full - float(preds[i + 1]), 4)
            for i, c in enumerate(cols)}


app = Flask(__name__)
CORS(app)

# ── Phục vụ luôn front-end để web + API chung 1 cổng (chia sẻ public dễ) ──
FRONTEND_FILES = {"app.js", "style.css", "vn-geo.js"}


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:fname>")
def frontend(fname):
    if fname in FRONTEND_FILES:
        return send_from_directory(ROOT, fname)
    abort(404)


@app.get("/health")
def health():
    return jsonify(status="ok", models=list(PIPELINES),
                   best_model=META["best_model"])


@app.get("/eda")
def eda():
    """Thống kê EDA thật từ dataset (số quan sát, giá/diện tích TB, phân phối…)."""
    return jsonify(EDA_STATS)


@app.get("/locations")
def locations():
    """Tỉnh MỚI -> danh sách quận/huyện (cũ) để web đổ vào dropdown định giá."""
    return jsonify(META["new_province_to_districts"])


@app.get("/metrics")
def metrics():
    return jsonify(metrics=METRICS, meta={
        "best_model": META["best_model"],
        "n_train": META["n_train"], "n_test": META["n_test"],
        "price_range_billion": META["price_range_billion"],
        "provinces_with_real_data": META["provinces_with_real_data"],
    })


@app.post("/predict")
def predict():
    payload = request.get_json(force=True) or {}
    model_name = payload.get("model") or META["best_model"]
    if model_name not in PIPELINES:
        model_name = META["best_model"]
    pipe = PIPELINES[model_name]

    row = to_features(payload)
    X = pd.DataFrame([row], columns=NUMERIC + CATEGORICAL)
    price = float(pipe.predict(X)[0])
    price = max(0.1, price)

    resid_std = METRICS[model_name]["resid_std"]
    margin = 1.645 * resid_std                       # ~90% interval
    r2 = METRICS[model_name]["R2"]

    province_new = payload.get("province", "")
    has_real = province_new in PROVINCES_WITH_DATA

    return jsonify(
        price=round(price, 3),
        lower=round(max(0.1, price - margin), 3),
        upper=round(price + margin, 3),
        confidence=confidence_from_r2(r2),
        model=model_name,
        shap=occlusion_contributions(pipe, row),
        info={
            "provinceUsed": row["province"],          # tỉnh cũ thực sự đưa vào model
            "districtUsed": row["district"],
            "provinceHasRealData": has_real,
            "wardUsed": False,
            "priceRange": [PRICE_MIN, PRICE_MAX],
            "outOfRange": price > PRICE_MAX or price < PRICE_MIN,
        },
    )


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))   # PORT để deploy (Render/Railway…)
    print("Models:", list(PIPELINES))
    print(f"Mở web tại  http://localhost:{port}   (best model: {META['best_model']})")
    # host 0.0.0.0 -> truy cập được từ LAN và qua tunnel (ngrok/cloudflared)
    app.run(host="0.0.0.0", port=port, debug=False)
