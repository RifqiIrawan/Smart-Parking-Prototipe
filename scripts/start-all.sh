#!/bin/bash
# Smart Parking - Start All Services

echo "================================================"
echo " Smart Parking System - Starting Services"
echo "================================================"

# Start Backend
echo ""
echo "▶ Starting Backend (Go + Gin) on port 8080..."
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  ⚠ Created .env from template. Please configure it!"
fi
go build -o smart-parking-api . && ./smart-parking-api &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
cd ..

# Wait for backend
sleep 2

# Start OCR Service (optional)
if [ -d "ocr-service/venv" ]; then
    echo ""
    echo "▶ Starting OCR Service (Python) on port 8000..."
    cd ocr-service
    source venv/bin/activate
    python main.py &
    OCR_PID=$!
    echo "  OCR PID: $OCR_PID"
    cd ..
else
    echo ""
    echo "⚠ OCR venv not found. Skipping OCR service."
    echo "  To setup: cd ocr-service && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
fi

# Start Frontend
echo ""
echo "▶ Starting Frontend (React) on port 5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
cd ..

echo ""
echo "================================================"
echo " All services started!"
echo " Frontend : http://localhost:5173"
echo " Backend  : http://localhost:8080"
echo " OCR      : http://localhost:8000"
echo "================================================"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap to kill all on exit
trap "kill $BACKEND_PID $FRONTEND_PID $OCR_PID 2>/dev/null; echo 'All services stopped.'" EXIT
wait
