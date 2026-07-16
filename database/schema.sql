-- Smart Parking System - Database Schema
-- PostgreSQL

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- TABLE: roles
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name) VALUES ('admin'), ('operator'), ('viewer') ON CONFLICT DO NOTHING;

-- =============================================
-- TABLE: users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role_id    INT REFERENCES roles(id) DEFAULT 2,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: gates
-- =============================================
CREATE TABLE IF NOT EXISTS gates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    type        VARCHAR(10) CHECK (type IN ('entry','exit')) NOT NULL,
    location    VARCHAR(200),
    status      VARCHAR(20) DEFAULT 'closed' CHECK (status IN ('open','closed','error')),
    ip_address  VARCHAR(50),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Re-running this file against a database created before `name` was UNIQUE
-- needs the constraint added explicitly, since CREATE TABLE IF NOT EXISTS
-- won't alter an existing table (see the same fix applied to tariffs below).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'gates_name_key'
    ) THEN
        ALTER TABLE gates ADD CONSTRAINT gates_name_key UNIQUE (name);
    END IF;
END $$;

-- =============================================
-- TABLE: parking_slots
-- =============================================
CREATE TABLE IF NOT EXISTS parking_slots (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_number VARCHAR(20) UNIQUE NOT NULL,
    floor       VARCHAR(10) DEFAULT 'G',
    zone        VARCHAR(10) DEFAULT 'A',
    type        VARCHAR(20) DEFAULT 'regular' CHECK (type IN ('regular','vip','handicap','motorcycle')),
    status      VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: vehicles
-- =============================================
CREATE TABLE IF NOT EXISTS vehicles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    type         VARCHAR(20) DEFAULT 'car' CHECK (type IN ('car','motorcycle','truck')),
    brand        VARCHAR(50),
    color        VARCHAR(30),
    owner_name   VARCHAR(100),
    owner_phone  VARCHAR(20),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: parking_transactions
-- =============================================
CREATE TABLE IF NOT EXISTS parking_transactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number    VARCHAR(30) UNIQUE NOT NULL,
    vehicle_id       UUID REFERENCES vehicles(id),
    slot_id          UUID REFERENCES parking_slots(id),
    entry_gate_id    UUID REFERENCES gates(id),
    exit_gate_id     UUID REFERENCES gates(id),
    entry_time       TIMESTAMPTZ DEFAULT NOW(),
    exit_time        TIMESTAMPTZ,
    duration_minutes INT,
    plate_number     VARCHAR(20) NOT NULL,
    plate_image_in   TEXT,
    plate_image_out  TEXT,
    base_rate        DECIMAL(12,2) DEFAULT 0,
    total_amount     DECIMAL(12,2) DEFAULT 0,
    status           VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
    operator_id      UUID REFERENCES users(id),
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: payments
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id      UUID REFERENCES parking_transactions(id),
    payment_method      VARCHAR(30) CHECK (payment_method IN ('qris','virtual_account','ewallet','cash','card')),
    payment_channel     VARCHAR(50),
    amount              DECIMAL(12,2) NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','refunded')),
    gateway             VARCHAR(20) CHECK (gateway IN ('midtrans','xendit','manual')),
    gateway_order_id    VARCHAR(100),
    gateway_payment_id  VARCHAR(100),
    gateway_response    JSONB,
    paid_at             TIMESTAMPTZ,
    expired_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: payment_logs
-- =============================================
CREATE TABLE IF NOT EXISTS payment_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id   UUID REFERENCES payments(id),
    event        VARCHAR(50),
    payload      JSONB,
    source       VARCHAR(50),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: tariffs
-- =============================================
CREATE TABLE IF NOT EXISTS tariffs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type    VARCHAR(20) NOT NULL UNIQUE,
    first_hour_rate DECIMAL(12,2) NOT NULL,
    next_hour_rate  DECIMAL(12,2) NOT NULL,
    max_daily_rate  DECIMAL(12,2),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Re-running this file against a database created before vehicle_type was
-- UNIQUE (e.g. via an older schema.sql) needs the constraint added explicitly,
-- since CREATE TABLE IF NOT EXISTS won't alter an existing table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tariffs_vehicle_type_key'
    ) THEN
        ALTER TABLE tariffs ADD CONSTRAINT tariffs_vehicle_type_key UNIQUE (vehicle_type);
    END IF;
END $$;

INSERT INTO tariffs (vehicle_type, first_hour_rate, next_hour_rate, max_daily_rate) VALUES
('car',        5000, 3000, 50000),
('motorcycle', 2000, 1000, 20000),
('truck',      10000, 7000, 100000)
ON CONFLICT (vehicle_type) DO NOTHING;

-- =============================================
-- TABLE: members (member/langganan discounts)
-- =============================================
CREATE TABLE IF NOT EXISTS members (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number     VARCHAR(20) UNIQUE NOT NULL,
    member_name      VARCHAR(100) NOT NULL,
    phone            VARCHAR(20),
    membership_type  VARCHAR(30) DEFAULT 'monthly',
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    valid_from       DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until      DATE NOT NULL,
    is_active        BOOLEAN DEFAULT TRUE,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_plate ON members(plate_number);

-- Link parking transactions to the member discount applied (if any)
ALTER TABLE parking_transactions ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id);
ALTER TABLE parking_transactions ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_plate ON parking_transactions(plate_number);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON parking_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_entry ON parking_transactions(entry_time);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_slots_status ON parking_slots(status);

-- =============================================
-- SEED: Default Admin User (password: admin123)
-- =============================================
INSERT INTO users (name, email, password, role_id) VALUES
('Administrator', 'admin@smartparking.id', crypt('admin123', gen_salt('bf')), 1)
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- SEED: Sample Gates
-- =============================================
INSERT INTO gates (name, type, location, ip_address) VALUES
('Gate A - Masuk',  'entry', 'Pintu Utara', '192.168.1.10'),
('Gate B - Masuk',  'entry', 'Pintu Selatan', '192.168.1.11'),
('Gate C - Keluar', 'exit',  'Pintu Utara', '192.168.1.12'),
('Gate D - Keluar', 'exit',  'Pintu Selatan', '192.168.1.13')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SEED: Sample Parking Slots (40 slots)
-- =============================================
DO $$
DECLARE
    i INT;
    zone CHAR;
    floor_label VARCHAR;
    types VARCHAR[] := ARRAY['regular','regular','regular','motorcycle','vip'];
BEGIN
    FOR i IN 1..40 LOOP
        zone := CASE WHEN i <= 20 THEN 'A' ELSE 'B' END;
        floor_label := CASE WHEN i <= 20 THEN 'G' ELSE 'L1' END;
        INSERT INTO parking_slots (slot_number, floor, zone, type, status)
        VALUES (
            zone || LPAD((i % 20 + 1)::TEXT, 2, '0'),
            floor_label,
            zone,
            types[((i-1) % 5) + 1],
            CASE WHEN RANDOM() > 0.6 THEN 'occupied' ELSE 'available' END
        ) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
