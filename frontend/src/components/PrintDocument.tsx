import React from 'react';
import { Printer, X } from 'lucide-react';

// Print-friendly modal: shows a preview on screen, and when the user clicks
// "Cetak", only #print-area is sent to the printer (everything else — the
// sidebar, the modal chrome, the overlay — is hidden via @media print).
// The browser's print dialog also lets the user "Save as PDF" directly.
export const PrintDocument: React.FC<{
  children: React.ReactNode;
  onClose: () => void;
}> = ({ children, onClose }) => {
  return (
    <div className="print-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .print-overlay { position: static !important; background: none !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 380, width: '100%', maxHeight: '90vh', overflowY: 'auto', color: '#111' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Pratinjau Cetak</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        <div id="print-area" style={{ padding: '1.25rem' }}>
          {children}
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, padding: '0.875rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            Tutup
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
            <Printer size={15} /> Cetak
          </button>
        </div>
      </div>
    </div>
  );
};
