# Alur Lengkap Sistem Smart Parking

Dokumen ini menjelaskan langkah demi langkah proses bisnis dari **kendaraan masuk (gate terbuka)** → **parkir** → **kendaraan keluar** → **pembayaran** → **gate keluar terbuka lalu tertutup kembali**, lengkap dengan endpoint API, tabel database, dan topik MQTT yang terlibat di tiap tahap.

Referensi kode:
- `backend/handlers/vehicle.go` — proses masuk & keluar kendaraan
- `backend/handlers/payment.go` — pembayaran (Midtrans / simulator)
- `backend/handlers/gate.go` — kontrol gate manual
- `backend/config/mqtt.go` — publish perintah ke ESP32
- `frontend/src/pages/Entry.tsx`, `Exit.tsx` — UI operator

---

## Ringkasan Alur (High-level)

```
[Operator: Entry.tsx] → POST /api/vehicle/entry → Gate MASUK terbuka (MQTT) → auto-close 8 detik
        │
        ▼ (kendaraan parkir, slot = occupied)
        │
[Operator: Exit.tsx]  → POST /api/vehicle/exit  → Hitung tarif, slot dibebaskan, gate BELUM dibuka
        │
        ▼
[Operator: Exit.tsx]  → POST /api/payment/create → QRIS/VA/E-wallet dibuat (Midtrans atau mode simulator)
        │
        ▼ (pembayaran dikonfirmasi lewat salah satu jalur di bawah)
   ┌─────────────────────────────┬───────────────────────────────┐
   │ Simulator: POST /api/payment/simulate/:order_id             │
   │ Real: Midtrans webhook → POST /api/payment/callback         │
   │ Polling: GET /api/payment/status/:order_id                  │
   └─────────────────────────────┴───────────────────────────────┘
        │
        ▼
   markPaid() → Gate KELUAR terbuka (MQTT) → auto-close 10 detik
```

---

## Tahap 1 — Kendaraan Masuk (Entry Gate Open)

**UI**: halaman `Entry` (`/entry` di frontend) — operator mengisi nomor plat, jenis kendaraan, dan gate masuk.

**Endpoint**: `POST /api/vehicle/entry`

```json
{
  "plate_number": "B1234ABC",
  "vehicle_type": "car",
  "gate_id": "<uuid gate masuk>"
}
```

Langkah yang dieksekusi backend (`VehicleHandler.Entry`, `backend/handlers/vehicle.go:28`):

1. **Cek duplikasi** — query `parking_transactions` untuk plat yang sama dengan `status='active'`. Jika sudah ada → response `409 Conflict` ("Kendaraan sudah ada di dalam parkir").
2. **Upsert kendaraan** — `INSERT ... ON CONFLICT (plate_number) DO UPDATE` ke tabel `vehicles`.
3. **Ambil tarif dasar** — `SELECT first_hour_rate FROM tariffs WHERE vehicle_type=...` (seed default: mobil Rp5.000, motor Rp2.000, truk Rp10.000).
4. **Auto-assign slot** — jika `slot_id` tidak dikirim, sistem mencari slot `available` dengan tipe yang sesuai (`motorcycle` untuk motor, `regular` untuk lainnya).
5. **Buat transaksi** — generate `ticket_number` (format `TKT-yyyyMMddHHmmss-xxxx`), insert ke `parking_transactions` dengan `status='active'`.
6. **Update slot** — slot yang dipakai diubah menjadi `status='occupied'`.
7. **Buka gate masuk**:
   - `UPDATE gates SET status='open'` di database.
   - `config.PublishGateCommand(gateID, gateName, "open")` → publish MQTT ke topik `smart-parking/gate/{gate_id}/command` dengan payload `{"command":"open", "auto_close":8, ...}`.
   - ESP32 (lihat `wokwi/sketch.ino`) yang subscribe ke topik tersebut menggerakkan servo untuk membuka palang.
   - **Auto-close** — goroutine terpisah menunggu 8 detik, lalu otomatis `UPDATE gates SET status='closed'` + publish command `"close"` ke topik yang sama, sehingga gate menutup kembali setelah kendaraan lewat.

**Response**: `201 Created`, berisi `ticket_number`, `entry_time`, `status: active`. Tiket ini yang dipakai nanti saat kendaraan keluar.

---

## Tahap 2 — Kendaraan Parkir

Tidak ada aksi API di tahap ini — slot berstatus `occupied` sampai kendaraan diproses keluar. Status dapat dipantau lewat `GET /api/dashboard/slot-map`.

---

## Tahap 3 — Kendaraan Keluar & Hitung Tarif (belum bayar, gate belum terbuka)

**UI**: halaman `Exit` (`/exit`) — operator memasukkan `ticket_number` + gate keluar (opsional).

**Endpoint**: `POST /api/vehicle/exit`

```json
{ "ticket_number": "TKT-20260716...", "gate_id": "<uuid gate keluar>" }
```

Langkah backend (`VehicleHandler.Exit`, `backend/handlers/vehicle.go:155`):

1. Cari transaksi aktif berdasarkan `ticket_number` (harus `status='active'`), join ke `vehicles` untuk tipe kendaraan.
2. **Hitung durasi & biaya**:
   - `durationMinutes = exit_time - entry_time` (minimum 1 menit).
   - `hours = ceil(durationMinutes / 60)`.
   - `total = first_hour_rate + (hours - 1) * next_hour_rate` (jika `hours > 1`).
   - Dibatasi oleh `max_daily_rate` (tarif harian maksimum).
3. **Update transaksi**: `exit_time`, `duration_minutes`, `total_amount`, `status='completed'`, `exit_gate_id`, `plate_image_out`.
4. **Bebaskan slot**: `UPDATE parking_slots SET status='available'`.
5. **Gate belum dibuka di tahap ini** — ini disengaja: gate keluar baru terbuka setelah pembayaran berhasil dikonfirmasi (lihat Tahap 5). Ini mencegah kendaraan keluar tanpa membayar.

**Response**: rincian tagihan — `transaction`, `duration_minutes`, `total_amount`, `vehicle_type`. Frontend menampilkan ini sebagai layar "Rincian Parkir" dengan pilihan metode pembayaran (QRIS / Virtual Account / E-wallet / Tunai).

---

## Tahap 4 — Membuat Pembayaran

**Endpoint**: `POST /api/payment/create`

```json
{ "transaction_id": "<id dari tahap 3>", "payment_method": "qris" }
```

Langkah backend (`PaymentHandler.CreatePayment`, `backend/handlers/payment.go:188`):

1. Ambil `total_amount` transaksi dari DB.
2. Generate `order_id` (format `SP-<unixmillis>-<random4digit>`) dan `expired_at` (+15 menit).
3. **Cek mode**: `useMidtrans = MIDTRANS_SERVER_KEY` di `.env` sudah diisi kunci asli (bukan placeholder default).
   - **Mode Midtrans (real)** — panggil Midtrans Core API `POST /v2/charge` (sandbox/production sesuai `MIDTRANS_SANDBOX`):
     - `qris` → dapat `qr_string` + `qr_image_url` dari respons Midtrans.
     - `virtual_account` → dapat `va_number` + nama bank.
     - `ewallet` (gopay/shopeepay) → dapat `deeplink` + `simulator_url` Midtrans.
   - **Mode Simulator (default, tanpa kunci Midtrans)**:
     - `qris` → generate string EMV QRIS palsu + QR image via `api.qrserver.com`.
     - `virtual_account` → generate nomor VA acak.
     - `ewallet` → generate deeplink palsu `gopay://pay?order_id=...`.
4. Insert record ke tabel `payments` dengan `status='pending'`, dan log event `CREATED` ke `payment_logs`.

**Response**: data pembayaran (`order_id`, `amount`, `qr_string`/`qr_image_url`/`va_number`, `use_midtrans`, `payment_instructions`, dst). Frontend (`QRISPanel` di `Exit.tsx`) menampilkan QR code, jumlah tagihan, dan countdown 15 menit.

---

## Tahap 5 — Konfirmasi Pembayaran (3 jalur berbeda, semua bermuara ke `markPaid()`)

### 5a. Mode Simulator — tombol "Konfirmasi Pembayaran"
`POST /api/payment/simulate/:order_id` (`PaymentHandler.SimulatePayment`) — dipanggil saat operator/tester klik tombol simulasi di UI. Langsung memanggil `markPaid()`.

### 5b. Polling status (dipakai frontend tiap 3 detik saat mode Midtrans real)
`GET /api/payment/status/:order_id` (`PaymentHandler.CheckPaymentStatus`):
- Jika `useMidtrans=true`, cek status asli via Midtrans `GET /v2/{order_id}/status`. Jika `settlement`/`capture` → panggil `markPaid()`.
- Jika mode simulator, hanya mengembalikan status dari DB (tidak berubah otomatis — harus lewat 5a atau webhook).

### 5c. Webhook Midtrans (produksi nyata)
`POST /api/payment/callback` (`PaymentHandler.Callback`) — dipanggil oleh server Midtrans saat status transaksi berubah. Memetakan `transaction_status`:
- `capture` / `settlement` → `paid` → panggil `markPaid()`.
- `deny` / `cancel` → `failed`.
- `expire` → `expired`.

### `markPaid()` — inti logika "gate keluar terbuka" (`backend/handlers/payment.go:414`)

1. `UPDATE payments SET status='paid', paid_at=NOW()`.
2. Insert log event `PAID` ke `payment_logs`.
3. Publish event MQTT (retained) ke `smart-parking/payment/{order_id}/paid` — dipakai dashboard/monitor lain untuk notifikasi real-time.
4. **Buka gate keluar** (goroutine terpisah):
   - Cari `exit_gate_id` milik transaksi terkait (gate yang dipilih di Tahap 3). Jika kosong, fallback ke gate mana pun bertipe `exit` yang aktif.
   - `UPDATE gates SET status='open'`.
   - `config.PublishGateCommand(gateID, gateName, "open")` → ESP32 gate keluar membuka palang.
   - **Auto-close setelah 10 detik** — `UPDATE gates SET status='closed'` + publish command `"close"` ke topik `smart-parking/gate/{gate_id}/command`.

**Response ke frontend**: status `paid`. UI menampilkan "PEMBAYARAN BERHASIL · Gate terbuka via MQTT…", lalu form direset untuk transaksi berikutnya.

---

## Tahap 6 — Gate Keluar Menutup Kembali

Sama seperti gate masuk, penutupan **tidak memerlukan aksi manual** — sudah dijadwalkan otomatis 10 detik setelah `markPaid()` dijalankan (lihat langkah 4 di atas). ESP32 menerima command `"close"` di topik yang sama (`smart-parking/gate/{gate_id}/command`) dan menutup palang.

> Catatan: gate masuk auto-close dalam **8 detik**, gate keluar dalam **10 detik** — nilai ini di-hardcode di `vehicle.go` (baris ~139) dan `payment.go` (baris ~454).

---

## Kontrol Gate Manual (di luar alur otomatis)

Operator/admin juga bisa membuka/menutup gate secara manual lewat halaman `Gates` di dashboard:

`POST /api/gate/open` atau `POST /api/gate/close`
```json
{ "gate_id": "<uuid>", "command": "open" }
```
→ ditangani `GateHandler.ControlGate` (`backend/handlers/gate.go:97`), update status gate + publish MQTT command yang sama, **tanpa** auto-close otomatis.

---

## Ringkasan Topik MQTT

| Topik | Arah | Kapan dipakai |
|---|---|---|
| `smart-parking/gate/{gate_id}/command` | Backend → ESP32 | Buka/tutup gate masuk (entry), gate keluar (setelah bayar), atau kontrol manual |
| `smart-parking/gate/{gate_id}/status` | ESP32 → Backend | Feedback status fisik gate dari hardware (di-log saja) |
| `smart-parking/payment/{order_id}/paid` | Backend → subscriber lain | Notifikasi pembayaran sukses (retained message) |
| `smart-parking/system/log` | Backend → subscriber lain | Log event sistem umum (`GATE_COMMAND`, `PAYMENT_PAID`, dll) |

> Jika broker MQTT tidak terkoneksi (mis. Mosquitto belum jalan), backend tetap berjalan normal — perintah gate hanya di-log (`[MQTT] Not connected. Gate command skipped`), status DB tetap ter-update, hanya kontrol hardware fisik yang tidak terjadi.

---

## Ringkasan Endpoint per Tahap

| Tahap | Endpoint | Handler |
|---|---|---|
| 1. Masuk + buka gate | `POST /api/vehicle/entry` | `VehicleHandler.Entry` |
| 3. Keluar + hitung tarif | `POST /api/vehicle/exit` | `VehicleHandler.Exit` |
| 4. Buat pembayaran | `POST /api/payment/create` | `PaymentHandler.CreatePayment` |
| 5a. Simulasi bayar | `POST /api/payment/simulate/:order_id` | `PaymentHandler.SimulatePayment` |
| 5b. Cek status bayar | `GET /api/payment/status/:order_id` | `PaymentHandler.CheckPaymentStatus` |
| 5c. Webhook Midtrans | `POST /api/payment/callback` | `PaymentHandler.Callback` |
| Manual gate | `POST /api/gate/open` / `/api/gate/close` | `GateHandler.ControlGate` |

Semua endpoint di atas (kecuali `/api/login`, `/health`, `/api/payment/callback`) memerlukan header `Authorization: Bearer <JWT>` yang didapat dari `POST /api/login` (default: `admin@smartparking.id` / `admin123`).

---

## Cara Penggunaan Simulator Mesin (Halaman "Simulator")

Karena gate fisik (ESP32 + servo) belum tentu tersedia saat development, dashboard menyediakan halaman **Simulator** (`/simulator`, `frontend/src/pages/Simulator.tsx`) untuk mensimulasikan seluruh alur di atas tanpa perangkat keras. Halaman ini punya 3 tab.

### Status Bar (selalu tampil di atas)
Tiga indikator koneksi:
- **MQTT Broker** — hijau "TERHUBUNG" jika berhasil connect ke broker (via WebSocket, `frontend/src/hooks/useMQTT.ts`). Jika merah "TERPUTUS", klik ikon refresh untuk reconnect.
- **Payment Gateway** — info bahwa Midtrans Sandbox dipakai (QRIS/VA/E-wallet).
- **Hardware Simulator** — status Wokwi ESP32 (link cepat ke wokwi.com).

### Tab 1 — 🚧 Gate Simulator
Menampilkan setiap gate (dari `GET /gates`) sebagai palang virtual (SVG animasi servo 0°–90°) dengan tombol **Buka** / **Tutup**.

Cara pakai:
1. Klik **Buka** pada salah satu gate → memanggil `POST /api/gate/open` (`{gate_id, command:"open"}`), lalu **juga** publish langsung ke topik MQTT `smart-parking/gate/{id}/command` dari browser (untuk keandalan ekstra jika ESP32 subscribe langsung).
2. Palang pada layar berputar ke posisi terbuka (90°), LED indikator berubah hijau ("OPEN").
3. Jika ESP32 Wokwi juga terkoneksi ke broker yang sama, ia akan menerima command ini dan menggerakkan servo asli, lalu mempublish balik status ke `smart-parking/gate/{id}/status` — event ini langsung muncul di **Event Log** di panel kanan.
4. Klik **Tutup** untuk mengirim command `close` secara manual (tab ini tidak auto-close, beda dengan alur Entry/Exit yang otomatis close setelah 8/10 detik).

Panel bawah menampilkan referensi 4 topik MQTT yang dipakai (PUB/SUB) — cocokkan dengan tabel topik di atas.

### Tab 2 — 💳 Payment QRIS
Berisi diagram alur 7 langkah (Kendaraan Keluar → Hitung Tarif → QRIS/VA → Midtrans Sandbox → Webhook → MQTT Publish → ESP32 Buka Gate) dan tombol **"Mulai Demo Pembayaran QRIS"**.

Cara pakai:
1. Klik tombol demo → sistem mengambil transaksi `active` pertama (`GET /transactions?status=active&limit=1`).
   - Jika ada transaksi aktif (kendaraan yang sudah masuk tapi belum keluar), sistem membuat pembayaran QRIS sungguhan lewat `POST /api/payment/create`.
   - Jika tidak ada transaksi aktif sama sekali, sistem membuat **mock payment** lokal (`order_id: SP-DEMO-...`) hanya untuk demo tampilan — tidak tersimpan di DB.
2. Modal QRIS muncul (mirip halaman Exit): QR code, jumlah tagihan, countdown 15 menit.
3. Klik **"Simulasikan Pembayaran Berhasil"** (mode simulator) atau **"Simulasi (Testing)"** (mode Midtrans real) → memanggil `POST /api/payment/simulate/:order_id` → `markPaid()` dijalankan → gate keluar terbuka via MQTT (lihat Tahap 5 & 6 di atas).
4. Event pembayaran & pembukaan gate akan muncul di Event Log kanan secara real-time.

> Untuk mengaktifkan Midtrans sungguhan (bukan simulator): daftar di sandbox.midtrans.com → Settings → Access Keys → salin Server Key → isi ke `backend/.env` → `MIDTRANS_SERVER_KEY`. Tanpa key ini, sistem otomatis jalan di mode simulator (aman untuk development).

### Tab 3 — 🤖 Wokwi Setup
Panduan 5 langkah untuk menyambungkan simulator hardware ESP32 (virtual, di wokwi.com) ke sistem ini:

1. **Buka Wokwi** — buat project baru ESP32 di `wokwi.com/projects/new/esp32`.
2. **Upload file** dari folder `wokwi/` proyek ini ke project Wokwi:
   - `diagram.json` — rangkaian virtual (ESP32 + Servo SG90 + LED hijau/merah + LCD I2C 16x2).
   - `sketch.ino` — firmware yang subscribe ke topik MQTT gate.
   - `libraries.txt` — daftar library (PubSubClient, ArduinoJson, dll) yang otomatis di-install Wokwi.
3. **Konfigurasi broker & Gate ID** di `sketch.ino`:
   ```cpp
   const char* MQTT_BROKER = "broker.hivemq.com"; // broker publik, dipakai Wokwi online
   const char* GATE_ID     = "UUID-DARI-DATABASE"; // harus sama persis dengan id di tabel `gates`
   ```
   Ambil UUID gate dari halaman **Gate Monitor** di dashboard, atau query `SELECT id, name FROM gates;`.
   - Backend juga harus menunjuk ke broker yang sama: set `MQTT_BROKER=tcp://broker.hivemq.com:1883` di `backend/.env` (default saat ini `tcp://localhost:1883`, cocok jika memakai Mosquitto lokal, bukan Wokwi).
4. **Jalankan** — klik ▶ Run di Wokwi. Serial Monitor akan menampilkan konfirmasi koneksi WiFi + MQTT + subscribe topik.
5. **Test dari halaman Simulator** — klik Buka/Tutup di Tab 1. ESP32 (virtual) akan menerima perintah, memutar servo, menyalakan LED, menampilkan status di LCD, lalu mempublish status baliknya sehingga terlihat di Event Log dashboard.

Pilihan broker MQTT (lihat `wokwi/README.md` untuk detail):

| Broker | Alamat | Cocok untuk |
|---|---|---|
| HiveMQ Public | `broker.hivemq.com:1883` | Wokwi online (default, tanpa setup tambahan) |
| Mosquitto lokal + ngrok | `x.tcp.ngrok.io:xxxxx` | Wokwi online ↔ broker lokal di komputer sendiri |
| Mosquitto lokal langsung | `192.168.1.x:1883` | ESP32 fisik & backend di jaringan yang sama (bukan Wokwi cloud) |

### Panel Event Log (kanan, semua tab)
Menampilkan semua event MQTT & API secara real-time dengan warna berbeda per sumber (`MQTT` ungu, `API` biru, `SYSTEM` kuning) — berguna untuk memverifikasi bahwa setiap langkah di alur (buka gate masuk → bayar → buka gate keluar → tutup) benar-benar terkirim/diterima, tanpa perlu membuka Serial Monitor Wokwi atau log backend secara terpisah.
