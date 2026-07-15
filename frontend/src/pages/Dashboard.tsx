import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { getDashboardStats, getRevenueChart, getSlotMap } from '../api/client';
import { DashboardStats, RevenuePoint, ParkingSlot } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Car, ParkingSquare, Activity, TrendingUp,
  Banknote, Clock, RefreshCw
} from 'lucide-react';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<RevenuePoint[]>([]);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    try {
      const [s, c, sl] = await Promise.all([
        getDashboardStats(),
        getRevenueChart(),
        getSlotMap(),
      ]);
      setStats(s.data.data);
      setChart(c.data.data || []);
      setSlots(sl.data.data || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = stats ? [
    { label: 'Total Slot', value: stats.total_slots, icon: ParkingSquare, color: 'blue', sub: 'Kapasitas parkir' },
    { label: 'Slot Tersedia', value: stats.available_slots, icon: Car, color: 'green', sub: `Occupancy: ${stats.occupancy_rate.toFixed(1)}%` },
    { label: 'Transaksi Aktif', value: stats.active_transactions, icon: Activity, color: 'amber', sub: 'Kendaraan di dalam' },
    { label: 'Pendapatan Hari Ini', value: formatRp(stats.today_revenue), icon: Banknote, color: 'cyan', sub: `${stats.today_transactions} transaksi` },
    { label: 'Pendapatan Bulan Ini', value: formatRp(stats.month_revenue), icon: TrendingUp, color: 'purple', sub: 'Bulan berjalan' },
  ] : [];

  const slotZones = [...new Set(slots.map(s => s.zone))];

  const slotStatusColor: Record<string, string> = {
    available: 'var(--accent-green)',
    occupied: 'var(--accent-red)',
    reserved: 'var(--accent-amber)',
    maintenance: 'var(--text-muted)',
  };

  return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            Update: {lastRefresh.toLocaleTimeString('id-ID')}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {statCards.map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className={`stat-card ${color}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="stat-label">{label}</span>
                  <Icon size={20} style={{ color: `var(--accent-${color})`, opacity: 0.7 }} />
                </div>
                <div className="stat-value" style={{ color: `var(--accent-${color})`, fontSize: 22 }}>
                  {value}
                </div>
                <div className="stat-sub">{sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Revenue Chart */}
            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                Pendapatan 30 Hari Terakhir
              </h2>
              {chart.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Belum ada data pendapatan
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chart} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number) => [formatRp(v), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#38bdf8" strokeWidth={2} fill="url(#revenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Occupancy Gauge */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Tingkat Hunian
              </span>
              <div style={{ position: 'relative', width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle
                    cx="70" cy="70" r="60"
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats?.occupancy_rate || 0) / 100 * 376.99} 376.99`}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dasharray 1s ease' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--accent-cyan)' }}>
                    {stats?.occupancy_rate.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Terisi</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{stats?.available_slots}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Kosong</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{stats?.occupied_slots}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Penuh</div>
                </div>
              </div>
            </div>
          </div>

          {/* Slot Map */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: 1 }}>
              Peta Slot Parkir
            </h2>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {Object.entries(slotStatusColor).map(([status, color]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                  {status}
                </div>
              ))}
            </div>
            {slotZones.map(zone => (
              <div key={zone} style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Zona {zone}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {slots.filter(s => s.zone === zone).map(slot => (
                    <div
                      key={slot.id}
                      title={`${slot.slot_number} - ${slot.type} - ${slot.status}`}
                      style={{
                        width: 44, height: 44,
                        borderRadius: 8,
                        background: slotStatusColor[slot.status] + '20',
                        border: `1px solid ${slotStatusColor[slot.status]}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-display)',
                        color: slotStatusColor[slot.status],
                        cursor: 'default',
                        transition: 'transform 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                      onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {slot.slot_number}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
};
