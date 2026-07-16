import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, LogOut as LogOutIcon, DoorOpen,
  Receipt, Users, BarChart3, ParkingSquare, LogIn, Zap
} from 'lucide-react';
import { useAuth } from '../store/auth';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/entry', icon: LogIn, label: 'Kendaraan Masuk' },
  { to: '/exit', icon: LogOutIcon, label: 'Kendaraan Keluar' },
  { to: '/slots', icon: ParkingSquare, label: 'Slot Parkir' },
  { to: '/gates', icon: DoorOpen, label: 'Gate Monitor' },
  { to: '/transactions', icon: Receipt, label: 'Transaksi' },
  { to: '/reports', icon: BarChart3, label: 'Laporan' },
  { to: '/users', icon: Users, label: 'Manajemen User' },
];

const simulatorItem = { to: '/simulator', icon: Zap, label: 'Simulator' };

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0.6rem 1rem',
    borderRadius: 8,
    color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-cyan-10)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
    fontSize: 13,
    textDecoration: 'none',
    transition: 'all 0.15s',
  });

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Car size={20} color="#0a0e1a" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--accent-cyan)', lineHeight: 1 }}>
              SMART
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1 }}>
              PARKING
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => linkStyle(isActive)}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: 10, color: '#475569', padding: '0 0.5rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            Simulator
          </div>
          <NavLink to={simulatorItem.to} style={({ isActive }) => ({
            ...linkStyle(isActive),
            background: isActive ? '#38bdf820' : '#38bdf808',
            color: isActive ? 'var(--accent-cyan)' : '#94a3b8',
            border: `1px solid ${isActive ? '#38bdf840' : '#38bdf815'}`,
          })}>
            <simulatorItem.icon size={16} />
            {simulatorItem.label}
            <span style={{
              marginLeft: 'auto', fontSize: 9, background: '#38bdf820',
              color: '#38bdf8', padding: '1px 5px', borderRadius: 3,
            }}>MQTT</span>
          </NavLink>
        </div>
      </nav>

      {/* User info */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#0a0e1a',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{user?.role_name || 'admin'}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none',
            background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontSize: 12,
          }}
        >
          <LogOutIcon size={14} />
          Logout
        </button>
      </div>
    </aside>
  );
};
