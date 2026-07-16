import React, { useState, useEffect, useRef } from 'react';
import { vehicleExit, getGates } from '../api/client';
import { createPayment, checkPaymentStatus, simulatePayment } from '../api/payment';
import type { PaymentData } from '../api/payment';
import type { Gate } from '../types';
import { LogOut, CreditCard, CheckCircle, AlertCircle, QrCode, Clock, Zap, Landmark, Wallet, Banknote, Copy, Check } from 'lucide-react';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins} menit`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
};

// ──────────────────────────────────────────────────────────
// Payment Panel (inline, no separate modal) — renders differently per method
// ──────────────────────────────────────────────────────────
const METHOD_META: Record<string, { icon: React.ReactNode; title: string; badge: string }> = {
  qris:            { icon: <QrCode size={18} color="#38bdf8" />,  title: 'Scan QRIS untuk Membayar',    badge: 'QRIS' },
  virtual_account: { icon: <Landmark size={18} color="#38bdf8" />, title: 'Transfer Virtual Account',    badge: 'VA' },
  ewallet:         { icon: <Wallet size={18} color="#38bdf8" />,   title: 'Bayar dengan E-Wallet',       badge: 'E-WALLET' },
  cash:            { icon: <Banknote size={18} color="#38bdf8" />, title: 'Pembayaran Tunai',            badge: 'TUNAI' },
};

const PaymentPanel: React.FC<{
  payment: PaymentData;
  onPaid: () => void;
  onCancel: () => void;
}> = ({ payment, onPaid, onCancel }) => {
  const [status, setStatus]       = useState<'pending' | 'paid' | 'simulating'>('pending');
  const [countdown, setCountdown] = useState(900);
  const [copied, setCopied]       = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (status === 'paid') return;
    // Only poll real DB orders (not mock demo-xxx)
    if (payment.order_id.startsWith('SP-DEMO')) return;

    pollRef.current = setInterval(async () => {
      try {
        const s = await checkPaymentStatus(payment.order_id);
        if (s.status === 'paid') {
          clearInterval(pollRef.current!);
          setStatus('paid');
          setTimeout(onPaid, 1800);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(pollRef.current!);
  }, [payment.order_id, status, onPaid]);

  const handleSimulate = async () => {
    setStatus('simulating');
    try {
      await simulatePayment(payment.order_id);
      setStatus('paid');
      clearInterval(pollRef.current!);
      setTimeout(onPaid, 1800);
    } catch {
      setStatus('pending');
    }
  };

  const handleCopyVA = () => {
    if (!payment.va_number) return;
    navigator.clipboard.writeText(payment.va_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');
  const qrSrc = payment.qr_image_url ||
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payment.qr_string || payment.order_id)}&bgcolor=ffffff&color=0a0e1a&margin=12`;

  const meta = METHOD_META[payment.method] ?? METHOD_META.qris;
  const confirmLabel = payment.method === 'cash' ? 'Konfirmasi Uang Diterima' : 'Konfirmasi Pembayaran';

  if (status === 'paid') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <CheckCircle size={52} color="#22c55e" style={{ display: 'block', margin: '0 auto 1rem' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-display)' }}>
          PEMBAYARAN BERHASIL
        </div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
          {formatRp(payment.amount)} · Gate terbuka via MQTT…
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {meta.icon}
          <span style={{ fontWeight: 600, fontSize: 14 }}>{meta.title}</span>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>

      {!payment.use_midtrans && (
        <div style={{ fontSize: 11, background: '#f59e0b15', color: '#f59e0b', padding: '4px 10px', borderRadius: 4, marginBottom: '0.75rem' }}>
          ⚡ Mode Simulator — klik tombol di bawah untuk simulasi bayar
        </div>
      )}

      {/* Amount */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '0.75rem', textAlign: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Bayar</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)' }}>
          {formatRp(payment.amount)}
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>{payment.order_id}</div>
      </div>

      {/* Method-specific body */}
      {payment.method === 'qris' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', position: 'relative' }}>
          <img src={qrSrc} alt="QRIS" width={200} height={200} style={{ borderRadius: 6, display: 'block' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${payment.order_id}&bgcolor=ffffff`;
            }}
          />
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            QRIS
          </div>
        </div>
      )}

      {payment.method === 'virtual_account' && (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem', marginBottom: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Bank {payment.bank ? payment.bank.toUpperCase() : ''}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)', letterSpacing: 2, margin: '8px 0' }}>
            {payment.va_number || '-'}
          </div>
          <button
            onClick={handleCopyVA}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
              background: copied ? '#22c55e15' : '#38bdf815', color: copied ? '#22c55e' : '#38bdf8',
              border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
            }}
          >
            {copied ? <><Check size={13} /> Tersalin</> : <><Copy size={13} /> Salin Nomor VA</>}
          </button>
        </div>
      )}

      {payment.method === 'ewallet' && (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
          <Wallet size={40} color="#38bdf8" style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.85 }} />
          {payment.deeplink && (
            <a href={payment.deeplink} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" style={{ justifyContent: 'center', gap: 8 }}>
              Buka Aplikasi E-Wallet
            </a>
          )}
        </div>
      )}

      {payment.method === 'cash' && (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
          <Banknote size={40} color="#38bdf8" style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.85 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Terima uang tunai {formatRp(payment.amount)} dari pelanggan di loket
          </div>
        </div>
      )}

      {/* Instructions */}
      {payment.payment_instructions && (
        <div style={{
          background: '#38bdf808', border: '1px solid #38bdf820',
          borderRadius: 8, padding: '0.75rem', fontSize: 12,
          color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.6,
        }}>
          {payment.payment_instructions}
        </div>
      )}

      {/* Timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: '0.75rem' }}>
        <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} /> Berlaku {mins}:{secs}
        </span>
        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s infinite' }} />
          Menunggu konfirmasi…
        </span>
      </div>

      {/* Simulate/Confirm Button */}
      <button
        className="btn btn-primary"
        onClick={handleSimulate}
        disabled={status === 'simulating'}
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
      >
        {status === 'simulating'
          ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Memproses…</>
          : <><Zap size={14} /> {payment.use_midtrans ? '🧪 Simulasi (Testing)' : `⚡ ${confirmLabel}`}</>
        }
      </button>

      {payment.simulator_url && payment.use_midtrans && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <a href={payment.simulator_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: '#64748b', textDecoration: 'underline' }}>
            Buka Midtrans Simulator →
          </a>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// Main Exit Page
// ──────────────────────────────────────────────────────────
export const ExitPage: React.FC = () => {
  const [ticketNumber,  setTicketNumber]  = useState('');
  const [gateId,        setGateId]        = useState('');
  const [gates,         setGates]         = useState<Gate[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('qris');
  const [exitResult, setExitResult] = useState<null | {
    transaction: { id: string; ticket_number: string; plate_number: string; entry_time: string };
    duration_minutes: number;
    total_amount: number;
    subtotal?: number;
    discount_percent?: number;
    discount_amount?: number;
    member_name?: string;
  }>(null);
  const [activePayment, setActivePayment] = useState<PaymentData | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getGates().then(r =>
      setGates(r.data.data?.filter((g: Gate) => g.type === 'exit' || g.type === 'entry') || [])
    );
  }, []);

  const handleExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setExitResult(null);
    setMessage(null);
    setActivePayment(null);
    try {
      const res = await vehicleExit({ ticket_number: ticketNumber.toUpperCase(), gate_id: gateId });
      setExitResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Tiket tidak ditemukan';
      setMessage({ ok: false, text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!exitResult) return;
    setLoading(true);
    try {
      const payment = await createPayment({
        transaction_id: exitResult.transaction.id,
        payment_method: paymentMethod as 'qris' | 'virtual_account' | 'ewallet' | 'cash',
      });
      setActivePayment(payment);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal membuat pembayaran';
      setMessage({ ok: false, text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentPaid = () => {
    setMessage({ ok: true, text: `✅ Pembayaran ${formatRp(exitResult?.total_amount || 0)} berhasil! Gate terbuka.` });
    setActivePayment(null);
    setExitResult(null);
    setTicketNumber('');
  };

  return (
    <>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: '1.5rem' }}>
          Kendaraan Keluar
        </h1>

        {/* Alert */}
        {message && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', padding: '0.875rem',
            borderRadius: 8, marginBottom: '1rem',
            background: message.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${message.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {message.ok
              ? <CheckCircle size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            }
            <span style={{ fontSize: 13 }}>{message.text}</span>
          </div>
        )}

        {/* Step 1 — Ticket lookup */}
        {!exitResult && !activePayment && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut size={18} color="#0a0e1a" />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Cari Tiket Parkir</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Masukkan nomor tiket kendaraan</div>
              </div>
            </div>

            <form onSubmit={handleExit}>
              <div className="form-group">
                <label className="form-label">Nomor Tiket</label>
                <input
                  className="form-input"
                  placeholder="TKT-20240115120000-1234"
                  value={ticketNumber}
                  onChange={e => setTicketNumber(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gate Keluar (opsional)</label>
                <select className="form-input" value={gateId} onChange={e => setGateId(e.target.value)}>
                  <option value="">Pilih Gate</option>
                  {gates.map(g => (
                    <option key={g.id} value={g.id}>{g.name} — {g.location}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Mencari…</> : 'Cari Tiket'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2 — Bill & payment method */}
        {exitResult && !activePayment && (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={16} color="#38bdf8" /> Rincian Parkir
            </div>

            {/* Bill */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              {[
                { label: 'Nomor Tiket', value: exitResult.transaction.ticket_number },
                { label: 'Plat Nomor', value: exitResult.transaction.plate_number },
                { label: 'Waktu Masuk', value: new Date(exitResult.transaction.entry_time).toLocaleString('id-ID') },
                { label: 'Durasi', value: formatDuration(exitResult.duration_minutes) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              {!!exitResult.discount_amount && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span>{formatRp(exitResult.subtotal ?? exitResult.total_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: '#a78bfa' }}>
                      🏷️ Diskon Member{exitResult.member_name ? ` (${exitResult.member_name})` : ''} · {exitResult.discount_percent}%
                    </span>
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>-{formatRp(exitResult.discount_amount)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                <span style={{ fontWeight: 700 }}>Total Biaya</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: 16 }}>
                  {formatRp(exitResult.total_amount)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="form-group">
              <label className="form-label">Metode Pembayaran</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { id: 'qris',            label: '📱 QRIS' },
                  { id: 'virtual_account', label: '🏦 Virtual Account' },
                  { id: 'ewallet',         label: '💳 E-Wallet' },
                  { id: 'cash',            label: '💵 Tunai' },
                ].map(m => (
                  <div
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    style={{
                      border: `2px solid ${paymentMethod === m.id ? 'var(--accent-cyan)' : 'var(--border)'}`,
                      borderRadius: 8, padding: '0.625rem', cursor: 'pointer', fontSize: 13,
                      background: paymentMethod === m.id ? 'var(--accent-cyan-10)' : 'transparent',
                      textAlign: 'center', transition: 'all 0.15s',
                    }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setExitResult(null)}
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreatePayment}
                disabled={loading}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Memproses…</> : `Bayar ${formatRp(exitResult.total_amount)}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — QRIS Panel */}
        {activePayment && (
          <div className="card">
            <PaymentPanel
              payment={activePayment}
              onPaid={handlePaymentPaid}
              onCancel={() => setActivePayment(null)}
            />
          </div>
        )}
      </div>
    </>
  );
};
