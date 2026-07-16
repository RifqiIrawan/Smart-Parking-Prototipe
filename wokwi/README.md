# 🤖 Wokwi ESP32 - Smart Parking Gate Simulator

Simulator hardware gate parkir menggunakan ESP32, Servo SG90, LED, dan LCD.

## Hardware (Virtual)
```
ESP32 DevKit V1
├── GPIO 13 → Servo SG90 (palang gate)
│             0°  = tutup, 90° = buka
├── GPIO 14 → LED Hijau (gate buka)
├── GPIO 12 → LED Merah (gate tutup)
└── GPIO 21/22 → LCD I2C 16x2 (status display)
```

## MQTT Topics

| Direction | Topic | Payload |
|-----------|-------|---------|
| Subscribe | `smart-parking/gate/{GATE_ID}/command` | `{"command":"open","gate_id":"...","auto_close":8}` |
| Publish   | `smart-parking/gate/{GATE_ID}/status`  | `{"status":"open","angle":90,"timestamp":...}` |
| Subscribe | `smart-parking/payment/+/paid`         | `{"order_id":"...","amount":15000}` |

## Cara Jalankan di Wokwi

### 1. Buka Wokwi
https://wokwi.com/projects/new/esp32

### 2. Upload file-file ini
- `diagram.json` → drag & drop ke editor
- `sketch.ino` → paste ke editor kode
- `libraries.txt` → Wokwi akan auto-install

### 3. Edit konfigurasi di sketch.ino
```cpp
// Broker MQTT
// Untuk Wokwi (online) → pakai public broker:
const char* MQTT_BROKER = "broker.hivemq.com";

// Untuk broker lokal (Mosquitto) → pakai ngrok:
// 1. Install ngrok: https://ngrok.com
// 2. ngrok tcp 1883
// 3. Salin URL: tcp://x.tcp.ngrok.io:12345
// const char* MQTT_BROKER = "x.tcp.ngrok.io";
// const int   MQTT_PORT   = 12345;

// Gate ID - harus sama dengan UUID gate di database
const char* GATE_ID = "UUID-DARI-DATABASE";
```

### 4. Samakan GATE_ID dengan Database
Lihat UUID gate di Smart Parking → Gate Monitor, atau query:
```sql
SELECT id, name FROM gates;
```
Paste salah satu UUID ke `GATE_ID` di sketch.ino

### 5. Jalankan
Klik ▶ Run di Wokwi. Serial Monitor akan menampilkan:
```
[WiFi] ✓ Connected! IP: 192.168.1.100
[MQTT] ✓ Connected to broker.hivemq.com:1883
[MQTT] Subscribed: smart-parking/gate/xxx/command
✓ Gate controller ready
```

### 6. Test dari Smart Parking UI
Buka halaman **Simulator** → Tab **Gate Simulator** → Klik **Buka**
- MQTT command dikirim ke broker
- ESP32 (Wokwi) menerima → servo bergerak 0° → 90°
- LED hijau menyala, LCD tampilkan "GATE BUKA"
- Setelah 8 detik → auto-close

## Broker Options

| Broker | Alamat | Port | Cocok untuk |
|--------|--------|------|-------------|
| HiveMQ Public | `broker.hivemq.com` | 1883 | Wokwi online ✓ |
| Mosquitto Public | `test.mosquitto.org` | 1883 | Testing |
| Lokal + ngrok | `x.tcp.ngrok.io` | xxxxx | Local dev |
| Lokal langsung | `192.168.1.x` | 1883 | Same network |

## Sambungkan Backend ke Broker yang Sama

Edit `backend/.env`:
```env
# Jika pakai HiveMQ public:
MQTT_BROKER=tcp://broker.hivemq.com:1883

# Jika pakai Mosquitto lokal:
MQTT_BROKER=tcp://localhost:1883
```

Frontend otomatis connect ke WebSocket broker:
- Lokal: `ws://localhost:9001`
- Public HiveMQ: `wss://broker.hivemq.com:8884/mqtt`
