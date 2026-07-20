import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, LogOut as LogOutIcon, DoorOpen,
  Receipt, Users, BarChart3, ParkingSquare, LogIn, Zap,
  MapPin, CreditCard, UserCheck, Shield,
} from 'lucide-react';
import { useAuth } from '../store/auth';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',         roles: [] },
  { to: '/entry',        icon: LogIn,           label: 'Kendaraan Masuk',   roles: [] },
  { to: '/exit',         icon: LogOutIcon,      label: 'Kendaraan Keluar',  roles: [] },
  { to: '/slots',        icon: ParkingSquare,   label: 'Slot Parkir',       roles: [] },
  { to: '/gates',        icon: DoorOpen,        label: 'Gate Monitor',      roles: [] },
  { to: '/transactions', icon: Receipt,         label: 'Transaksi',         roles: [] },
  { to: '/members',      icon: UserCheck,       label: 'Member',            roles: [] },
  { to: '/tariffs',      icon: CreditCard,      label: 'Tarif',             roles: ['super_admin','admin','operator'] },
  { to: '/reports',      icon: BarChart3,       label: 'Laporan',           roles: [] },
  { to: '/users',        icon: Users,           label: 'Manajemen User',    roles: ['super_admin','admin'] },
  { to: '/locations',    icon: MapPin,          label: 'Lokasi',            roles: ['super_admin','admin'] },
  { to: '/master-lokasi', icon: Shield,          label: 'Master Lokasi',    roles: ['super_admin'] },
];

const simulatorItem = { to: '/simulator', icon: Zap, label: 'Simulator' };

export const Sidebar: React.FC = () => {
  const { user, logout, isSuperAdmin, locationLabel } = useAuth();
  const navigate  = useNavigate();
  const role      = user?.role_name || '';

  const handleLogout = () => { logout(); navigate('/login'); };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0.6rem 1rem', borderRadius: 8,
    color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-cyan-10)' : 'transparent',
    fontWeight: isActive ? 600 : 400, fontSize: 13,
    textDecoration: 'none', transition: 'all 0.15s',
  });

  // admin has full access to all menu items
  const isFullAdmin = role === 'super_admin' || role === 'admin';
  const visibleItems = navItems.filter(item =>
    isFullAdmin || item.roles.length === 0 || item.roles.includes(role)
  );

  return (
    <aside style={{
      width: 'var(--sidebar-w)', height: '100vh',
      background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Car size={18} color="#0a0e1a" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--accent-cyan)', lineHeight: 1 }}>SMART</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1 }}>PARKING</div>
          </div>
        </div>

        {/* Location badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: role === 'super_admin' ? '#f59e0b10' : isSuperAdmin ? '#22c55e10' : '#38bdf810',
          border: `1px solid ${role === 'super_admin' ? '#f59e0b30' : isSuperAdmin ? '#22c55e30' : '#38bdf830'}`,
          borderRadius: 6, padding: '4px 8px',
        }}>
          <MapPin size={11} color={role === 'super_admin' ? '#f59e0b' : isSuperAdmin ? '#22c55e' : '#38bdf8'} />
          <span style={{
            fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            color: role === 'super_admin' ? '#f59e0b' : isSuperAdmin ? '#22c55e' : '#38bdf8',
          }}>
            {locationLabel}
          </span>
          {isSuperAdmin && (
            <span style={{
              fontSize: 8,
              background: role === 'super_admin' ? '#f59e0b' : '#22c55e',
              color: '#000',
              padding: '1px 4px', borderRadius: 3, fontWeight: 700, marginLeft: 'auto',
            }}>
              {role === 'super_admin' ? 'SUPER' : 'ADMIN'}
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.625rem', overflowY: 'auto' }}>
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => linkStyle(isActive)}>
            <Icon size={15} />
            {label}
          </NavLink>
        ))}

        {/* Simulator (divider) */}
        <div style={{ borderTop: '1px solid var(--border)', margin: '0.5rem 0', paddingTop: '0.5rem' }}>
          <NavLink to={simulatorItem.to} style={({ isActive }) => ({
            ...linkStyle(isActive),
            background: isActive ? '#38bdf820' : '#38bdf808',
            color: isActive ? 'var(--accent-cyan)' : '#94a3b8',
            border: `1px solid ${isActive ? '#38bdf840' : '#38bdf815'}`,
            fontSize: 12,
          })}>
            <simulatorItem.icon size={14} />
            {simulatorItem.label}
            <span style={{ marginLeft:'auto', fontSize:8, background:'#38bdf820', color:'#38bdf8', padding:'1px 4px', borderRadius:3 }}>MQTT</span>
          </NavLink>
        </div>
      </nav>

      {/* User info */}
      <div style={{ padding: '0.875rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: role === 'super_admin'
              ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
              : role === 'admin'
              ? 'linear-gradient(135deg, #22c55e, #38bdf8)'
              : 'linear-gradient(135deg, #38bdf8, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#0a0e1a',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {role === 'super_admin' ? '⭐ Super Admin' : role === 'admin' ? '🔑 Admin' : role}
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '0.45rem 0.75rem', borderRadius: 6, border: 'none',
          background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontSize: 12,
        }}>
          <LogOutIcon size={13} /> Logout
        </button>
      </div>
    </aside>
  );
};
