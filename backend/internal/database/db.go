package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"resolv-backend/internal/config"
)

type DB struct {
	Pool *pgxpool.Pool
}

func NewDB(ctx context.Context, cfg *config.Config) (*DB, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %w", err)
	}

	poolConfig.MaxConns = int32(cfg.DBPoolSize)
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	db := &DB{Pool: pool}
	if err := db.Migrate(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database migration failed: %w", err)
	}

	log.Println("[INFO] PostgreSQL database connected and schema verified")
	return db, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

func (db *DB) Migrate(ctx context.Context) error {
	schema := `
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";
	CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name VARCHAR(255) NOT NULL,
		email VARCHAR(255) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		phone VARCHAR(20),
		role VARCHAR(50) NOT NULL DEFAULT 'member',
		is_active BOOLEAN NOT NULL DEFAULT true,
		refresh_token VARCHAR(255),
		last_login_at TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

	CREATE TABLE IF NOT EXISTS slots (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		venue_id UUID NOT NULL,
		date DATE NOT NULL,
		start_time TIMESTAMP WITH TIME ZONE NOT NULL,
		end_time TIMESTAMP WITH TIME ZONE NOT NULL,
		capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
		remaining_capacity INT NOT NULL DEFAULT 1 CHECK (remaining_capacity >= 0),
		status VARCHAR(50) NOT NULL DEFAULT 'available',
		duration_minutes INT NOT NULL DEFAULT 30,
		price NUMERIC(10, 2),
		currency VARCHAR(3) NOT NULL DEFAULT 'USD',
		metadata JSONB,
		held_until TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CHECK (end_time > start_time)
	);

	CREATE INDEX IF NOT EXISTS idx_slots_venue_date ON slots (venue_id, date);
	CREATE INDEX IF NOT EXISTS idx_slots_status_date ON slots (status, date);

	CREATE TABLE IF NOT EXISTS bookings (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
		venue_id UUID NOT NULL,
		confirmation_code VARCHAR(12) UNIQUE NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		guest_count INT NOT NULL DEFAULT 1 CHECK (guest_count > 0),
		notes TEXT,
		booking_date DATE NOT NULL,
		cancelled_at TIMESTAMP WITH TIME ZONE,
		cancellation_reason TEXT,
		confirmed_at TIMESTAMP WITH TIME ZONE,
		completed_at TIMESTAMP WITH TIME ZONE,
		total_price NUMERIC(10, 2),
		metadata JSONB,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id);
	CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);
	CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
	CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_code ON bookings (confirmation_code);
	CREATE INDEX IF NOT EXISTS idx_bookings_venue_date ON bookings (venue_id, booking_date);

	-- Reconcile any existing columns from TypeORM if needed
	DO $$
	BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isActive') THEN
			ALTER TABLE users RENAME COLUMN "isActive" TO is_active;
		END IF;
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'refreshToken') THEN
			ALTER TABLE users RENAME COLUMN "refreshToken" TO refresh_token;
		END IF;
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastLoginAt') THEN
			ALTER TABLE users RENAME COLUMN "lastLoginAt" TO last_login_at;
		END IF;
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'createdAt') THEN
			ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
		END IF;
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updatedAt') THEN
			ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
		END IF;
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'totalPrice') THEN
			ALTER TABLE bookings RENAME COLUMN "totalPrice" TO total_price;
		END IF;
	END $$;
	`

	_, err := db.Pool.Exec(ctx, schema)
	return err
}
