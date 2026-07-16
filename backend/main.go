package main

import (
	"log"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/routes"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment")
	}

	// Connect to database
	db := config.InitDB()
	defer db.Close()

	// Connect to MQTT broker
	mqttClient := config.InitMQTT()
	if mqttClient != nil && mqttClient.IsConnected() {
		log.Println("MQTT broker connected ✓")
		defer mqttClient.Disconnect(250)
	} else {
		log.Println("MQTT broker not connected (hardware control disabled)")
	}

	// Start HTTP server
	r := routes.SetupRouter(db)
	log.Println("Smart Parking API starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Server failed:", err)
	}
}
