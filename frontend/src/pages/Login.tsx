import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../store/auth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@smartparking.id');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authLogin(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login gagal';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(56,189,248,0.05) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.05) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: '10%', left: '5%',
        width: 300, height: 300,
        border: '1px solid rgba(56,189,248,0.05)',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%', right: '5%',
        width: 200, height: 200,
        border: '1px solid rgba(59,130,246,0.05)',
        borderRadius: '50%',
      }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 0 40px rgba(56,189,248,0.2)',
          }}>
            <Car size={36} color="#0a0e1a" strokeWidth={2} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: 2 }}>
            SMART<span style={{ color: 'var(--accent-cyan)' }}>PARKING</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
            Sistem Manajemen Parkir Cerdas
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Masuk ke sistem
          </h2>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10,
              marginBottom: '1rem',
              color: 'var(--accent-red)',
              fontSize: 14,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@smartparking.id"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: '1rem' }}>
          Smart Parking System v1.0.0 · © 2024
        </p>
      </div>
    </div>
  );
};
