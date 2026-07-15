import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { getTransactions } from '../api/client';
import { Transaction } from '../types';
import { Receipt, Search, RefreshCw } from 'lucide-react';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const statusBadge: Record<string, string> = {
  active: 'badge badge-amber',
  completed: 'badge badge-green',
  cancelled: 'badge badge-gray',
};

const statusLabel: Record<string, string> = {
  active: 'Aktif',
  completed: 'Selesai',
  cancelled: 'Batal',
};

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getTransactions({ status: filter || undefined });
      setTransactions(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const filtered = transactions.filter(t =>
    !search || t.plate_number.includes(search.toUpperCase()) || t.ticket_number.includes(search.toUpperCase())
  );

  return (
    <Layout title="Riwayat Transaksi">
      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 38 }}
            placeholder="Cari plat atau nomor tiket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Batal</option>
        </select>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <span className="spinner" style={{ width: 32, height: 32, display: 'inline-block' }} />
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>No. Tiket</th>
                <th>Plat Kendaraan</th>
                <th>Slot</th>
                <th>Masuk</th>
                <th>Keluar</th>
                <th>Durasi</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Tidak ada data transaksi
                  </td>
                </tr>
              ) : filtered.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--accent-cyan)' }}>
                    {tx.ticket_number}
                  </td>
                  <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {tx.plate_number}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{tx.slot_number || '-'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {new Date(tx.entry_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {tx.exit_time
                      ? new Date(tx.exit_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                      : '-'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {tx.duration_minutes ? `${tx.duration_minutes} mnt` : '-'}
                  </td>
                  <td style={{ fontWeight: 600, color: tx.total_amount > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
                    {tx.total_amount > 0 ? formatRp(tx.total_amount) : '-'}
                  </td>
                  <td>
                    <span className={statusBadge[tx.status] || 'badge badge-gray'}>
                      {statusLabel[tx.status] || tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: 12, color: 'var(--text-muted)' }}>
        Menampilkan {filtered.length} dari {transactions.length} transaksi
      </div>
    </Layout>
  );
};
