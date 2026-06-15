# Dockerfile — dùng cho Hugging Face Spaces (SDK: Docker) hoặc bất kỳ host Docker nào.
FROM python:3.12-slim

WORKDIR /app

# libgomp1 = OpenMP runtime mà lightgbm/xgboost cần (bản slim chưa có -> phải cài)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# HF Spaces mặc định cổng 7860 (đặt app_port: 7860 trong README của Space).
ENV PORT=7860
EXPOSE 7860

CMD ["python", "api.py"]
