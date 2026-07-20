import React from 'react';

const VEHICLE_LABEL: Record<string, string> = { car: 'Mobil', motorcycle: 'Motor', truck: 'Truk' };

export const TicketPrintout: React.FC<{
  ticketNumber: string;
  plateNumber: string;
  vehicleType: string;
  entryTime: string;
  gateName: string;
}> = ({ ticketNumber, plateNumber, vehicleType, entryTime, gateName }) => {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#111', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>SMART PARKING</div>
      <div style={{ fontSize: 11, marginBottom: 10 }}>Tiket Masuk Kendaraan</div>
      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, margin: '10px 0' }}>{plateNumber}</div>

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="No. Tiket" value={ticketNumber} />
        <Row label="Jenis"     value={VEHICLE_LABEL[vehicleType] || vehicleType} />
        <Row label="Gate"      value={gateName} />
        <Row label="Waktu Masuk" value={new Date(entryTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} />
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '10px 0' }} />
      <div style={{ fontSize: 10, color: '#555' }}>
        Simpan tiket ini. Tunjukkan saat keluar untuk proses pembayaran.
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontWeight: 600 }}>{value}</span>
  </div>
);
