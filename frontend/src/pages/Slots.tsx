import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { getSlots, createSlot, createSlotsBulk, updateSlot, deleteSlot } from '../api/client';
import type { ParkingSlot } from '../types';
import { useAuth } from '../store/auth';
import { ParkingSquare, RefreshCw, Plus, Layers, Pencil, Trash2, X, CheckCircle } from 'lucide-react';

interface Location { id: string; name: string; code: string; }

const emptySlotForm = { slot_number: '', floor: '', zone: '', type: 'regular', status: 'available' };
const emptyFloorForm = { floor: '', zone: '', type: 'regular', count: 10, prefix: '' };

export const SlotsPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ParkingSlot | null>(null);
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [floorForm, setFloorForm] = useState(emptyFloorForm);
  const [saving, setSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [floorResult, setFloorResult] = useState('');

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSlots({
        status: filterStatus || undefined,
        zone: filterZone || undefined,
        location_id: isSuperAdmin && locationId ? locationId : undefined,
      });
      setSlots(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterZone, locationId, isSuperAdmin]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiClient.get('/locations').then(r => setLocations(r.data.data || [])).catch(() => {});
  }, [isSuperAdmin]);

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

  const closeSlotModal = () => { setShowSlotModal(false); setEditingSlot(null); };
  const openAddSlot = () => { setEditingSlot(null); setSlotForm(emptySlotForm); setModalMsg(''); setShowSlotModal(true); };
  const openEditSlot = (slot: ParkingSlot) => {
    setEditingSlot(slot);
    setSlotForm({ slot_number: slot.slot_number, floor: slot.floor, zone: slot.zone, type: slot.type, status: slot.status });
    setModalMsg('');
    setShowSlotModal(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalMsg('');
    try {
      if (editingSlot) {
        await updateSlot(editingSlot.id, slotForm);
      } else {
        await createSlot({ ...slotForm, location_id: isSuperAdmin ? locationId || undefined : undefined });
      }
      setShowSlotModal(false);
      setEditingSlot(null);
      fetchSlots();
    } catch (err: unknown) {
      setModalMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menyimpan slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slot: ParkingSlot) => {
    if (!confirm(`Hapus slot ${slot.slot_number}?`)) return;
    try {
      await deleteSlot(slot.id);
      fetchSlots();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menghapus slot');
    }
  };

  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalMsg('');
    setFloorResult('');
    try {
      const res = await createSlotsBulk({ ...floorForm, location_id: isSuperAdmin ? locationId || undefined : undefined });
      const d = res.data.data;
      setFloorResult(`${d.created} slot ditambahkan: ${d.from} – ${d.to}`);
      fetchSlots();
    } catch (err: unknown) {
      setModalMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menambah lantai');
    } finally {
      setSaving(false);
    }
  };

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
        {isSuperAdmin && (
          <select className="form-input" style={{ width: 200 }} value={locationId} onChange={e => setLocationId(e.target.value)}>
            <option value="">Semua Lokasi</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        )}
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setFloorForm(emptyFloorForm); setModalMsg(''); setFloorResult(''); setShowFloorModal(true); }}>
            <Layers size={15} /> Tambah Lantai
          </button>
          <button className="btn btn-primary" onClick={openAddSlot}>
            <Plus size={16} /> Tambah Slot
          </button>
        </div>
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
                  title={`${slot.slot_number}\nTipe: ${slot.type}\nStatus: ${slot.status}\nKlik untuk edit`}
                  onClick={() => openEditSlot(slot)}
                  style={{
                    width: 64, height: 64,
                    borderRadius: 10,
                    background: statusBg[slot.status],
                    border: `2px solid ${statusColor[slot.status]}40`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    cursor: 'pointer',
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
                {isSuperAdmin && <th>Lokasi</th>}
                <th>Aksi</th>
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
                  {isSuperAdmin && <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{slot.location_name || '-'}</td>}
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditSlot(slot)}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSlot(slot)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: add/edit single slot */}
      {showSlotModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeSlotModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editingSlot ? `Edit Slot ${editingSlot.slot_number}` : 'Tambah Slot Baru'}</span>
              <button onClick={() => closeSlotModal()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {modalMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: 'var(--accent-red)' }}>
                {modalMsg}
              </div>
            )}

            <form onSubmit={handleSaveSlot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nomor Slot</label>
                <input className="form-input" value={slotForm.slot_number} disabled={!!editingSlot}
                  onChange={e => setSlotForm(p => ({ ...p, slot_number: e.target.value.toUpperCase() }))}
                  placeholder="A21" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Lantai</label>
                  <input className="form-input" value={slotForm.floor} onChange={e => setSlotForm(p => ({ ...p, floor: e.target.value }))} placeholder="G / L1 / L2" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Zona</label>
                  <input className="form-input" value={slotForm.zone} onChange={e => setSlotForm(p => ({ ...p, zone: e.target.value.toUpperCase() }))} placeholder="A" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipe</label>
                  <select className="form-input" value={slotForm.type} onChange={e => setSlotForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="handicap">Handicap</option>
                    <option value="motorcycle">Motor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={slotForm.status} onChange={e => setSlotForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="available">Tersedia</option>
                    <option value="occupied">Terisi</option>
                    <option value="reserved">Reservasi</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => closeSlotModal()} style={{ flex: 1, justifyContent: 'center' }}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? <span className="spinner" /> : <CheckCircle size={16} />}
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: add floor (bulk slots) */}
      {showFloorModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowFloorModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Tambah Lantai Baru</span>
              <button onClick={() => setShowFloorModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Membuat sejumlah slot sekaligus untuk lantai baru, diberi nomor otomatis berurutan (mis. C01, C02, …).
            </p>

            {modalMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: 'var(--accent-red)' }}>
                {modalMsg}
              </div>
            )}
            {floorResult && (
              <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: 'var(--accent-green)' }}>
                ✓ {floorResult}
              </div>
            )}

            <form onSubmit={handleAddFloor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nama Lantai</label>
                  <input className="form-input" value={floorForm.floor} onChange={e => setFloorForm(p => ({ ...p, floor: e.target.value }))} placeholder="L2" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Zona</label>
                  <input className="form-input" value={floorForm.zone} onChange={e => setFloorForm(p => ({ ...p, zone: e.target.value.toUpperCase() }))} placeholder="C" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Jumlah Slot</label>
                  <input type="number" min={1} max={200} className="form-input" value={floorForm.count} onChange={e => setFloorForm(p => ({ ...p, count: parseInt(e.target.value) || 1 }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipe Slot</label>
                  <select className="form-input" value={floorForm.type} onChange={e => setFloorForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="handicap">Handicap</option>
                    <option value="motorcycle">Motor</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Prefix Nomor Slot (opsional)</label>
                <input className="form-input" value={floorForm.prefix} onChange={e => setFloorForm(p => ({ ...p, prefix: e.target.value.toUpperCase() }))} placeholder="Default: sama dengan Zona" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFloorModal(false)} style={{ flex: 1, justifyContent: 'center' }}>
                  Tutup
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? <span className="spinner" /> : <Layers size={16} />}
                  {saving ? 'Menambahkan...' : 'Tambah Lantai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
