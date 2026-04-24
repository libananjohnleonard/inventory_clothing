-- Run this as a PostgreSQL superuser or database owner.
-- 1. Create the database:
--    CREATE DATABASE inventory_clothing;
-- 2. Connect to it:
--    \c inventory_clothing

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS inventory_clothing;

CREATE TABLE IF NOT EXISTS inventory_clothing.admin_users (
    admin_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(120) NOT NULL DEFAULT 'Clothing Inventory Admin',
    workspace_name VARCHAR(160) NOT NULL DEFAULT 'Edmund Clothing Inventory',
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    member_since VARCHAR(40) NOT NULL DEFAULT 'April 2026',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_clothing.clothing_items (
    item_id BIGSERIAL PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(120) NOT NULL,
    sku VARCHAR(40) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    description TEXT NOT NULL DEFAULT '',
    last_update TEXT NOT NULL DEFAULT 'Recently added item',
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_clothing_items_created_at
    ON inventory_clothing.clothing_items (created_at DESC);

CREATE OR REPLACE FUNCTION inventory_clothing.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_clothing_admin_users_updated_at ON inventory_clothing.admin_users;
CREATE TRIGGER trg_inventory_clothing_admin_users_updated_at
BEFORE UPDATE ON inventory_clothing.admin_users
FOR EACH ROW
EXECUTE FUNCTION inventory_clothing.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_clothing_items_updated_at ON inventory_clothing.clothing_items;
CREATE TRIGGER trg_inventory_clothing_items_updated_at
BEFORE UPDATE ON inventory_clothing.clothing_items
FOR EACH ROW
EXECUTE FUNCTION inventory_clothing.set_updated_at();

INSERT INTO inventory_clothing.admin_users (
    full_name,
    role,
    workspace_name,
    email,
    password_hash,
    member_since,
    is_active
)
VALUES (
    'Edmund Admin',
    'Clothing Inventory Admin',
    'Edmund Clothing Inventory',
    'edmund@gmail.com',
    crypt('1234', gen_salt('bf')),
    'April 2026',
    TRUE
)
ON CONFLICT (email) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    workspace_name = EXCLUDED.workspace_name,
    password_hash = crypt('1234', gen_salt('bf')),
    member_since = EXCLUDED.member_since,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO inventory_clothing.clothing_items (
    item_name,
    category,
    sku,
    quantity,
    description,
    last_update,
    image_url
)
VALUES
    (
        'Classic Cotton T-Shirt',
        'Tops',
        'CLTH-TSH-001',
        48,
        'Everyday crew neck cotton t-shirt in assorted sizes.',
        'Recently added item',
        ''
    ),
    (
        'Denim Straight Jeans',
        'Bottoms',
        'CLTH-JNS-002',
        24,
        'Mid-rise straight leg denim jeans ready for retail display.',
        'Recently added item',
        ''
    ),
    (
        'Lightweight Hoodie',
        'Outerwear',
        'CLTH-HOD-003',
        16,
        'Soft fleece hoodie for casual wear and cooler days.',
        'Recently added item',
        ''
    )
ON CONFLICT (sku) DO UPDATE
SET
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    quantity = EXCLUDED.quantity,
    description = EXCLUDED.description,
    last_update = EXCLUDED.last_update,
    image_url = EXCLUDED.image_url,
    updated_at = CURRENT_TIMESTAMP;
