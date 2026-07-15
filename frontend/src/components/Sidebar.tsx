import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, LogOut as LogOutIcon, DoorOpen,
  Receipt, Users, Settings, BarChart3, ParkingSquare, LogIn
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

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
      <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.15s',
              background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: isActive ? '1px solid rgba(56,189,248,0.2)' : '1px solid transparent',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--border)' }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 10,
          padding: '12px',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {user?.role_name}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseOver={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-red)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)';
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          }}
        >
          <LogOutIcon size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
};
