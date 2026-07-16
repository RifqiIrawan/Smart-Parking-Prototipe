#!/bin/bash
# Start Eclipse Mosquitto MQTT Broker

echo "================================================"
echo " Eclipse Mosquitto MQTT Broker"
echo " TCP  : mqtt://localhost:1883"
echo " WS   : ws://localhost:9001  (for browser)"
echo "================================================"

# Install if not found
if ! command -v mosquitto &> /dev/null; then
    echo "Installing Mosquitto..."
    sudo apt-get update -q && sudo apt-get install -y mosquitto mosquitto-clients
fi

# Kill existing
pkill -f mosquitto 2>/dev/null

# Start with config
mosquitto -c "$(dirname "$0")/mosquitto.conf" -v

echo "Mosquitto stopped."
