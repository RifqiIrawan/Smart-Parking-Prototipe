# Smart Parking - OCR Service

Layanan OCR untuk deteksi dan pengenalan plat nomor kendaraan.

## Tech Stack
- **FastAPI** - REST API framework
- **PaddleOCR** - OCR engine (Baidu)
- **OpenCV** - Image preprocessing

## Instalasi

```bash
# Buat virtual environment
python3 -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
```

## Menjalankan

```bash
python main.py
# atau
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### POST /ocr/plate
Deteksi plat nomor dari gambar base64.

```json
{
  "image_base64": "data:image/jpeg;base64,/9j/...",
  "enhance": true,
  "debug": false
}
```

Response:
```json
{
  "success": true,
  "plate_number": "B 1234 ABC",
  "confidence": 0.92,
  "raw_text": [],
  "processing_time_ms": 145
}
```

### GET /ocr/test
Test OCR dengan gambar sampel.

## Mode Operasi
- **Paddle Mode**: PaddleOCR aktif (perlu GPU/CPU cukup)
- **Mock Mode**: Jika PaddleOCR tidak tersedia, mengembalikan data dummy
