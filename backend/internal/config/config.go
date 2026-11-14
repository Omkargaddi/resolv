package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                         string
	Env                          string
	DatabaseURL                  string
	DBPoolSize                   int
	RedisURL                     string
	JWTSecret                    string
	JWTAccessExpiry              time.Duration
	JWTRefreshExpiry             time.Duration
	CORSOrigin                   string
	MaxBookingAdvanceDays        int
	MaxConcurrentBookingsPerUser int
	BookingCancellationWindow    time.Duration
	WorkerConcurrency            int
	LogLevel                     string
}

func LoadConfig() (*Config, error) {
	// Try loading from .env in current directory or parent directory
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	port := getEnv("PORT", "4000")
	env := getEnv("NODE_ENV", getEnv("APP_ENV", "development"))

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbHost := getEnv("DB_HOST", "localhost")
		dbPort := getEnv("DB_PORT", "5432")
		dbUser := getEnv("DB_USER", "reserve")
		dbPass := getEnv("DB_PASSWORD", "reserve_secret")
		dbName := getEnv("DB_NAME", "reserve_db")
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", dbUser, dbPass, dbHost, dbPort, dbName)
	}

	jwtAccessExpiry := parseDurationWithDays(getEnv("JWT_EXPIRES_IN", "7d"), 7*24*time.Hour)
	jwtRefreshExpiry := parseDurationWithDays(getEnv("JWT_REFRESH_EXPIRES_IN", "30d"), 30*24*time.Hour)

	cancelHours, _ := strconv.Atoi(getEnv("BOOKING_CANCELLATION_WINDOW_HOURS", "24"))
	advanceDays, _ := strconv.Atoi(getEnv("MAX_BOOKING_ADVANCE_DAYS", "90"))
	maxBookings, _ := strconv.Atoi(getEnv("MAX_CONCURRENT_BOOKINGS_PER_USER", "5"))
	poolSize, _ := strconv.Atoi(getEnv("DB_POOL_SIZE", "20"))
	workers, _ := strconv.Atoi(getEnv("WORKER_CONCURRENCY", "5"))

	cfg := &Config{
		Port:                         port,
		Env:                          env,
		DatabaseURL:                  dbURL,
		DBPoolSize:                   poolSize,
		RedisURL:                     getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:                    getEnv("JWT_SECRET", "fallback-dev-secret"),
		JWTAccessExpiry:              jwtAccessExpiry,
		JWTRefreshExpiry:             jwtRefreshExpiry,
		CORSOrigin:                   getEnv("CORS_ORIGIN", "*"),
		MaxBookingAdvanceDays:        advanceDays,
		MaxConcurrentBookingsPerUser: maxBookings,
		BookingCancellationWindow:    time.Duration(cancelHours) * time.Hour,
		WorkerConcurrency:            workers,
		LogLevel:                     getEnv("LOG_LEVEL", "debug"),
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func parseDurationWithDays(raw string, fallback time.Duration) time.Duration {
	raw = strings.TrimSpace(raw)
	if strings.HasSuffix(raw, "d") {
		daysStr := strings.TrimSuffix(raw, "d")
		days, err := strconv.Atoi(daysStr)
		if err == nil {
			return time.Duration(days) * 24 * time.Hour
		}
	}
	d, err := time.ParseDuration(raw)
	if err == nil {
		return d
	}
	return fallback
}
