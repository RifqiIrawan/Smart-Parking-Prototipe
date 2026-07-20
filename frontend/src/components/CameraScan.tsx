import React, { useState, useEffect, useRef } from 'react';
import { Camera, X } from 'lucide-react';

// Reusable OCR camera-scan modal: opens the device camera, lets the user
// snap a frame, and sends it to the OCR service for plate detection.
// Used by the Billing, Entry, and Exit pages.
export const CameraScan: React.FC<{
  onPlateDetected: (plate: string, imageBase64: string) => void;
  onClose: () => void;
}> = ({ onPlateDetected, onClose }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState('');
  const [detected, setDetected] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { setError('Tidak bisa mengakses kamera. Pastikan izin kamera diizinkan.'); }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanning(true); setError(''); setDetected('');

    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width  = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1];

    try {
      const res = await fetch('http://localhost:8000/ocr/plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, enhance: true }),
      });
      const data = await res.json();

      if (data.success && data.plate_number) {
        setDetected(data.plate_number);
        setTimeout(() => { onPlateDetected(data.plate_number, base64); }, 800);
      } else {
        setError('Plat nomor tidak terdeteksi. Coba lagi atau input manual.');
      }
    } catch {
      setError('OCR Service tidak tersedia. Gunakan input manual.');
    } finally { setScanning(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 480, padding: '0 1rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#fff' }}>📷 Scan Plat Nomor</div>
        <button onClick={onClose} style={{ background: '#ffffff20', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#fff' }}><X size={16} /></button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', display: 'block', background: '#000' }} playsInline muted />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ border: '2px solid #38bdf8', borderRadius: 8, width: '70%', height: 80, boxShadow: '0 0 0 9999px rgba(0,0,0,.5)' }} />
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>
          Arahkan plat nomor ke dalam kotak
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {detected && (
        <div style={{ background: '#22c55e20', border: '1px solid #22c55e', borderRadius: 10, padding: '12px 24px', fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#22c55e', letterSpacing: 4 }}>
          ✓ {detected}
        </div>
      )}

      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#ef4444', maxWidth: 480, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={captureAndScan}
        disabled={scanning}
        style={{ gap: 8, fontSize: 15, padding: '12px 32px' }}
      >
        {scanning ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Memindai…</> : <><Camera size={18} /> Foto & Scan Sekarang</>}
      </button>
    </div>
  );
};
