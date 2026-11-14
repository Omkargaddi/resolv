package main

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"resolv-backend/internal/config"
	"resolv-backend/internal/database"
	"resolv-backend/internal/models"
	"resolv-backend/internal/redis"
)

func main() {
	log.Println("[INFO] Starting database seeding...")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load config: %v", err)
	}

	ctx := context.Background()
	db, err := database.NewDB(ctx, cfg)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect database: %v", err)
	}
	defer db.Close()

	rdb, err := redis.NewClient(cfg)
	if err != nil {
		log.Printf("[WARN] Redis connection warning: %v", err)
	} else {
		defer func() { _ = rdb.Close() }()
	}

	// Seed Admin
	seedUser(ctx, db, "System Admin", "admin@reserve.local", "AdminPassword123!", models.UserRoleAdmin, nil)

	// Seed Members
	phone1 := "+1234567890"
	seedUser(ctx, db, "John Doe", "user@example.com", "securepass", models.UserRoleMember, &phone1)

	phone2 := "+1987654321"
	seedUser(ctx, db, "Alice Smith", "alice@example.com", "securepass", models.UserRoleMember, &phone2)

	// Seed Slots
	sampleVenueID := "11111111-1111-1111-1111-111111111111"
	var slotCount int
	err = db.Pool.QueryRow(ctx, "SELECT count(*) FROM slots WHERE venue_id = $1", sampleVenueID).Scan(&slotCount)
	if err != nil {
		log.Fatalf("[FATAL] Failed to check slots: %v", err)
	}

	if slotCount == 0 {
		now := time.Now()
		totalSeeded := 0

		for dayOffset := 0; dayOffset < 7; dayOffset++ {
			slotDate := now.AddDate(0, 0, dayOffset)
			dateStr := slotDate.Format("2006-01-02")

			times := []struct {
				startHour int
				endHour   int
				price     float64
			}{
				{10, 11, 25.0},
				{14, 15, 30.0},
				{18, 19, 50.0},
			}

			for _, t := range times {
				startTime := time.Date(slotDate.Year(), slotDate.Month(), slotDate.Day(), t.startHour, 0, 0, 0, time.UTC)
				endTime := time.Date(slotDate.Year(), slotDate.Month(), slotDate.Day(), t.endHour, 0, 0, 0, time.UTC)

				query := `
					INSERT INTO slots (venue_id, date, start_time, end_time, capacity, remaining_capacity, status, duration_minutes, price, currency, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
				`
				_, err := db.Pool.Exec(ctx, query,
					sampleVenueID, dateStr, startTime, endTime,
					4, 4, models.SlotStatusAvailable, 60, t.price, "USD",
				)
				if err != nil {
					log.Printf("[ERROR] Failed to insert slot: %v", err)
				} else {
					totalSeeded++
				}
			}
		}
		log.Printf("[INFO] Seeded %d slots for venue %s", totalSeeded, sampleVenueID)
	} else {
		log.Printf("[INFO] Slots already exist for venue %s (%d slots)", sampleVenueID, slotCount)
	}

	log.Println("[INFO] Database seeding completed successfully.")
}

func seedUser(ctx context.Context, db *database.DB, name, email, password string, role models.UserRole, phone *string) {
	var existingID string
	err := db.Pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&existingID)
	if err == nil {
		log.Printf("[INFO] User already exists: %s", email)
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("[ERROR] Failed to check user %s: %v", email, err)
		return
	}

	u := &models.User{
		Name:     name,
		Email:    email,
		Role:     role,
		Phone:    phone,
		IsActive: true,
	}
	if err := u.HashPassword(password); err != nil {
		log.Printf("[ERROR] Failed to hash password for %s: %v", email, err)
		return
	}

	query := `
		INSERT INTO users (name, email, password, phone, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`
	_, err = db.Pool.Exec(ctx, query, u.Name, u.Email, u.Password, u.Phone, u.Role, u.IsActive)
	if err != nil {
		log.Printf("[ERROR] Failed to insert user %s: %v", email, err)
		return
	}
	log.Printf("[INFO] Seeded %s: %s / %s", role, email, password)
}
