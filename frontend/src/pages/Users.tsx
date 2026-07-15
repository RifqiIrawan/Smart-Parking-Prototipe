import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { getUsers, createUser, deleteUser, getRoles } from '../api/client';
import { User } from '../types';
import { UserPlus, Trash2, RefreshCw, X, CheckCircle } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: 2 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([getUsers(), getRoles()]);
      setUsers(u.data.data || []);
      setRoles(r.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser(form);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role_id: 2 });
      fetchData();
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal membuat user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Nonaktifkan user ${name}?`)) return;
    try {
      await deleteUser(id);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Layout title="Manajemen User">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setMsg(''); }}>
          <UserPlus size={16} /> Tambah User
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
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className={u.role_name === 'admin' ? 'badge badge-purple' : u.role_name === 'operator' ? 'badge badge-blue' : 'badge badge-gray'}>
                      {u.role_name}
                    </span>
                  </td>
                  <td>
                    <span className={u.is_active ? 'badge badge-green' : 'badge badge-red'}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {new Date(u.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(u.id, u.name)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Tambah User Baru</span>
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

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password (min. 6 karakter)</label>
                <input type="password" className="form-input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={form.role_id} onChange={e => setForm(p => ({ ...p, role_id: parseInt(e.target.value) }))}>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
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
    </Layout>
  );
};
