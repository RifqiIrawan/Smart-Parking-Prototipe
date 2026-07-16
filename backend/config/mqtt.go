package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

var MQTTClient mqtt.Client

// MQTT Topics
const (
	TopicGateCommand = "smart-parking/gate/%s/command" // publish: open/close
	TopicGateStatus  = "smart-parking/gate/%s/status"  // subscribe: ESP32 feedback
	TopicPaymentPaid = "smart-parking/payment/%s/paid" // publish: payment confirmed
	TopicSystemLog   = "smart-parking/system/log"      // system events
)

type MQTTMessage struct {
	Event     string                 `json:"event"`
	Timestamp string                 `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

func InitMQTT() mqtt.Client {
	broker := os.Getenv("MQTT_BROKER")
	if broker == "" {
		broker = "tcp://localhost:1883"
	}
	clientID := os.Getenv("MQTT_CLIENT_ID")
	if clientID == "" {
		clientID = "smart-parking-backend"
	}

	opts := mqtt.NewClientOptions().
		AddBroker(broker).
		SetClientID(clientID).
		SetKeepAlive(30 * time.Second).
		SetPingTimeout(10 * time.Second).
		SetAutoReconnect(true).
		SetMaxReconnectInterval(30 * time.Second).
		SetConnectionLostHandler(func(c mqtt.Client, err error) {
			log.Printf("[MQTT] Connection lost: %v", err)
		}).
		SetOnConnectHandler(func(c mqtt.Client) {
			log.Printf("[MQTT] Connected to broker: %s", broker)
			// Subscribe to gate status feedback from ESP32
			c.Subscribe("smart-parking/gate/+/status", 1, handleGateStatus)
		}).
		SetReconnectingHandler(func(c mqtt.Client, opts *mqtt.ClientOptions) {
			log.Printf("[MQTT] Reconnecting to broker...")
		})

	client := mqtt.NewClient(opts)

	token := client.Connect()
	if token.WaitTimeout(10 * time.Second); token.Error() != nil {
		log.Printf("[MQTT] Warning: Could not connect to MQTT broker at %s: %v", broker, token.Error())
		log.Printf("[MQTT] Gate commands will be logged only (no hardware control)")
	}

	MQTTClient = client
	return client
}

func handleGateStatus(client mqtt.Client, msg mqtt.Message) {
	log.Printf("[MQTT] Gate status received on %s: %s", msg.Topic(), string(msg.Payload()))
}

// PublishGateCommand sends open/close command to ESP32 via MQTT
func PublishGateCommand(gateID, gateName, command string) {
	if MQTTClient == nil || !MQTTClient.IsConnected() {
		log.Printf("[MQTT] Not connected. Gate command skipped: gate=%s cmd=%s", gateID, command)
		return
	}

	topic := fmt.Sprintf(TopicGateCommand, gateID)
	payload := map[string]interface{}{
		"command":    command,   // "open" | "close"
		"gate_id":    gateID,
		"gate_name":  gateName,
		"timestamp":  time.Now().Format(time.RFC3339),
		"auto_close": 8,        // seconds before auto-close (ESP32 uses this)
	}

	data, _ := json.Marshal(payload)
	token := MQTTClient.Publish(topic, 1, false, data)
	token.Wait()

	if token.Error() != nil {
		log.Printf("[MQTT] Publish gate command failed: %v", token.Error())
	} else {
		log.Printf("[MQTT] Gate command published: topic=%s payload=%s", topic, string(data))
	}

	// Also log to system topic
	PublishSystemLog("GATE_COMMAND", map[string]interface{}{
		"gate_id":  gateID,
		"command":  command,
	})
}

// PublishPaymentPaid notifies all subscribers that payment was confirmed
func PublishPaymentPaid(orderID string, amount float64, method string) {
	if MQTTClient == nil || !MQTTClient.IsConnected() {
		return
	}

	topic := fmt.Sprintf(TopicPaymentPaid, orderID)
	payload := map[string]interface{}{
		"order_id":  orderID,
		"amount":    amount,
		"method":    method,
		"paid_at":   time.Now().Format(time.RFC3339),
		"status":    "paid",
	}

	data, _ := json.Marshal(payload)
	MQTTClient.Publish(topic, 1, true, data) // retain=true so new subscribers see last status

	log.Printf("[MQTT] Payment paid published: order=%s amount=%.0f", orderID, amount)

	PublishSystemLog("PAYMENT_PAID", payload)
}

// PublishSystemLog sends event to system log topic
func PublishSystemLog(event string, data map[string]interface{}) {
	if MQTTClient == nil || !MQTTClient.IsConnected() {
		return
	}

	msg := MQTTMessage{
		Event:     event,
		Timestamp: time.Now().Format(time.RFC3339),
		Data:      data,
	}
	payload, _ := json.Marshal(msg)
	MQTTClient.Publish(TopicSystemLog, 0, false, payload)
}
