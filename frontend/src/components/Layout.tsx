import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
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
        {title && (
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            marginBottom: '1.5rem',
            color: 'var(--text-primary)',
          }}>
            {title}
          </h1>
        )}
        <div className="fade-in">{children}</div>
      </main>
    </div>
  );
};
