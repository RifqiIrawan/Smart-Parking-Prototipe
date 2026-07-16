import React, { useState, useEffect } from 'react';
import { vehicleEntry, getGates } from '../api/client';
import type { Gate } from '../types';
import { LogIn, CheckCircle, AlertCircle } from 'lucide-react';

export const EntryPage: React.FC = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [gateId, setGateId] = useState('');
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { success: boolean; message: string; data?: unknown }>(null);

  useEffect(() => {
    getGates().then(r => setGates(r.data.data?.filter((g: Gate) => g.type === 'entry') || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await vehicleEntry({
        plate_number: plateNumber.toUpperCase().replace(/\s/g, ''),
        vehicle_type: vehicleType,
        gate_id: gateId });
      setResult({ success: true, message: res.data.message, data: res.data.data });
      setPlateNumber('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal memproses masuk';
      setResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
            <div style={{
              width: 48, height: 48,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogIn size={24} color="var(--accent-green)" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Proses Masuk</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Daftarkan kendaraan yang masuk</p>
            </div>
          </div>

          {result && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '14px 16px',
              background: result.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${result.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              borderRadius: 10,
              marginBottom: '1.5rem',
              animation: 'fadeIn 0.3s ease' }}>
              {result.success
                ? <CheckCircle size={18} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 1 }} />
                : <AlertCircle size={18} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: result.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {String(result.message ?? "")}
                </div>
                {result.success && !!result.data && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Tiket: <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)' }}>
                      {((result.data as Record<string, unknown>)?.ticket_number as string) ?? ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Nomor Plat Kendaraan *</label>
              <input
                type="text"
                className="form-input"
                style={{ fontFamily: 'var(--font-display)', fontSize: 20, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' }}
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="B 1234 ABC"
                required
                maxLength={12}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Format: B 1234 ABC</span>
            </div>

            <div className="form-group">
              <label className="form-label">Jenis Kendaraan</label>
              <select className="form-input" value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                <option value="car">🚗 Mobil</option>
                <option value="motorcycle">🏍️ Motor</option>
                <option value="truck">🚛 Truk</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Gate Masuk</label>
              <select className="form-input" value={gateId} onChange={e => setGateId(e.target.value)}>
                <option value="">-- Pilih Gate (opsional) --</option>
                {gates.map(g => (
                  <option key={g.id} value={g.id}>{g.name} - {g.location}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-success btn-lg"
              disabled={loading || !plateNumber}
              style={{ justifyContent: 'center', marginTop: 8 }}
            >
              {loading ? <span className="spinner" /> : <LogIn size={18} />}
              {loading ? 'Memproses...' : 'Proses Masuk'}
            </button>
          </form>
        </div>

        {/* Quick Guide */}
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.75rem' }}>
            Panduan
          </h3>
          <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
            <li>Masukkan nomor plat kendaraan dengan benar</li>
            <li>Pilih jenis kendaraan sesuai</li>
            <li>Pilih gate masuk yang digunakan</li>
            <li>Klik tombol &ldquo;Proses Masuk&rdquo;</li>
            <li>Sistem akan mencetak tiket secara otomatis</li>
          </ol>
        </div>
      </div>
    </>
  );
};
