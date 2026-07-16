/**
 * Smart Parking - Gate Controller
 * ESP32 + MQTT + Servo
 *
 * Hardware:
 *   - GPIO 13 → Servo SG90 (gate barrier)
 *   - GPIO 14 → LED Hijau (gate open)
 *   - GPIO 12 → LED Merah (gate closed)
 *   - GPIO 21/22 → LCD I2C (status display)
 *
 * MQTT Topics:
 *   Subscribe: smart-parking/gate/{GATE_ID}/command
 *   Publish:   smart-parking/gate/{GATE_ID}/status
 *   Subscribe: smart-parking/payment/+/paid  (opsional auto-open)
 *
 * Broker: broker.hivemq.com:1883
 *   (ganti ke IP lokal jika broker Mosquitto lokal diakses via ngrok)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ────────────────────────────────────────────────
// KONFIGURASI - UBAH SESUAI KEBUTUHAN
// ────────────────────────────────────────────────

// WiFi (Wokwi menggunakan WiFi virtual)
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// MQTT Broker
// Pilihan:
//   "broker.hivemq.com"          → public broker (untuk Wokwi online)
//   "test.mosquitto.org"         → public broker alternatif
//   "192.168.1.xxx"              → lokal Mosquitto (butuh ngrok untuk Wokwi)
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* MQTT_CLIENT   = "esp32-gate-A";   // harus unik per device

// Gate ID harus sama dengan UUID gate di database
const char* GATE_ID       = "gate-simulator-001";
const char* GATE_NAME     = "Gate A (Wokwi Simulator)";

// GPIO pins
const int PIN_SERVO       = 13;
const int PIN_LED_GREEN   = 14;
const int PIN_LED_RED     = 12;

// Servo angles
const int SERVO_CLOSED    = 0;    // 0° = palang turun (tertutup)
const int SERVO_OPEN      = 90;   // 90° = palang naik (terbuka)

// Auto-close delay (detik)
const int AUTO_CLOSE_SEC  = 8;

// ────────────────────────────────────────────────

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
Servo        gateServo;
LiquidCrystal_I2C lcd(0x27, 16, 2);

char topicCommand[80];
char topicStatus[80];
char topicPayment[80];

bool    isOpen       = false;
int     autoCloseTimer = 0;
unsigned long lastMillis = 0;

// ────────────────────────────────────────────────
// SETUP
// ────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n╔═══════════════════════════════╗");
  Serial.println("║  Smart Parking - Gate ESP32   ║");
  Serial.println("╚═══════════════════════════════╝");

  // GPIO
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  digitalWrite(PIN_LED_RED, HIGH);   // mulai: merah (tutup)
  digitalWrite(PIN_LED_GREEN, LOW);

  // Servo
  gateServo.attach(PIN_SERVO);
  gateServo.write(SERVO_CLOSED);

  // LCD
  lcd.init();
  lcd.backlight();
  lcdShow("Smart Parking", "Initializing...");

  // Build MQTT topics
  snprintf(topicCommand, sizeof(topicCommand), "smart-parking/gate/%s/command", GATE_ID);
  snprintf(topicStatus,  sizeof(topicStatus),  "smart-parking/gate/%s/status",  GATE_ID);
  snprintf(topicPayment, sizeof(topicPayment), "smart-parking/payment/+/paid");

  // Connect WiFi
  connectWifi();

  // Connect MQTT
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);
  connectMQTT();

  lcdShow("Gate: " + String(GATE_NAME).substring(0, 13), "Status: TUTUP");
  Serial.println("✓ Gate controller ready");
  Serial.printf("  Topic CMD: %s\n", topicCommand);
  Serial.printf("  Topic STA: %s\n", topicStatus);
}

// ────────────────────────────────────────────────
// LOOP
// ────────────────────────────────────────────────

void loop() {
  if (!mqtt.connected()) {
    connectMQTT();
  }
  mqtt.loop();

  // Auto-close timer (countdown tiap detik)
  if (isOpen && autoCloseTimer > 0) {
    if (millis() - lastMillis >= 1000) {
      lastMillis = millis();
      autoCloseTimer--;
      Serial.printf("[AUTO-CLOSE] %d detik lagi...\n", autoCloseTimer);

      char buf[16];
      snprintf(buf, sizeof(buf), "Tutup dlm: %ds", autoCloseTimer);
      lcdShow("Gate: BUKA", buf);

      if (autoCloseTimer == 0) {
        Serial.println("[AUTO-CLOSE] Menutup gate...");
        closeGate("auto_timeout");
      }
    }
  }
}

// ────────────────────────────────────────────────
// MQTT CALLBACK
// ────────────────────────────────────────────────

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  String msg = "";
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }

  Serial.printf("\n[MQTT IN] Topic: %s\n[MQTT IN] Payload: %s\n", topic, msg.c_str());

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) {
    Serial.printf("[MQTT] JSON parse error: %s\n", err.c_str());
    return;
  }

  // ── Gate Command ──
  if (topicStr.indexOf("/command") >= 0) {
    const char* command   = doc["command"]   | "close";
    int         autoClose = doc["auto_close"] | AUTO_CLOSE_SEC;

    if (strcmp(command, "open") == 0) {
      openGate(autoClose);
    } else if (strcmp(command, "close") == 0) {
      closeGate("manual");
    }
  }

  // ── Payment Paid → Auto Open ──
  if (topicStr.indexOf("/paid") >= 0) {
    const char* orderID = doc["order_id"] | "";
    float amount        = doc["amount"]   | 0.0f;
    Serial.printf("[PAYMENT] Order %s dibayar: Rp %.0f → Membuka gate\n", orderID, amount);

    char line2[17];
    snprintf(line2, sizeof(line2), "Rp %.0f LUNAS", amount);
    lcdShow("BAYAR SUKSES!", line2);
    delay(2000);
    openGate(AUTO_CLOSE_SEC);
  }
}

// ────────────────────────────────────────────────
// GATE CONTROL
// ────────────────────────────────────────────────

void openGate(int autoCloseSecs) {
  if (isOpen) {
    Serial.println("[GATE] Sudah terbuka, reset timer");
    autoCloseTimer = autoCloseSecs;
    return;
  }

  Serial.printf("[GATE] MEMBUKA → servo %d°\n", SERVO_OPEN);

  // Gerakkan servo perlahan (smooth)
  int current = gateServo.read();
  for (int angle = current; angle <= SERVO_OPEN; angle += 2) {
    gateServo.write(angle);
    delay(20);
  }
  gateServo.write(SERVO_OPEN);

  isOpen         = true;
  autoCloseTimer = autoCloseSecs;
  lastMillis     = millis();

  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED,   LOW);

  lcdShow(">> GATE BUKA <<", "Silakan masuk!");
  Serial.println("[GATE] ✓ Terbuka");

  // Publish status
  publishStatus("open", SERVO_OPEN);
}

void closeGate(const char* reason) {
  Serial.printf("[GATE] MENUTUP (reason: %s) → servo %d°\n", reason, SERVO_CLOSED);

  // Gerakkan servo perlahan (smooth)
  int current = gateServo.read();
  for (int angle = current; angle >= SERVO_CLOSED; angle -= 2) {
    gateServo.write(angle);
    delay(20);
  }
  gateServo.write(SERVO_CLOSED);

  isOpen         = false;
  autoCloseTimer = 0;

  digitalWrite(PIN_LED_RED,   HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);

  lcdShow("Gate: TUTUP", "Tap kartu/bayar");
  Serial.println("[GATE] ✓ Tertutup");

  // Publish status
  publishStatus("closed", SERVO_CLOSED);
}

void publishStatus(const char* status, int angle) {
  StaticJsonDocument<200> doc;
  doc["gate_id"]   = GATE_ID;
  doc["gate_name"] = GATE_NAME;
  doc["status"]    = status;
  doc["angle"]     = angle;
  doc["timestamp"] = millis();

  char buf[200];
  serializeJson(doc, buf);
  mqtt.publish(topicStatus, buf, true); // retain=true

  Serial.printf("[MQTT OUT] %s → %s\n", topicStatus, buf);
}

// ────────────────────────────────────────────────
// WiFi & MQTT CONNECTION
// ────────────────────────────────────────────────

void connectWifi() {
  Serial.printf("[WiFi] Connecting to %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] ✓ Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] ✗ Failed (offline mode)");
  }
}

void connectMQTT() {
  int tries = 0;
  while (!mqtt.connected() && tries < 5) {
    Serial.printf("[MQTT] Connecting to %s:%d as %s...\n", MQTT_BROKER, MQTT_PORT, MQTT_CLIENT);

    if (mqtt.connect(MQTT_CLIENT)) {
      Serial.println("[MQTT] ✓ Connected!");

      // Subscribe topics
      mqtt.subscribe(topicCommand, 1);
      mqtt.subscribe(topicPayment, 1);

      Serial.printf("[MQTT] Subscribed: %s\n", topicCommand);
      Serial.printf("[MQTT] Subscribed: %s\n", topicPayment);

      // Announce online
      publishStatus("online", isOpen ? SERVO_OPEN : SERVO_CLOSED);
      lcdShow("MQTT Terhubung", MQTT_BROKER);
      delay(1500);
    } else {
      Serial.printf("[MQTT] ✗ Failed rc=%d, retry in 3s\n", mqtt.state());
      delay(3000);
    }
    tries++;
  }
}

// ────────────────────────────────────────────────
// LCD HELPER
// ────────────────────────────────────────────────

void lcdShow(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}
