-- Sample data untuk demo halaman Billing (/billing)
-- Membuat kendaraan + transaksi parkir aktif dengan berbagai durasi & jenis kendaraan

DO $$
DECLARE
    v_location   UUID := (SELECT id FROM locations WHERE code = 'PST');
    v_gate_a     UUID := (SELECT id FROM gates WHERE name = 'Gate A - Masuk');
    v_gate_b     UUID := (SELECT id FROM gates WHERE name = 'Gate B - Masuk');
    v_op         UUID := (SELECT id FROM users WHERE email = 'admin@smartparking.id');
BEGIN
    -- 1) Mobil, baru masuk 20 menit lalu, slot A04
    INSERT INTO vehicles (plate_number, type, brand, color, owner_name, owner_phone)
    VALUES ('B1234ABC', 'car', 'Toyota Avanza', 'Hitam', 'Budi Santoso', '081234567801')
    ON CONFLICT (plate_number) DO NOTHING;

    INSERT INTO parking_transactions
        (ticket_number, vehicle_id, slot_id, entry_gate_id, entry_time, plate_number, base_rate, status, operator_id, location_id)
    SELECT
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-1001',
        (SELECT id FROM vehicles WHERE plate_number = 'B1234ABC'),
        (SELECT id FROM parking_slots WHERE slot_number = 'A04'),
        v_gate_a, NOW() - INTERVAL '20 minutes', 'B1234ABC', 5000, 'active', v_op, v_location
    WHERE NOT EXISTS (
        SELECT 1 FROM parking_transactions WHERE plate_number = 'B1234ABC' AND status = 'active'
    );

    -- 2) Motor, masuk 45 menit lalu, slot A07
    INSERT INTO vehicles (plate_number, type, brand, color, owner_name, owner_phone)
    VALUES ('B5678XYZ', 'motorcycle', 'Honda Beat', 'Merah', 'Siti Aminah', '081234567802')
    ON CONFLICT (plate_number) DO NOTHING;

    INSERT INTO parking_transactions
        (ticket_number, vehicle_id, slot_id, entry_gate_id, entry_time, plate_number, base_rate, status, operator_id, location_id)
    SELECT
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-1002',
        (SELECT id FROM vehicles WHERE plate_number = 'B5678XYZ'),
        (SELECT id FROM parking_slots WHERE slot_number = 'A07'),
        v_gate_b, NOW() - INTERVAL '45 minutes', 'B5678XYZ', 2000, 'active', v_op, v_location
    WHERE NOT EXISTS (
        SELECT 1 FROM parking_transactions WHERE plate_number = 'B5678XYZ' AND status = 'active'
    );

    -- 3) Mobil, masuk 2 jam 30 menit lalu, slot A09
    INSERT INTO vehicles (plate_number, type, brand, color, owner_name, owner_phone)
    VALUES ('D9012DEF', 'car', 'Honda Jazz', 'Putih', 'Andi Wijaya', '081234567803')
    ON CONFLICT (plate_number) DO NOTHING;

    INSERT INTO parking_transactions
        (ticket_number, vehicle_id, slot_id, entry_gate_id, entry_time, plate_number, base_rate, status, operator_id, location_id)
    SELECT
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-1003',
        (SELECT id FROM vehicles WHERE plate_number = 'D9012DEF'),
        (SELECT id FROM parking_slots WHERE slot_number = 'A09'),
        v_gate_a, NOW() - INTERVAL '2 hours 30 minutes', 'D9012DEF', 5000, 'active', v_op, v_location
    WHERE NOT EXISTS (
        SELECT 1 FROM parking_transactions WHERE plate_number = 'D9012DEF' AND status = 'active'
    );

    -- 4) Truk, masuk 6 jam lalu (untuk uji tarif maksimal harian), slot A11
    INSERT INTO vehicles (plate_number, type, brand, color, owner_name, owner_phone)
    VALUES ('B7788TRK', 'truck', 'Mitsubishi Colt Diesel', 'Kuning', 'Joko Prasetyo', '081234567804')
    ON CONFLICT (plate_number) DO NOTHING;

    INSERT INTO parking_transactions
        (ticket_number, vehicle_id, slot_id, entry_gate_id, entry_time, plate_number, base_rate, status, operator_id, location_id)
    SELECT
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-1004',
        (SELECT id FROM vehicles WHERE plate_number = 'B7788TRK'),
        (SELECT id FROM parking_slots WHERE slot_number = 'A11'),
        v_gate_b, NOW() - INTERVAL '6 hours', 'B7788TRK', 10000, 'active', v_op, v_location
    WHERE NOT EXISTS (
        SELECT 1 FROM parking_transactions WHERE plate_number = 'B7788TRK' AND status = 'active'
    );

    -- 5) Mobil dengan tagihan pending payment, masuk 3 jam lalu, slot A12
    INSERT INTO vehicles (plate_number, type, brand, color, owner_name, owner_phone)
    VALUES ('F3344GHI', 'car', 'Suzuki Ertiga', 'Silver', 'Dewi Lestari', '081234567805')
    ON CONFLICT (plate_number) DO NOTHING;

    INSERT INTO parking_transactions
        (ticket_number, vehicle_id, slot_id, entry_gate_id, entry_time, plate_number, base_rate, status, operator_id, location_id)
    SELECT
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-1005',
        (SELECT id FROM vehicles WHERE plate_number = 'F3344GHI'),
        (SELECT id FROM parking_slots WHERE slot_number = 'A12'),
        v_gate_a, NOW() - INTERVAL '3 hours', 'F3344GHI', 5000, 'active', v_op, v_location
    WHERE NOT EXISTS (
        SELECT 1 FROM parking_transactions WHERE plate_number = 'F3344GHI' AND status = 'active'
    );

    INSERT INTO payments (transaction_id, gateway_order_id, amount, payment_method, status, expired_at)
    SELECT
        t.id, 'ORDER-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-1005', 17000, 'qris', 'pending', NOW() + INTERVAL '15 minutes'
    FROM parking_transactions t
    WHERE t.plate_number = 'F3344GHI' AND t.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM payments p WHERE p.transaction_id = t.id AND p.status IN ('pending','created')
    );

    -- Tandai slot yang dipakai sebagai occupied
    UPDATE parking_slots SET status = 'occupied'
    WHERE slot_number IN ('A04','A07','A09','A11','A12') AND location_id = v_location;
END $$;
