import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';

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

const DEFAULT_BROKER  = 'ws://localhost:9002';
const FALLBACK_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

export function useMQTT({
  broker = DEFAULT_BROKER,
  topics = [],
  onMessage,
  enabled = true,
}: UseMQTTOptions = {}) {
  const clientRef    = useRef<MqttClientType | null>(null);
  const topicsRef    = useRef(topics);    // FIX: stable ref — avoid infinite reconnect
  const onMessageRef = useRef(onMessage); // FIX: stable ref — avoid re-subscribe
  topicsRef.current    = topics;
  onMessageRef.current = onMessage;

  const [status, setStatus] = useState<MQTTStatus>({
    connected: false, connecting: false, error: null, broker,
  });
  const [messages, setMessages] = useState<MQTTMessage[]>([]);

  // Stable message handler using ref
  const handleMessage = useCallback((topic: string, rawPayload: Buffer) => {
    try {
      const payload = JSON.parse(rawPayload.toString()) as Record<string, unknown>;
      const msg: MQTTMessage = { topic, payload, timestamp: new Date() };
      setMessages(prev => [msg, ...prev].slice(0, 100));
      onMessageRef.current?.(topic, payload);
    } catch {
      // ignore non-JSON
    }
  }, []); // no deps — uses ref

  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectTo = useCallback((brokerUrl: string, isFallback = false) => {
    clientRef.current?.end(true);
    clientRef.current = null;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    setStatus(s => ({ ...s, connecting: true, error: null, broker: brokerUrl }));

    const client = mqtt.connect(brokerUrl, {
      clientId: `sp-ui-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 10000,
      connectTimeout: 8000,
    });

    let settled = false;
    const triggerFallback = () => {
      if (settled || isFallback) return;
      settled = true;
      connectTo(FALLBACK_BROKER, true);
    };

    // FIX: mqtt.js doesn't reliably emit 'error' on a plain connection-refused
    // (e.g. nothing listening on the port) — it just loops 'close'/'reconnect'
    // against the same broker forever, so the UI got stuck on "connecting"
    // and the fallback below never ran. Force the fallback on a timer too.
    if (!isFallback) {
      fallbackTimerRef.current = setTimeout(triggerFallback, 6000);
    }

    client.on('connect', () => {
      settled = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setStatus({ connected: true, connecting: false, error: null, broker: brokerUrl });
      const t = topicsRef.current;
      if (t.length > 0) client.subscribe(t, { qos: 1 });
    });

    client.on('error', (err) => {
      setStatus(s => ({ ...s, connecting: false, error: err.message }));
      triggerFallback();
    });

    client.on('offline', () => setStatus(s => ({ ...s, connected: false })));
    client.on('reconnect', () => setStatus(s => ({ ...s, connecting: true })));
    client.on('message', handleMessage);

    clientRef.current = client;
  }, [handleMessage]); // FIX: only depends on stable handleMessage

  useEffect(() => {
    if (!enabled) return;
    connectTo(broker);
    return () => {
      clientRef.current?.end(true);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); // FIX: only re-run when enabled changes, not on every broker/topics change

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
  const reconnect     = useCallback(() => connectTo(DEFAULT_BROKER), [connectTo]);

  return { status, messages, publish, subscribe, unsubscribe, clearMessages, reconnect };
}
