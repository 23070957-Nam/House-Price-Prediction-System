# 🏠 Dự đoán giá nhà Việt Nam — AI/ML Project 2026

Web dự đoán giá nhà dùng **mô hình machine learning thật**, huấn luyện trên
**30.000+ tin rao bán thật** (toàn quốc, 2024, nguồn batdongsan.vn — Kaggle
`nguyentiennhan/vietnam-housing-dataset-2024`). Địa giới hành chính theo
**34 tỉnh/thành sau sáp nhập 1/7/2025**.

## Kiến trúc

```
Trình duyệt (web tĩnh :8000)  ──fetch──▶  Flask API (:5000)  ──▶  model .pkl
   index.html / app.js / vn-geo.js            api.py              models/*.pkl
```

- **Front-end**: HTML/CSS/JS thuần (`index.html`, `app.js`, `style.css`, `vn-geo.js`).
- **Back-end**: `api.py` (Flask) nạp model đã train, trả giá + khoảng tin cậy + đóng góp đặc trưng.
- Nếu **API không chạy**, web tự động chuyển sang công thức ước lượng cục bộ (vẫn dùng được offline).

## Mô hình (số liệu thật trên tập test 6.039 mẫu)

| Model | MAE (tỷ) | RMSE (tỷ) | R² | MAPE |
|---|---|---|---|---|
| LightGBM ⭐ | 0.975 | 1.301 | 0.648 | 20.1% |
| XGBoost | 1.009 | 1.318 | 0.639 | 21.0% |
| Random Forest | 1.035 | 1.367 | 0.611 | 21.7% |
| Decision Tree | 1.208 | 1.563 | 0.492 | 26.0% |
| Linear Regression | 1.267 | 1.631 | 0.446 | 26.8% |

> Đặc trưng dùng: Diện tích, Số tầng, Phòng ngủ, Phòng tắm, **Mặt tiền, Đường vào,
> Quận/Huyện**, Tỉnh/TP, Pháp lý, Nội thất, Hướng nhà. Thêm Quận/Huyện + Mặt tiền +
> Đường vào đã nâng R² từ 0.49 → **0.65**. Dataset đã lọc giá **1–11,5 tỷ** nên dự
> đoán nằm trong khoảng này; 32/34 tỉnh có dữ liệu giao dịch thật.
>
> **Vị trí**: web hiển thị Tỉnh + Phường/Xã theo đơn vị hành chính 2025; riêng ô
> **Quận/Huyện** (hệ cũ) dùng để định giá vì dữ liệu 2024 ở mức quận/huyện.

## Cách chạy

```bash
# 1. Cài thư viện (một lần)
pip install -r requirements.txt

# 2. (Tùy chọn) Train lại model — đã có sẵn trong models/
python -m src.train_models

# 3. Chạy API (cửa sổ terminal 1)
python api.py                 # http://localhost:5000

# 4. Chạy web (cửa sổ terminal 2)
python -m http.server 8000    # mở http://localhost:8000
```

Mở **http://localhost:8000**. Khi API chạy, kết quả hiện badge
🟢 *Mô hình thật · dữ liệu 2024*; nếu tắt API thì hiện 🟡 *Ước lượng cục bộ*.

## Cấu trúc thư mục

```
├── index.html, app.js, style.css, vn-geo.js   # web front-end
├── api.py                                      # Flask API: /predict /metrics /eda /locations
├── src/train_models.py                         # pipeline huấn luyện + thống kê EDA
├── data/vietnam_housing_dataset.csv            # dữ liệu thật 2024
├── data/old_admin/                             # danh sách hành chính 63 tỉnh (pre-2025)
├── models/                                     # *.pkl + metrics.json + meta.json + eda_stats.json
└── requirements.txt
```

> Trang **Phân tích EDA** và các chỉ số (R², số quan sát, giá/diện tích TB) đều
> lấy số THẬT từ model/dataset qua API — không còn dữ liệu mô phỏng.

## Hạn chế & hướng phát triển

- Dataset giới hạn 1–11,5 tỷ và chủ yếu HCM/Hà Nội → kém chính xác cho nhà
  cao cấp, vùng nông thôn, tỉnh ít dữ liệu.
- Định giá ở mức **quận/huyện**; chỉ HCM/Hà Nội/TP lớn có đủ dữ liệu quận/huyện,
  các tỉnh khác chỉ định giá ở mức tỉnh.
- Hướng tiếp: thu thập thêm dữ liệu (đặc biệt ngoài HCM/Hà Nội và nhà > 11,5 tỷ),
  thêm đặc trưng vị trí chi tiết hơn, hoặc dùng dữ liệu giá/m² theo thời gian.
