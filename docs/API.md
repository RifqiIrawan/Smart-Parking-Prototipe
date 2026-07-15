# Smart Parking API Documentation

Base URL: `http://localhost:8080`

## Authentication
JWT Bearer Token. Masukkan token di header:
```
Authorization: Bearer <token>
```

---

## Auth

### POST /api/login
```json
// Request
{ "email": "admin@smartparking.id", "password": "admin123" }

// Response
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": { "id": "...", "name": "Administrator", "role_name": "admin" }
  }
}
```

---

## Dashboard

### GET /api/dashboard
Stats ringkasan sistem.

### GET /api/dashboard/revenue-chart
Data pendapatan 30 hari terakhir.

### GET /api/dashboard/slot-map
Status semua slot parkir.

---

## Kendaraan

### POST /api/vehicle/entry
```json
{
  "plate_number": "B 1234 ABC",
  "vehicle_type": "car",  // car | motorcycle | truck
  "gate_id": "uuid",      // opsional
  "plate_image": "base64" // opsional
}
```

### POST /api/vehicle/exit
```json
{
  "ticket_number": "TKT-20240115120000-1234",
  "gate_id": "uuid",
  "plate_image": "base64"
}
```

### GET /api/transactions?status=active&limit=50
### GET /api/transactions/:id

---

## Gate

### GET /api/gates
### POST /api/gate/open
```json
{ "gate_id": "uuid", "command": "open" }
```
### POST /api/gate/close
```json
{ "gate_id": "uuid", "command": "close" }
```

---

## Payment

### POST /api/payment/create
```json
{
  "transaction_id": "uuid",
  "payment_method": "qris",  // qris | virtual_account | ewallet | cash
  "payment_channel": "gopay" // opsional
}
```

### POST /api/payment/simulate/:order_id
Simulasi konfirmasi pembayaran (sandbox only).

### POST /api/payment/callback
Webhook dari Midtrans/Xendit.

---

## Laporan

### GET /api/reports?period=daily
period: daily | monthly

---

## Error Response
```json
{
  "success": false,
  "message": "Pesan error",
  "error": "Detail error"
}
```
