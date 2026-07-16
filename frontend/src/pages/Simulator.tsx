import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, Wifi, WifiOff, Zap, QrCode, DoorOpen, DoorClosed,
  CheckCircle, Clock, AlertCircle, Terminal, Trash2, RefreshCw,
  ChevronRight, Radio
} from 'lucide-react';
import { useMQTT } from '../hooks/useMQTT';
import apiClient, { vehicleEntry, vehicleExit } from '../api/client';
import { createPayment, checkPaymentStatus, simulatePayment } from '../api/payment';
import type { PaymentData } from '../api/payment';

// ──────────────────────────────────────────────────────────
// Auto Demo — simulates camera/RFID detection + a self-paying
// customer so the full cycle runs with zero clicks and zero hardware.
// ──────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const randomPlate = () => {
  const prefixes = ['B', 'D', 'F', 'L', 'AB', 'BE'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const numbers = Math.floor(1000 + Math.random() * 9000);
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `${prefix}${numbers}${letters}`;
};

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface Gate {
  id: string;
  name: string;
  type: string;
  status: string;
  location: string;
}

interface LogEntry {
  id: number;
  time: string;
  source: 'mqtt' | 'api' | 'system';
  topic?: string;
  event: string;
  detail: string;
  ok: boolean;
}

// ──────────────────────────────────────────────────────────
// Gate Visualizer Component
// ──────────────────────────────────────────────────────────

const GateVisualizer: React.FC<{
  gate: Gate;
  isOpen: boolean;
  angle: number;
  onOpen: () => void;
  onClose: () => void;
  loading: boolean;
}> = ({ gate, isOpen, angle, onOpen, onClose, loading }) => {
  const poleHeight = 100;
  const barrierWidth = 110;
  const rad = (angle * Math.PI) / 180;

  // Barrier endpoint based on servo angle
  const bx = Math.cos(rad - Math.PI / 2) * barrierWidth;
  const by = Math.sin(rad - Math.PI / 2) * barrierWidth;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${isOpen ? 'var(--accent-green)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: '1.25rem',
      transition: 'border-color 0.4s',
      minWidth: 240,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)' }}>{gate.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{gate.location}</div>
        </div>
        <span className={`badge badge-${isOpen ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>
          {isOpen ? '● BUKA' : '● TUTUP'}
        </span>
      </div>

      {/* SVG Gate Animation */}
      <svg width="200" height="160" viewBox="0 0 200 160" style={{ display: 'block', margin: '0 auto' }}>
        {/* Road */}
        <rect x="0" y="100" width="200" height="60" fill="#1a1f2e" rx="0" />
        <rect x="88" y="105" width="24" height="50" fill="#38bdf810" rx="2" />

        {/* Lane markings */}
        <line x1="80" y1="120" x2="120" y2="120" stroke="#ffffff15" strokeWidth="1" strokeDasharray="8,8" />

        {/* Pole */}
        <rect x="88" y={100 - poleHeight} width="10" height={poleHeight} fill="#334155" rx="3" />

        {/* Pivot point */}
        <circle cx="93" cy={100 - poleHeight + 8} r="5" fill="#64748b" />

        {/* Barrier arm (rotates from pivot) */}
        <g transform={`translate(93, ${100 - poleHeight + 8})`}>
          <line
            x1="0" y1="0"
            x2={bx} y2={by}
            stroke={isOpen ? '#22c55e' : '#ef4444'}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ transition: 'all 0.6s ease' }}
          />
          {/* Stripes on barrier */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={bx * (t - 0.05)} y1={by * (t - 0.05)}
              x2={bx * (t + 0.05)} y2={by * (t + 0.05)}
              stroke="#fff3"
              strokeWidth="6"
            />
          ))}
          {/* End cap */}
          <circle cx={bx} cy={by} r="5" fill={isOpen ? '#22c55e' : '#ef4444'} style={{ transition: 'fill 0.4s' }} />
        </g>

        {/* LED indicator */}
        <circle cx="165" cy="30" r="10" fill={isOpen ? '#22c55e' : '#ef4444'}
          style={{ filter: `drop-shadow(0 0 6px ${isOpen ? '#22c55e' : '#ef4444'})`, transition: 'fill 0.4s' }} />
        <text x="165" y="50" textAnchor="middle" fill="#94a3b8" fontSize="9">{isOpen ? 'OPEN' : 'CLOSE'}</text>

        {/* Servo angle label */}
        <text x="140" y="115" fill="#64748b" fontSize="9">{Math.round(angle)}° servo</text>
      </svg>

      {/* Control buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-success"
          onClick={onOpen}
          disabled={loading || isOpen}
          style={{ flex: 1, fontSize: 12, padding: '0.4rem' }}
        >
          <DoorOpen size={14} /> Buka
        </button>
        <button
          className="btn btn-danger"
          onClick={onClose}
          disabled={loading || !isOpen}
          style={{ flex: 1, fontSize: 12, padding: '0.4rem' }}
        >
          <DoorClosed size={14} /> Tutup
        </button>
      </div>

      {/* MQTT info */}
      <div style={{ marginTop: 10, fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
        📡 smart-parking/gate/{gate.id.slice(0, 8)}…/command
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// QRIS Payment Modal Component
// ──────────────────────────────────────────────────────────

const QRISModal: React.FC<{
  payment: PaymentData;
  onPaid: () => void;
  onClose: () => void;
}> = ({ payment, onPaid, onClose }) => {
  const [status, setStatus] = useState<'pending' | 'paid' | 'simulating'>('pending');
  const [countdown, setCountdown] = useState(900); // 15 min
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll payment status every 3 seconds (skip mock/demo orders)
  useEffect(() => {
    if (status === 'paid') return;
    if (payment.order_id.startsWith('SP-DEMO') || !payment.use_midtrans) return; // skip mock

    pollRef.current = setInterval(async () => {
      try {
        const s = await checkPaymentStatus(payment.order_id);
        if (s.status === 'paid') {
          setStatus('paid');
          clearInterval(pollRef.current!);
          setTimeout(onPaid, 2000);
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => clearInterval(pollRef.current!);
  }, [payment.order_id, payment.use_midtrans, status]);

  const handleSimulate = async () => {
    setStatus('simulating');
    try {
      await simulatePayment(payment.order_id);
      setStatus('paid');
      clearInterval(pollRef.current!);
      setTimeout(onPaid, 2000);
    } catch (e) {
      setStatus('pending');
    }
  };

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');

  const isSimulatorMode = !payment.use_midtrans;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 420,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {status === 'paid' ? (
          /* ── Success State ── */
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#22c55e22', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
              animation: 'pulse 1s ease-out',
            }}>
              <CheckCircle size={44} color="#22c55e" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-display)' }}>
              PEMBAYARAN BERHASIL
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              Rp {payment.amount.toLocaleString('id')}
            </div>
            <div style={{ marginTop: 16, color: '#38bdf8', fontSize: 13 }}>
              🚀 Gate terbuka via MQTT…
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>Pembayaran QRIS</div>
                {isSimulatorMode && (
                  <div style={{
                    fontSize: 10, background: '#f59e0b22', color: '#f59e0b',
                    padding: '2px 8px', borderRadius: 4, marginTop: 4,
                  }}>
                    ⚡ MODE SIMULATOR
                  </div>
                )}
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Amount */}
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem',
              textAlign: 'center', marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Bayar</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)' }}>
                Rp {payment.amount.toLocaleString('id')}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Order: {payment.order_id}</div>
            </div>

            {/* QR Code */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: '1.25rem',
              display: 'flex', justifyContent: 'center', marginBottom: '1rem',
              position: 'relative',
            }}>
              {payment.qr_image_url ? (
                <img
                  src={payment.qr_image_url}
                  alt="QRIS"
                  width={220}
                  height={220}
                  style={{ borderRadius: 8, display: 'block' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.qr_string || payment.order_id)}&bgcolor=ffffff&color=000000&margin=16`;
                  }}
                />
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.qr_string || payment.order_id)}&bgcolor=ffffff&color=0a0e1a&margin=16`}
                  alt="QRIS Code"
                  width={220}
                  height={220}
                  style={{ borderRadius: 8 }}
                />
              )}
              {/* QRIS label */}
              <div style={{
                position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                background: '#ef4444', color: '#fff', padding: '2px 10px',
                borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              }}>
                QRIS
              </div>
            </div>

            {/* Instructions */}
            <div style={{
              background: '#38bdf808', border: '1px solid #38bdf820',
              borderRadius: 8, padding: '0.75rem', fontSize: 12,
              color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6,
            }}>
              {payment.payment_instructions || 'Scan QR menggunakan aplikasi e-wallet Anda'}
            </div>

            {/* Countdown + polling status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f59e0b' }}>
                <Clock size={14} />
                Berlaku: {mins}:{secs}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#38bdf8',
                  animation: 'pulse 1.5s infinite',
                }} />
                Menunggu konfirmasi…
              </div>
            </div>

            {/* Simulate button (always shown for demo) */}
            <button
              className="btn btn-primary"
              onClick={handleSimulate}
              disabled={status === 'simulating'}
              style={{ width: '100%', gap: 8, justifyContent: 'center' }}
            >
              {status === 'simulating' ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  Memproses…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  {isSimulatorMode ? '⚡ Simulasikan Pembayaran Berhasil' : '🧪 Simulasi (Testing)'}
                </>
              )}
            </button>

            {payment.simulator_url && !isSimulatorMode && (
              <a
                href={payment.simulator_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', textAlign: 'center', marginTop: 10,
                  fontSize: 12, color: '#64748b', textDecoration: 'underline',
                }}
              >
                Buka Midtrans Simulator →
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// Main Simulator Page
// ──────────────────────────────────────────────────────────

const MQTT_TOPICS = [
  'smart-parking/gate/+/command',
  'smart-parking/gate/+/status',
  'smart-parking/payment/+/paid',
  'smart-parking/system/log',
];

let logId = 0;

export const Simulator: React.FC = () => {
  const [gates, setGates] = useState<Gate[]>([]);
  const [gateStates, setGateStates] = useState<Record<string, { open: boolean; angle: number }>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [gateLoading, setGateLoading] = useState<Record<string, boolean>>({});
  const [activePayment, setActivePayment] = useState<PaymentData | null>(null);
  const [activeTab, setActiveTab] = useState<'gates' | 'payment' | 'wokwi' | 'auto'>('gates');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLoop, setAutoLoop] = useState(false);
  const [autoStage, setAutoStage] = useState('');
  const autoLoopRef = useRef(false);
  const autoRunningRef = useRef(false);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
    setLogs(prev => [{
      ...entry,
      id: logId++,
      time: new Date().toLocaleTimeString('id-ID'),
    }, ...prev].slice(0, 80));
  }, []);

  // MQTT hook
  const { status: mqttStatus, messages, clearMessages, reconnect, publish } = useMQTT({
    topics: MQTT_TOPICS,
    onMessage: (topic, payload) => {
      // Parse gate status from ESP32
      if (topic.includes('/status')) {
        const mqttGateId = (payload.gate_id as string) || topic.split('/')[2];
        const isOpen = payload.status === 'open';
        const angle = (payload.angle as number) ?? (isOpen ? 90 : 0);

        // Update by MQTT gate_id directly (could be UUID or custom like "gate-simulator-001")
        setGateStates(prev => ({ ...prev, [mqttGateId]: { open: isOpen, angle } }));

        // Also try to sync DB gates: match by id prefix OR by mqtt_gate_id field
        setGates(prev => {
          // Find gate whose UUID starts with mqttGateId, or mqttGateId starts with gate UUID prefix
          const match = prev.find(g =>
            g.id === mqttGateId ||
            g.id.startsWith(mqttGateId) ||
            mqttGateId.startsWith(g.id.slice(0, 8))
          );
          if (match) {
            setGateStates(gs => ({ ...gs, [match.id]: { open: isOpen, angle } }));
          }
          return prev;
        });

        addLog({
          source: 'mqtt',
          topic,
          event: `Gate ${isOpen ? 'BUKA' : 'TUTUP'}`,
          detail: `ESP32 → angle=${angle}°`,
          ok: true,
        });
      }

      if (topic.includes('/paid')) {
        addLog({
          source: 'mqtt',
          topic,
          event: 'PEMBAYARAN DIKONFIRMASI',
          detail: `Rp ${((payload.amount as number) || 0).toLocaleString('id')} via ${payload.method || 'qris'}`,
          ok: true,
        });
      }

      if (topic.includes('/command')) {
        addLog({
          source: 'mqtt',
          topic,
          event: `Perintah Gate: ${payload.command}`,
          detail: `→ ${payload.gate_name || topic.split('/')[2]}`,
          ok: true,
        });
      }
    },
  });

  // Load gates
  useEffect(() => {
    apiClient.get('/gates').then(res => {
      const g = res.data.data || [];
      setGates(g);
      const states: Record<string, { open: boolean; angle: number }> = {};
      g.forEach((gate: Gate) => {
        states[gate.id] = { open: gate.status === 'open', angle: gate.status === 'open' ? 90 : 0 };
      });
      setGateStates(states);
    });
  }, []);

  const controlGate = async (gateId: string, command: 'open' | 'close') => {
    setGateLoading(prev => ({ ...prev, [gateId]: true }));
    try {
      const res = await apiClient.post(`/gate/${command}`, { gate_id: gateId, command });
      const data = res.data.data;

      // Optimistic update
      setGateStates(prev => ({
        ...prev,
        [gateId]: { open: command === 'open', angle: command === 'open' ? 90 : 0 },
      }));

      addLog({
        source: 'api',
        event: `Gate ${command.toUpperCase()} via API`,
        detail: `MQTT → ${data?.mqtt || 'smart-parking/gate/.../command'}`,
        ok: true,
      });

      // Also publish directly to MQTT for extra reliability
      const gate = gates.find(g => g.id === gateId);
      publish(`smart-parking/gate/${gateId}/command`, {
        command,
        gate_id: gateId,
        gate_name: gate?.name || 'Gate',
        timestamp: new Date().toISOString(),
        auto_close: command === 'open' ? 8 : 0,
      });

    } catch (e: unknown) {
      addLog({
        source: 'api',
        event: 'Error kontrol gate',
        detail: (e as Error).message,
        ok: false,
      });
    } finally {
      setGateLoading(prev => ({ ...prev, [gateId]: false }));
    }
  };

  const startPaymentDemo = async () => {
    // Get first active transaction or create demo payment
    try {
      const txRes = await apiClient.get('/transactions?status=active&limit=1');
      const txList = txRes.data.data || [];

      let transactionId = '';

      if (txList.length > 0) {
        transactionId = txList[0].id;
      } else {
        addLog({ source: 'system', event: 'Demo', detail: 'Tidak ada transaksi aktif. Menggunakan mock transaction.', ok: false });
        // Create minimal mock payment for demo
        const pd: PaymentData = {
          payment_id: 'demo-' + Date.now(),
          order_id: 'SP-DEMO-' + Date.now(),
          amount: 15000,
          method: 'qris',
          expired_at: new Date(Date.now() + 15 * 60000).toISOString(),
          status: 'pending',
          use_midtrans: false,
          mode: 'simulator',
          qr_string: 'DEMO-QRIS-' + Date.now(),
          payment_instructions: '[MODE SIMULATOR] Tidak ada transaksi aktif. Klik Simulasikan untuk demo.',
        };
        setActivePayment(pd);
        return;
      }

      const payment = await createPayment({
        transaction_id: transactionId,
        payment_method: 'qris',
      });

      setActivePayment(payment);
      addLog({
        source: 'api',
        event: 'QRIS Dibuat',
        detail: `Order: ${payment.order_id} | Rp ${payment.amount.toLocaleString('id')}`,
        ok: true,
      });
    } catch (e: unknown) {
      addLog({ source: 'api', event: 'Error buat payment', detail: (e as Error).message, ok: false });
    }
  };

  const onPaymentPaid = () => {
    addLog({ source: 'system', event: '✅ Pembayaran Lunas', detail: 'Gate exit akan terbuka otomatis', ok: true });
    setActivePayment(null);
    // Refresh gate states
    apiClient.get('/gates').then(res => {
      const g = res.data.data || [];
      const states: Record<string, { open: boolean; angle: number }> = {};
      g.forEach((gate: Gate) => {
        states[gate.id] = { open: gate.status === 'open', angle: gate.status === 'open' ? 90 : 0 };
      });
      setGateStates(states);
    });
  };

  const refreshGates = async () => {
    const res = await apiClient.get('/gates');
    const g = res.data.data || [];
    setGates(g);
    const states: Record<string, { open: boolean; angle: number }> = {};
    g.forEach((gate: Gate) => {
      states[gate.id] = { open: gate.status === 'open', angle: gate.status === 'open' ? 90 : 0 };
    });
    setGateStates(states);
    return g as Gate[];
  };

  // Runs the full masuk → parkir → keluar → bayar → gate cycle with zero
  // clicks, standing in for hardware that doesn't exist yet: a random plate
  // simulates the camera/RFID reader, and an auto-simulated payment stands
  // in for a customer paying with their own e-wallet.
  const runAutoDemo = async () => {
    if (autoRunningRef.current) return;
    autoRunningRef.current = true;
    setAutoRunning(true);

    try {
      const currentGates = gates.length > 0 ? gates : await refreshGates();
      const entryGate = currentGates.find(g => g.type === 'entry');
      const exitGate = currentGates.find(g => g.type === 'exit');
      if (!entryGate || !exitGate) {
        addLog({ source: 'system', event: 'Demo Otomatis gagal', detail: 'Gate masuk/keluar belum ada di database', ok: false });
        return;
      }

      const plate = randomPlate();

      // 1. Simulated camera/RFID detection at entry
      setAutoStage('📷 Mendeteksi kendaraan di gate masuk...');
      addLog({ source: 'system', event: '📷 [SIMULASI KAMERA] Plat terdeteksi', detail: `${plate} di ${entryGate.name}`, ok: true });
      await sleep(1200);

      const entryRes = await vehicleEntry({ plate_number: plate, vehicle_type: 'car', gate_id: entryGate.id });
      const ticketNumber = entryRes.data.data.ticket_number as string;
      addLog({ source: 'api', event: 'Kendaraan masuk', detail: `Tiket ${ticketNumber} · Gate ${entryGate.name} terbuka`, ok: true });
      await refreshGates();

      // 2. Simulated parking duration
      setAutoStage('🅿️ Kendaraan sedang parkir...');
      addLog({ source: 'system', event: '🅿️ Kendaraan parkir', detail: 'Menunggu (disingkat untuk demo)...', ok: true });
      await sleep(4000);

      // 3. Simulated camera/RFID detection at exit — looked up by PLATE, not ticket
      setAutoStage('📷 Mendeteksi kendaraan di gate keluar...');
      addLog({ source: 'system', event: '📷 [SIMULASI KAMERA] Plat terdeteksi', detail: `${plate} di ${exitGate.name}`, ok: true });
      await sleep(1200);

      const exitRes = await vehicleExit({ ticket_number: '', plate_number: plate, gate_id: exitGate.id });
      const exitData = exitRes.data.data;
      const transactionId = exitData.transaction.id as string;
      const totalAmount = exitData.total_amount as number;
      addLog({
        source: 'api', event: 'Tarif dihitung (cari otomatis via plat, tanpa tiket)',
        detail: `Rp ${totalAmount.toLocaleString('id')} · durasi ${exitData.duration_minutes} menit`, ok: true,
      });

      // 4. Auto-create payment
      setAutoStage('💳 Membuat tagihan QRIS...');
      const payment = await createPayment({ transaction_id: transactionId, payment_method: 'qris' });
      addLog({ source: 'api', event: 'QRIS dibuat', detail: `Order ${payment.order_id} · Rp ${payment.amount.toLocaleString('id')}`, ok: true });

      // 5. Simulated self-service payment (stands in for customer scanning with their own e-wallet)
      setAutoStage('⏳ Menunggu pembayaran (simulasi customer bayar sendiri)...');
      addLog({ source: 'system', event: '⏳ Menunggu pembayaran', detail: 'Simulasi: customer scan & bayar via e-wallet sendiri...', ok: true });
      await sleep(2500);

      await simulatePayment(payment.order_id);
      addLog({ source: 'api', event: '✅ Pembayaran berhasil', detail: `Rp ${totalAmount.toLocaleString('id')} · Gate keluar terbuka otomatis`, ok: true });
      setAutoStage('🚧 Gate keluar terbuka...');
      await refreshGates();

      // 6. Wait for the backend's auto-close (10s) then confirm visually
      await sleep(10500);
      await refreshGates();
      setAutoStage('✅ Siklus selesai — gate tertutup kembali');
      addLog({ source: 'system', event: '✅ Siklus otomatis selesai', detail: `${plate} · tiket ${ticketNumber} · Rp ${totalAmount.toLocaleString('id')}`, ok: true });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error).message;
      addLog({ source: 'system', event: 'Demo Otomatis error', detail: msg, ok: false });
      setAutoStage('');
    } finally {
      autoRunningRef.current = false;
      setAutoRunning(false);
      if (autoLoopRef.current) {
        setTimeout(() => runAutoDemo(), 1500);
      } else {
        setAutoStage('');
      }
    }
  };

  const toggleAutoLoop = () => {
    const next = !autoLoop;
    setAutoLoop(next);
    autoLoopRef.current = next;
    if (next && !autoRunningRef.current) {
      runAutoDemo();
    }
  };

  // ──────────────────────────────────
  // Render
  // ──────────────────────────────────

  const mqttConnected = mqttStatus.connected;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 4 }}>
          ⚡ Simulator
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Simulasi MQTT gate control + Midtrans QRIS + Wokwi ESP32
        </p>
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12, marginBottom: '1.5rem',
      }}>
        {/* MQTT Status */}
        <div style={{
          background: 'var(--bg-secondary)', border: `1px solid ${mqttConnected ? 'var(--accent-green)' : '#ef444440'}`,
          borderRadius: 10, padding: '0.875rem', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {mqttConnected
            ? <Wifi size={20} color="#22c55e" />
            : <WifiOff size={20} color="#ef4444" />
          }
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>MQTT Broker</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: mqttConnected ? '#22c55e' : '#ef4444' }}>
              {mqttConnected ? 'TERHUBUNG' : (mqttStatus.connecting ? 'Menghubungkan…' : 'TERPUTUS')}
            </div>
            <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>
              {mqttStatus.broker.replace('wss://', '').replace('ws://', '')}
            </div>
          </div>
          {!mqttConnected && (
            <button onClick={reconnect} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* Midtrans Status */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '0.875rem', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <QrCode size={20} color="#38bdf8" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Payment Gateway</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Midtrans Sandbox</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>QRIS · VA · E-Wallet</div>
          </div>
        </div>

        {/* Wokwi Status */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '0.875rem', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Radio size={20} color="#a78bfa" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Hardware Simulator</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Wokwi ESP32</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Servo + LED + LCD</div>
          </div>
          <a
            href="https://wokwi.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: 10, color: '#a78bfa', textDecoration: 'none' }}
          >
            Buka →
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
        {([
          { id: 'auto', label: '🚀 Demo Otomatis' },
          { id: 'gates', label: '🚧 Gate Simulator' },
          { id: 'payment', label: '💳 Payment QRIS' },
          { id: 'wokwi', label: '🤖 Wokwi Setup' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.5rem 1rem', fontSize: 13,
              color: activeTab === tab.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              marginBottom: -1, fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Left Panel */}
        <div>
          {/* ── AUTO DEMO TAB ── */}
          {activeTab === 'auto' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                  Siklus Penuh Tanpa Petugas &amp; Tanpa Hardware
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Satu klik menjalankan seluruh alur secara otomatis: kamera/RFID (disimulasikan) mendeteksi
                  plat di gate masuk → kendaraan parkir → terdeteksi lagi di gate keluar (dicari otomatis lewat
                  plat, bukan nomor tiket) → tagihan dibuat → customer &ldquo;bayar sendiri&rdquo; (disimulasikan) →
                  gate keluar buka lalu tutup lagi. Tidak ada tombol yang perlu Anda klik di tengah jalan.
                </p>
              </div>

              <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '1.5rem', textAlign: 'center', marginBottom: '1rem',
              }}>
                <Radio size={40} color="#a78bfa" style={{ display: 'block', margin: '0 auto 1rem', opacity: 0.85 }} />

                {autoStage && (
                  <div style={{
                    fontSize: 13, color: '#38bdf8', marginBottom: '1rem', minHeight: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {autoRunning && <div className="spinner" style={{ width: 14, height: 14 }} />}
                    {autoStage}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={runAutoDemo}
                  disabled={autoRunning}
                  style={{ gap: 8, marginBottom: 12 }}
                >
                  {autoRunning
                    ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Sedang berjalan…</>
                    : <><Zap size={16} /> Jalankan Demo Otomatis (1x)</>
                  }
                </button>

                <div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={autoLoop} onChange={toggleAutoLoop} />
                    Ulangi terus-menerus (buat dibiarkan jalan saat demo ke orang lain)
                  </label>
                </div>
              </div>

              <div style={{
                background: '#a78bfa08', border: '1px solid #a78bfa20',
                borderRadius: 8, padding: '0.875rem', fontSize: 12, color: '#a78bfa', lineHeight: 1.6,
              }}>
                <strong>Yang disimulasikan (belum ada alatnya):</strong> kamera/OCR plat nomor, RFID reader,
                dan customer yang bayar sendiri lewat e-wallet. <strong>Yang sungguhan berjalan:</strong> semua
                panggilan API ke backend, perhitungan tarif, penyimpanan database, dan perintah MQTT ke gate —
                identik dengan yang akan terjadi kalau hardware fisik sudah terpasang.
              </div>
            </div>
          )}

          {/* ── GATE TAB ── */}
          {activeTab === 'gates' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)' }}>Gate Controllers</h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Kontrol kirim MQTT → broker → ESP32 → Servo
                </div>
              </div>

              {gates.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <Activity size={32} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
                  Tidak ada gate. Tambah gate di menu Gate Monitor.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
                  {gates.map(gate => (
                    <GateVisualizer
                      key={gate.id}
                      gate={gate}
                      isOpen={gateStates[gate.id]?.open ?? gate.status === 'open'}
                      angle={gateStates[gate.id]?.angle ?? (gate.status === 'open' ? 90 : 0)}
                      onOpen={() => controlGate(gate.id, 'open')}
                      onClose={() => controlGate(gate.id, 'close')}
                      loading={gateLoading[gate.id] ?? false}
                    />
                  ))}
                </div>
              )}

              {/* MQTT Topic info */}
              <div style={{
                marginTop: 16, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 10, padding: '1rem',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📡 MQTT Topics</div>
                {[
                  { dir: 'PUB', topic: 'smart-parking/gate/{id}/command', desc: 'Backend → ESP32: open/close' },
                  { dir: 'SUB', topic: 'smart-parking/gate/{id}/status', desc: 'ESP32 → Backend: feedback angle' },
                  { dir: 'PUB', topic: 'smart-parking/payment/{order}/paid', desc: 'Backend: payment confirmed' },
                  { dir: 'SUB', topic: 'smart-parking/system/log', desc: 'System events broadcast' },
                ].map(t => (
                  <div key={t.topic} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: t.dir === 'PUB' ? '#38bdf820' : '#a78bfa20',
                      color: t.dir === 'PUB' ? '#38bdf8' : '#a78bfa',
                      fontFamily: 'monospace', fontWeight: 700,
                    }}>{t.dir}</span>
                    <code style={{ fontSize: 10, color: '#94a3b8' }}>{t.topic}</code>
                    <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PAYMENT TAB ── */}
          {activeTab === 'payment' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                  Midtrans QRIS Payment Flow
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Alur lengkap: Buat QRIS → Scan / Simulasi → Webhook → MQTT → Buka Gate
                </p>
              </div>

              {/* Flow diagram */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem',
                marginBottom: '1.25rem', flexWrap: 'wrap',
              }}>
                {[
                  { label: 'Kendaraan Keluar', color: '#38bdf8' },
                  { label: 'Hitung Tarif', color: '#a78bfa' },
                  { label: 'QRIS / VA', color: '#f59e0b' },
                  { label: 'Midtrans Sandbox', color: '#ec4899' },
                  { label: 'Webhook Callback', color: '#22c55e' },
                  { label: 'MQTT Publish', color: '#38bdf8' },
                  { label: 'ESP32 → Gate Buka', color: '#22c55e' },
                ].map((step, i) => (
                  <React.Fragment key={step.label}>
                    <div style={{
                      background: `${step.color}15`, border: `1px solid ${step.color}40`,
                      borderRadius: 6, padding: '4px 10px', fontSize: 11, color: step.color, fontWeight: 600,
                    }}>
                      {i + 1}. {step.label}
                    </div>
                    {i < 6 && <ChevronRight size={12} color="#475569" />}
                  </React.Fragment>
                ))}
              </div>

              {/* Demo Payment Button */}
              <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '1.5rem', textAlign: 'center',
              }}>
                <QrCode size={48} color="#38bdf8" style={{ display: 'block', margin: '0 auto 1rem', opacity: 0.8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Demo Pembayaran QRIS</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Ambil transaksi aktif → Generate QRIS → Simulasi bayar → Auto open gate
                </div>
                <button
                  className="btn btn-primary"
                  onClick={startPaymentDemo}
                  style={{ gap: 8 }}
                >
                  <Zap size={16} />
                  Mulai Demo Pembayaran QRIS
                </button>
              </div>

              {/* Config reminder */}
              <div style={{
                marginTop: 12, background: '#f59e0b08', border: '1px solid #f59e0b20',
                borderRadius: 8, padding: '0.875rem', fontSize: 12, color: '#d97706',
              }}>
                <strong>🔑 Midtrans Sandbox:</strong> Daftar di{' '}
                <a href="https://sandbox.midtrans.com" target="_blank" rel="noreferrer" style={{ color: '#f59e0b' }}>
                  sandbox.midtrans.com
                </a>{' '}
                → Dashboard → Settings → Access Keys → Copy Server Key → paste ke{' '}
                <code style={{ fontSize: 11 }}>backend/.env → MIDTRANS_SERVER_KEY</code>.
                Tanpa key, sistem tetap jalan dalam mode simulator.
              </div>
            </div>
          )}

          {/* ── WOKWI TAB ── */}
          {activeTab === 'wokwi' && (
            <div>
              <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
                Wokwi ESP32 Simulator Setup
              </h3>

              {[
                {
                  step: 1, title: 'Buka Wokwi',
                  desc: 'Pergi ke wokwi.com dan buat project baru (ESP32)',
                  code: 'https://wokwi.com/projects/new/esp32',
                  isLink: true,
                },
                {
                  step: 2, title: 'Upload Files',
                  desc: 'Upload 3 file dari folder wokwi/ proyek ini:',
                  code: 'diagram.json   ← circuit (ESP32 + Servo + LED + LCD)\nsketch.ino    ← kode MQTT controller\nlibraries.txt ← PubSubClient, ArduinoJson, dll',
                },
                {
                  step: 3, title: 'Konfigurasi Broker',
                  desc: 'Edit sketch.ino, sesuaikan MQTT_BROKER dan GATE_ID:',
                  code: 'const char* MQTT_BROKER = "broker.hivemq.com";  // public (Wokwi online)\nconst char* GATE_ID    = "gate-id-dari-database"; // samakan dengan DB\n\n// Untuk broker lokal: pakai ngrok\n// ngrok tcp 1883 → dapat URL seperti tcp://xxx.ngrok.io:12345',
                },
                {
                  step: 4, title: 'Jalankan Simulasi',
                  desc: 'Klik ▶ Run di Wokwi. ESP32 akan connect ke broker dan subscribe topic gate.',
                  code: '[MQTT] ✓ Connected to broker.hivemq.com\n[MQTT] Subscribed: smart-parking/gate/xxx/command\n[GATE] Gate controller ready',
                },
                {
                  step: 5, title: 'Test dari Simulator Page',
                  desc: 'Klik "Buka" / "Tutup" di tab Gate Simulator. MQTT command akan dikirim → ESP32 Servo bergerak.',
                  code: 'smart-parking/gate/{id}/command → {"command":"open","auto_close":8}\nESP32 memutar servo 0° → 90° (smooth)\nLED Hijau menyala, LCD menampilkan "GATE BUKA"',
                },
              ].map(step => (
                <div key={step.step} style={{
                  display: 'flex', gap: 12, marginBottom: 16,
                  background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#0a0e1a',
                  }}>
                    {step.step}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{step.desc}</div>
                    {step.isLink ? (
                      <a
                        href={step.code}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12, color: '#38bdf8', fontFamily: 'monospace',
                          background: '#38bdf810', padding: '4px 8px', borderRadius: 4, textDecoration: 'none',
                        }}
                      >
                        {step.code} →
                      </a>
                    ) : (
                      <pre style={{
                        fontSize: 11, color: '#94a3b8', background: '#0f172a',
                        padding: '0.75rem', borderRadius: 6, margin: 0,
                        overflowX: 'auto', lineHeight: 1.6,
                        border: '1px solid #1e293b',
                      }}>{step.code}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Live Event Log */}
        <div>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 80,
          }}>
            {/* Log Header */}
            <div style={{
              padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={14} color="#38bdf8" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Event Log</span>
                {mqttConnected && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
                )}
              </div>
              <button
                onClick={() => { clearMessages(); setLogs([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Log entries */}
            <div style={{ height: 500, overflowY: 'auto', padding: '0.5rem' }}>
              {logs.length === 0 && messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#475569', fontSize: 12 }}>
                  <Activity size={24} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                  Belum ada event.<br />
                  Coba kontrol gate atau mulai demo payment.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} style={{
                    padding: '0.5rem 0.625rem', borderRadius: 6, marginBottom: 4,
                    background: log.ok ? '#22c55e08' : '#ef444408',
                    border: `1px solid ${log.ok ? '#22c55e15' : '#ef444415'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>{log.time}</span>
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 3,
                        background: log.source === 'mqtt' ? '#a78bfa20' : log.source === 'api' ? '#38bdf820' : '#f59e0b20',
                        color: log.source === 'mqtt' ? '#a78bfa' : log.source === 'api' ? '#38bdf8' : '#f59e0b',
                        fontFamily: 'monospace',
                      }}>
                        {log.source.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: log.ok ? '#f1f5f9' : '#ef4444' }}>
                      {log.ok ? <CheckCircle size={9} style={{ display: 'inline', marginRight: 4, color: '#22c55e' }} /> : <AlertCircle size={9} style={{ display: 'inline', marginRight: 4 }} />}
                      {log.event}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                      {log.detail}
                    </div>
                    {log.topic && (
                      <div style={{ fontSize: 9, color: '#334155', marginTop: 2, fontFamily: 'monospace' }}>
                        📡 {log.topic}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {activePayment && (
        <QRISModal
          payment={activePayment}
          onPaid={onPaymentPaid}
          onClose={() => setActivePayment(null)}
        />
      )}
    </div>
  );
};
