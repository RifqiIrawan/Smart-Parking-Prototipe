import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { forgotPassword } from '../api/client';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDevLink(null);
    try {
      const res = await forgotPassword(email);
      setDone(true);
      setDevLink(res.data.data?.dev_reset_link || null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal memproses permintaan';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Car size={32} color="#0a0e1a" strokeWidth={2} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Lupa Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>
            Masukkan email akun Anda untuk menerima link reset password
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: '1rem', color: 'var(--accent-red)', fontSize: 14 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {done ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, marginBottom: '1rem', color: 'var(--accent-green)', fontSize: 13 }}>
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Jika email terdaftar, link reset password telah dibuat.</span>
              </div>
              {devLink && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-primary)', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ marginBottom: 8, color: '#f59e0b' }}>
                    ⚡ Mode simulasi — SMTP belum dikonfigurasi. Link berikut disimulasikan (di-log juga di server), bukan dikirim ke email sungguhan:
                  </div>
                  <Link to={devLink.replace('http://localhost:5173', '')} style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                    {devLink}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="email" className="form-input" style={{ paddingLeft: 38 }}
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com" required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Memproses...' : 'Kirim Link Reset'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Kembali ke login
          </Link>
        </div>
      </div>
    </div>
  );
};
