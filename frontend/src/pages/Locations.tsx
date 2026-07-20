import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Plus, Edit2, Trash2, CheckCircle, XCircle,
  Building2, Car, Users, DoorOpen, Receipt, TrendingUp,
  ChevronRight, Search, RefreshCw, ToggleLeft, ToggleRight,
  Phone, Mail, Hash, Layers, AlertCircle, X, Check,
  ParkingSquare, Activity,
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../store/auth';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Location {
  id: string; name: string; code: string; address: string;
  city: string; phone: string; email: string; capacity: number;
  is_active: boolean; created_at: string; updated_at: string;
}

interface LocationStat {
  id: string; name: string; code: string; city: string;
  available_slots: number; occupied_slots: number; total_slots: number;
  active_transactions: number; today_revenue: number; occupancy_pct: number;
}

interface Gate {
  id: string; name: string; type: string; location: string;
  status: string; ip_address: string; location_id: string; is_active: boolean;
}

interface Slot {
  id: string; slot_number: string; floor: string; zone: string;
  type: string; status: string; location_id: string;
}

interface User {
  id: string; name: string; email: string; role_name: string;
  location_id: string | null; is_active: boolean;
}

interface Transaction {
  id: string; ticket_number: string; plate_number: string;
  entry_time: string; exit_time: string | null;
  total_amount: number; status: string;
}

const formatRp   = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const formatDate = (s: string) => s ? new Date(s).toLocaleString('id-ID', { dateStyle:'short', timeStyle:'short' }) : '-';

// ─────────────────────────────────────────────
// Badge Component
// ─────────────────────────────────────────────
const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', gap:4,
    fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700,
    background: active ? '#22c55e20' : '#ef444420',
    color: active ? '#22c55e' : '#ef4444',
    border: `1px solid ${active ? '#22c55e40' : '#ef444440'}`,
  }}>
    {active ? <CheckCircle size={9}/> : <XCircle size={9}/>}
    {active ? 'Aktif' : 'Nonaktif'}
  </span>
);

// ─────────────────────────────────────────────
// Occupancy Ring
// ─────────────────────────────────────────────
const OccupancyRing: React.FC<{ pct: number; size?: number }> = ({ pct, size = 56 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(pct, 100) / 100;
  const color = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e';
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 0.6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill:color, fontSize:12, fontWeight:700, transform:'rotate(90deg)', transformOrigin:'50% 50%' }}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
};

// ─────────────────────────────────────────────
// Location Form Modal
// ─────────────────────────────────────────────
const LocationModal: React.FC<{
  loc: Location | null; onClose: () => void; onSave: () => void;
}> = ({ loc, onClose, onSave }) => {
  const isEdit = !!loc;
  const [form, setForm] = useState({
    name: loc?.name || '', code: loc?.code || '',
    address: loc?.address || '', city: loc?.city || '',
    phone: loc?.phone || '', email: loc?.email || '',
    capacity: loc?.capacity || 0, is_active: loc?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string, v: string | number | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError('Nama dan Kode wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) await apiClient.put(`/locations/${loc!.id}`, form);
      else        await apiClient.post('/locations', form);
      onSave();
    } catch (e: unknown) {
      setError((e as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const fields: { label: string; key: string; type?: string; placeholder: string; half?: boolean }[] = [
    { label:'Nama Lokasi',    key:'name',     placeholder:'Gedung Pusat' },
    { label:'Kode Lokasi',    key:'code',     placeholder:'PST',       half:true },
    { label:'Kota',           key:'city',     placeholder:'Jakarta',   half:true },
    { label:'Alamat Lengkap', key:'address',  placeholder:'Jl. Sudirman No. 1' },
    { label:'Telepon',        key:'phone',    placeholder:'021-5550001', half:true },
    { label:'Email',          key:'email',    placeholder:'parkir@gedung.id', half:true },
    { label:'Kapasitas Slot', key:'capacity', placeholder:'100', type:'number', half:true },
  ];

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000,
    }}>
      <div style={{
        background:'var(--bg-primary)', border:'1px solid var(--border)',
        borderRadius:16, padding:'2rem', width:'100%', maxWidth:520,
        boxShadow:'0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:17, marginBottom:2 }}>
              {isEdit ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}
            </h2>
            <p style={{ fontSize:12, color:'var(--text-secondary)' }}>
              {isEdit ? `Mengubah data ${loc!.name}` : 'Isi detail lokasi/cabang parkir'}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:4 }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'0.75rem', background:'#ef444415',
            border:'1px solid #ef444430', borderRadius:8, marginBottom:'1rem', fontSize:13, color:'#ef4444' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Form grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {fields.map(f => (
            <div key={f.key} style={{ gridColumn: f.half ? 'auto' : '1/-1' }}>
              <label className="form-label">{f.label}</label>
              <input
                className="form-input"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={(form as Record<string,unknown>)[f.key] as string}
                onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </div>
          ))}

          {/* Status toggle */}
          <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'var(--bg-secondary)', borderRadius:8, padding:'0.75rem 1rem' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>Status Lokasi</div>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                {form.is_active ? 'Lokasi aktif dan dapat menerima kendaraan' : 'Lokasi dinonaktifkan'}
              </div>
            </div>
            <button
              onClick={() => set('is_active', !form.is_active)}
              style={{
                background: form.is_active ? '#22c55e20' : '#ef444420',
                border: `1px solid ${form.is_active ? '#22c55e40' : '#ef444440'}`,
                color: form.is_active ? '#22c55e' : '#ef4444',
                borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:700,
                display:'flex', alignItems:'center', gap:6,
              }}>
              {form.is_active ? <><ToggleRight size={16}/> Aktif</> : <><ToggleLeft size={16}/> Nonaktif</>}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8, marginTop:'1.5rem' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex:1 }} disabled={saving}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={handleSave} style={{ flex:2, justifyContent:'center' }} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width:14, height:14 }}/> Menyimpan…</> : <><Check size={15}/> {isEdit ? 'Simpan Perubahan' : 'Buat Lokasi'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Delete Confirm Dialog
// ─────────────────────────────────────────────
const DeleteDialog: React.FC<{
  name: string; onCancel: () => void; onConfirm: () => void; loading: boolean;
}> = ({ name, onCancel, onConfirm, loading }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:2000 }}>
    <div style={{ background:'var(--bg-primary)', border:'1px solid #ef444440', borderRadius:14,
      padding:'2rem', maxWidth:380, width:'100%', textAlign:'center' }}>
      <div style={{ width:56, height:56, borderRadius:'50%', background:'#ef444415',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
        <Trash2 size={26} color="#ef4444" />
      </div>
      <h3 style={{ fontFamily:'var(--font-display)', marginBottom:8 }}>Hapus Lokasi?</h3>
      <p style={{ color:'var(--text-secondary)', fontSize:13, marginBottom:'1.5rem' }}>
        <strong>{name}</strong> akan dinonaktifkan. Data yang sudah ada tidak akan dihapus.
      </p>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-secondary" onClick={onCancel} style={{ flex:1 }} disabled={loading}>Batal</button>
        <button className="btn btn-danger"    onClick={onConfirm} style={{ flex:1, justifyContent:'center' }} disabled={loading}>
          {loading ? <div className="spinner" style={{ width:14, height:14 }}/> : 'Ya, Nonaktifkan'}
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Right Panel Tabs
// ─────────────────────────────────────────────
type Tab = 'overview' | 'slots' | 'gates' | 'users' | 'transactions';

const TAB_LIST: { id: Tab; label: string; icon: React.FC<{ size: number }> }[] = [
  { id:'overview',     label:'Ringkasan',  icon: Activity },
  { id:'slots',        label:'Slot Parkir', icon: ParkingSquare },
  { id:'gates',        label:'Gate',        icon: DoorOpen },
  { id:'users',        label:'User',        icon: Users },
  { id:'transactions', label:'Transaksi',   icon: Receipt },
];

// ─────────────────────────────────────────────
// Detail Panel
// ─────────────────────────────────────────────
const DetailPanel: React.FC<{
  loc: Location; stat: LocationStat | undefined;
  onEdit: () => void; onDelete: () => void;
}> = ({ loc, stat, onEdit, onDelete }) => {
  const [tab,   setTab]   = useState<Tab>('overview');
  const [gates, setGates] = useState<Gate[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [txs,   setTxs]   = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTab = useCallback(async (t: Tab) => {
    if (t === 'overview') return;
    setLoading(true);
    try {
      if (t === 'gates')        { const r = await apiClient.get(`/gates?location_id=${loc.id}`);         setGates(r.data.data || []); }
      if (t === 'slots')        { const r = await apiClient.get(`/slots?location_id=${loc.id}`);         setSlots(r.data.data || []); }
      if (t === 'users')        { const r = await apiClient.get(`/users?location_id=${loc.id}`);         setUsers(r.data.data || []); }
      if (t === 'transactions') { const r = await apiClient.get(`/transactions?location_id=${loc.id}&limit=30`); setTxs(r.data.data || []); }
    } finally { setLoading(false); }
  }, [loc.id]);

  useEffect(() => { setTab('overview'); }, [loc.id]);
  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const occ = stat?.occupancy_pct ?? 0;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Location header */}
      <div style={{
        padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border)',
        background:'var(--bg-secondary)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, margin:0 }}>{loc.name}</h2>
              <span style={{
                fontSize:10, padding:'2px 8px', borderRadius:4,
                background:'#38bdf815', color:'#38bdf8',
                fontFamily:'monospace', fontWeight:700, border:'1px solid #38bdf830',
              }}>{loc.code}</span>
              <StatusBadge active={loc.is_active} />
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:12, color:'var(--text-secondary)' }}>
              {loc.city    && <span style={{ display:'flex', alignItems:'center', gap:4 }}><MapPin size={12}/>{loc.city}</span>}
              {loc.phone   && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Phone size={12}/>{loc.phone}</span>}
              {loc.email   && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Mail size={12}/>{loc.email}</span>}
              {loc.address && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Building2 size={12}/>{loc.address}</span>}
            </div>
          </div>

          <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:12 }}>
            <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{ fontSize:11, padding:'5px 10px' }}>
              <Edit2 size={12}/> Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ fontSize:11, padding:'5px 10px' }}>
              <Trash2 size={12}/> Hapus
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)', padding:'0 1.25rem' }}>
        {TAB_LIST.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:'none', border:'none', cursor:'pointer', padding:'0.6rem 0.875rem',
            fontSize:12, display:'flex', alignItems:'center', gap:6,
            color: tab === id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderBottom: tab === id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            marginBottom:-1, fontWeight: tab === id ? 600 : 400, transition:'all 0.15s',
          }}>
            <Icon size={13}/> {label}
          </button>
        ))}
        <button onClick={() => loadTab(tab)} style={{
          background:'none', border:'none', cursor:'pointer', marginLeft:'auto',
          color:'#64748b', padding:'0.6rem',
        }}>
          <RefreshCw size={13}/>
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div>
            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:'1.25rem' }}>
              {[
                { label:'Total Slot',     value: stat?.total_slots ?? loc.capacity,    color:'#38bdf8', icon: ParkingSquare },
                { label:'Tersedia',       value: stat?.available_slots ?? 0,           color:'#22c55e', icon: CheckCircle },
                { label:'Terisi',         value: stat?.occupied_slots ?? 0,            color:'#ef4444', icon: Car },
                { label:'Transaksi Aktif', value: stat?.active_transactions ?? 0,      color:'#f59e0b', icon: Activity },
              ].map(k => (
                <div key={k.label} style={{
                  background:'var(--bg-secondary)', border:'1px solid var(--border)',
                  borderRadius:10, padding:'0.875rem',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{k.label}</span>
                    <k.icon size={14} color={k.color} />
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, color:k.color, fontFamily:'var(--font-display)' }}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Occupancy + Revenue */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:'1.25rem' }}>
              {/* Occupancy ring */}
              <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:'1rem' }}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:'0.75rem' }}>Tingkat Okupansi</div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <OccupancyRing pct={occ} size={64} />
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                      {stat?.occupied_slots ?? 0} dari {stat?.total_slots ?? loc.capacity} slot terisi
                    </div>
                    <div style={{ fontSize:11, color: occ > 85 ? '#ef4444' : occ > 60 ? '#f59e0b' : '#22c55e', marginTop:4, fontWeight:600 }}>
                      {occ > 85 ? '🔴 Hampir Penuh' : occ > 60 ? '🟡 Cukup Sibuk' : '🟢 Tersedia Banyak'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue today */}
              <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:'1rem' }}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:6 }}>
                  <TrendingUp size={13} color="#22c55e"/> Pendapatan Hari Ini
                </div>
                <div style={{ fontSize:22, fontWeight:700, color:'#22c55e', fontFamily:'var(--font-display)', marginBottom:6 }}>
                  {formatRp(stat?.today_revenue ?? 0)}
                </div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                  Kapasitas: {loc.capacity} slot
                </div>
              </div>
            </div>

            {/* Info detail */}
            <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:'1rem' }}>
              <div style={{ fontSize:12, fontWeight:600, marginBottom:'0.875rem' }}>Informasi Lokasi</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Kode',       value: loc.code,      icon: Hash },
                  { label:'Kota',       value: loc.city || '-', icon: MapPin },
                  { label:'Telepon',    value: loc.phone || '-', icon: Phone },
                  { label:'Email',      value: loc.email || '-', icon: Mail },
                  { label:'Kapasitas',  value: `${loc.capacity} slot`, icon: Layers },
                  { label:'Dibuat',     value: formatDate(loc.created_at), icon: Activity },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                    <Icon size={13} color="#64748b" style={{ marginTop:1, flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:10, color:'#64748b' }}>{label}</div>
                      <div style={{ fontSize:12, fontWeight:500 }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
              {loc.address && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)', fontSize:12, color:'var(--text-secondary)', display:'flex', gap:8 }}>
                  <Building2 size={13} style={{ flexShrink:0, marginTop:1 }}/> {loc.address}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SLOTS ── */}
        {tab === 'slots' && (
          <div>
            {loading ? <div style={{ textAlign:'center', padding:'3rem' }}><div className="spinner" style={{ margin:'0 auto' }}/></div> : (
              <>
                {/* Summary pills */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:'1rem' }}>
                  {['available','occupied','reserved','maintenance'].map(s => {
                    const count = slots.filter(sl => sl.status === s).length;
                    const colors: Record<string,string> = { available:'#22c55e', occupied:'#ef4444', reserved:'#f59e0b', maintenance:'#64748b' };
                    return (
                      <div key={s} style={{
                        background:`${colors[s]}15`, border:`1px solid ${colors[s]}40`,
                        color:colors[s], borderRadius:6, padding:'4px 12px', fontSize:11, fontWeight:700,
                      }}>
                        {count} {s}
                      </div>
                    );
                  })}
                </div>

                {/* Grid view */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:6 }}>
                  {slots.map(sl => {
                    const bg: Record<string,string> = { available:'#22c55e15', occupied:'#ef444415', reserved:'#f59e0b15', maintenance:'#64748b15' };
                    const bd: Record<string,string> = { available:'#22c55e40', occupied:'#ef444440', reserved:'#f59e0b40', maintenance:'#64748b40' };
                    const tx: Record<string,string> = { available:'#22c55e', occupied:'#ef4444', reserved:'#f59e0b', maintenance:'#94a3b8' };
                    return (
                      <div key={sl.id} style={{
                        background: bg[sl.status] || '#1e293b',
                        border: `1px solid ${bd[sl.status] || '#334155'}`,
                        borderRadius:8, padding:'8px 6px', textAlign:'center',
                      }}>
                        <div style={{ fontSize:11, fontWeight:700, color:tx[sl.status], fontFamily:'monospace' }}>
                          {sl.slot_number}
                        </div>
                        <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>
                          {sl.zone} · {sl.floor}
                        </div>
                      </div>
                    );
                  })}
                  {slots.length === 0 && (
                    <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'3rem', color:'#64748b', fontSize:13 }}>
                      <ParkingSquare size={32} style={{ margin:'0 auto 0.75rem', display:'block', opacity:0.3 }}/>
                      Belum ada slot terdaftar di lokasi ini
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── GATES ── */}
        {tab === 'gates' && (
          <div>
            {loading ? <div style={{ textAlign:'center', padding:'3rem' }}><div className="spinner" style={{ margin:'0 auto' }}/></div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {gates.map(g => (
                  <div key={g.id} style={{
                    background:'var(--bg-secondary)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'0.875rem 1rem',
                    display:'flex', alignItems:'center', gap:12,
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:8, flexShrink:0,
                      background: g.status === 'open' ? '#22c55e20' : '#ef444420',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <DoorOpen size={18} color={g.status === 'open' ? '#22c55e' : '#ef4444'}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{g.name}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>
                        {g.type === 'entry' ? '↓ Masuk' : '↑ Keluar'} · {g.location}
                        {g.ip_address && ` · ${g.ip_address}`}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <span className={`badge badge-${g.status === 'open' ? 'success' : 'danger'}`} style={{ fontSize:10 }}>
                        {g.status === 'open' ? '● BUKA' : '● TUTUP'}
                      </span>
                      <span style={{ fontSize:10, color:'#64748b' }}>{g.type}</span>
                    </div>
                  </div>
                ))}
                {gates.length === 0 && (
                  <div style={{ textAlign:'center', padding:'3rem', color:'#64748b', fontSize:13 }}>
                    <DoorOpen size={32} style={{ margin:'0 auto 0.75rem', display:'block', opacity:0.3 }}/>
                    Belum ada gate di lokasi ini
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div>
            {loading ? <div style={{ textAlign:'center', padding:'3rem' }}><div className="spinner" style={{ margin:'0 auto' }}/></div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {users.map(u => (
                  <div key={u.id} style={{
                    background:'var(--bg-secondary)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'0.875rem 1rem',
                    display:'flex', alignItems:'center', gap:12,
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:'50%', flexShrink:0,
                      background:'linear-gradient(135deg,#38bdf8,#818cf8)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, fontWeight:700, color:'#0a0e1a',
                    }}>
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{u.email}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <span style={{
                        fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:700,
                        background:'#38bdf815', color:'#38bdf8', border:'1px solid #38bdf830',
                      }}>{u.role_name}</span>
                      <StatusBadge active={u.is_active} />
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div style={{ textAlign:'center', padding:'3rem', color:'#64748b', fontSize:13 }}>
                    <Users size={32} style={{ margin:'0 auto 0.75rem', display:'block', opacity:0.3 }}/>
                    Belum ada user di lokasi ini
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {tab === 'transactions' && (
          <div>
            {loading ? <div style={{ textAlign:'center', padding:'3rem' }}><div className="spinner" style={{ margin:'0 auto' }}/></div> : (
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tiket</th>
                      <th>Plat</th>
                      <th>Masuk</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily:'monospace', fontSize:11 }}>{tx.ticket_number}</td>
                        <td style={{ fontWeight:600 }}>{tx.plate_number}</td>
                        <td style={{ fontSize:11, color:'var(--text-secondary)' }}>{formatDate(tx.entry_time)}</td>
                        <td style={{ fontWeight:700, color:'var(--accent-cyan)' }}>
                          {tx.total_amount > 0 ? formatRp(tx.total_amount) : '-'}
                        </td>
                        <td>
                          <span className={`badge badge-${tx.status === 'active' ? 'warning' : tx.status === 'completed' ? 'success' : 'secondary'}`}
                            style={{ fontSize:10 }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {txs.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign:'center', padding:'3rem', color:'#64748b', fontSize:13 }}>
                        Belum ada transaksi
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export const LocationsPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();

  const [locations,  setLocations]  = useState<Location[]>([]);
  const [stats,      setStats]      = useState<LocationStat[]>([]);
  const [selected,   setSelected]   = useState<Location | null>(null);
  const [search,     setSearch]     = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [modal,      setModal]      = useState<'create' | 'edit' | null>(null);
  const [delTarget,  setDelTarget]  = useState<Location | null>(null);
  const [delLoading, setDelLoading] = useState(false);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const [locR, statR] = await Promise.all([
        apiClient.get('/locations'),
        isSuperAdmin ? apiClient.get('/locations/stats') : Promise.resolve({ data:{ data:[] } }),
      ]);
      const locs = locR.data.data || [];
      setLocations(locs);
      setStats(statR.data.data || []);
      // Auto-select first if none selected
      setSelected(prev => prev ? (locs.find((l: Location) => l.id === prev.id) ?? locs[0] ?? null) : locs[0] ?? null);
    } finally { setLoadingList(false); }
  }, [isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!delTarget) return;
    setDelLoading(true);
    try {
      await apiClient.delete(`/locations/${delTarget.id}`);
      setDelTarget(null);
      if (selected?.id === delTarget.id) setSelected(null);
      load();
    } catch (e: unknown) {
      alert((e as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Gagal menghapus');
    } finally { setDelLoading(false); }
  };

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase()) ||
    l.city.toLowerCase().includes(search.toLowerCase())
  );

  const getStatFor = (id: string) => stats.find(s => s.id === id);

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, marginBottom:2 }}>Master Lokasi</h1>
          <p style={{ fontSize:13, color:'var(--text-secondary)' }}>
            Kelola cabang/lokasi parkir dan lihat data per lokasi
          </p>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={() => setModal('create')} style={{ gap:8 }}>
            <Plus size={15}/> Tambah Lokasi
          </button>
        )}
      </div>

      {/* Split layout */}
      <div style={{
        display:'grid', gridTemplateColumns:'280px 1fr',
        gap:0, border:'1px solid var(--border)', borderRadius:14,
        overflow:'hidden', background:'var(--bg-primary)',
        height:'calc(100vh - 180px)', minHeight:500,
      }}>
        {/* ── LEFT: Location List ── */}
        <div style={{
          borderRight:'1px solid var(--border)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          background:'var(--bg-secondary)',
        }}>
          {/* Search */}
          <div style={{ padding:'0.875rem', borderBottom:'1px solid var(--border)' }}>
            <div style={{ position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#64748b' }}/>
              <input
                className="form-input"
                style={{ paddingLeft:30, fontSize:12, height:34 }}
                placeholder="Cari nama, kode, kota..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:2,
                }}>
                  <X size={12}/>
                </button>
              )}
            </div>
          </div>

          {/* Count */}
          <div style={{ padding:'6px 12px', fontSize:11, color:'#64748b', borderBottom:'1px solid var(--border)' }}>
            {filtered.length} lokasi{search && ` dari ${locations.length}`}
          </div>

          {/* List */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {loadingList ? (
              <div style={{ padding:'3rem', textAlign:'center' }}>
                <div className="spinner" style={{ margin:'0 auto' }}/>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'#64748b', fontSize:13 }}>
                <MapPin size={28} style={{ margin:'0 auto 0.5rem', display:'block', opacity:0.3 }}/>
                Tidak ditemukan
              </div>
            ) : filtered.map(loc => {
              const st  = getStatFor(loc.id);
              const occ = st?.occupancy_pct ?? 0;
              const isActive = selected?.id === loc.id;

              return (
                <div
                  key={loc.id}
                  onClick={() => setSelected(loc)}
                  style={{
                    padding:'0.875rem 1rem', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background: isActive ? '#38bdf810' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                    transition:'all 0.15s',
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                        {loc.name}
                        {!loc.is_active && <span style={{ fontSize:9, color:'#ef4444', fontWeight:700 }}>NONAKTIF</span>}
                      </div>
                      <div style={{ fontSize:10, color:'#64748b', display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                        <span style={{ fontFamily:'monospace', color:'#38bdf8', fontWeight:700 }}>{loc.code}</span>
                        {loc.city && <span>{loc.city}</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} color={isActive ? '#38bdf8' : '#334155'}/>
                  </div>

                  {/* Mini occupancy bar */}
                  {st && (
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#64748b', marginBottom:3 }}>
                        <span>{st.occupied_slots}/{st.total_slots} slot</span>
                        <span style={{ color: occ > 85 ? '#ef4444' : occ > 60 ? '#f59e0b' : '#22c55e', fontWeight:700 }}>
                          {occ.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height:3, background:'#1e293b', borderRadius:2 }}>
                        <div style={{
                          height:'100%', borderRadius:2,
                          width:`${Math.min(occ, 100)}%`,
                          background: occ > 85 ? '#ef4444' : occ > 60 ? '#f59e0b' : '#22c55e',
                          transition:'width 0.5s ease',
                        }}/>
                      </div>
                      {st.active_transactions > 0 && (
                        <div style={{ fontSize:10, color:'#f59e0b', marginTop:3, display:'flex', alignItems:'center', gap:4 }}>
                          <Activity size={9}/> {st.active_transactions} transaksi aktif · {formatRp(st.today_revenue)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer stats */}
          {stats.length > 0 && (
            <div style={{ padding:'0.75rem 1rem', borderTop:'1px solid var(--border)', background:'var(--bg-primary)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Total Slot', value: stats.reduce((a,s) => a + s.total_slots, 0), color:'#38bdf8' },
                  { label:'Terisi', value: stats.reduce((a,s) => a + s.occupied_slots, 0), color:'#ef4444' },
                  { label:'Revenue Hari Ini', value: formatRp(stats.reduce((a,s) => a + s.today_revenue, 0)), color:'#22c55e', full:true },
                ].map(m => (
                  <div key={m.label} style={{ gridColumn: (m as { full?: boolean }).full ? '1/-1' : 'auto', textAlign:'center',
                    background:'var(--bg-secondary)', borderRadius:6, padding:'5px 8px' }}>
                    <div style={{ fontSize:9, color:'#64748b' }}>{m.label}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        {selected ? (
          <DetailPanel
            loc={selected}
            stat={getStatFor(selected.id)}
            onEdit={() => setModal('edit')}
            onDelete={() => setDelTarget(selected)}
          />
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'#64748b' }}>
            <MapPin size={48} strokeWidth={1} style={{ opacity:0.2 }}/>
            <div style={{ fontSize:14 }}>Pilih lokasi dari daftar</div>
            {isSuperAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal('create')} style={{ gap:6 }}>
                <Plus size={13}/> Tambah Lokasi Baru
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <LocationModal
          loc={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {delTarget && (
        <DeleteDialog
          name={delTarget.name}
          onCancel={() => setDelTarget(null)}
          onConfirm={handleDelete}
          loading={delLoading}
        />
      )}
    </>
  );
};
