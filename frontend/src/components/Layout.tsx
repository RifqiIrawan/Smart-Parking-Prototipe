import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const Layout: React.FC = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: 'var(--sidebar-w)',
        flex: 1,
        padding: '2rem',
        overflowY: 'auto',
        minHeight: '100vh',
      }}>
        <div className="fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
