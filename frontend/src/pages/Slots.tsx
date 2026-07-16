import React, { useState, useEffect } from 'react';
import { getSlots } from '../api/client';
import type { ParkingSlot } from '../types';
import { ParkingSquare, RefreshCw } from 'lucide-react';

export const SlotsPage: React.FC = () => {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await getSlots({ status: filterStatus || undefined, zone: filterZone || undefined });
      setSlots(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, [filterStatus, filterZone]);

  const statusColor: Record<string, string> = {
    available: '#22c55e',
    occupied: '#ef4444',
    reserved: '#f59e0b',
    maintenance: '#6b7280' };

  const statusBg: Record<string, string> = {
    available: 'rgba(34,197,94,0.08)',
    occupied: 'rgba(239,68,68,0.08)',
    reserved: 'rgba(245,158,11,0.08)',
    maintenance: 'rgba(107,114,128,0.08)' };

  const zones = [...new Set(slots.map(s => s.zone))].sort();
  const total = slots.length;
  const available = slots.filter(s => s.status === 'available').length;
  const occupied = slots.filter(s => s.status === 'occupied').length;

  return (
    <>
          {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Slot', val: total, color: 'var(--accent-blue)' },
          { label: 'Tersedia', val: available, color: 'var(--accent-green)' },
          { label: 'Terisi', val: occupied, color: 'var(--accent-red)' },
          { label: 'Maintenance', val: slots.filter(s => s.status === 'maintenance').length, color: 'var(--text-muted)' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="available">Tersedia</option>
          <option value="occupied">Terisi</option>
          <option value="reserved">Reservasi</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select className="form-input" style={{ width: 140 }} value={filterZone} onChange={e => setFilterZone(e.target.value)}>
          <option value="">Semua Zona</option>
          {zones.map(z => <option key={z} value={z}>Zona {z}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {['grid', 'table'].map(m => (
            <button
              key={m}
              className={`btn btn-sm ${viewMode === m ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode(m as 'grid' | 'table')}
            >
              {m === 'grid' ? '⊞ Grid' : '☰ Tabel'}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchSlots}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(statusColor).map(([s, c]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 32, height: 32, display: 'inline-block' }} />
        </div>
      ) : viewMode === 'grid' ? (
        zones.map(zone => (
          <div key={zone} style={{ marginBottom: '2rem' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.75rem' }}>
              Zona {zone} — Lantai {slots.find(s => s.zone === zone)?.floor}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {slots.filter(s => s.zone === zone).map(slot => (
                <div
                  key={slot.id}
                  title={`${slot.slot_number}\nTipe: ${slot.type}\nStatus: ${slot.status}`}
                  style={{
                    width: 64, height: 64,
                    borderRadius: 10,
                    background: statusBg[slot.status],
                    border: `2px solid ${statusColor[slot.status]}40`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    cursor: 'default',
                    transition: 'all 0.15s' }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = statusColor[slot.status];
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${statusColor[slot.status]}40`;
                  }}
                >
                  <ParkingSquare size={18} color={statusColor[slot.status]} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: statusColor[slot.status], fontWeight: 700 }}>
                    {slot.slot_number}
                  </span>
                  {slot.type !== 'regular' && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{slot.type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nomor Slot</th>
                <th>Lantai</th>
                <th>Zona</th>
                <th>Tipe</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {slots.map(slot => (
                <tr key={slot.id}>
                  <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{slot.slot_number}</td>
                  <td>{slot.floor}</td>
                  <td>{slot.zone}</td>
                  <td style={{ textTransform: 'capitalize' }}>{slot.type}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '3px 10px', borderRadius: 100,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      background: statusBg[slot.status],
                      color: statusColor[slot.status],
                      border: `1px solid ${statusColor[slot.status]}40` }}>
                      {slot.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
