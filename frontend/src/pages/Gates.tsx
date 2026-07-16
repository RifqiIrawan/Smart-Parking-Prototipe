import React, { useState, useEffect } from 'react';
import { getGates, controlGate } from '../api/client';
import type { Gate } from '../types';
import { DoorOpen, DoorClosed, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const GatesPage: React.FC = () => {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState<string | null>(null);

  const fetchGates = async () => {
    try {
      const res = await getGates();
      setGates(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGates();
    const iv = setInterval(fetchGates, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleControl = async (gateId: string, command: 'open' | 'close') => {
    setControlling(gateId);
    try {
      await controlGate(gateId, command);
      await fetchGates();
    } catch (e) {
      console.error(e);
    } finally {
      setControlling(null);
    }
  };

  const statusColor: Record<string, string> = {
    open: 'var(--accent-green)',
    closed: 'var(--accent-red)',
    error: 'var(--accent-amber)' };

  const entryGates = gates.filter(g => g.type === 'entry');
  const exitGates = gates.filter(g => g.type === 'exit');

  return (
    <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="badge badge-green">
            <span style={{ width: 6, height: 6, background: 'var(--accent-green)', borderRadius: '50%', animation: 'pulse-dot 2s infinite' }} />
            {gates.filter(g => g.status === 'open').length} Terbuka
          </div>
          <div className="badge badge-red">
            {gates.filter(g => g.status === 'closed').length} Tertutup
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchGates}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 32, height: 32, display: 'inline-block' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {[
            { label: 'Gate Masuk (Entry)', gates: entryGates, accentColor: 'var(--accent-green)' as const },
            { label: 'Gate Keluar (Exit)', gates: exitGates, accentColor: 'var(--accent-red)' },
          ].map(({ label, gates: gList, accentColor: _accentColor }) => (
            <div key={label}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>
                {label}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {gList.map(gate => (
                  <div
                    key={gate.id}
                    className="card"
                    style={{ borderLeft: `3px solid ${statusColor[gate.status] || 'var(--border)'}` }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 4 }}>
                          {gate.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {gate.location}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, fontWeight: 700, color: statusColor[gate.status],
                        textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {gate.status === 'open' ? <DoorOpen size={16} /> : <DoorClosed size={16} />}
                        {gate.status}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1rem', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {gate.ip_address ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {gate.ip_address || 'Tidak terhubung'}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-success btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={gate.status === 'open' || controlling === gate.id}
                        onClick={() => handleControl(gate.id, 'open')}
                      >
                        {controlling === gate.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <DoorOpen size={14} />}
                        Buka
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={gate.status === 'closed' || controlling === gate.id}
                        onClick={() => handleControl(gate.id, 'close')}
                      >
                        {controlling === gate.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <DoorClosed size={14} />}
                        Tutup
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
