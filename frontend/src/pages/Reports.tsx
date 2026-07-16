import React, { useState, useEffect } from 'react';
import { getReports, exportReportsXlsx } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RefreshCw, FileSpreadsheet } from 'lucide-react';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

interface ReportItem {
  period: string;
  total_transactions: number;
  completed: number;
  revenue: number;
  discount_given: number;
}

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [data, setData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getReports(period);
      setData((res.data.data || []).reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportReportsXlsx(period);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-${period === 'daily' ? 'harian' : 'bulanan'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalTx = data.reduce((s, d) => s + d.total_transactions, 0);
  const totalDiscount = data.reduce((s, d) => s + d.discount_given, 0);
  const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;

  return (
    <>
          {/* Period Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {(['daily', 'monthly'] as const).map(p => (
          <button
            key={p}
            className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'daily' ? '📅 Harian' : '📆 Bulanan'}
          </button>
        ))}
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={handleExport}
          disabled={data.length === 0 || exporting}
        >
          {exporting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <FileSpreadsheet size={14} />}
          {exporting ? 'Membuat file...' : 'Export ke Excel'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Pendapatan', val: formatRp(totalRevenue), color: 'cyan' },
          { label: 'Total Transaksi', val: totalTx.toString(), color: 'blue' },
          { label: `Rata-rata per ${period === 'daily' ? 'Hari' : 'Bulan'}`, val: formatRp(avgRevenue), color: 'green' },
          { label: 'Total Diskon Member', val: formatRp(totalDiscount), color: 'purple' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`stat-card ${color}`}>
            <span className="stat-label">{label}</span>
            <span className="stat-value" style={{ color: `var(--accent-${color})`, fontSize: 20 }}>{val}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 32, height: 32, display: 'inline-block' }} />
        </div>
      ) : data.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada data laporan
        </div>
      ) : (
        <>
          {/* Revenue Chart */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1.25rem' }}>
              Pendapatan {period === 'daily' ? '30 Hari' : '12 Bulan'} Terakhir
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: unknown) => [`Rp ${Number(v || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
                />
                <Bar dataKey="revenue" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Data Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Total Transaksi</th>
                  <th>Selesai</th>
                  <th>Diskon Member</th>
                  <th>Pendapatan</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.period}>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>{item.period}</td>
                    <td>{item.total_transactions}</td>
                    <td>
                      <span className="badge badge-green">{item.completed}</span>
                    </td>
                    <td style={{ fontSize: 13, color: item.discount_given > 0 ? '#a78bfa' : 'var(--text-secondary)' }}>
                      {item.discount_given > 0 ? `-${formatRp(item.discount_given)}` : '-'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>
                      {formatRp(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};
