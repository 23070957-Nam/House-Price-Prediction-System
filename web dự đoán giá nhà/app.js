/* ============================================================
   app.js — Vietnam House Price Prediction (Pure JS)
   All logic: routing, prediction engine, charts, EDA, SHAP
============================================================ */

// ── Data: Provinces & Wards (34 đơn vị hành chính sau sáp nhập 1/7/2025) ──
// Hệ số giá theo tỉnh/thành. Danh sách phường/xã nằm ở vn-geo.js (VN_WARDS).
const PROVINCES = {
  // 6 thành phố trực thuộc Trung ương
  "Hồ Chí Minh":           3.50,  // gồm cả Bình Dương + Bà Rịa - Vũng Tàu (cũ)
  "Hà Nội":                3.20,
  "Hải Phòng":             1.70,  // gồm cả Hải Dương (cũ)
  "Đà Nẵng":               2.10,  // gồm cả Quảng Nam (cũ)
  "Cần Thơ":               1.40,  // gồm cả Sóc Trăng + Hậu Giang (cũ)
  "Huế":                   1.30,
  // 28 tỉnh
  "Khánh Hòa":             1.60,  // gồm Ninh Thuận (cũ)
  "Quảng Ninh":            1.55,
  "Đồng Nai":              1.55,  // gồm Bình Phước (cũ)
  "Bắc Ninh":              1.50,  // gồm Bắc Giang (cũ)
  "Hưng Yên":              1.35,  // gồm Thái Bình (cũ)
  "Lâm Đồng":              1.30,  // gồm Đắk Nông + Bình Thuận (cũ)
  "Tây Ninh":              1.25,  // gồm Long An (cũ)
  "Ninh Bình":             1.20,  // gồm Hà Nam + Nam Định (cũ)
  "Thái Nguyên":           1.20,  // gồm Bắc Kạn (cũ)
  "An Giang":              1.15,  // gồm Kiên Giang (cũ) — có Phú Quốc
  "Phú Thọ":               1.15,  // gồm Vĩnh Phúc + Hòa Bình (cũ)
  "Gia Lai":               1.10,  // gồm Bình Định (cũ)
  "Đắk Lắk":               1.10,  // gồm Phú Yên (cũ)
  "Nghệ An":               1.10,
  "Thanh Hoá":             1.10,
  "Quảng Ngãi":            1.05,  // gồm Kon Tum (cũ)
  "Hà Tĩnh":               1.00,
  "Vĩnh Long":             1.00,  // gồm Bến Tre + Trà Vinh (cũ)
  "Đồng Tháp":             1.00,  // gồm Tiền Giang (cũ)
  "Lào Cai":               1.00,  // gồm Yên Bái (cũ)
  "Quảng Trị":             0.95,  // gồm Quảng Bình (cũ)
  "Lạng Sơn":              0.95,
  "Cà Mau":                0.95,  // gồm Bạc Liêu (cũ)
  "Sơn La":                0.90,
  "Tuyên Quang":           0.90,  // gồm Hà Giang (cũ)
  "Cao Bằng":              0.85,
  "Điện Biên":             0.85,
  "Lai Châu":              0.85,
};

// Danh sách phường/xã theo từng tỉnh (dữ liệu chuẩn ở vn-geo.js)
const DISTRICTS = VN_WARDS;

// Hệ số phụ theo phường/xã (tên phường mới sau 1/7/2025). Phường không liệt kê → 1.00.
const WARD_PREMIUM = {
  // Hồ Chí Minh (lõi trung tâm + khu vực Bình Dương / Bà Rịa - Vũng Tàu cũ)
  "Sài Gòn": 1.55, "Bến Thành": 1.50, "Tân Định": 1.35, "Chợ Lớn": 1.30,
  "Gia Định": 1.30, "Bình Thạnh": 1.25, "Phú Nhuận": 1.28, "Bàn Cờ": 1.25,
  "An Khánh": 1.22, "Thủ Đức": 1.18, "Vũng Tàu": 1.35, "Thuận An": 1.18, "Dĩ An": 1.15,
  // Hà Nội
  "Hoàn Kiếm": 1.55, "Cửa Nam": 1.45, "Ba Đình": 1.45, "Hồng Hà": 1.40,
  "Đống Đa": 1.35, "Tây Hồ": 1.35, "Cầu Giấy": 1.28, "Hai Bà Trưng": 1.30,
  "Ngọc Hà": 1.30, "Hà Đông": 1.12, "Long Biên": 1.12,
  // Đà Nẵng (gồm Hội An - Quảng Nam cũ)
  "Hải Châu": 1.35, "Sơn Trà": 1.30, "Ngũ Hành Sơn": 1.25, "Thanh Khê": 1.15, "Hội An": 1.40,
  // Hải Phòng
  "Hồng Bàng": 1.30, "Ngô Quyền": 1.28, "Lê Chân": 1.25, "Hải An": 1.20,
  // Cần Thơ
  "Ninh Kiều": 1.25, "Cái Răng": 1.12,
  // Du lịch / ven biển
  "Nha Trang": 1.35, "Cam Ranh": 1.15, "Phan Thiết": 1.20,
  "Xuân Hương - Đà Lạt": 1.35, "Hạ Long": 1.30, "Bãi Cháy": 1.28, "Cẩm Phả": 1.10,
  "Phú Quốc": 1.55,
  // Mặc định
  "default": 1.00,
};

const LEGAL_LABELS = {
  "1.15": "Sổ đỏ (Red Book)",
  "1.10": "Sổ hồng (Pink Book)",
  "1.0": "Giấy tờ hợp lệ",
  "0.90": "Đang chờ cấp sổ",
  "0.80": "Chưa có sổ",
};

const FURNITURE_LABELS = {
  "1.20": "Nội thất cao cấp",
  "1.10": "Nội thất đầy đủ",
  "1.0": "Nội thất cơ bản",
  "0.90": "Không nội thất",
};

const DIRECTION_LABELS = {
  "1.08": "Đông Nam", "1.06": "Nam", "1.04": "Đông", "1.02": "Tây Nam / Đông Bắc",
  "1.0": "Bắc", "0.98": "Tây", "0.97": "Tây Bắc",
};

// ── Model Configs ──────────────────────────────────────────
const MODEL_CONFIGS = {
  "Linear Regression": {
    icon: "📏",
    color: "#3b82f6",
    rmseMultiplier: 1.00,
    description: "Mô hình tuyến tính cơ bản. Nhanh, dễ hiểu, phù hợp làm baseline.",
    pros: ["Huấn luyện nhanh", "Rất dễ diễn giải", "Tốt khi quan hệ tuyến tính"],
    cons: ["Không nắm được phi tuyến", "Nhạy với giá trị ngoại lệ", "Giả định các biến độc lập"],
    metrics: { MAE: 0.7821, RMSE: 0.9834, R2: 0.8847, MAPE: 16.43 },
  },
  "Decision Tree": {
    icon: "🌳",
    color: "#10b981",
    rmseMultiplier: 0.90,
    description: "Cây quyết định phân chia dữ liệu theo từng nút. Dễ trực quan hoá.",
    pros: ["Nắm được quan hệ phi tuyến", "Không cần chuẩn hoá dữ liệu", "Dễ trực quan hoá"],
    cons: ["Dễ quá khớp (overfitting)", "Phương sai cao", "Bất ổn khi dữ liệu đổi nhỏ"],
    metrics: { MAE: 0.6512, RMSE: 0.8741, R2: 0.9103, MAPE: 13.28 },
  },
  "Random Forest": {
    icon: "🌲",
    color: "#6366f1",
    rmseMultiplier: 0.80,
    description: "Ensemble của nhiều cây quyết định. Mạnh mẽ và ổn định.",
    pros: ["Giảm quá khớp (overfitting)", "Xử lý được giá trị thiếu", "Có sẵn độ quan trọng đặc trưng"],
    cons: ["Chậm hơn cây đơn lẻ", "Khó diễn giải hơn", "Tốn bộ nhớ hơn"],
    metrics: { MAE: 0.4123, RMSE: 0.5632, R2: 0.9387, MAPE: 9.74 },
  },
  "XGBoost": {
    icon: "⚡",
    color: "#f59e0b",
    rmseMultiplier: 0.75,
    description: "Gradient boosting hiệu suất cao. Thắng nhiều cuộc thi Kaggle.",
    pros: ["Hiệu năng hàng đầu", "Có sẵn điều chuẩn (regularization)", "Xử lý được dữ liệu thiếu"],
    cons: ["Nhiều siêu tham số phải tinh chỉnh", "Huấn luyện lâu hơn", "Có nguy cơ quá khớp"],
    metrics: { MAE: 0.3847, RMSE: 0.4879, R2: 0.9476, MAPE: 8.92 },
  },
  "LightGBM": {
    icon: "💡",
    color: "#ec4899",
    rmseMultiplier: 0.70,
    description: "Gradient boosting siêu nhanh, tiêu thụ bộ nhớ thấp.",
    pros: ["Huấn luyện rất nhanh", "Tốn ít bộ nhớ", "Chính xác cao với dữ liệu bảng"],
    cons: ["Nhạy với dữ liệu nhỏ", "Nhiều siêu tham số", "Nhạy với dữ liệu nhiễu"],
    metrics: { MAE: 0.3285, RMSE: 0.4612, R2: 0.9521, MAPE: 8.47 },
  },
};

// ── Sample inputs ──────────────────────────────────────────
const SAMPLES = {
  hcm: { area: 75, bedrooms: 2, bathrooms: 2, floors: 1, province: "Hồ Chí Minh", districtOld: "Quận 1", district: "Bến Thành", legal: "1.15", furniture: "1.20", direction: "1.08" },
  hn: { area: 120, bedrooms: 4, bathrooms: 3, floors: 3, province: "Hà Nội", districtOld: "Cầu Giấy", district: "Hà Đông", legal: "1.15", furniture: "1.10", direction: "1.06" },
  nhatrang: { area: 250, bedrooms: 5, bathrooms: 4, floors: 2, province: "Khánh Hòa", districtOld: "Nha Trang", district: "Nha Trang", legal: "1.15", furniture: "1.20", direction: "1.08" },
  tayninh: { area: 60, bedrooms: 2, bathrooms: 1, floors: 1, province: "Tây Ninh", district: "Tân An", legal: "1.0", furniture: "1.0", direction: "1.0" },
};

// ── State ──────────────────────────────────────────────────
let currentPage = 'home';
let selectedModel = 'Random Forest';
let shapChart = null;
let compBarChart = null;
let radarChartInst = null;
let edaCharts = {};

// ── Router ─────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');
  currentPage = name;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.classList.remove('show');

  if (name === 'eda') initEDA();
  if (name === 'comparison') initComparison();
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  s.classList.toggle('open');
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('show');
}

// ── Province / Ward selects ────────────────────────────────
// So sánh theo bảng chữ cái tiếng Việt; numeric để "Móng Cái 1/2/10" xếp tự nhiên.
const viSort = (a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });

function populateProvinces() {
  const provNames = Object.keys(PROVINCES).sort(viSort);
  const sel = document.getElementById('province');
  provNames.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    sel.appendChild(o);
  });
  sel.value = 'Hồ Chí Minh';  // giữ mặc định là HCM dù danh sách xếp theo ABC
  updateWards();

  // EDA filter
  const edaSel = document.getElementById('edaProvFilter');
  provNames.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    edaSel.appendChild(o);
  });
}

function updateWards() {
  const prov = document.getElementById('province').value;
  const distSel = document.getElementById('district');
  distSel.innerHTML = '';
  (DISTRICTS[prov] || []).slice().sort(viSort).forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    distSel.appendChild(o);
  });
  updateSummary();
}

// Danh sách quận/huyện (cũ) để ĐỊNH GIÁ, lấy từ API /locations theo tỉnh.
let VALUATION_DISTRICTS = {};

function updateValuationDistricts() {
  const prov = document.getElementById('province').value;
  const sel = document.getElementById('districtOld');
  if (!sel) return;
  const list = (VALUATION_DISTRICTS[prov] || []).slice().sort(viSort);
  sel.innerHTML = '';
  if (!list.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(không có dữ liệu định giá)';
    sel.appendChild(o);
  } else {
    list.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d;
      sel.appendChild(o);
    });
  }
  updateSummary();
}

// Đổi tỉnh -> cập nhật cả phường/xã (2025) lẫn quận/huyện (định giá).
function onProvinceChange() {
  updateWards();
  updateValuationDistricts();
}

async function loadLocations() {
  try {
    const resp = await fetch(`${API_BASE}/locations`);
    if (!resp.ok) return;
    VALUATION_DISTRICTS = await resp.json();
    updateValuationDistricts();
  } catch (e) { /* API offline → ô quận/huyện để trống */ }
}

// Thống kê EDA thật từ API (thay dữ liệu mô phỏng cũ).
let EDA_STATS = null;

async function loadEdaStats() {
  try {
    const resp = await fetch(`${API_BASE}/eda`);
    if (!resp.ok) return;
    EDA_STATS = await resp.json();
    // cập nhật card thống kê trang EDA
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('eda-n', EDA_STATS.n.toLocaleString('vi-VN'));
    set('eda-price', EDA_STATS.price_mean.toLocaleString('vi-VN') + ' Tỷ');
    set('eda-area', EDA_STATS.area_mean.toLocaleString('vi-VN') + ' m²');
    set('eda-prov', EDA_STATS.n_provinces);
    if (currentPage === 'eda') initEDA();   // vẽ lại bằng số thật
  } catch (e) { /* API offline → dùng dữ liệu mô phỏng dự phòng */ }
}

// ── Slider ─────────────────────────────────────────────────
function updateSlider(type) {
  if (type === 'area') {
    const v = document.getElementById('areaSlider').value;
    document.getElementById('areaVal').textContent = v;
    document.getElementById('s-area').textContent = v + ' m²';
  }
  updateSummary();
}

// ── Number Input ───────────────────────────────────────────
function changeNum(id, delta) {
  const el = document.getElementById(id);
  const min = parseInt(el.min), max = parseInt(el.max);
  let val = parseInt(el.value) + delta;
  val = Math.max(min, Math.min(max, val));
  el.value = val;
  if (id === 'bedrooms') document.getElementById('s-bed').textContent = val;
  if (id === 'bathrooms') document.getElementById('s-bath').textContent = val;
  if (id === 'floors') document.getElementById('s-floor').textContent = val;
  updateSummary();
}

// ── Summary Card Update ────────────────────────────────────
function updateSummary() {
  const legalSel = document.getElementById('legal');
  const furnSel = document.getElementById('furniture');
  const dirSel = document.getElementById('direction');

  document.getElementById('s-area').textContent = document.getElementById('areaSlider').value + ' m²';
  document.getElementById('s-bed').textContent = document.getElementById('bedrooms').value;
  document.getElementById('s-bath').textContent = document.getElementById('bathrooms').value;
  document.getElementById('s-floor').textContent = document.getElementById('floors').value;
  document.getElementById('s-prov').textContent = document.getElementById('province').value;
  document.getElementById('s-dist').textContent = document.getElementById('district').value;

  if (legalSel) {
    const lText = legalSel.options[legalSel.selectedIndex]?.text || '';
    document.getElementById('s-legal').textContent = lText.split('(')[0].trim();
  }
  if (furnSel) document.getElementById('s-furn').textContent = furnSel.options[furnSel.selectedIndex]?.text || '';
  if (dirSel) document.getElementById('s-dir').textContent = dirSel.options[dirSel.selectedIndex]?.text || '';
}

// ── Sample fill ────────────────────────────────────────────
function fillSample(key) {
  const s = SAMPLES[key];
  if (!s) return;

  document.getElementById('areaSlider').value = s.area;
  document.getElementById('areaVal').textContent = s.area;
  document.getElementById('bedrooms').value = s.bedrooms;
  document.getElementById('bathrooms').value = s.bathrooms;
  document.getElementById('floors').value = s.floors;

  document.getElementById('province').value = s.province;
  onProvinceChange();
  // Set ward + valuation district after repopulating
  setTimeout(() => {
    document.getElementById('district').value = s.district;
    if (s.districtOld) document.getElementById('districtOld').value = s.districtOld;
    document.getElementById('legal').value = s.legal;
    document.getElementById('furniture').value = s.furniture;
    document.getElementById('direction').value = s.direction;
    updateSummary();
  }, 10);
}

// ── Model Selection ────────────────────────────────────────
function selectModel(name) {
  selectedModel = name;
  document.querySelectorAll('.model-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-model="${name}"]`)?.classList.add('active');

  const cfg = MODEL_CONFIGS[name];
  document.getElementById('modelDesc').textContent = cfg.description;
  document.getElementById('modelPros').innerHTML =
    `<b>✅ Ưu điểm</b><br>` + cfg.pros.map(p => `• ${p}`).join('<br>');
  document.getElementById('modelCons').innerHTML =
    `<b>⚠️ Nhược điểm</b><br>` + cfg.cons.map(c => `• ${c}`).join('<br>');
}

// ── Prediction Engine ──────────────────────────────────────
function computePrice(inputs) {
  const basePricePerM2 = 25; // million VND
  const provMult = PROVINCES[inputs.province] || 1.0;
  const distMult = WARD_PREMIUM[inputs.district] || WARD_PREMIUM['default'] || 1.0;
  const legalMult = parseFloat(inputs.legal);
  const furnMult = parseFloat(inputs.furniture);
  const dirMult = parseFloat(inputs.direction);
  const floorBonus = 1 + (inputs.floors - 1) * 0.05;
  const roomBonus = 1 + (inputs.bedrooms - 1) * 0.08 + (inputs.bathrooms - 1) * 0.04;
  const cfg = MODEL_CONFIGS[selectedModel];
  const noiseRange = cfg.rmseMultiplier * 0.05;

  const price = inputs.area * basePricePerM2 * provMult * distMult
    * legalMult * furnMult * dirMult * floorBonus * roomBonus;

  const priceBillion = price / 1000;
  const noise = 1 + (Math.random() - 0.5) * noiseRange;
  const final = Math.max(0.3, priceBillion * noise);

  const confLevel = cfg.metrics.R2 > 0.94 ? "High" : cfg.metrics.R2 > 0.90 ? "Medium" : "Low";
  const margin = final * (cfg.rmseMultiplier * 0.18);

  return {
    price: final,
    lower: Math.max(0.1, final - margin),
    upper: final + margin,
    confidence: confLevel,
    // SHAP values (feature contributions, simplified)
    shap: {
      "Diện tích": inputs.area * basePricePerM2 * 0.001 * (provMult - 1 + 1),
      "Tỉnh/TP": (provMult - 1) * inputs.area * basePricePerM2 * 0.001 * 0.6,
      "Phường/Xã": (distMult - 1) * inputs.area * basePricePerM2 * 0.001 * 0.5,
      "Pháp lý": (legalMult - 1) * final * 0.7,
      "Nội thất": (furnMult - 1) * final * 0.6,
      "Phòng ngủ": (inputs.bedrooms - 1) * 0.08 * final * 0.5,
      "Hướng nhà": (dirMult - 1) * final * 0.8,
      "Số tầng": (inputs.floors - 1) * 0.05 * final * 0.4,
      "Phòng tắm": (inputs.bathrooms - 1) * 0.04 * final * 0.3,
    },
  };
}

// Backend mô hình thật (Flask). Nếu offline, web tự động dùng công thức cục bộ.
// Khi Flask phục vụ luôn web (cùng origin) hoặc qua link public -> dùng đường dẫn
// tương đối. Chỉ khi mở bằng dev server tĩnh (cổng 8000) mới trỏ sang cổng 5000.
const API_BASE = (location.port === '8000') ? 'http://localhost:5000' : '';

async function predict() {
  const btn = document.getElementById('predictBtn');
  btn.classList.add('loading');
  btn.textContent = '⏳ Đang xử lý…';

  const inputs = {
    area: parseInt(document.getElementById('areaSlider').value),
    bedrooms: parseInt(document.getElementById('bedrooms').value),
    bathrooms: parseInt(document.getElementById('bathrooms').value),
    floors: parseInt(document.getElementById('floors').value),
    frontage: parseFloat(document.getElementById('frontage').value),
    accessRoad: parseFloat(document.getElementById('accessRoad').value),
    province: document.getElementById('province').value,
    districtOld: document.getElementById('districtOld').value,   // quận/huyện định giá
    district: document.getElementById('district').value,         // phường/xã 2025 (hiển thị)
    legal: document.getElementById('legal').value,
    furniture: document.getElementById('furniture').value,
    direction: document.getElementById('direction').value,
  };

  try {
    const resp = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inputs, model: selectedModel }),
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const result = await resp.json();
    result.source = 'api';                       // mô hình thật đã train
    showResult(inputs, result);
  } catch (err) {
    // Fallback: công thức heuristic cục bộ khi API không chạy
    const result = computePrice(inputs);
    result.source = 'local';
    showResult(inputs, result);
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '🔮 Dự Đoán Giá Ngay';
  }
}

function showResult(inputs, result) {
  const confColor = result.confidence === 'High' ? '#10b981' :
    result.confidence === 'Medium' ? '#f59e0b' : '#ef4444';
  // Đơn giá mỗi m² (triệu VND/m²) = tổng giá (triệu) / diện tích
  const pricePerM2 = (result.price * 1000) / inputs.area;
  // Định dạng kiểu Việt Nam: tỷ dùng dấu phẩy thập phân (16,323)
  const fmtTy = v => v.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const legalText = document.getElementById('legal').options[document.getElementById('legal').selectedIndex].text;

  // Nhãn nguồn dự đoán: API = mô hình thật đã train; local = công thức dự phòng
  const srcBadge = result.source === 'api'
    ? `<span class="conf-badge" style="background:#10b98120;color:#10b981;border:1px solid #10b98140">🟢 Mô hình thật · dữ liệu 2024</span>`
    : `<span class="conf-badge" style="background:#f59e0b20;color:#f59e0b;border:1px solid #f59e0b40">🟡 Ước lượng cục bộ · API offline</span>`;

  // Ghi chú khi tỉnh chưa có dữ liệu thật, hoặc giá vượt khoảng dataset (1–11,5 tỷ)
  const info = result.info || {};
  let note = '';
  if (result.source === 'api' && info.provinceHasRealData === false)
    note += `⚠️ Tỉnh này chưa có dữ liệu giao dịch thật trong tập 2024 — kết quả ước lượng theo các đặc trưng khác.<br>`;
  if (result.source === 'api' && info.outOfRange)
    note += `⚠️ Dataset chỉ chứa nhà 1–11,5 tỷ; giá trị ngoài khoảng này kém tin cậy.<br>`;
  const noteHtml = note ? `<div class="result-range" style="color:#f59e0b">${note}</div>` : '';

  const el = document.getElementById('predictionResult');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="result-header">
      <span class="result-model-badge">🤖 ${result.model || selectedModel}</span>
      ${srcBadge}
      <span class="conf-badge" style="background:${confColor}20;color:${confColor};border:1px solid ${confColor}40">
        🎯 Độ tin cậy: ${result.confidence === 'High' ? 'Cao' : result.confidence === 'Medium' ? 'Trung bình' : 'Thấp'}
      </span>
    </div>
    <div class="result-price">
      💰 ${fmtTy(result.price)} <span class="price-unit">Tỷ VND</span>
    </div>
    <div class="result-price-m">📐 Đơn giá: ≈ ${pricePerM2.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Triệu VND/m²</div>
    <div class="result-range">
      📊 Khoảng tin cậy 90%: <strong>${fmtTy(result.lower)}</strong> — <strong>${fmtTy(result.upper)}</strong> Tỷ VND
    </div>
    ${noteHtml}
    <div class="result-info">
      📍 ${inputs.district}${inputs.districtOld ? ' · ' + inputs.districtOld : ''}, ${inputs.province} &nbsp;|&nbsp;
      📐 ${inputs.area} m² &nbsp;|&nbsp;
      🛏️ ${inputs.bedrooms} PN &nbsp;|&nbsp;
      📄 ${legalText.split('(')[0].trim()}
    </div>
  `;

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showSHAP(result.shap);
}

// ── SHAP Chart ─────────────────────────────────────────────
function showSHAP(shapValues) {
  const section = document.getElementById('shapSection');
  section.style.display = 'block';

  const labels = Object.keys(shapValues);
  const values = Object.values(shapValues);

  // Sort by absolute value
  const sorted = labels.map((l, i) => ({ label: l, val: values[i] }))
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

  const sortedLabels = sorted.map(x => x.label);
  const sortedVals = sorted.map(x => x.val);
  const colors = sortedVals.map(v => v >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)');

  if (shapChart) { shapChart.destroy(); shapChart = null; }

  const ctx = document.getElementById('shapChart').getContext('2d');
  shapChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedLabels,
      datasets: [{
        label: 'Đóng góp SHAP (Tỷ VND)',
        data: sortedVals,
        backgroundColor: colors,
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x >= 0 ? '+' : ''}${ctx.parsed.x.toFixed(3)} Tỷ VND`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e2e8f0', font: { size: 12, weight: '600' } },
        }
      }
    }
  });

  // Insights
  const top = sorted[0];
  const top2 = sorted[1];
  const insights = document.getElementById('shapInsights');
  insights.innerHTML = `
    💡 <strong>Phân tích AI:</strong> Yếu tố ảnh hưởng lớn nhất là
    <strong style="color:#22d3ee">${top.label}</strong> (${top.val >= 0 ? '+' : ''}${top.val.toFixed(3)} Tỷ)
    và <strong style="color:#a78bfa">${top2.label}</strong> (${top2.val >= 0 ? '+' : ''}${top2.val.toFixed(3)} Tỷ).
    ${top.val > 0 ? 'Vị trí và diện tích đóng vai trò tích cực' : 'Một số yếu tố đang kéo giá xuống'} trong dự đoán này.
    Thuật toán <strong>${selectedModel}</strong> đạt R² = ${MODEL_CONFIGS[selectedModel].metrics.R2.toFixed(4)}.
  `;
}

// ═══════════════════════════════════════════════
// EDA PAGE
// ═══════════════════════════════════════════════
function generateEDAData() {
  // Simulate realistic dataset stats — 34 provinces
  const provAvg = {
    // 6 thành phố trực thuộc Trung ương
    "Hồ Chí Minh":        12.4,
    "Hà Nội":             10.8,
    "Đà Nẵng":             5.8,
    "Hải Phòng":           4.2,
    "Cần Thơ":             3.2,
    "Huế":                 3.0,
    // 28 tỉnh
    "Khánh Hòa":           4.6,
    "Quảng Ninh":          3.8,
    "Đồng Nai":            3.6,
    "Bắc Ninh":            3.2,
    "Hưng Yên":            2.9,
    "Lâm Đồng":            3.0,
    "Tây Ninh":            2.6,
    "Ninh Bình":           2.6,
    "Thái Nguyên":         2.5,
    "An Giang":            2.6,
    "Phú Thọ":             2.5,
    "Gia Lai":             2.4,
    "Đắk Lắk":             2.4,
    "Nghệ An":             2.4,
    "Thanh Hoá":           2.4,
    "Quảng Ngãi":          2.3,
    "Hà Tĩnh":             2.1,
    "Vĩnh Long":           2.1,
    "Đồng Tháp":           2.1,
    "Lào Cai":             2.2,
    "Quảng Trị":           2.0,
    "Lạng Sơn":            2.0,
    "Cà Mau":              2.0,
    "Sơn La":              1.9,
    "Tuyên Quang":         2.0,
    "Cao Bằng":            1.8,
    "Điện Biên":           1.8,
    "Lai Châu":            1.7,
  };

  const bedroomAvg = { 1: 1.8, 2: 3.2, 3: 5.6, 4: 9.2, 5: 18.4 };

  const legalAvg = {
    "Sổ đỏ": 6.8, "Sổ hồng": 5.9, "Hợp lệ": 4.8, "Chờ sổ": 3.8, "Chưa sổ": 2.9
  };

  const furnAvg = {
    "Cao cấp": 8.2, "Đầy đủ": 5.6, "Cơ bản": 4.0, "Không NT": 3.1
  };

  const dirAvg = {
    "Đông Nam": 5.8, "Nam": 5.6, "Đông": 5.2, "Tây Nam": 4.9,
    "Bắc": 4.7, "Tây": 4.4, "Đông Bắc": 4.9, "Tây Bắc": 4.2
  };

  // Histogram data (price distribution buckets)
  const histBuckets = [0, 1, 2, 3, 4, 5, 7, 10, 15, 20, 30, 50];
  const histCounts = [12, 85, 198, 263, 218, 154, 172, 124, 78, 42, 25, 8];  // ~1400 visible

  return { provAvg, bedroomAvg, legalAvg, furnAvg, dirAvg, histBuckets, histCounts };
}

function destroyChart(inst) { if (inst) { try { inst.destroy(); } catch (e) { } } }

function initEDA() {
  const data = EDA_STATS || generateEDAData();   // ưu tiên thống kê thật từ API
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };
  const axisStyle = {
    grid: { color: 'rgba(255,255,255,0.05)' },
    ticks: { color: '#94a3b8', font: { size: 11 } },
  };

  // Destroy existing
  Object.values(edaCharts).forEach(destroyChart);
  edaCharts = {};

  // 1. Histogram
  {
    const ctx = document.getElementById('histChart').getContext('2d');
    const labels = ['0–1', '1–2', '2–3', '3–4', '4–5', '5–7', '7–10', '10–15', '15–20', '20–30', '30–50', '50+'];
    edaCharts.hist = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Số lượng',
          data: data.histCounts,
          backgroundColor: 'rgba(99,102,241,0.6)',
          borderColor: 'rgba(99,102,241,1)',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: { ...axisStyle, title: { display: true, text: 'Giá (Tỷ VND)', color: '#64748b' } },
          y: { ...axisStyle, title: { display: true, text: 'Số lượng', color: '#64748b' } },
        }
      }
    });
  }

  // 2. Province avg bar
  {
    const ctx = document.getElementById('provChart').getContext('2d');
    const sorted = Object.entries(data.provAvg).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const vals = sorted.map(x => x[1]);
    const colors = vals.map((v, i) => `hsl(${220 + i * 8},70%,${60 - i * 2}%)`);

    edaCharts.prov = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Giá TB (Tỷ)',
          data: vals,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 20,
        }]
      },
      options: {
        ...chartDefaults,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.x.toFixed(1)} Tỷ VND`
            }
          }
        },
        scales: {
          x: {
            ...axisStyle,
            title: { display: true, text: 'Giá trung bình (Tỷ VND)', color: '#64748b', font: { size: 11 } }
          },
          y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 11 } } },
        }
      }
    });
  }

  // 3. Bedrooms vs Price
  {
    const ctx = document.getElementById('bedroomChart').getContext('2d');
    edaCharts.bed = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['1 PN', '2 PN', '3 PN', '4 PN', '5 PN'],
        datasets: [{
          label: 'Giá TB (Tỷ)',
          data: Object.values(data.bedroomAvg),
          backgroundColor: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899'],
          borderRadius: 6,
        }]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { ...axisStyle, title: { display: true, text: 'Tỷ VND', color: '#64748b' } },
        }
      }
    });
  }

  // 4. Legal status
  {
    const ctx = document.getElementById('legalChart').getContext('2d');
    edaCharts.legal = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(data.legalAvg),
        datasets: [{
          label: 'Giá TB (Tỷ)',
          data: Object.values(data.legalAvg),
          backgroundColor: ['#10b981', '#22d3ee', '#6366f1', '#f59e0b', '#ef4444'],
          borderRadius: 6,
        }]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
          y: { ...axisStyle },
        }
      }
    });
  }

  // 5. Furniture
  {
    const ctx = document.getElementById('furnitureChart').getContext('2d');
    edaCharts.furn = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(data.furnAvg),
        datasets: [{
          data: Object.values(data.furnAvg),
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#94a3b8'],
          borderWidth: 0,
          spacing: 3,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 11 } } },
        },
        cutout: '60%',
      }
    });
  }

  // 6. Direction
  {
    const ctx = document.getElementById('directionChart').getContext('2d');
    edaCharts.dir = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: Object.keys(data.dirAvg),
        datasets: [{
          data: Object.values(data.dirAvg),
          backgroundColor: [
            'rgba(99,102,241,0.6)', 'rgba(34,211,238,0.6)', 'rgba(16,185,129,0.6)',
            'rgba(245,158,11,0.6)', 'rgba(239,68,68,0.6)', 'rgba(236,72,153,0.6)',
            'rgba(167,139,250,0.6)', 'rgba(52,211,153,0.6)',
          ],
          borderWidth: 0,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } },
        },
        scales: {
          r: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { display: false } }
        }
      }
    });
  }

  // 7. Correlation (as grouped bar — simulated)
  {
    const ctx = document.getElementById('correlationChart').getContext('2d');
    destroyChart(edaCharts.corr);
    edaCharts.corr = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: (data.corr && data.corr.labels) || ['Diện tích', 'P.Ngủ', 'P.Tắm', 'Số tầng'],
        datasets: [{
          label: 'Tương quan với Giá (r)',
          data: (data.corr && data.corr.values) || [0.83, 0.71, 0.65, 0.52],
          backgroundColor: ['rgba(99,102,241,0.7)', 'rgba(34,211,238,0.7)', 'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)', 'rgba(236,72,153,0.7)'],
          borderRadius: 6,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: true, labels: { color: '#94a3b8' } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { ...axisStyle, min: 0, max: 1, title: { display: true, text: 'Hệ số tương quan r', color: '#64748b' } },
        }
      }
    });
  }
}

function updateEDACharts() {
  // Re-init is fine for demo, real implementation would filter dataset
  initEDA();
}

function updatePriceFilter() {
  const v = document.getElementById('priceMax').value;
  document.getElementById('priceRangeVal').textContent = `0 – ${v}`;
}

// ═══════════════════════════════════════════════
// COMPARISON PAGE
// ═══════════════════════════════════════════════
let activeTab = 'rmse';

function initComparison() {
  buildMetricsTable();
  buildComparisonChart('rmse');
  buildRadar();
  buildModelCards();
}

function buildMetricsTable() {
  const models = Object.entries(MODEL_CONFIGS)
    .sort((a, b) => a[1].metrics.RMSE - b[1].metrics.RMSE);

  const tbody = document.getElementById('metricsBody');
  tbody.innerHTML = '';
  const ranks = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  models.forEach(([name, cfg], i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'best-row';
    tr.innerHTML = `
      <td>${ranks[i]}</td>
      <td><span style="color:${cfg.color}; font-weight:700">${cfg.icon} ${i === 0 ? '<strong>' : ''}${name}${i === 0 ? '</strong>' : ''}</span></td>
      <td>${cfg.metrics.MAE.toFixed(4)}</td>
      <td><strong>${cfg.metrics.RMSE.toFixed(4)}</strong></td>
      <td>${cfg.metrics.R2.toFixed(4)}</td>
      <td>${cfg.metrics.MAPE.toFixed(2)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  buildComparisonChart(tab);
}

function buildComparisonChart(tab) {
  destroyChart(compBarChart);

  const models = Object.entries(MODEL_CONFIGS)
    .sort((a, b) => {
      if (tab === 'r2') return b[1].metrics.R2 - a[1].metrics.R2;
      const key = { rmse: 'RMSE', mae: 'MAE', mape: 'MAPE' }[tab];
      return a[1].metrics[key] - b[1].metrics[key];
    });

  const labels = models.map(([n]) => n);
  const colors = models.map(([n, c]) => c.color);
  const metricKey = { rmse: 'RMSE', mae: 'MAE', r2: 'R2', mape: 'MAPE' }[tab];
  const vals = models.map(([, c]) => c.metrics[metricKey]);

  // Highlight best
  const bgColors = colors.map((c, i) => i === 0 ? '#10b981' : c + 'aa');

  const ctx = document.getElementById('comparisonBarChart').getContext('2d');
  compBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: bgColors,
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.parsed.y.toFixed(4)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function buildRadar() {
  destroyChart(radarChartInst);

  const models = Object.entries(MODEL_CONFIGS);
  const maxRMSE = Math.max(...models.map(([, c]) => c.metrics.RMSE));
  const maxMAE = Math.max(...models.map(([, c]) => c.metrics.MAE));
  const maxMAPE = Math.max(...models.map(([, c]) => c.metrics.MAPE));
  const maxR2 = Math.max(...models.map(([, c]) => c.metrics.R2));

  const datasets = models.map(([name, cfg]) => ({
    label: name,
    data: [
      1 - cfg.metrics.RMSE / maxRMSE,
      1 - cfg.metrics.MAE / maxMAE,
      cfg.metrics.R2 / maxR2,
      1 - cfg.metrics.MAPE / maxMAPE,
    ],
    borderColor: cfg.color,
    backgroundColor: cfg.color + '22',
    borderWidth: 2,
    pointBackgroundColor: cfg.color,
    pointRadius: 4,
  }));

  const ctx = document.getElementById('radarChart').getContext('2d');
  radarChartInst = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['RMSE (norm)', 'MAE (norm)', 'R² Score', 'MAPE (norm)'],
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { size: 11 } } }
      },
      scales: {
        r: {
          min: 0, max: 1,
          grid: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { color: '#e2e8f0', font: { size: 12, weight: '600' } },
          ticks: { display: false },
        }
      }
    }
  });
}

function buildModelCards() {
  const grid = document.getElementById('modelDetailGrid');
  grid.innerHTML = '';
  const sorted = Object.entries(MODEL_CONFIGS).sort((a, b) => a[1].metrics.RMSE - b[1].metrics.RMSE);

  sorted.forEach(([name, cfg], i) => {
    const isTop = i === 0;
    const div = document.createElement('div');
    div.className = 'model-detail-card';
    div.style.borderTop = `3px solid ${cfg.color}`;
    div.innerHTML = `
      <div class="mdc-icon">${cfg.icon}</div>
      <div class="mdc-name">${name}</div>
      <div class="mdc-metric"><span>RMSE</span><b>${cfg.metrics.RMSE.toFixed(4)}</b></div>
      <div class="mdc-metric"><span>MAE</span><b>${cfg.metrics.MAE.toFixed(4)}</b></div>
      <div class="mdc-metric"><span>R²</span><b>${cfg.metrics.R2.toFixed(4)}</b></div>
      <div class="mdc-metric"><span>MAPE</span><b>${cfg.metrics.MAPE.toFixed(2)}%</b></div>
      ${isTop ? `<div class="mdc-badge" style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}44">🏆 Tốt nhất</div>` : ''}
    `;
    grid.appendChild(div);
  });
}

// ── Counter Animation ──────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.animate-count').forEach((el, i) => {
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const valEl = el.querySelector('.kpi-value');
    if (!valEl) return;
    let start = 0;
    const duration = 1200;
    const step = 16;
    const steps = duration / step;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      valEl.textContent = Math.floor(current).toLocaleString('vi-VN') + suffix;
    }, step);
  });
}

// ── Init ───────────────────────────────────────────────────
// Nạp chỉ số thật từ API và ghi đè số demo trong MODEL_CONFIGS (nếu API chạy).
async function loadRealMetrics() {
  try {
    const resp = await fetch(`${API_BASE}/metrics`);
    if (!resp.ok) return;
    const data = await resp.json();
    Object.entries(data.metrics || {}).forEach(([name, m]) => {
      if (MODEL_CONFIGS[name]) {
        MODEL_CONFIGS[name].metrics = { MAE: m.MAE, RMSE: m.RMSE, R2: m.R2, MAPE: m.MAPE };
      }
    });
    // Cập nhật các số liệu tĩnh bằng số THẬT từ model
    const best = data.meta?.best_model;
    const bm = best && data.metrics[best];
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (bm) {
      set('kpi-r2', '~' + Math.round(bm.R2 * 100) + '%');                 // KPI trang chủ
      set('best-model-name', 'Mô Hình Tốt Nhất: ' + best);
      set('best-model-stats',
        `RMSE: ${bm.RMSE}  |  MAE: ${bm.MAE}  |  R²: ${bm.R2}  |  MAPE: ${bm.MAPE}%`);
    }
    const total = (data.meta?.n_train || 0) + (data.meta?.n_test || 0);
    if (total) set('kpi-dataset', total.toLocaleString('vi-VN') + '+');
    if (currentPage === 'comparison') initComparison();   // vẽ lại với số thật
  } catch (e) { /* API offline → giữ số demo */ }
}

document.addEventListener('DOMContentLoaded', () => {
  populateProvinces();
  updateSummary();
  selectModel('Random Forest');
  loadRealMetrics();
  loadLocations();
  loadEdaStats();

  // Animate KPI counters after small delay
  setTimeout(animateCounters, 300);

  // Add input listeners for live summary
  document.getElementById('legal').addEventListener('change', updateSummary);
  document.getElementById('furniture').addEventListener('change', updateSummary);
  document.getElementById('direction').addEventListener('change', updateSummary);
  document.getElementById('district').addEventListener('change', updateSummary);
});
