import React, { useState, useEffect } from 'react';
import { getTariffs, createTariff, updateTariff } from '../api/client';
import type { Tariff } from '../types';
import { Plus, Pencil, RefreshCw, X, CheckCircle, Wallet } from 'lucide-react';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const VEHICLE_LABEL: Record<string, string> = {
  car: '🚗 Mobil',
  motorcycle: '🏍️ Motor',
  truck: '🚛 Truk',
};

const vehicleLabel = (type: string) => VEHICLE_LABEL[type] ?? `🚘 ${type}`;

interface TariffForm {
  vehicle_type: string;
  first_hour_rate: string;
  next_hour_rate: string;
  max_daily_rate: string;
  is_active: boolean;
}

const emptyForm: TariffForm = {
  vehicle_type: '',
  first_hour_rate: '',
  next_hour_rate: '',
  max_daily_rate: '',
  is_active: true,
};

export const TariffsPage: React.FC = () => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TariffForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getTariffs();
      setTariffs(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMsg('');
    setShowModal(true);
  };

  const openEdit = (t: Tariff) => {
    setEditingId(t.id);
    setForm({
      vehicle_type: t.vehicle_type,
      first_hour_rate: String(t.first_hour_rate),
      next_hour_rate: String(t.next_hour_rate),
      max_daily_rate: String(t.max_daily_rate),
      is_active: t.is_active,
    });
    setMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        vehicle_type: form.vehicle_type.trim().toLowerCase(),
        first_hour_rate: Number(form.first_hour_rate),
        next_hour_rate: Number(form.next_hour_rate),
        max_daily_rate: Number(form.max_daily_rate) || 0,
        is_active: form.is_active,
      };
      if (editingId) {
        await updateTariff(editingId, payload);
      } else {
        await createTariff(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menyimpan tarif');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: Tariff) => {
    try {
      await updateTariff(t.id, {
        first_hour_rate: t.first_hour_rate,
        next_hour_rate: t.next_hour_rate,
        max_daily_rate: t.max_daily_rate,
        is_active: !t.is_active,
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Wallet size={20} color="var(--accent-cyan)" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Tarif Parkir</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Atur tarif per jam berdasarkan kategori kendaraan
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} />
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Kategori Kendaraan</th>
                <th>Tarif Jam Pertama</th>
                <th>Tarif Jam Berikutnya</th>
                <th>Tarif Maks. Harian</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{vehicleLabel(t.vehicle_type)}</td>
                  <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{formatRp(t.first_hour_rate)}</td>
                  <td style={{ fontSize: 13 }}>{formatRp(t.next_hour_rate)} / jam</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {t.max_daily_rate > 0 ? formatRp(t.max_daily_rate) : '-'}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(t)}
                      className={t.is_active ? 'badge badge-green' : 'badge badge-gray'}
                      style={{ border: 'none', cursor: 'pointer' }}
                      title="Klik untuk mengubah status"
                    >
                      {t.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {tariffs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Belum ada kategori tarif
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editingId ? 'Edit Tarif' : 'Tambah Kategori Tarif'}</span>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {msg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: 'var(--accent-red)' }}>
                {msg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Kategori Kendaraan</label>
                <input
                  className="form-input"
                  value={form.vehicle_type}
                  onChange={e => setForm(p => ({ ...p, vehicle_type: e.target.value }))}
                  placeholder="car / motorcycle / truck / ..."
                  disabled={!!editingId}
                  required
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Gunakan nama bahasa Inggris singkat, contoh: <code>car</code>, <code>motorcycle</code>, <code>truck</code>, <code>bus</code>
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Tarif Jam Pertama (Rp)</label>
                <input
                  type="number" min={0} step={500} className="form-input"
                  value={form.first_hour_rate}
                  onChange={e => setForm(p => ({ ...p, first_hour_rate: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tarif Jam Berikutnya (Rp/jam)</label>
                <input
                  type="number" min={0} step={500} className="form-input"
                  value={form.next_hour_rate}
                  onChange={e => setForm(p => ({ ...p, next_hour_rate: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tarif Maksimum Harian (Rp, opsional)</label>
                <input
                  type="number" min={0} step={1000} className="form-input"
                  value={form.max_daily_rate}
                  onChange={e => setForm(p => ({ ...p, max_daily_rate: e.target.value }))}
                  placeholder="Kosongkan jika tidak ada batas"
                />
              </div>
              {editingId && (
                <div className="form-group">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    />
                    Tarif aktif digunakan
                  </label>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: 'center' }}>
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
    </>
  );
};
