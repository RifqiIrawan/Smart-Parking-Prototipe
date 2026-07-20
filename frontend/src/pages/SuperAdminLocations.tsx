import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Plus, Edit2, Trash2, Building2, Car, Users, DoorOpen,
  TrendingUp, Search, RefreshCw, ToggleLeft, ToggleRight,
  Phone, Mail, Hash, Layers, AlertCircle, X, Check, ParkingSquare,
  Activity, Shield, Eye, EyeOff,
  Globe,
} from 'lucide-react';
import apiClient from '../api/client';

// ─────────────────────────── types ───────────────────────────
interface Location {
  id: string; name: string; code: string; address: string;
  city: string; phone: string; email: string; capacity: number;
  is_active: boolean; created_at: string; updated_at: string;
}
interface LocStat {
  id: string; name: string; code: string; city: string;
  available_slots: number; occupied_slots: number; total_slots: number;
  active_transactions: number; today_revenue: number; occupancy_pct: number;
}
interface Gate   { id:string; name:string; type:string; status:string; ip_address:string; is_active:boolean; }
interface Slot   { id:string; slot_number:string; floor:string; zone:string; type:string; status:string; }
interface User   { id:string; name:string; email:string; role_name:string; is_active:boolean; }
interface Tx     { id:string; ticket_number:string; plate_number:string; entry_time:string; total_amount:number; status:string; }

const Rp  = (n:number) => `Rp ${n.toLocaleString('id-ID')}`;
const dt  = (s:string) => s ? new Date(s).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'}) : '-';

// ─────────────────────────── Ring ────────────────────────────
const Ring: React.FC<{pct:number;size?:number}> = ({pct,size=52}) => {
  const r = (size-8)/2, c = 2*Math.PI*r;
  const col = pct>85?'#ef4444':pct>60?'#f59e0b':'#22c55e';
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)',flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
        strokeDasharray={`${c*Math.min(pct,100)/100} ${c}`} strokeLinecap="round"
        style={{transition:'stroke-dasharray 0.6s'}}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{fill:col,fontSize:11,fontWeight:700,transform:'rotate(90deg)',transformOrigin:'50% 50%'}}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
};

// ─────────────────────────── Location Form Modal ─────────────
const LocModal: React.FC<{loc:Location|null; onClose:()=>void; onSaved:()=>void}> = ({loc,onClose,onSaved}) => {
  const isEdit = !!loc;
  const [f,setF] = useState({
    name:loc?.name||'', code:loc?.code||'', address:loc?.address||'',
    city:loc?.city||'', phone:loc?.phone||'', email:loc?.email||'',
    capacity:loc?.capacity||0, is_active:loc?.is_active??true,
  });
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');

  const save = async () => {
    if (!f.name||!f.code){setErr('Nama dan Kode wajib diisi');return;}
    setSaving(true); setErr('');
    try {
      if(isEdit) await apiClient.put(`/locations/${loc!.id}`,f);
      else       await apiClient.post('/locations',f);
      onSaved();
    } catch(e:unknown){
      setErr((e as {response?:{data?:{message?:string}}})?.response?.data?.message||'Gagal menyimpan');
    } finally{setSaving(false);}
  };

  const row = (label:string, key:keyof typeof f, ph:string, type='text', half=false) => (
    <div key={key} style={{gridColumn:half?'auto':'1/-1'}}>
      <label className="form-label" style={{fontSize:11}}>{label}</label>
      <input className="form-input" type={type} placeholder={ph}
        value={String(f[key])}
        onChange={e=>setF(p=>({...p,[key]:type==='number'?Number(e.target.value):e.target.value}))}
        style={{height:34,fontSize:13}}/>
    </div>
  );

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(6px)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000}}>
      <div style={{background:'var(--bg-primary)',border:'1px solid var(--border)',borderRadius:16,
        padding:'1.75rem',width:'100%',maxWidth:500,boxShadow:'0 30px 60px rgba(0,0,0,.6)'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
          <div>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:16,marginBottom:2}}>
              {isEdit?`Edit: ${loc!.name}`:'Tambah Lokasi Baru'}
            </h3>
            <p style={{fontSize:11,color:'var(--text-secondary)'}}>Master data cabang/lokasi parkir</p>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}><X size={18}/></button>
        </div>

        {err && <div style={{display:'flex',gap:8,padding:'.625rem',background:'#ef444415',border:'1px solid #ef444430',
          borderRadius:8,marginBottom:'1rem',fontSize:12,color:'#ef4444'}}><AlertCircle size={13}/>{err}</div>}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {row('Nama Lokasi','name','Gedung Pusat')}
          {row('Kode','code','PST',undefined,true)}
          {row('Kota','city','Jakarta',undefined,true)}
          {row('Alamat','address','Jl. Sudirman No. 1')}
          {row('Telepon','phone','021-5550001',undefined,true)}
          {row('Email','email','lokasi@parkir.id',undefined,true)}
          {row('Kapasitas Slot','capacity','100','number',true)}

          <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',justifyContent:'space-between',
            background:'var(--bg-secondary)',borderRadius:8,padding:'.625rem .875rem'}}>
            <div>
              <div style={{fontSize:12,fontWeight:600}}>Status Lokasi</div>
              <div style={{fontSize:11,color:'var(--text-secondary)'}}>{f.is_active?'Aktif dan menerima kendaraan':'Dinonaktifkan'}</div>
            </div>
            <button onClick={()=>setF(p=>({...p,is_active:!p.is_active}))} style={{
              background:f.is_active?'#22c55e20':'#ef444420',
              border:`1px solid ${f.is_active?'#22c55e40':'#ef444440'}`,
              color:f.is_active?'#22c55e':'#ef4444',
              borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:700,
              display:'flex',alignItems:'center',gap:5}}>
              {f.is_active?<><ToggleRight size={14}/>Aktif</>:<><ToggleLeft size={14}/>Nonaktif</>}
            </button>
          </div>
        </div>

        <div style={{display:'flex',gap:8,marginTop:'1.25rem'}}>
          <button className="btn btn-secondary" onClick={onClose} style={{flex:1}} disabled={saving}>Batal</button>
          <button className="btn btn-primary" onClick={save} style={{flex:2,justifyContent:'center'}} disabled={saving}>
            {saving?<><div className="spinner" style={{width:13,height:13}}/> Menyimpan…</>:<><Check size={13}/>{isEdit?'Simpan':'Buat Lokasi'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────── Delete Confirm ──────────────────
const DelConfirm: React.FC<{name:string;onNo:()=>void;onYes:()=>void;loading:boolean}> = ({name,onNo,onYes,loading}) => (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',
    alignItems:'center',justifyContent:'center',zIndex:3000}}>
    <div style={{background:'var(--bg-primary)',border:'1px solid #ef444440',borderRadius:14,
      padding:'1.75rem',maxWidth:360,width:'100%',textAlign:'center'}}>
      <div style={{width:52,height:52,borderRadius:'50%',background:'#ef444415',margin:'0 auto .875rem',
        display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={24} color="#ef4444"/></div>
      <h3 style={{fontFamily:'var(--font-display)',marginBottom:6}}>Nonaktifkan Lokasi?</h3>
      <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:'1.25rem'}}>
        <strong>{name}</strong> akan dinonaktifkan. Data historis tetap tersimpan.
      </p>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-secondary" onClick={onNo} style={{flex:1}} disabled={loading}>Batal</button>
        <button className="btn btn-danger" onClick={onYes} style={{flex:1,justifyContent:'center'}} disabled={loading}>
          {loading?<div className="spinner" style={{width:13,height:13}}/>:'Nonaktifkan'}
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────── Location Detail Drawer ──────────
type DTab = 'overview'|'slots'|'gates'|'users'|'transactions';

const Drawer: React.FC<{
  loc:Location; stat:LocStat|undefined;
  onEdit:()=>void; onDelete:()=>void; onClose:()=>void;
}> = ({loc,stat,onEdit,onDelete,onClose}) => {
  const [tab,setTab] = useState<DTab>('overview');
  const [gates,setGates] = useState<Gate[]>([]);
  const [slots,setSlots] = useState<Slot[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [txs,  setTxs]   = useState<Tx[]>([]);
  const [loading,setLoading] = useState(false);

  const loadTab = useCallback(async(t:DTab)=>{
    if(t==='overview') return;
    setLoading(true);
    try {
      if(t==='gates')        setGates((await apiClient.get(`/gates?location_id=${loc.id}`)).data.data||[]);
      if(t==='slots')        setSlots((await apiClient.get(`/slots?location_id=${loc.id}`)).data.data||[]);
      if(t==='users')        setUsers((await apiClient.get(`/users?location_id=${loc.id}`)).data.data||[]);
      if(t==='transactions') setTxs((await apiClient.get(`/transactions?location_id=${loc.id}&limit=25`)).data.data||[]);
    } finally{setLoading(false);}
  },[loc.id]);

  useEffect(()=>{setTab('overview');},[loc.id]);
  useEffect(()=>{loadTab(tab);},[tab,loadTab]);

  const occ = stat?.occupancy_pct??0;
  const occColor = occ>85?'#ef4444':occ>60?'#f59e0b':'#22c55e';

  const TABS: {id:DTab;label:string;count?:number}[] = [
    {id:'overview',label:'Ringkasan'},
    {id:'slots',label:'Slot',count:stat?.total_slots},
    {id:'gates',label:'Gate'},
    {id:'users',label:'User'},
    {id:'transactions',label:'Transaksi'},
  ];

  return (
    <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex'}}>
      {/* Backdrop */}
      <div onClick={onClose} style={{flex:1,background:'rgba(0,0,0,.5)'}}/>

      {/* Drawer */}
      <div style={{width:560,background:'var(--bg-primary)',borderLeft:'1px solid var(--border)',
        display:'flex',flexDirection:'column',overflow:'hidden',
        boxShadow:'-20px 0 60px rgba(0,0,0,.5)'}}>

        {/* Header */}
        <div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid var(--border)',background:'var(--bg-secondary)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <h2 style={{fontFamily:'var(--font-display)',fontSize:17,margin:0}}>{loc.name}</h2>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:'#38bdf815',
                  color:'#38bdf8',fontFamily:'monospace',fontWeight:700,border:'1px solid #38bdf830'}}>{loc.code}</span>
                <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,fontWeight:700,
                  background:loc.is_active?'#22c55e20':'#ef444420',
                  color:loc.is_active?'#22c55e':'#ef4444',
                  border:`1px solid ${loc.is_active?'#22c55e40':'#ef444440'}`}}>
                  {loc.is_active?'AKTIF':'NONAKTIF'}
                </span>
              </div>
              <div style={{fontSize:11,color:'#64748b',display:'flex',gap:10,flexWrap:'wrap'}}>
                {loc.city&&<span style={{display:'flex',alignItems:'center',gap:3}}><MapPin size={10}/>{loc.city}</span>}
                {loc.phone&&<span style={{display:'flex',alignItems:'center',gap:3}}><Phone size={10}/>{loc.phone}</span>}
                {loc.email&&<span style={{display:'flex',alignItems:'center',gap:3}}><Mail size={10}/>{loc.email}</span>}
              </div>
            </div>
            <div style={{display:'flex',gap:6,marginLeft:8}}>
              <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{fontSize:11,padding:'4px 10px'}}>
                <Edit2 size={11}/> Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={onDelete} style={{fontSize:11,padding:'4px 10px'}}>
                <Trash2 size={11}/>
              </button>
              <button onClick={onClose} style={{background:'#1e293b',border:'1px solid var(--border)',
                borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#64748b'}}>
                <X size={14}/>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:2,marginTop:8}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                background:tab===t.id?'#38bdf820':'transparent',
                border:tab===t.id?'1px solid #38bdf840':'1px solid transparent',
                cursor:'pointer', padding:'5px 10px', borderRadius:6, fontSize:12,
                color:tab===t.id?'var(--accent-cyan)':'var(--text-secondary)',
                fontWeight:tab===t.id?700:400,
              }}>
                {t.label}{t.count!=null&&<span style={{marginLeft:4,fontSize:10,color:'#64748b'}}>({t.count})</span>}
              </button>
            ))}
            <button onClick={()=>loadTab(tab)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px 6px'}}>
              <RefreshCw size={12}/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'1.25rem'}}>

          {/* ── OVERVIEW ── */}
          {tab==='overview' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* 4 KPI */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
                {[
                  {label:'Total Slot', value:stat?.total_slots??loc.capacity, color:'#38bdf8',icon:ParkingSquare},
                  {label:'Tersedia',   value:stat?.available_slots??0,         color:'#22c55e',icon:Check},
                  {label:'Terisi',     value:stat?.occupied_slots??0,          color:'#ef4444',icon:Car},
                  {label:'Aktif TX',   value:stat?.active_transactions??0,     color:'#f59e0b',icon:Activity},
                ].map(k=>(
                  <div key={k.label} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',
                    borderRadius:10,padding:'.75rem .875rem'}}>
                    <k.icon size={13} color={k.color} style={{marginBottom:4}}/>
                    <div style={{fontSize:20,fontWeight:700,color:k.color,fontFamily:'var(--font-display)'}}>{k.value}</div>
                    <div style={{fontSize:10,color:'#64748b'}}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Occupancy + Revenue */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'1rem'}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:'var(--text-secondary)'}}>Tingkat Okupansi</div>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <Ring pct={occ} size={60}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:occColor}}>{occ.toFixed(1)}%</div>
                      <div style={{fontSize:11,color:'#64748b'}}>{stat?.occupied_slots??0}/{stat?.total_slots??loc.capacity} terisi</div>
                      <div style={{fontSize:10,marginTop:4,color:occColor,fontWeight:600}}>
                        {occ>85?'🔴 Hampir Penuh':occ>60?'🟡 Cukup Sibuk':'🟢 Banyak Tersedia'}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'1rem'}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:10,display:'flex',alignItems:'center',gap:5}}>
                    <TrendingUp size={12} color="#22c55e"/> Revenue Hari Ini
                  </div>
                  <div style={{fontSize:20,fontWeight:700,color:'#22c55e',fontFamily:'var(--font-display)',marginBottom:4}}>
                    {Rp(stat?.today_revenue??0)}
                  </div>
                  <div style={{fontSize:11,color:'#64748b'}}>Kapasitas: {loc.capacity} slot</div>
                </div>
              </div>

              {/* Detail info */}
              <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'1rem'}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Informasi Lokasi</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {label:'Kode',      value:loc.code,       icon:Hash},
                    {label:'Kota',      value:loc.city||'-',  icon:MapPin},
                    {label:'Telepon',   value:loc.phone||'-', icon:Phone},
                    {label:'Email',     value:loc.email||'-', icon:Mail},
                    {label:'Kapasitas', value:`${loc.capacity} slot`, icon:Layers},
                    {label:'Dibuat',    value:dt(loc.created_at), icon:Activity},
                  ].map(({label,value,icon:Icon})=>(
                    <div key={label} style={{display:'flex',gap:7,alignItems:'flex-start'}}>
                      <Icon size={12} color="#64748b" style={{marginTop:1,flexShrink:0}}/>
                      <div><div style={{fontSize:10,color:'#64748b'}}>{label}</div>
                        <div style={{fontSize:12,fontWeight:500}}>{value}</div></div>
                    </div>
                  ))}
                </div>
                {loc.address&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',
                    fontSize:12,color:'#94a3b8',display:'flex',gap:6,alignItems:'flex-start'}}>
                    <Building2 size={12} style={{flexShrink:0,marginTop:2}}/> {loc.address}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SLOTS ── */}
          {tab==='slots'&&(
            loading
              ? <div style={{textAlign:'center',padding:'3rem'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
              : <>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                    {['available','occupied','reserved','maintenance'].map(s=>{
                      const n=slots.filter(sl=>sl.status===s).length;
                      const c={available:'#22c55e',occupied:'#ef4444',reserved:'#f59e0b',maintenance:'#64748b'}[s]||'#94a3b8';
                      return <div key={s} style={{background:`${c}15`,border:`1px solid ${c}40`,color:c,
                        borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:700}}>{n} {s}</div>;
                    })}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(78px,1fr))',gap:5}}>
                    {slots.map(sl=>{
                      const bg={available:'#22c55e15',occupied:'#ef444415',reserved:'#f59e0b15',maintenance:'#64748b15'};
                      const bd={available:'#22c55e40',occupied:'#ef444440',reserved:'#f59e0b40',maintenance:'#64748b40'};
                      const tx={available:'#22c55e',occupied:'#ef4444',reserved:'#f59e0b',maintenance:'#94a3b8'};
                      return (
                        <div key={sl.id} style={{background:bg[sl.status as keyof typeof bg]||'#1e293b',
                          border:`1px solid ${bd[sl.status as keyof typeof bd]||'#334155'}`,
                          borderRadius:7,padding:'7px 5px',textAlign:'center'}}>
                          <div style={{fontSize:11,fontWeight:700,color:tx[sl.status as keyof typeof tx],fontFamily:'monospace'}}>{sl.slot_number}</div>
                          <div style={{fontSize:9,color:'#64748b',marginTop:2}}>{sl.zone}·{sl.floor}</div>
                        </div>
                      );
                    })}
                    {slots.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:'2.5rem',color:'#64748b',fontSize:12}}>
                      <ParkingSquare size={28} style={{display:'block',margin:'0 auto .5rem',opacity:.3}}/> Belum ada slot</div>}
                  </div>
                </>
          )}

          {/* ── GATES ── */}
          {tab==='gates'&&(
            loading
              ? <div style={{textAlign:'center',padding:'3rem'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
              : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {gates.map(g=>(
                    <div key={g.id} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',
                      borderRadius:10,padding:'.875rem',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:34,height:34,borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                        background:g.status==='open'?'#22c55e20':'#ef444420'}}>
                        <DoorOpen size={17} color={g.status==='open'?'#22c55e':'#ef4444'}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{g.name}</div>
                        <div style={{fontSize:11,color:'#64748b'}}>{g.type==='entry'?'↓ Masuk':'↑ Keluar'}{g.ip_address&&` · ${g.ip_address}`}</div>
                      </div>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,
                        background:g.status==='open'?'#22c55e20':'#ef444420',
                        color:g.status==='open'?'#22c55e':'#ef4444'}}>
                        {g.status==='open'?'● BUKA':'● TUTUP'}
                      </span>
                    </div>
                  ))}
                  {gates.length===0&&<div style={{textAlign:'center',padding:'2.5rem',color:'#64748b',fontSize:12}}>
                    <DoorOpen size={28} style={{display:'block',margin:'0 auto .5rem',opacity:.3}}/> Belum ada gate</div>}
                </div>
          )}

          {/* ── USERS ── */}
          {tab==='users'&&(
            loading
              ? <div style={{textAlign:'center',padding:'3rem'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
              : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {users.map(u=>(
                    <div key={u.id} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',
                      borderRadius:10,padding:'.875rem',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:34,height:34,borderRadius:'50%',flexShrink:0,
                        background:'linear-gradient(135deg,#38bdf8,#818cf8)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:13,fontWeight:700,color:'#0a0e1a'}}>{u.name[0]?.toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{u.name}</div>
                        <div style={{fontSize:11,color:'#64748b'}}>{u.email}</div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:4,fontWeight:700,
                          background:'#38bdf815',color:'#38bdf8',border:'1px solid #38bdf830'}}>{u.role_name}</span>
                        <span style={{fontSize:9,color:u.is_active?'#22c55e':'#ef4444'}}>{u.is_active?'● Aktif':'● Nonaktif'}</span>
                      </div>
                    </div>
                  ))}
                  {users.length===0&&<div style={{textAlign:'center',padding:'2.5rem',color:'#64748b',fontSize:12}}>
                    <Users size={28} style={{display:'block',margin:'0 auto .5rem',opacity:.3}}/> Belum ada user</div>}
                </div>
          )}

          {/* ── TRANSACTIONS ── */}
          {tab==='transactions'&&(
            loading
              ? <div style={{textAlign:'center',padding:'3rem'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
              : <div className="card" style={{padding:0,overflow:'hidden'}}>
                  <table className="table">
                    <thead><tr><th>Tiket</th><th>Plat</th><th>Masuk</th><th>Total</th><th>Status</th></tr></thead>
                    <tbody>
                      {txs.map(tx=>(
                        <tr key={tx.id}>
                          <td style={{fontFamily:'monospace',fontSize:10}}>{tx.ticket_number}</td>
                          <td style={{fontWeight:600,fontSize:12}}>{tx.plate_number}</td>
                          <td style={{fontSize:11,color:'#64748b'}}>{dt(tx.entry_time)}</td>
                          <td style={{fontWeight:700,color:'var(--accent-cyan)',fontSize:12}}>
                            {tx.total_amount>0?Rp(tx.total_amount):'-'}
                          </td>
                          <td><span className={`badge badge-${tx.status==='active'?'warning':tx.status==='completed'?'success':'secondary'}`}
                            style={{fontSize:9}}>{tx.status}</span></td>
                        </tr>
                      ))}
                      {txs.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:'2.5rem',color:'#64748b',fontSize:12}}>Belum ada transaksi</td></tr>}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────── MAIN PAGE ───────────────────────
export const SuperAdminLocationsPage: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats,     setStats]     = useState<LocStat[]>([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [drawer,    setDrawer]    = useState<Location|null>(null);
  const [modal,     setModal]     = useState<'create'|'edit'|null>(null);
  const [delTarget, setDelTarget] = useState<Location|null>(null);
  const [delLoading,setDelLoading]= useState(false);
  const [sortBy,    setSortBy]    = useState<'name'|'occupancy'|'revenue'>('name');
  const [showInactive, setShowInactive] = useState(true);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [lr,sr] = await Promise.all([
        apiClient.get('/locations'),
        apiClient.get('/locations/stats'),
      ]);
      setLocations(lr.data.data||[]);
      setStats(sr.data.data||[]);
    } finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const handleDel = async()=>{
    if(!delTarget) return;
    setDelLoading(true);
    try {
      await apiClient.delete(`/locations/${delTarget.id}`);
      if(drawer?.id===delTarget.id) setDrawer(null);
      setDelTarget(null);
      load();
    } catch(e:unknown){
      alert((e as {response?:{data?:{message?:string}}})?.response?.data?.message||'Gagal');
    } finally{setDelLoading(false);}
  };

  const statOf = (id:string) => stats.find(s=>s.id===id);

  // Totals
  const totalSlots  = stats.reduce((a,s)=>a+s.total_slots,0);
  const totalOcc    = stats.reduce((a,s)=>a+s.occupied_slots,0);
  const totalAvail  = stats.reduce((a,s)=>a+s.available_slots,0);
  const totalRev    = stats.reduce((a,s)=>a+s.today_revenue,0);
  const totalTx     = stats.reduce((a,s)=>a+s.active_transactions,0);
  const avgOcc      = totalSlots>0?totalOcc/totalSlots*100:0;

  // Filter + sort
  let filtered = locations
    .filter(l=>(showInactive||l.is_active) &&
      (l.name.toLowerCase().includes(search.toLowerCase())||
       l.code.toLowerCase().includes(search.toLowerCase())||
       l.city.toLowerCase().includes(search.toLowerCase())));

  if(sortBy==='occupancy') filtered = [...filtered].sort((a,b)=>(statOf(b.id)?.occupancy_pct??0)-(statOf(a.id)?.occupancy_pct??0));
  if(sortBy==='revenue')   filtered = [...filtered].sort((a,b)=>(statOf(b.id)?.today_revenue??0)-(statOf(a.id)?.today_revenue??0));
  if(sortBy==='name')      filtered = [...filtered].sort((a,b)=>a.name.localeCompare(b.name));

  return (
    <>
      {/* ── Header ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.25rem'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <Shield size={20} color="#f59e0b"/>
            <h1 style={{fontFamily:'var(--font-display)',fontSize:22,margin:0}}>Master Lokasi</h1>
            <span style={{fontSize:10,padding:'3px 8px',borderRadius:4,background:'#f59e0b20',
              color:'#f59e0b',fontWeight:700,border:'1px solid #f59e0b40'}}>SUPER ADMIN</span>
          </div>
          <p style={{fontSize:13,color:'var(--text-secondary)'}}>
            Kelola semua cabang/lokasi parkir — {locations.length} lokasi terdaftar
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal('create')} style={{gap:8}}>
          <Plus size={15}/> Tambah Lokasi
        </button>
      </div>

      {/* ── Global KPI Bar ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:'1.25rem'}}>
        {[
          {label:'Total Lokasi',    value:locations.length,     color:'#a78bfa',icon:Globe},
          {label:'Total Slot',      value:totalSlots,           color:'#38bdf8',icon:ParkingSquare},
          {label:'Slot Tersedia',   value:totalAvail,           color:'#22c55e',icon:Check},
          {label:'Transaksi Aktif', value:totalTx,              color:'#f59e0b',icon:Activity},
          {label:'Revenue Hari Ini',value:Rp(totalRev),         color:'#22c55e',icon:TrendingUp},
        ].map(k=>(
          <div key={k.label} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',
            borderRadius:10,padding:'.875rem',display:'flex',alignItems:'center',gap:10}}>
            <k.icon size={18} color={k.color} style={{flexShrink:0}}/>
            <div>
              <div style={{fontSize:11,color:'var(--text-secondary)'}}>{k.label}</div>
              <div style={{fontSize:16,fontWeight:700,color:k.color,fontFamily:'var(--font-display)'}}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Global Occupancy Bar ── */}
      <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,
        padding:'.875rem 1rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:16}}>
        <div style={{fontSize:12,color:'var(--text-secondary)',whiteSpace:'nowrap'}}>Okupansi Global</div>
        <div style={{flex:1}}>
          <div style={{height:8,background:'#1e293b',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,transition:'width 0.6s',
              width:`${Math.min(avgOcc,100)}%`,
              background:avgOcc>85?'#ef4444':avgOcc>60?'#f59e0b':'#22c55e'}}/>
          </div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:avgOcc>85?'#ef4444':avgOcc>60?'#f59e0b':'#22c55e',whiteSpace:'nowrap'}}>
          {avgOcc.toFixed(1)}% · {totalOcc}/{totalSlots} slot
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:'1rem',flexWrap:'wrap'}}>
        {/* Search */}
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#64748b'}}/>
          <input className="form-input" placeholder="Cari nama, kode, kota…" value={search}
            onChange={e=>setSearch(e.target.value)}
            style={{paddingLeft:30,fontSize:12,height:34}}/>
          {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:8,top:'50%',
            transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:2}}>
            <X size={11}/></button>}
        </div>

        {/* Sort */}
        <div style={{display:'flex',background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
          {([['name','Nama'],['occupancy','Okupansi'],['revenue','Revenue']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setSortBy(k)} style={{
              background:sortBy===k?'#38bdf820':'transparent',
              color:sortBy===k?'var(--accent-cyan)':'var(--text-secondary)',
              border:'none',cursor:'pointer',padding:'5px 12px',fontSize:11,
              borderRight:'1px solid var(--border)',fontWeight:sortBy===k?700:400}}>
              {l}
            </button>
          ))}
        </div>

        {/* Toggle nonaktif */}
        <button onClick={()=>setShowInactive(p=>!p)} style={{
          display:'flex',alignItems:'center',gap:6,fontSize:11,
          background:showInactive?'#38bdf815':'var(--bg-secondary)',
          border:`1px solid ${showInactive?'#38bdf840':'var(--border)'}`,
          color:showInactive?'#38bdf8':'var(--text-secondary)',
          borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>
          {showInactive?<Eye size={13}/>:<EyeOff size={13}/>}
          {showInactive?'Semua':'Aktif Saja'}
        </button>

        {/* Refresh */}
        <button onClick={load} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',
          borderRadius:8,padding:'5px 10px',cursor:'pointer',color:'#64748b'}}>
          <RefreshCw size={13}/>
        </button>
      </div>

      {/* ── Location Cards Grid ── */}
      {loading ? (
        <div style={{textAlign:'center',padding:'4rem'}}><div className="spinner" style={{margin:'0 auto',width:36,height:36}}/></div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
          {filtered.map(loc=>{
            const st  = statOf(loc.id);
            const occ = st?.occupancy_pct??0;
            const occCol = occ>85?'#ef4444':occ>60?'#f59e0b':'#22c55e';
            return (
              <div key={loc.id} onClick={()=>setDrawer(loc)} style={{
                background:'var(--bg-secondary)',border:'1px solid var(--border)',
                borderRadius:12,padding:'1rem',cursor:'pointer',
                transition:'all 0.2s',opacity:loc.is_active?1:0.6,
              }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='#38bdf8')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>

                {/* Card header */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <span style={{fontWeight:700,fontSize:14}}>{loc.name}</span>
                      {!loc.is_active&&<span style={{fontSize:9,color:'#ef4444',fontWeight:700}}>NONAKTIF</span>}
                    </div>
                    <div style={{fontSize:11,color:'#64748b',display:'flex',gap:8}}>
                      <span style={{fontFamily:'monospace',color:'#38bdf8',fontWeight:700}}>{loc.code}</span>
                      {loc.city&&<span>{loc.city}</span>}
                    </div>
                  </div>
                  <Ring pct={occ} size={48}/>
                </div>

                {/* Occupancy bar */}
                <div style={{marginBottom:10}}>
                  <div style={{height:5,background:'#1e293b',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:3,width:`${Math.min(occ,100)}%`,
                      background:occCol,transition:'width 0.5s'}}/>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
                  {[
                    {label:'Tersedia', value:st?.available_slots??0,  color:'#22c55e'},
                    {label:'Terisi',   value:st?.occupied_slots??0,   color:'#ef4444'},
                    {label:'TX Aktif', value:st?.active_transactions??0, color:'#f59e0b'},
                  ].map(m=>(
                    <div key={m.label} style={{background:'var(--bg-primary)',borderRadius:6,padding:'5px 8px',textAlign:'center'}}>
                      <div style={{fontSize:14,fontWeight:700,color:m.color}}>{m.value}</div>
                      <div style={{fontSize:9,color:'#64748b'}}>{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Revenue + actions */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  paddingTop:8,borderTop:'1px solid var(--border)'}}>
                  <div>
                    <div style={{fontSize:10,color:'#64748b'}}>Revenue Hari Ini</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#22c55e'}}>{Rp(st?.today_revenue??0)}</div>
                  </div>
                  <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={()=>{setDrawer(loc);setModal('edit');}}
                      style={{fontSize:10,padding:'3px 8px'}}>
                      <Edit2 size={10}/> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={()=>setDelTarget(loc)}
                      style={{fontSize:10,padding:'3px 8px'}}>
                      <Trash2 size={10}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filtered.length===0&&(
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:'4rem',color:'#64748b'}}>
              <Globe size={40} style={{display:'block',margin:'0 auto 1rem',opacity:.2}}/>
              <div style={{fontSize:14}}>Tidak ada lokasi ditemukan</div>
              {search&&<div style={{fontSize:12,marginTop:4}}>Coba ubah kata kunci pencarian</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Drawer ── */}
      {drawer&&(
        <Drawer
          loc={drawer}
          stat={statOf(drawer.id)}
          onEdit={()=>setModal('edit')}
          onDelete={()=>setDelTarget(drawer)}
          onClose={()=>setDrawer(null)}
        />
      )}

      {/* ── Modals ── */}
      {modal&&(
        <LocModal
          loc={modal==='edit'?drawer:null}
          onClose={()=>setModal(null)}
          onSaved={()=>{setModal(null);load();
            if(modal==='edit'&&drawer) apiClient.get(`/locations/${drawer.id}`).then(r=>setDrawer(r.data.data));
          }}
        />
      )}
      {delTarget&&(
        <DelConfirm name={delTarget.name} loading={delLoading}
          onNo={()=>setDelTarget(null)} onYes={handleDel}/>
      )}
    </>
  );
};
