"""
src/train_models.py
-------------------
Train REAL house-price models on the nationwide Vietnam 2024 dataset
(30k+ real listings crawled from batdongsan.vn).

Pipeline: clean -> feature engineering -> train 5 models -> evaluate on a
held-out test set -> persist pipelines (.pkl) + real metrics + metadata.

Only the features the web form actually collects are used, so every model
input maps 1:1 to a user input (and explanations stay honest):
    numeric     : Area, Floors, Bedrooms, Bathrooms
    categorical : province (old 63-era name), Legal status, Furniture, Direction
    target      : Price (billion VND, dataset is pre-filtered to 1..11.5 tỷ)

Run:  python -m src.train_models
"""
from __future__ import annotations
import json, re
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "vietnam_housing_dataset.csv"
OUT = ROOT / "models"
OUT.mkdir(exist_ok=True)

NUMERIC = ["Area", "Floors", "Bedrooms", "Bathrooms", "Frontage", "Access Road"]
CATEGORICAL = ["province", "district", "Legal status", "Furniture state", "House direction"]
TARGET = "Price"
UNKNOWN = "Không rõ"
MIN_CAT_FREQ = 15   # bỏ qua hạng mục hiếm (và dùng làm ngưỡng cho dropdown quận/huyện)

# 34 tỉnh/thành MỚI (1/7/2025) -> ĐẦY ĐỦ các tỉnh CŨ (63-era) đã sáp nhập vào nó.
# Dùng để gộp toàn bộ quận/huyện của các tỉnh cũ + suy ra tỉnh cũ từ quận/huyện.
NEW_PROVINCE_COMPONENTS = {
    "Hồ Chí Minh": ["Hồ Chí Minh", "Bình Dương", "Bà Rịa - Vũng Tàu"],
    "Hà Nội": ["Hà Nội"],
    "Hải Phòng": ["Hải Phòng", "Hải Dương"],
    "Đà Nẵng": ["Đà Nẵng", "Quảng Nam"],
    "Cần Thơ": ["Cần Thơ", "Hậu Giang", "Sóc Trăng"],
    "Huế": ["Thừa Thiên Huế", "Huế"],
    "Khánh Hòa": ["Khánh Hòa", "Ninh Thuận"],
    "Quảng Ninh": ["Quảng Ninh"],
    "Đồng Nai": ["Đồng Nai", "Bình Phước"],
    "Bắc Ninh": ["Bắc Ninh", "Bắc Giang"],
    "Hưng Yên": ["Hưng Yên", "Thái Bình"],
    "Lâm Đồng": ["Lâm Đồng", "Đắk Nông", "Bình Thuận"],
    "Tây Ninh": ["Tây Ninh", "Long An"],
    "Ninh Bình": ["Ninh Bình", "Hà Nam", "Nam Định"],
    "Thái Nguyên": ["Thái Nguyên", "Bắc Kạn"],
    "An Giang": ["An Giang", "Kiên Giang"],
    "Phú Thọ": ["Phú Thọ", "Vĩnh Phúc", "Hòa Bình"],
    "Gia Lai": ["Gia Lai", "Bình Định"],
    "Đắk Lắk": ["Đắk Lắk", "Phú Yên"],
    "Nghệ An": ["Nghệ An"],
    "Thanh Hoá": ["Thanh Hóa", "Thanh Hoá"],
    "Quảng Ngãi": ["Quảng Ngãi", "Kon Tum"],
    "Hà Tĩnh": ["Hà Tĩnh"],
    "Vĩnh Long": ["Vĩnh Long", "Bến Tre", "Trà Vinh"],
    "Đồng Tháp": ["Đồng Tháp", "Tiền Giang"],
    "Lào Cai": ["Lào Cai", "Yên Bái"],
    "Quảng Trị": ["Quảng Trị", "Quảng Bình"],
    "Lạng Sơn": ["Lạng Sơn"],
    "Cà Mau": ["Cà Mau", "Bạc Liêu"],
    "Sơn La": ["Sơn La"],
    "Tuyên Quang": ["Tuyên Quang", "Hà Giang"],
    "Cao Bằng": ["Cao Bằng"],
    "Điện Biên": ["Điện Biên"],
    "Lai Châu": ["Lai Châu"],
}


def clean_province(addr: str) -> str:
    """Last comma-separated token of the address, trailing punctuation removed."""
    tok = str(addr).split(",")[-1].strip()
    tok = re.sub(r"[.。\s]+$", "", tok).strip()
    # common spelling unifications
    fixes = {"Bà Rịa Vũng Tàu": "Bà Rịa - Vũng Tàu", "Thanh Hoá": "Thanh Hóa"}
    return fixes.get(tok, tok)


def clean_district(addr: str) -> str:
    """Second-to-last token = quận/huyện/thành phố/thị xã (old 63-era system)."""
    parts = [x.strip() for x in str(addr).split(",")]
    if len(parts) >= 2:
        d = re.sub(r"[.。\s]+$", "", parts[-2]).strip()
        return d or UNKNOWN
    return UNKNOWN


_TYPE_PREFIX = re.compile(r"^(Thành phố|Thị xã|Thị trấn|Quận|Huyện)\s+", re.IGNORECASE)
# Thống nhất 2 kiểu đặt dấu thanh tiếng Việt (cũ↔mới): Thuỷ↔Thủy, Hoà↔Hòa…
_TONE_FIX = {
    "oà": "òa", "oá": "óa", "oả": "ỏa", "oã": "õa", "oạ": "ọa",
    "oè": "òe", "oé": "óe", "oẻ": "ỏe", "oẽ": "õe", "oẹ": "ọe",
    "uỳ": "ùy", "uý": "úy", "uỷ": "ủy", "uỹ": "ũy", "uỵ": "ụy",
}

def vn_norm(s: str) -> str:
    s = str(s).strip().lower()
    for a, b in _TONE_FIX.items():
        s = s.replace(a, b)
    return s

def norm_district(name: str) -> str:
    """Khoá so khớp: bỏ tiền tố loại + chuẩn hoá dấu (vd 'Quận Bình Thạnh' ~ 'Bình Thạnh')."""
    return vn_norm(_TYPE_PREFIX.sub("", str(name).strip()))


def load_official_districts() -> dict:
    """{tên tỉnh cũ (chuẩn hoá): [(norm, tên hiển thị)]} — hành chính 63 tỉnh pre-2025."""
    base = ROOT / "data" / "old_admin"
    tt = json.loads((base / "tinh_tp.json").read_text(encoding="utf-8"))
    qh = json.loads((base / "quan_huyen.json").read_text(encoding="utf-8"))
    code2name = {c: v["name"] for c, v in tt.items()}
    out = {}
    for v in qh.values():
        prov = code2name.get(v.get("parent_code"))
        if prov:
            out.setdefault(vn_norm(prov), []).append(
                (norm_district(v["name_with_type"]), v["name"]))
    return out


def load_clean() -> pd.DataFrame:
    df = pd.read_csv(DATA)
    df["province"] = df["Address"].apply(clean_province)
    df["district"] = df["Address"].apply(clean_district)
    # numeric coercion
    for c in NUMERIC + [TARGET]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=[TARGET, "Area"])
    # drop obviously broken rows / extreme area outliers (keep the bulk)
    df = df[(df["Area"] >= 10) & (df["Area"] <= 500)]
    df = df[(df[TARGET] >= 0.5) & (df[TARGET] <= 100)]
    # categorical: explicit "unknown" bucket (esp. direction ~70% missing)
    for c in ["Legal status", "Furniture state", "House direction"]:
        df[c] = df[c].fillna(UNKNOWN).astype(str).str.strip().replace("", UNKNOWN)
    return df[NUMERIC + CATEGORICAL + [TARGET]].reset_index(drop=True)


def build_location_maps(df_tr: pd.DataFrame, official: dict):
    """Trả về (primary, districts, district_to_old) cho 34 tỉnh mới.

    - primary[new]            : tỉnh cũ chính (nhiều dữ liệu nhất) — fallback khi
                                không chọn quận/huyện.
    - districts[new]          : danh sách quận/huyện ĐẦY ĐỦ (mọi tỉnh cũ thành phần),
                                ưu tiên tên dataset cho quận model học được, phần còn
                                lại lấy từ danh sách hành chính cũ chính thức.
    - district_to_old[new][d] : quận/huyện d thuộc tỉnh cũ nào (để gán đúng feature).
    """
    train_provs = set(df_tr["province"].unique())
    primary, districts, district_to_old = {}, {}, {}
    for new, comps in NEW_PROVINCE_COMPONENTS.items():
        present = [c for c in comps if c in train_provs]
        if present:
            counts = {c: int((df_tr["province"] == c).sum()) for c in present}
            primary[new] = max(counts, key=counts.get)
        else:
            primary[new] = comps[0]

        items, d2o, seen = [], {}, set()
        # 1) Quận/huyện model THỰC SỰ học được (>= ngưỡng) — giữ đúng tên dataset.
        for old in present:
            vc = df_tr.loc[df_tr["province"] == old, "district"].value_counts()
            for d, c in vc.items():
                if c >= MIN_CAT_FREQ and d != UNKNOWN:
                    n = norm_district(d)
                    if n not in seen:
                        seen.add(n); items.append(d); d2o[d] = old
        # 2) Bổ sung cho ĐẦY ĐỦ từ danh sách hành chính cũ (mọi tỉnh thành phần).
        for old in comps:
            for n, disp in official.get(vn_norm(old), []):
                if n not in seen:
                    seen.add(n); items.append(disp); d2o[disp] = old
        districts[new] = sorted(items)
        district_to_old[new] = d2o
    return primary, districts, district_to_old


def make_preprocessor() -> ColumnTransformer:
    num = Pipeline([("imp", SimpleImputer(strategy="median"))])
    cat = Pipeline([
        ("imp", SimpleImputer(strategy="constant", fill_value=UNKNOWN)),
        ("oh", OneHotEncoder(handle_unknown="ignore", min_frequency=MIN_CAT_FREQ)),
    ])
    return ColumnTransformer([("num", num, NUMERIC), ("cat", cat, CATEGORICAL)])


def make_models() -> dict:
    return {
        "Linear Regression": LinearRegression(),
        "Decision Tree": DecisionTreeRegressor(
            max_depth=14, min_samples_leaf=25, random_state=42),
        # tham số gọn để file .pkl nhỏ (deploy free-tier), giữ độ chính xác gần như cũ
        "Random Forest": RandomForestRegressor(
            n_estimators=120, max_depth=16, min_samples_leaf=12,
            n_jobs=-1, random_state=42),
        "XGBoost": XGBRegressor(
            n_estimators=500, max_depth=6, learning_rate=0.05,
            subsample=0.85, colsample_bytree=0.85, reg_lambda=1.0,
            n_jobs=-1, random_state=42, tree_method="hist"),
        "LightGBM": LGBMRegressor(
            n_estimators=600, num_leaves=63, learning_rate=0.05,
            subsample=0.85, colsample_bytree=0.85, n_jobs=-1,
            random_state=42, verbose=-1),
    }


def mape(y_true, y_pred) -> float:
    y_true = np.asarray(y_true, float)
    return float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100)


def compute_eda_stats(df: pd.DataFrame) -> dict:
    """Thống kê EDA THẬT từ dataset (để trang Phân tích dữ liệu vẽ số thật)."""
    old_to_new = {vn_norm(c): new
                  for new, comps in NEW_PROVINCE_COMPONENTS.items() for c in comps}
    new_prov = df["province"].map(lambda p: old_to_new.get(vn_norm(p), p))
    pv = df.assign(_p=new_prov).groupby("_p")["Price"].agg(["mean", "count"])
    prov_avg = {k: round(float(v), 2)
                for k, v in pv[pv["count"] >= 20]["mean"].items()}

    bins = [0, 1, 2, 3, 4, 5, 7, 10, 15, 20, 30, 50, float("inf")]
    hist = pd.cut(df["Price"], bins=bins, right=False).value_counts().sort_index()
    hist_counts = [int(x) for x in hist.tolist()]

    bd = df["Bedrooms"].clip(1, 5)
    bedroom_avg = {}
    for k in range(1, 6):
        sub = df.loc[bd == k, "Price"]
        if len(sub):
            bedroom_avg[str(k)] = round(float(sub.mean()), 2)

    LEGAL_VN = {"Have certificate": "Có sổ", "Sale contract": "HĐ mua bán", UNKNOWN: "Không rõ"}
    FURN_VN = {"Full": "Đầy đủ", "Basic": "Cơ bản", UNKNOWN: "Không rõ"}
    legal_avg = {LEGAL_VN.get(k, k): round(float(v), 2)
                 for k, v in df.groupby("Legal status")["Price"].mean().items()}
    furn_avg = {FURN_VN.get(k, k): round(float(v), 2)
                for k, v in df.groupby("Furniture state")["Price"].mean().items()}
    dir_df = df[df["House direction"] != UNKNOWN]
    dir_avg = {k: round(float(v), 2)
               for k, v in dir_df.groupby("House direction")["Price"].mean().items()}

    corr_labels, corr_vals = [], []
    for col, lab in [("Area", "Diện tích"), ("Frontage", "Mặt tiền"),
                     ("Access Road", "Đường vào"), ("Bedrooms", "P.Ngủ"),
                     ("Bathrooms", "P.Tắm"), ("Floors", "Số tầng")]:
        r = df[[col, "Price"]].dropna().corr().iloc[0, 1]
        corr_labels.append(lab)
        corr_vals.append(round(float(r), 2))

    return {
        "n": int(len(df)),
        "price_mean": round(float(df["Price"].mean()), 2),
        "area_mean": round(float(df["Area"].mean()), 1),
        "n_provinces": int(len(prov_avg)),
        "provAvg": prov_avg,
        "histCounts": hist_counts,
        "bedroomAvg": bedroom_avg,
        "legalAvg": legal_avg,
        "furnAvg": furn_avg,
        "dirAvg": dir_avg,
        "corr": {"labels": corr_labels, "values": corr_vals},
    }


def main():
    print(f"Loading {DATA} ...")
    df = load_clean()
    print(f"Clean rows: {len(df):,}")

    X, y = df[NUMERIC + CATEGORICAL], df[TARGET]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Train: {len(X_tr):,} | Test: {len(X_te):,}")

    pre = make_preprocessor()
    metrics, best_name, best_r2 = {}, None, -1e9
    for name, est in make_models().items():
        pipe = Pipeline([("pre", pre), ("model", est)])
        pipe.fit(X_tr, y_tr)
        pred = pipe.predict(X_te)
        resid = y_te.to_numpy() - pred
        rmse = float(np.sqrt(mean_squared_error(y_te, pred)))
        m = {
            "MAE": round(float(mean_absolute_error(y_te, pred)), 4),
            "RMSE": round(rmse, 4),
            "R2": round(float(r2_score(y_te, pred)), 4),
            "MAPE": round(mape(y_te, pred), 2),
            "resid_std": round(float(np.std(resid)), 4),
        }
        metrics[name] = m
        joblib.dump(pipe, OUT / f"{name.replace(' ', '_').lower()}.pkl", compress=3)
        print(f"  {name:18s} MAE={m['MAE']:.3f}  RMSE={m['RMSE']:.3f}  "
              f"R2={m['R2']:.3f}  MAPE={m['MAPE']:.1f}%")
        if m["R2"] > best_r2:
            best_r2, best_name = m["R2"], name

    train_provs = set(X_tr["province"].unique())
    official = load_official_districts()
    primary_old, new_province_to_districts, district_to_old = build_location_maps(X_tr, official)
    # cảnh báo nếu tỉnh thành phần không khớp tên trong danh sách hành chính cũ
    missing = sorted({c for comps in NEW_PROVINCE_COMPONENTS.values()
                      for c in comps if vn_norm(c) not in official})
    if missing:
        print("  [chú ý] tỉnh cũ không tìm thấy trong danh sách chính thức:", missing)
    covered = sum(1 for new, comps in NEW_PROVINCE_COMPONENTS.items()
                  if any(c in train_provs for c in comps))

    meta = {
        "numeric": NUMERIC,
        "categorical": CATEGORICAL,
        "target": TARGET,
        "unknown_token": UNKNOWN,
        "best_model": best_name,
        "price_range_billion": [float(y.min()), float(y.max())],
        "n_train": len(X_tr),
        "n_test": len(X_te),
        "new_to_old_primary": primary_old,
        "new_province_to_districts": new_province_to_districts,
        "district_to_old": district_to_old,
        "provinces_with_real_data": covered,
        "provinces_with_data": [new for new, comps in NEW_PROVINCE_COMPONENTS.items()
                                if any(c in train_provs for c in comps)],
        "categories": {
            "Legal status": sorted(X_tr["Legal status"].unique().tolist()),
            "Furniture state": sorted(X_tr["Furniture state"].unique().tolist()),
            "House direction": sorted(X_tr["House direction"].unique().tolist()),
        },
        "baseline_numeric": {c: float(np.median(X_tr[c].dropna())) for c in NUMERIC},
        "baseline_categorical": {c: X_tr[c].mode().iloc[0] for c in CATEGORICAL},
    }
    (OUT / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "eda_stats.json").write_text(
        json.dumps(compute_eda_stats(df), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nBest model: {best_name} (R2={best_r2:.3f})")
    print(f"Provinces mapped to real data: {covered}/34")
    print(f"Saved models + metrics.json + meta.json -> {OUT}")


if __name__ == "__main__":
    main()
