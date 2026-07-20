import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '../api/client';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  ip_address: string;
  created_at: string;
}

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'badge-green',
  UPDATE: 'badge-blue',
  DELETE: 'badge-red',
  LOGIN: 'badge-cyan',
  LOGOUT: 'badge-gray',
  FORGOT_PASSWORD: 'badge-amber',
  RESET_PASSWORD: 'badge-purple',
};

const ENTITY_LABEL: Record<string, string> = {
  auth: 'Autentikasi',
  user: 'User',
  tariff: 'Tarif',
  gate: 'Gate',
  location: 'Lokasi',
  member: 'Member',
  vehicle_entry: 'Kendaraan Masuk',
  vehicle_exit: 'Kendaraan Keluar',
  payment: 'Pembayaran',
};

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        entity_type: entityFilter || undefined,
        action: actionFilter || undefined,
        limit: 100,
      });
      setLogs(res.data.data?.logs || []);
      setTotal(res.data.data?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} color="var(--accent-cyan)" /> Audit Log
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Riwayat aktivitas pengguna sistem · {total} entri
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
        <select className="form-input" style={{ maxWidth: 220 }} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          <option value="">Semua Entitas</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="form-input" style={{ maxWidth: 180 }} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">Semua Aksi</option>
          {Object.keys(ACTION_BADGE).map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Belum ada aktivitas tercatat
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>User</th>
                <th>Aksi</th>
                <th>Entitas</th>
                <th>Deskripsi</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{l.user_name || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{l.user_email}</div>
                  </td>
                  <td>
                    <span className={`badge ${ACTION_BADGE[l.action] || 'badge-gray'}`}>{l.action}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{ENTITY_LABEL[l.entity_type] || l.entity_type}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{l.description}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};
