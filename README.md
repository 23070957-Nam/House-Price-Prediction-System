Vietnam House Price Prediction
A web app that estimates house prices in Vietnam using machine learning models trained on 30,000+ real 2024 property listings. The user enters a home's location and features, and the app returns a predicted price, a confidence range and the features that drove the estimate.
Dataset
Source: Vietnam Housing Dataset 2024 (Kaggle), scraped from batdongsan.vn listings
Size: 30,194 listings after cleaning (24,155 train / 6,039 test, 80/20 split)
Target: price in billion VND, listings priced 1–11.5 billion VND
Summary: average price 5.87 billion VND, average area 68.1 m²
Type	Features
Numeric	Area, Floors, Bedrooms, Bathrooms, Frontage, Access road width
Categorical	Province, District, Legal status, Furniture state, House direction
Approach
Cleaning: parsed province and district from free-text addresses, standardised district names, filled missing categories with an "Unknown" level.
Preprocessing: scikit-learn `ColumnTransformer` with median imputation for numeric features and one-hot encoding (rare categories grouped) for categorical features.
Modelling: trained and compared five regressors in the same pipeline: Linear Regression, Decision Tree, Random Forest, XGBoost and LightGBM.
Evaluation: MAE, RMSE, R² and MAPE on the held-out test set.
Location mapping: mapped the 2024 district-level data onto Vietnam's 34 provinces after the July 2025 administrative merger, so the app uses current province names.
Results
Test set, 6,039 listings:
Model	MAE (bn VND)	RMSE (bn VND)	R²	MAPE
LightGBM	0.975	1.301	0.648	20.1%
XGBoost	1.009	1.318	0.639	21.0%
Random Forest	1.120	1.452	0.562	23.9%
Decision Tree	1.208	1.563	0.492	26.0%
Linear Regression	1.267	1.631	0.446	26.8%
LightGBM is the best model and powers the app: its typical error is about 1 billion VND, or 20% of the listing price.
Adding district, frontage and access road width raised R² from 0.49 to 0.65, showing that location detail matters more than house size alone.
Architecture
```
Browser (HTML/CSS/JS)  --fetch-->  Flask API (api.py)  -->  trained models (.pkl)
```
Front end: plain HTML, CSS and JavaScript, including an EDA page with price by province, bedrooms, legal status and correlations.
Back end: Flask API with `/predict`, `/metrics`, `/eda` and `/locations` endpoints.
Fallback: if the API is offline, the page switches to a local estimation formula so it still works.
Deployment: Docker and Render configuration included.
Tech stack
Python, pandas, NumPy, scikit-learn, XGBoost, LightGBM, Flask, JavaScript, HTML/CSS, Docker
How to run
```bash
cd "web dự đoán giá nhà"
pip install -r requirements.txt

python -m src.train\_models     # optional: retrain models into models/
python api.py                  # API at http://localhost:5000
python -m http.server 8000     # web app at http://localhost:8000
```
Project structure
```
web dự đoán giá nhà/
├── index.html, app.js, style.css, vn-geo.js   front end
├── api.py                                      Flask API
├── src/train\_models.py                         cleaning, training and EDA pipeline
├── data/vietnam\_housing\_dataset.csv            2024 listings
├── models/                                     trained models and metrics
├── requirements.txt
├── Dockerfile
└── render.yaml
```
Limitations
Listings are limited to 1–11.5 billion VND and concentrated in Ho Chi Minh City and Hanoi, so estimates are weaker for luxury homes and provinces with few listings.
Outside major cities, data is too thin to price at district level, so those estimates use province level only.
Listing prices are asking prices, not final transaction prices.
Author
Mac Hai Nam, Business Data Analytics, VNU International School
