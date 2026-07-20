import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Camera, Car, Clock,
  CheckCircle, AlertCircle, Zap, RefreshCw, X,
  MapPin, DoorOpen, ParkingSquare, QrCode, CreditCard,
  Activity,
} from 'lucide-react';
import apiClient from '../api/client';
import { createPayment, simulatePayment, checkPaymentStatus } from '../api/payment';
import type { PaymentData } from '../api/payment';

// ─────────────────────────── Types ───────────────────────────
interface BillingResult {
  transaction_id: string;
  ticket_number: string;
  plate_number: string;
  vehicle_type: string;
  entry_time: string;
  status: string;
  slot_number: string;
  entry_gate_name: string;
  location_name: string;
  location_code: string;
  duration_minutes: number;
  duration_display: string;
  current_fee: number;
  base_rate: number;
  next_hour_rate: number;
  max_daily_rate: number;
  pending_payment?: {
    payment_id: string;
    order_id: string;
    amount: number;
    method: string;
    status: string;
    expired_at: string;
  };
}

interface ActiveBill {
  transaction_id: string;
  ticket_number: string;
  plate_number: string;
  vehicle_type: string;
  entry_time: string;
  duration_minutes: number;
  duration_display: string;
  estimated_fee: number;
  slot_number: string;
  entry_gate_name: string;
  location_name: string;
  payment_status: string;
}

const Rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

// ─────────────────────────── Live Timer ──────────────────────
function useLiveTimer(entryTime: string | null) {
  const [elapsed, setElapsed] = useState({ minutes: 0, display: '0 menit', fee: 0 });

  useEffect(() => {
    if (!entryTime) return;
    const calc = () => {
      const mins = Math.max(1, Math.floor((Date.now() - new Date(entryTime).getTime()) / 60000));
      const h = Math.floor(mins / 60), m = mins % 60;
      const display = h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
      setElapsed({ minutes: mins, display, fee: 0 });
    };
    calc();
    const id = setInterval(calc, 10000);
    return () => clearInterval(id);
  }, [entryTime]);

  return elapsed;
}

// ─────────────────────────── QRIS Panel ──────────────────────
const QRISPanel: React.FC<{
  payment: PaymentData;
  onPaid: () => void;
  onClose: () => void;
}> = ({ payment, onPaid, onClose }) => {
  const [status, setStatus]     = useState<'pending' | 'paid' | 'loading'>('pending');
  const [countdown, setCountdown] = useState(900);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (status === 'paid' || payment.order_id.startsWith('SP-DEMO') || !payment.use_midtrans) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await checkPaymentStatus(payment.order_id);
        if (s.status === 'paid') { setStatus('paid'); clearInterval(pollRef.current!); setTimeout(onPaid, 1500); }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(pollRef.current!);
  }, [payment.order_id, payment.use_midtrans, status, onPaid]);

  const simulate = async () => {
    setStatus('loading');
    try { await simulatePayment(payment.order_id); setStatus('paid'); setTimeout(onPaid, 1500); }
    catch { setStatus('pending'); }
  };

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');

  if (status === 'paid') return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <CheckCircle size={56} color="#22c55e" style={{ display: 'block', margin: '0 auto 1rem' }} />
      <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-display)' }}>PEMBAYARAN LUNAS</div>
      <div style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13 }}>{Rp(payment.amount)} · Gate terbuka otomatis</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <QrCode size={16} color="#38bdf8" /> Scan QRIS untuk Bayar
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
      </div>

      {!payment.use_midtrans && (
        <div style={{ fontSize: 11, background: '#f59e0b15', color: '#f59e0b', padding: '4px 10px', borderRadius: 4, marginBottom: 10 }}>
          ⚡ Mode Simulator
        </div>
      )}

      <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '0.875rem', textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Tagihan</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)' }}>
          {Rp(payment.amount)}
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>{payment.order_id}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
        <img
          src={payment.qr_image_url || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.qr_string || payment.order_id)}&bgcolor=ffffff&color=0a0e1a&margin=12`}
          alt="QRIS"
          width={220}
          height={220}
          style={{ borderRadius: 8, display: 'block' }}
        />
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', padding: '2px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>QRIS</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 12 }}>
        <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> Berlaku {mins}:{secs}
        </span>
        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s infinite' }} />
          Menunggu konfirmasi…
        </span>
      </div>

      <button
        className="btn btn-primary"
        onClick={simulate}
        disabled={status === 'loading'}
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
      >
        {status === 'loading'
          ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Memproses…</>
          : <><Zap size={14} /> {payment.use_midtrans ? '🧪 Simulasi Bayar' : '⚡ Konfirmasi Pembayaran'}</>
        }
      </button>
    </div>
  );
};

// ─────────────────────────── Camera Scan ─────────────────────
const CameraScan: React.FC<{
  onPlateDetected: (plate: string) => void;
  onClose: () => void;
}> = ({ onPlateDetected, onClose }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState('');
  const [detected, setDetected] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { setError('Tidak bisa mengakses kamera. Pastikan izin kamera diizinkan.'); }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanning(true); setError(''); setDetected('');

    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width  = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1];

    try {
      // Call OCR service
      const res = await fetch('http://localhost:8000/ocr/plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, enhance: true }),
      });
      const data = await res.json();

      if (data.success && data.plate_number) {
        setDetected(data.plate_number);
        setTimeout(() => { onPlateDetected(data.plate_number); }, 800);
      } else {
        setError('Plat nomor tidak terdeteksi. Coba lagi atau input manual.');
      }
    } catch {
      setError('OCR Service tidak tersedia. Gunakan input manual.');
    } finally { setScanning(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 480, padding: '0 1rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#fff' }}>📷 Scan Plat Nomor</div>
        <button onClick={onClose} style={{ background: '#ffffff20', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#fff' }}><X size={16} /></button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', display: 'block', background: '#000' }} playsInline muted />
        {/* Plate overlay guide */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ border: '2px solid #38bdf8', borderRadius: 8, width: '70%', height: 80, boxShadow: '0 0 0 9999px rgba(0,0,0,.5)' }} />
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>
          Arahkan plat nomor ke dalam kotak
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {detected && (
        <div style={{ background: '#22c55e20', border: '1px solid #22c55e', borderRadius: 10, padding: '12px 24px', fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#22c55e', letterSpacing: 4 }}>
          ✓ {detected}
        </div>
      )}

      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#ef4444', maxWidth: 480, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={captureAndScan}
        disabled={scanning}
        style={{ gap: 8, fontSize: 15, padding: '12px 32px' }}
      >
        {scanning ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Memindai…</> : <><Camera size={18} /> Foto & Scan Sekarang</>}
      </button>
    </div>
  );
};

// ─────────────────────────── Main Billing Page ───────────────
export const BillingPage: React.FC = () => {
  const [input,       setInput]       = useState('');
  const [mode,        setMode]        = useState<'plate' | 'ticket'>('plate');
  const [result,      setResult]      = useState<BillingResult | null>(null);
  const [actives,     setActives]     = useState<ActiveBill[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error,       setError]       = useState('');
  const [showCamera,  setShowCamera]  = useState(false);
  const [payment,     setPayment]     = useState<PaymentData | null>(null);
  const [payMethod,   setPayMethod]   = useState<'qris' | 'virtual_account' | 'ewallet' | 'cash'>('qris');
  const [payLoading,  setPayLoading]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const timer = useLiveTimer(result?.entry_time ?? null);

  const loadActives = useCallback(async () => {
    try {
      const r = await apiClient.get('/billing/active');
      setActives(r.data.data || []);
    } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadActives(); const id = setInterval(loadActives, 30000); return () => clearInterval(id); }, [loadActives]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = input.trim().toUpperCase().replace(/\s+/g, '');
    if (!val) return;
    setLoading(true); setError(''); setResult(null); setPayment(null);
    try {
      const param = mode === 'plate' ? `plate=${val}` : `ticket=${val}`;
      const r = await apiClient.get(`/billing/check?${param}`);
      setResult(r.data.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Kendaraan tidak ditemukan';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handlePay = async () => {
    if (!result) return;
    setPayLoading(true);
    try {
      const pd = await createPayment({ transaction_id: result.transaction_id, payment_method: payMethod });
      setPayment(pd);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal membuat pembayaran');
    } finally { setPayLoading(false); }
  };

  const onPaid = () => {
    setPayment(null);
    setResult(null);
    setInput('');
    loadActives();
    inputRef.current?.focus();
  };

  const selectActive = (b: ActiveBill) => {
    setInput(b.plate_number);
    setMode('plate');
    setResult(null);
    setError('');
    setPayment(null);
    setTimeout(() => handleSearch(), 100);
  };

  const filteredActives = actives.filter(b =>
    b.plate_number.includes(searchQuery.toUpperCase()) ||
    b.slot_number.includes(searchQuery.toUpperCase()) ||
    b.location_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Effective current fee (use live timer if we have result)
  const liveFee = result ? (() => {
    const mins = timer.minutes || result.duration_minutes;
    const hrs  = Math.ceil(mins / 60);
    let fee = result.base_rate;
    if (hrs > 1) fee += (hrs - 1) * result.next_hour_rate;
    if (fee > result.max_daily_rate) fee = result.max_daily_rate;
    return fee;
  })() : 0;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 2 }}>
            Billing & Tagihan
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Cek tagihan parkir berdasarkan plat nomor atau tiket · {actives.length} kendaraan aktif
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadActives} style={{ gap: 6, fontSize: 12 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: Search + Result ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Search Bar */}
          <div className="card">
            {/* Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-primary)', borderRadius: 8, padding: 3, marginBottom: '1rem', width: 'fit-content' }}>
              {(['plate', 'ticket'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setInput(''); setResult(null); setError(''); }} style={{
                  background: mode === m ? 'var(--bg-secondary)' : 'transparent',
                  border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 6, padding: '5px 16px', cursor: 'pointer', fontSize: 12,
                  color: mode === m ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: mode === m ? 700 : 400,
                }}>
                  {m === 'plate' ? '🚗 Plat Nomor' : '🎫 Nomor Tiket'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    ref={inputRef}
                    className="form-input"
                    style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', height: 52, paddingRight: 48 }}
                    placeholder={mode === 'plate' ? 'B 1234 ABC' : 'TKT-20240115...'}
                    value={input}
                    onChange={e => setInput(e.target.value.toUpperCase())}
                    autoFocus
                  />
                  {input && (
                    <button type="button" onClick={() => { setInput(''); setResult(null); setError(''); }}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
                {mode === 'plate' && (
                  <button type="button" onClick={() => setShowCamera(true)} title="Scan via kamera"
                    className="btn btn-secondary" style={{ padding: '0 16px', height: 52, fontSize: 13 }}>
                    <Camera size={18} />
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 52, padding: '0 24px', gap: 8 }}>
                  {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <><Search size={16} /> Cek</>}
                </button>
              </div>
            </form>

            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, padding: '0.625rem 0.75rem', background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </div>

          {/* ── Billing Result ── */}
          {result && !payment && (
            <div className="card" style={{ border: '1px solid #38bdf840' }}>
              {/* Plate header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 900, letterSpacing: 6, color: 'var(--text-primary)' }}>
                    {result.plate_number}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 10 }}>
                    <span style={{ textTransform: 'capitalize' }}>{result.vehicle_type === 'car' ? '🚗 Mobil' : result.vehicle_type === 'motorcycle' ? '🏍 Motor' : '🚛 Truk'}</span>
                    <span>Tiket: {result.ticket_number}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-warning" style={{ fontSize: 11 }}>● PARKIR AKTIF</span>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {result.location_name} ({result.location_code})
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1.25rem' }}>
                {[
                  { label: 'Slot', value: result.slot_number, icon: ParkingSquare, color: '#38bdf8' },
                  { label: 'Gate Masuk', value: result.entry_gate_name, icon: DoorOpen, color: '#a78bfa' },
                  { label: 'Lokasi', value: result.location_name, icon: MapPin, color: '#f59e0b' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                    <Icon size={16} color={color} style={{ display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Duration + Fee (LIVE) */}
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: '1px solid #38bdf830', borderRadius: 12, padding: '1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '1.25rem',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Clock size={11} /> Durasi Parkir (live)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#f59e0b' }}>
                    {timer.minutes > 0 ? timer.display : result.duration_display}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Masuk: {new Date(result.entry_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <Activity size={11} /> Tagihan Saat Ini
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#38bdf8', fontFamily: 'var(--font-display)' }}>
                    {Rp(liveFee)}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                    Tarif: {Rp(result.base_rate)}/jam pertama · {Rp(result.next_hour_rate)}/jam berikutnya
                  </div>
                </div>
              </div>

              {/* Pending payment warning */}
              {result.pending_payment && (
                <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 8, padding: '0.75rem', marginBottom: 12, fontSize: 12, color: '#f59e0b' }}>
                  ⚠ Ada pembayaran pending ({result.pending_payment.method}) — {Rp(result.pending_payment.amount)}
                </div>
              )}

              {/* Payment Method + Pay Button */}
              <div style={{ marginBottom: '0.875rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Metode Pembayaran</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  {([
                    { id: 'qris',            label: '📱 QRIS' },
                    { id: 'virtual_account', label: '🏦 VA' },
                    { id: 'ewallet',         label: '💳 E-Wallet' },
                    { id: 'cash',            label: '💵 Tunai' },
                  ] as const).map(m => (
                    <button key={m.id} onClick={() => setPayMethod(m.id)} style={{
                      border: `2px solid ${payMethod === m.id ? 'var(--accent-cyan)' : 'var(--border)'}`,
                      borderRadius: 8, padding: '8px 4px', cursor: 'pointer', fontSize: 11,
                      background: payMethod === m.id ? 'var(--accent-cyan-10)' : 'transparent',
                      color: payMethod === m.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontWeight: payMethod === m.id ? 700 : 400, transition: 'all 0.15s',
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handlePay}
                disabled={payLoading}
                style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 15, padding: '0.875rem' }}
              >
                {payLoading
                  ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Memproses…</>
                  : <><CreditCard size={17} /> Bayar {Rp(liveFee)} via {payMethod.replace('_', ' ').toUpperCase()}</>
                }
              </button>
            </div>
          )}

          {/* ── QRIS Payment ── */}
          {payment && (
            <div className="card" style={{ border: '1px solid #38bdf840' }}>
              <QRISPanel payment={payment} onPaid={onPaid} onClose={() => setPayment(null)} />
            </div>
          )}
        </div>

        {/* ── RIGHT: Active Vehicles List ── */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 80 }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Activity size={14} color="#22c55e" />
              Kendaraan Aktif
              <span style={{ fontSize: 10, background: '#22c55e20', color: '#22c55e', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                {actives.length}
              </span>
            </div>
          </div>

          {/* Search active */}
          <div style={{ padding: '0.625rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input className="form-input" placeholder="Cari plat, slot, lokasi…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 26, fontSize: 11, height: 30 }} />
            </div>
          </div>

          {/* Active list */}
          <div style={{ height: 520, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : filteredActives.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                <Car size={28} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                Tidak ada kendaraan aktif
              </div>
            ) : filteredActives.map(b => {
              const isSel = result?.transaction_id === b.transaction_id;
              return (
                <div key={b.transaction_id}
                  onClick={() => selectActive(b)}
                  style={{
                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: isSel ? '#38bdf810' : 'transparent',
                    borderLeft: isSel ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#ffffff05'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>{b.plate_number}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{b.duration_display}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                    <span>{b.slot_number} · {b.entry_gate_name}</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>~{Rp(b.estimated_fee)}</span>
                  </div>
                  {b.payment_status && (
                    <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>⏳ Pembayaran pending</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          {actives.length > 0 && (
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center', background: 'var(--bg-primary)', borderRadius: 8, padding: '6px' }}>
                <div style={{ fontSize: 9, color: '#64748b' }}>Est. Total Tagihan</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                  {Rp(actives.reduce((a, b) => a + b.estimated_fee, 0))}
                </div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-primary)', borderRadius: 8, padding: '6px' }}>
                <div style={{ fontSize: 9, color: '#64748b' }}>Avg. Durasi</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                  {actives.length > 0 ? `${Math.floor(actives.reduce((a, b) => a + b.duration_minutes, 0) / actives.length)}m` : '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <CameraScan
          onPlateDetected={plate => { setShowCamera(false); setInput(plate); setMode('plate'); setTimeout(() => handleSearch(), 200); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
};
