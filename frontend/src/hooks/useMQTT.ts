import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';

// Use mqtt.MqttClient from the default export namespace
type MqttClientType = InstanceType<typeof mqtt.MqttClient>;

export interface MQTTMessage {
  topic: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface MQTTStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  broker: string;
}

export interface UseMQTTOptions {
  broker?: string;
  topics?: string[];
  onMessage?: (topic: string, payload: Record<string, unknown>) => void;
  enabled?: boolean;
}

const DEFAULT_BROKER = 'ws://localhost:9001';
const FALLBACK_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

export function useMQTT({
  broker = DEFAULT_BROKER,
  topics = [],
  onMessage,
  enabled = true,
}: UseMQTTOptions = {}) {
  const clientRef = useRef<MqttClientType | null>(null);
  const [status, setStatus] = useState<MQTTStatus>({
    connected: false,
    connecting: false,
    error: null,
    broker,
  });
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const addMessage = useCallback((topic: string, rawPayload: Buffer) => {
    try {
      const payload = JSON.parse(rawPayload.toString()) as Record<string, unknown>;
      const msg: MQTTMessage = { topic, payload, timestamp: new Date() };
      setMessages(prev => [msg, ...prev].slice(0, 100));
      onMessageRef.current?.(topic, payload);
    } catch {
      // ignore non-JSON
    }
  }, []);

  const connect = useCallback((brokerUrl: string, isFallback = false) => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }

    setStatus(s => ({ ...s, connecting: true, error: null, broker: brokerUrl }));

    const client = mqtt.connect(brokerUrl, {
      clientId: `smart-parking-ui-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: isFallback ? 10000 : 5000,
      connectTimeout: 8000,
    });

    client.on('connect', () => {
      setStatus({ connected: true, connecting: false, error: null, broker: brokerUrl });
      if (topics.length > 0) {
        client.subscribe(topics, { qos: 1 });
      }
    });

    client.on('error', (err) => {
      setStatus(s => ({ ...s, connecting: false, error: err.message }));
      if (!isFallback) {
        client.end(true);
        setTimeout(() => connect(FALLBACK_BROKER, true), 1000);
      }
    });

    client.on('offline', () => {
      setStatus(s => ({ ...s, connected: false }));
    });

    client.on('reconnect', () => {
      setStatus(s => ({ ...s, connecting: true }));
    });

    client.on('message', addMessage);
    clientRef.current = client;
  }, [topics, addMessage]);

  useEffect(() => {
    if (!enabled) return;
    connect(broker);
    return () => { clientRef.current?.end(true); };
  }, [enabled, connect, broker]);

  const subscribe = useCallback((topic: string | string[]) => {
    clientRef.current?.subscribe(topic, { qos: 1 });
  }, []);

  const unsubscribe = useCallback((topic: string | string[]) => {
    clientRef.current?.unsubscribe(topic);
  }, []);

  const publish = useCallback((topic: string, payload: Record<string, unknown>) => {
    if (!clientRef.current?.connected) return false;
    clientRef.current.publish(topic, JSON.stringify(payload), { qos: 1 });
    return true;
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const reconnect = useCallback(() => connect(DEFAULT_BROKER), [connect]);

  return { status, messages, publish, subscribe, unsubscribe, clearMessages, reconnect };
}
