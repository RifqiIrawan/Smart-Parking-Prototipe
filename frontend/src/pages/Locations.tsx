import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, ToggleLeft, ToggleRight, Building2,
  Car, TrendingUp, Check } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../store/auth';

interface Location {
  id: string; name: string; code: string; address: string;
  city: string; phone: string; email: string; capacity: number;
  is_active: boolean; created_at: string;
  active_slots?: number; occupied_slots?: number;
}

interface LocationStat {
  id: string; name: string; code: string; city: string;
  available_slots: number; occupied_slots: number; total_slots: number;
  active_transactions: number; today_revenue: number; occupancy_pct: number;
}

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const Modal: React.FC<{
  loc?: Location | null; onClose: () => void; onSave: (data: Partial<Location>) => void;
}> = ({ loc, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: loc?.name || '', code: loc?.code || '', address: loc?.address || '',
    city: loc?.city || '', phone: loc?.phone || '', email: loc?.email || '',
    capacity: loc?.capacity || 0, is_active: loc?.is_active ?? true,
  });

  return (
    <div style={{ position:'fixed', inset:0, background:'#000c', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:14, padding:'1.75rem', width:'100%', maxWidth:480 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5rem' }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:16 }}>{loc ? 'Edit Lokasi' : 'Tambah Lokasi'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:20 }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            { label:'Nama Lokasi', key:'name', placeholder:'Gedung Pusat', full: true },
            { label:'Kode', key:'code', placeholder:'PST' },
            { label:'Kota', key:'city', placeholder:'Jakarta' },
            { label:'Telepon', key:'phone', placeholder:'021-555xxxx' },
            { label:'Email', key:'email', placeholder:'lokasi@parking.id' },
            { label:'Kapasitas Slot', key:'capacity', placeholder:'100', type:'number' },
          ].map(f => (
            <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : 'auto' }}>
              <label className="form-label">{f.label}</label>
              <input
                className="form-input"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={(form as Record<string,unknown>)[f.key] as string}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
          <div style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Alamat</label>
            <input className="form-input" placeholder="Jl. ..." value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:'1.25rem' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex:1 }}>Batal</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} style={{ flex:2, justifyContent:'center' }}>
            <Check size={14} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export const LocationsPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role_name === 'super_admin';
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats,     setStats]     = useState<LocationStat[]>([]);
  const [modal,     setModal]     = useState<null | 'create' | Location>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, statRes] = await Promise.all([
        apiClient.get('/locations'),
        isSuperAdmin ? apiClient.get('/locations/stats') : Promise.resolve({ data: { data: [] } }),
      ]);
      setLocations(locRes.data.data || []);
      setStats(statRes.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<Location>) => {
    if (modal === 'create') {
      await apiClient.post('/locations', data);
    } else if (modal && typeof modal === 'object') {
      await apiClient.put(`/locations/${(modal as Location).id}`, data);
    }
    setModal(null);
    load();
  };

  const handleToggle = async (loc: Location) => {
    await apiClient.put(`/locations/${loc.id}`, { ...loc, is_active: !loc.is_active });
    load();
  };

  return (
    <>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, marginBottom:2 }}>Manajemen Lokasi</h1>
          <p style={{ fontSize:13, color:'var(--text-secondary)' }}>
            {isSuperAdmin ? `${locations.length} lokasi terdaftar` : 'Data lokasi Anda'}
          </p>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={() => setModal('create')} style={{ gap:8 }}>
            <Plus size={15} /> Tambah Lokasi
          </button>
        )}
      </div>

      {/* Super admin: summary stats cards */}
      {isSuperAdmin && stats.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12, marginBottom:'1.5rem' }}>
          {stats.map(s => (
            <div key={s.id} style={{
              background:'var(--bg-secondary)', border:'1px solid var(--border)',
              borderRadius:12, padding:'1.125rem',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>{s.city}</div>
                </div>
                <span style={{
                  fontSize:11, padding:'2px 8px', borderRadius:4,
                  background:'#38bdf815', color:'#38bdf8', fontFamily:'monospace', fontWeight:700,
                }}>{s.code}</span>
              </div>

              {/* Occupancy bar */}
              <div style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#94a3b8', marginBottom:4 }}>
                  <span>Okupansi</span>
                  <span>{s.occupancy_pct.toFixed(0)}%</span>
                </div>
                <div style={{ height:6, background:'#1e293b', borderRadius:3 }}>
                  <div style={{
                    height:'100%', borderRadius:3, transition:'width 0.5s',
                    width:`${Math.min(s.occupancy_pct, 100)}%`,
                    background: s.occupancy_pct > 80 ? '#ef4444' : s.occupancy_pct > 50 ? '#f59e0b' : '#22c55e',
                  }} />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[
                  { icon: Car, label:'Aktif TX', value: s.active_transactions },
                  { icon: Building2, label:'Slot Kosong', value: s.available_slots },
                  { icon: TrendingUp, label:'Revenue Hari Ini', value: formatRp(s.today_revenue) },
                ].map(m => (
                  <div key={m.label} style={{ background:'var(--bg-primary)', borderRadius:6, padding:'6px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>{m.label}</div>
                    <div style={{ fontSize:12, fontWeight:700 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locations table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nama / Kode</th>
              <th>Kota</th>
              <th>Kontak</th>
              <th>Kapasitas</th>
              <th>Status</th>
              {isSuperAdmin && <th>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:'3rem', color:'#64748b' }}>
                <div className="spinner" style={{ margin:'0 auto' }} />
              </td></tr>
            ) : locations.map(loc => (
              <tr key={loc.id}>
                <td>
                  <div style={{ fontWeight:600 }}>{loc.name}</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', color:'#38bdf8' }}>{loc.code}</div>
                </td>
                <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{loc.city || '-'}</td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  <div>{loc.phone || '-'}</div>
                  <div>{loc.email || '-'}</div>
                </td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Car size={13} color="#64748b" />
                    <span style={{ fontSize:13 }}>{loc.capacity} slot</span>
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${loc.is_active ? 'success' : 'danger'}`}>
                    {loc.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                {isSuperAdmin && (
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setModal(loc)}
                        style={{ padding:'4px 10px', fontSize:11 }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className={`btn btn-sm ${loc.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggle(loc)}
                        style={{ padding:'4px 10px', fontSize:11 }}
                      >
                        {loc.is_active ? <><ToggleLeft size={12} /> Nonaktifkan</> : <><ToggleRight size={12} /> Aktifkan</>}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          loc={modal === 'create' ? null : modal as Location}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
};
