import React, { useState, useEffect } from 'react';
import { vehicleExit, getGates, createPayment, simulatePayment } from '../api/client';
import type { Gate } from '../types';
import { LogOut, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins} menit`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
};

export const ExitPage: React.FC = () => {
  const [ticketNumber, setTicketNumber] = useState('');
  const [gateId, setGateId] = useState('');
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(false);
  const [exitResult, setExitResult] = useState<null | {
    transaction: { id: string; ticket_number: string; plate_number: string; entry_time: string };
    duration_minutes: number;
    total_amount: number;
    order_id?: string;
  }>(null);
  const [paymentMethod, setPaymentMethod] = useState('qris');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<null | { success: boolean; message: string; data?: unknown }>(null);

  useEffect(() => {
    getGates().then(r => setGates(r.data.data?.filter((g: Gate) => g.type === 'exit') || []));
  }, []);

  const handleExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setExitResult(null);
    setPaymentResult(null);
    try {
      const res = await vehicleExit({
        ticket_number: ticketNumber.toUpperCase(),
        gate_id: gateId });
      setExitResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal memproses keluar';
      setPaymentResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!exitResult) return;
    setPaymentLoading(true);
    try {
      const res = await createPayment({
        transaction_id: exitResult.transaction.id,
        payment_method: paymentMethod });
      const orderId = res.data.data.order_id;

      // Auto-simulate payment for demo
      await simulatePayment(orderId);

      setPaymentResult({ success: true, message: `Pembayaran ${formatRp(exitResult.total_amount)} berhasil!` });
      setExitResult(null);
      setTicketNumber('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal memproses pembayaran';
      setPaymentResult({ success: false, message: msg });
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {!exitResult ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
              <div style={{
                width: 48, height: 48,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut size={24} color="var(--accent-red)" />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Proses Keluar</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Scan atau masukkan nomor tiket</p>
              </div>
            </div>

            {paymentResult && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: paymentResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${paymentResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 10, marginBottom: '1.5rem' }}>
                {paymentResult.success
                  ? <CheckCircle size={18} color="var(--accent-green)" />
                  : <AlertCircle size={18} color="var(--accent-red)" />
                }
                <span style={{ fontSize: 14, color: paymentResult.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {paymentResult.message}
                </span>
              </div>
            )}

            <form onSubmit={handleExit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nomor Tiket *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 1 }}
                  value={ticketNumber}
                  onChange={e => setTicketNumber(e.target.value.toUpperCase())}
                  placeholder="TKT-20240115120000-1234"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gate Keluar</label>
                <select className="form-input" value={gateId} onChange={e => setGateId(e.target.value)}>
                  <option value="">-- Pilih Gate (opsional) --</option>
                  {gates.map(g => (
                    <option key={g.id} value={g.id}>{g.name} - {g.location}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-danger btn-lg"
                disabled={loading || !ticketNumber}
                style={{ justifyContent: 'center' }}
              >
                {loading ? <span className="spinner" /> : <LogOut size={18} />}
                {loading ? 'Memproses...' : 'Cari Tiket'}
              </button>
            </form>
          </div>
        ) : (
          /* Payment card */
          <div className="card fade-in">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: '1.5rem', color: 'var(--accent-cyan)' }}>
              Informasi Parkir
            </h2>

            {/* Bill */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 12, padding: '1.25rem',
              border: '1px dashed var(--border)',
              marginBottom: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Nomor Tiket', exitResult.transaction.ticket_number],
                ['Plat Kendaraan', exitResult.transaction.plate_number],
                ['Waktu Masuk', new Date(exitResult.transaction.entry_time).toLocaleString('id-ID')],
                ['Waktu Keluar', new Date().toLocaleString('id-ID')],
                ['Durasi', formatDuration(exitResult.duration_minutes)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Total Bayar</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent-amber)' }}>
                  {formatRp(exitResult.total_amount)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Metode Pembayaran</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { val: 'qris', label: '📱 QRIS' },
                  { val: 'virtual_account', label: '🏦 VA Bank' },
                  { val: 'ewallet', label: '💳 E-Wallet' },
                  { val: 'cash', label: '💵 Tunai' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPaymentMethod(val)}
                    className="btn"
                    style={{
                      justifyContent: 'center',
                      fontSize: 13,
                      background: paymentMethod === val ? 'rgba(56,189,248,0.1)' : 'var(--bg-secondary)',
                      border: `1px solid ${paymentMethod === val ? 'var(--accent-cyan)' : 'var(--border)'}`,
                      color: paymentMethod === val ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setExitResult(null); setTicketNumber(''); }}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handlePayment}
                disabled={paymentLoading}
              >
                {paymentLoading ? <span className="spinner" /> : <CreditCard size={18} />}
                {paymentLoading ? 'Memproses...' : `Bayar ${formatRp(exitResult.total_amount)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
