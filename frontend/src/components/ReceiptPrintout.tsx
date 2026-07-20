import React from 'react';

const Rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export const ReceiptPrintout: React.FC<{
  ticketNumber: string;
  plateNumber: string;
  entryTime: string;
  exitTime?: string;
  durationMinutes: number;
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  memberName?: string;
  totalAmount: number;
  paymentMethod?: string;
}> = ({
  ticketNumber, plateNumber, entryTime, exitTime, durationMinutes,
  subtotal, discountPercent, discountAmount, memberName, totalAmount, paymentMethod,
}) => {
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const durationDisplay = h > 0 ? `${h} jam ${m} menit` : `${m} menit`;

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#111', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>SMART PARKING</div>
      <div style={{ fontSize: 11, marginBottom: 10 }}>Struk Pembayaran Parkir</div>
      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, margin: '8px 0' }}>{plateNumber}</div>

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="No. Tiket"    value={ticketNumber} />
        <Row label="Masuk"        value={new Date(entryTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} />
        <Row label="Keluar"       value={new Date(exitTime || Date.now()).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} />
        <Row label="Durasi"      value={durationDisplay} />
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="Subtotal" value={Rp(subtotal)} />
        {!!discountAmount && (
          <Row label={`Diskon${memberName ? ` (${memberName})` : ''} ${discountPercent}%`} value={`-${Rp(discountAmount)}`} />
        )}
        {paymentMethod && <Row label="Metode Bayar" value={paymentMethod.replace('_', ' ').toUpperCase()} />}
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '10px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
        <span>TOTAL</span>
        <span>{Rp(totalAmount)}</span>
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '10px 0' }} />
      <div style={{ fontSize: 10, color: '#555' }}>Terima kasih telah menggunakan Smart Parking</div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontWeight: 600 }}>{value}</span>
  </div>
);
