import React, { useState, useEffect } from 'react';
import { getMembers, createMember, updateMember, deleteMember } from '../api/client';
import type { Member } from '../types';
import { UserPlus, Pencil, Trash2, RefreshCw, X, CheckCircle, BadgePercent } from 'lucide-react';

const MEMBERSHIP_LABEL: Record<string, string> = {
  monthly: 'Bulanan',
  yearly: 'Tahunan',
  vip: 'VIP',
  corporate: 'Korporat',
};

const isExpired = (validUntil: string) => new Date(validUntil) < new Date(new Date().toDateString());

interface MemberForm {
  plate_number: string;
  member_name: string;
  phone: string;
  membership_type: string;
  discount_percent: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const inOneMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

const emptyForm = (): MemberForm => ({
  plate_number: '',
  member_name: '',
  phone: '',
  membership_type: 'monthly',
  discount_percent: '10',
  valid_from: today(),
  valid_until: inOneMonth(),
  is_active: true,
  notes: '',
});

export const MembersPage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getMembers();
      setMembers(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setMsg('');
    setShowModal(true);
  };

  const openEdit = (m: Member) => {
    setEditingId(m.id);
    setForm({
      plate_number: m.plate_number,
      member_name: m.member_name,
      phone: m.phone,
      membership_type: m.membership_type,
      discount_percent: String(m.discount_percent),
      valid_from: m.valid_from.slice(0, 10),
      valid_until: m.valid_until.slice(0, 10),
      is_active: m.is_active,
      notes: m.notes,
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
        plate_number: form.plate_number.toUpperCase().replace(/\s/g, ''),
        member_name: form.member_name,
        phone: form.phone,
        membership_type: form.membership_type,
        discount_percent: Number(form.discount_percent),
        valid_from: form.valid_from,
        valid_until: form.valid_until,
        is_active: form.is_active,
        notes: form.notes,
      };
      if (editingId) {
        await updateMember(editingId, payload);
      } else {
        await createMember(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menyimpan member');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (m: Member) => {
    if (!confirm(`Nonaktifkan member ${m.member_name} (${m.plate_number})?`)) return;
    try {
      await deleteMember(m.id);
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
          background: 'rgba(168,139,250,0.1)', border: '1px solid rgba(168,139,250,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BadgePercent size={20} color="#a78bfa" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Member &amp; Langganan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Kendaraan terdaftar dapat diskon otomatis saat keluar
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          <UserPlus size={16} /> Daftarkan Member
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
                <th>Plat Nomor</th>
                <th>Nama Member</th>
                <th>Jenis</th>
                <th>Diskon</th>
                <th>Berlaku Sampai</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const expired = isExpired(m.valid_until);
                return (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{m.plate_number}</td>
                    <td>{m.member_name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {MEMBERSHIP_LABEL[m.membership_type] ?? m.membership_type}
                    </td>
                    <td style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{m.discount_percent}%</td>
                    <td style={{ fontSize: 13, color: expired ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                      {new Date(m.valid_until).toLocaleDateString('id-ID')}
                    </td>
                    <td>
                      {!m.is_active
                        ? <span className="badge badge-gray">Nonaktif</span>
                        : expired
                          ? <span className="badge badge-red">Kedaluwarsa</span>
                          : <span className="badge badge-green">Aktif</span>
                      }
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>
                        <Pencil size={13} /> Edit
                      </button>
                      {m.is_active && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(m)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Belum ada member terdaftar
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
              <span className="modal-title">{editingId ? 'Edit Member' : 'Daftarkan Member Baru'}</span>
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
                <label className="form-label">Plat Nomor</label>
                <input
                  className="form-input" style={{ textTransform: 'uppercase' }}
                  value={form.plate_number}
                  onChange={e => setForm(p => ({ ...p, plate_number: e.target.value.toUpperCase() }))}
                  placeholder="B 1234 ABC"
                  disabled={!!editingId}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Member</label>
                <input
                  className="form-input"
                  value={form.member_name}
                  onChange={e => setForm(p => ({ ...p, member_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">No. Telepon (opsional)</label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Jenis Keanggotaan</label>
                <select
                  className="form-input"
                  value={form.membership_type}
                  onChange={e => setForm(p => ({ ...p, membership_type: e.target.value }))}
                >
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                  <option value="vip">VIP</option>
                  <option value="corporate">Korporat</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Diskon (%)</label>
                <input
                  type="number" min={0} max={100} step={5} className="form-input"
                  value={form.discount_percent}
                  onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Berlaku Dari</label>
                  <input
                    type="date" className="form-input"
                    value={form.valid_from}
                    onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Berlaku Sampai</label>
                  <input
                    type="date" className="form-input"
                    value={form.valid_until}
                    onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Catatan (opsional)</label>
                <input
                  className="form-input"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
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
                    Member aktif
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
