# Smart Parking System

Sistem manajemen parkir cerdas berbasis web dengan fitur OCR plat nomor, payment gateway, dan monitoring real-time.

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: Go + Gin Framework
- **Database**: PostgreSQL
- **OCR**: Python + PaddleOCR + OpenCV
- **Payment**: Midtrans/Xendit Sandbox

## Struktur Project
```
smart-parking/
├── frontend/     # React + Vite + TypeScript
├── backend/      # Go + Gin
├── ocr-service/  # Python + PaddleOCR
├── database/     # PostgreSQL schema
├── docs/         # Documentation
└── scripts/      # Utility scripts
```

## Quick Start

### 1. Database
```bash
cd database && bash migrate.sh
```

### 2. Backend
```bash
cd backend
cp .env.example .env  # edit with your config
go mod tidy
go run main.go        # port 8080
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev           # port 5173
```

### 4. OCR Service (opsional)
```bash
cd ocr-service
pip install -r requirements.txt
python main.py        # port 8000
```

## Login Default
- Email: admin@smartparking.id
- Password: admin123

## API Endpoints
- POST /api/login
- GET  /api/dashboard
- POST /api/vehicle/entry
- POST /api/vehicle/exit
- GET  /api/transactions
- GET  /api/gates
- POST /api/gate/open
- POST /api/gate/close
- POST /api/payment/create
- POST /api/payment/callback

Lihat README lengkap di docs/API.md
